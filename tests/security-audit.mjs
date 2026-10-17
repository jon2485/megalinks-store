import assert from 'node:assert/strict';
import {randomBytes,createCipheriv} from 'node:crypto';
import {readFileSync,readdirSync,realpathSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(realpathSync('node_modules/wrangler')+'/package.json'),{Miniflare}=require('miniflare');
const master=randomBytes(32),iv=randomBytes(12),gemini='fixture-only-gemini-secret',email='fixture-only-email-secret';
const cipher=createCipheriv('aes-256-gcm',master,iv),wrapped=Buffer.concat([iv,cipher.update(gemini),cipher.final(),cipher.getAuthTag()]).toString('base64');
let aiCalls=0;const mail=[];
const mf=new Miniflare({modules:[{type:'ESModule',path:'dist/server/index.js'},...readdirSync('dist/server',{recursive:true}).filter(p=>/\.(m?js)$/.test(p)&&p!=='index.js').map(p=>({type:'ESModule',path:'dist/server/'+p}))],compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],r2Buckets:['BUCKET'],bindings:{SETTINGS_ENCRYPTION_KEY:master.toString('base64'),GEMINI_API_KEY_ENCRYPTED:wrapped,POSTFLOW_EMAIL_SECRET:email,POSTFLOW_OWNER_EMAIL:'owner@example.test'},assets:{directory:'dist/client',binding:'ASSETS',routerConfig:{has_user_worker:true,invoke_user_worker_ahead_of_assets:true}},cf:false,outboundService:async request=>{const url=new URL(request.url);assert(!request.url.includes(gemini)&&!request.url.includes(email));if(url.hostname==='generativelanguage.googleapis.com'){assert.equal(request.headers.get('x-goog-api-key'),gemini);aiCalls++;if(request.method==='GET')return Response.json({supportedGenerationMethods:['generateContent']});return Response.json({candidates:[{content:{parts:[{text:JSON.stringify({title:'בדיקה',goals:'בדיקה',articles:[]})}]}}]});}if(url.hostname==='mail.example.test'){assert.equal(request.headers.get('authorization'),'Bearer '+email);mail.push(await request.json());return Response.json({ok:true});}throw new Error('Unexpected fixture fetch');}});
let checks=0;
async function req(path,method='GET',body,user='owner',status=200,extra={}){const headers={'Content-Type':'application/json',...(user?{'oai-authenticated-user-id':user,'oai-authenticated-user-email':user+'@example.test'}:{}),...extra};const r=await mf.dispatchFetch('https://postflow.test'+path,{method,headers,body:body===undefined?undefined:typeof body==='string'?body:JSON.stringify(body)});const text=await r.text();if(status!==null)assert.equal(r.status,status,method+' '+path+' '+text);for(const secret of [gemini,email,wrapped])assert(!text.includes(secret),'secret absent from response');checks++;return {r,data:JSON.parse(text)};}
try{
const db=await mf.getD1Database('DB');for(const migration of readdirSync('drizzle').filter(p=>p.endsWith('.sql')).sort())for(const part of readFileSync('drizzle/'+migration,'utf8').split('--> statement-breakpoint').map(p=>p.trim()).filter(Boolean))await db.prepare(part).run();
await db.prepare('INSERT INTO settings(key,value) VALUES (?,?)').bind('integration_ai',JSON.stringify({provider:'gemini',model:'gemini-2.5-flash',enabled:true,secret_storage:'encrypted_server',secret:wrapped})).run();
await req('/api/me');const migrated=JSON.parse((await db.prepare("SELECT value FROM settings WHERE key='integration_ai'").first()).value);assert.equal(migrated.secret_storage,'environment');assert(!('secret' in migrated));checks++;
const {data:settings,r}=await req('/api/admin/settings');assert.equal(settings.connections.ai.has_secret,true);assert.equal(settings.connections.ai.secret_storage,'environment');assert.equal(r.headers.get('referrer-policy'),'no-referrer');assert.equal(r.headers.get('x-content-type-options'),'nosniff');checks++;
await req('/api/admin/integration/ai/test','POST',{});
await req('/api/admin/settings','GET',undefined,null,401);await req('/api/admin/settings','GET',undefined,'client',403);
await req('/api/admin/integration/email','PATCH',{enabled:true,url:'https://mail.example.test',secret_storage:'environment'});
for(const payload of [{password:'plaintext'},{api_key:'plaintext'},{secret:{nested:'bad'}},{secret:'plaintext',secret_storage:'environment'},{url:'https://mail.example.test?token=plaintext'},{url:'https://localhost.'},{url:'https://service.local.'},{url:'https://127.0.0.1'},{url:'https://[::1]'},{url:'https://user:password@mail.example.test'}])await req('/api/admin/integration/email','PATCH',payload,'owner',400);
await req('/api/admin/integration/email','PATCH',{enabled:true,url:'https://mail.example.test',secret_storage:'environment'},'owner',403,{origin:'https://attacker.test'});
const storedEmail=(await db.prepare("SELECT value FROM settings WHERE key='integration_email'").first()).value;assert(!storedEmail.includes(email));checks++;
await db.prepare("UPDATE settings SET value=json_set(value,'$.password','legacy-password','$.access_token','legacy-token') WHERE key='integration_email'").run();const clean=(await req('/api/admin/settings')).data.connections.email;assert(!('password' in clean)&&!('access_token' in clean));checks++;
await req('/mcp','POST','null');await req('/mcp','POST',{method:'tools/call',params:{name:'monthly_billing_summary'}},'client',403);
await req('/api/strategy-generate','POST',{brand:'בדיקה',topic:'בדיקה'},null,401);
const before=aiCalls;const attempts=await Promise.all(Array.from({length:9},()=>req('/api/strategy-generate','POST',{brand:'בדיקה',topic:'בדיקה'},'client',null).catch(e=>e)));
// Requests are asserted below because the race may admit any five callers.
const counts=await db.prepare("SELECT data FROM records WHERE kind='security_rate' AND user_id='client'").all();assert.equal(JSON.parse(counts.results[0].data).count,5);assert.equal(aiCalls-before,5);assert(attempts.every(x=>!(x instanceof Error)));checks++;
await req('/api/strategy-generate','POST',{brand:'בדיקה',topic:'בדיקה'},'client',429);
await req('/api/me','PATCH',JSON.stringify({name:'x'.repeat(500010)}),'client',413);
const headers={'Content-Type':'application/json','oai-authenticated-user-id':'client','oai-authenticated-user-email':'client@example.test'};
const stream=new ReadableStream({start(c){c.enqueue(new Uint8Array(300000));c.enqueue(new Uint8Array(300000));c.close();}});const oversized=await mf.dispatchFetch('https://postflow.test/api/me',{method:'PATCH',headers,body:stream,duplex:'half'});assert.equal(oversized.status,413);checks++;
const activities=JSON.stringify((await db.prepare('SELECT data FROM activity').all()).results);assert(!activities.includes(gemini)&&!activities.includes(email)&&!activities.includes(wrapped));checks++;
console.log('SECURITY AUDIT PASSED:',checks,'checks; migration, environment-only use, metadata allowlist, unsafe URLs, authorization, headers, atomic AI budget and chunked body limits. Provider calls mocked.');
}finally{await mf.dispose();}
