// Claude (Anthropic) as an AI provider (owner 27.11.2026). Every provider call is mocked; nothing reaches the network.
// Run after `corepack pnpm build` (the second part loads dist/server).
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {readFileSync,readdirSync,realpathSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(realpathSync('node_modules/wrangler')+'/package.json'),{build}=require('esbuild'),{Miniflare}=require('miniflare');
let checks=0;

// Part 1: the request module alone, with a fake outbound fetch.
const bundle=await build({stdin:{contents:`export * from './lib/anthropic-request';`,resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false,plugins:[{name:'isolated-runtime',setup(b){b.onResolve({filter:/^\.\/server$/},a=>({path:a.path,namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export class ApiError extends Error{constructor(status,message){super(message);this.status=status;}}',loader:'js'}));}}]});
const {anthropicJson,anthropicModelCheck,jsonObjectText}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const key='FAKE_ANTHROPIC_KEY_FOR_LOCAL_TEST_ONLY';
const reply=(text,stop='end_turn')=>Response.json({id:'msg_test',type:'message',role:'assistant',model:'claude-opus-5-5',content:[{type:'thinking',thinking:'',signature:'x'},{type:'text',text}],stop_reason:stop,stop_details:null,usage:{input_tokens:1,output_tokens:1}});
const seen=[];
const outbound=(respond)=>async(url,init,timeout)=>{const headers=new Headers(init.headers);seen.push({url,method:init.method||'GET',headers,body:init.body?JSON.parse(init.body):null,timeout});return respond();};
let raw=await anthropicJson(key,'claude-opus-5-5','כתוב JSON',outbound(()=>reply('הנה התשובה:\n```json\n{"title":"כותרת","content":"<p>תוכן</p>"}\n```')));
let call=seen.at(-1);
assert.equal(call.url,'https://api.anthropic.com/v1/messages');assert.equal(call.method,'POST');
assert.equal(call.headers.get('x-api-key')||call.headers.get('authorization'),call.headers.get('x-api-key')?key:'Bearer '+key,'the SDK sends the key in a header only');assert(!call.url.includes(key));assert(call.headers.get('anthropic-version'));assert.match(call.headers.get('anthropic-beta')||'',/server-side-fallback-2026-07-01/);
assert.equal(call.body.model,'claude-opus-5-5');assert.equal(call.body.max_tokens,16000);assert.deepEqual(call.body.output_config,{effort:'medium'});assert.equal(call.body.fallbacks,'default');
for(const banned of ['thinking','temperature','top_p','top_k','budget_tokens','betas'])assert(!(banned in call.body),'never sends '+banned);
assert.equal(call.body.messages.length,1);assert.equal(call.body.messages[0].role,'user','no assistant prefill');
assert(call.timeout>45000&&call.timeout<120000,'one attempt fits the 120-second article job');
assert.deepEqual(JSON.parse(raw),{title:'כותרת',content:'<p>תוכן</p>'});checks++;
raw=await anthropicJson(key,'claude-sonnet-5-5','x',outbound(()=>reply('{"a":1}')));assert.equal(seen.at(-1).body.fallbacks,'default');assert.equal(raw,'{"a":1}');checks++;
await anthropicJson(key,'claude-haiku-5-5','x',outbound(()=>reply('{"a":1}')));call=seen.at(-1);
assert.equal(call.url,'https://api.anthropic.com/v1/messages');assert(!call.headers.get('anthropic-beta'),'Haiku has no server-side fallback');assert(!('fallbacks' in call.body));checks++;
const fails=async(respond,text,model='claude-opus-5-5')=>{const before=seen.length;await assert.rejects(anthropicJson(key,model,'private prompt',outbound(respond)),e=>e.status===502&&e.message.includes(text)&&!e.message.includes(key)&&!e.message.includes('private'));assert.equal(seen.length,before+1,'no automatic retry');checks++;};
await fails(()=>reply('','refusal'),'סירב');
await fails(()=>reply('{"title":"חצי','max_tokens'),'נקטעה');
await fails(()=>reply('   '),'לא התקבל תוכן');
const apiError=(status,type)=>()=>Response.json({type:'error',error:{type,message:'provider text '+key}},{status});
await fails(apiError(401,'authentication_error'),'מפתח Claude לא אומת');
await fails(apiError(403,'permission_error'),'הרשאה');
await fails(apiError(404,'not_found_error'),'המודל שנבחר לא נמצא');
await fails(apiError(429,'rate_limit_error'),'עמוס');
await fails(apiError(529,'overloaded_error'),'עמוס');
await fails(apiError(500,'api_error'),'אינו זמין');
await fails(apiError(400,'invalid_request_error'),'בדקו מפתח, מודל ויתרה');
await assert.rejects(anthropicJson(key,'claude-opus-5-5','x',async()=>{throw new Error('socket '+key);}),e=>e.status===502&&e.message.includes('נקטע')&&!e.message.includes(key));checks++;
await anthropicModelCheck(key,'claude-opus-5-5',outbound(()=>Response.json({type:'model',id:'claude-opus-5-5',display_name:'Claude Opus 5.5',created_at:'2026-01-01T00:00:00Z'})));
assert.equal(seen.at(-1).url,'https://api.anthropic.com/v1/models/claude-opus-5-5');assert.equal(seen.at(-1).method,'GET');checks++;
assert.equal(jsonObjectText('{"x":{"y":1}}'),'{"x":{"y":1}}');assert.equal(jsonObjectText('```json\n{"x":1}\n```'),'{"x":1}');checks++;

// Part 2: the built app, with Claude answering through Miniflare's outbound service.
const fixtureKey='FAKE_CLAUDE_STORED_KEY_FOR_LOCAL_TEST_ONLY',environmentKey='FAKE_CLAUDE_ENV_KEY_FOR_LOCAL_TEST_ONLY',openaiKey='FAKE_OPENAI_ENV_KEY_FOR_LOCAL_TEST_ONLY';
for(const withEnvironment of [false,true]){
 const calls=[];let mode='ok';
 const mf=new Miniflare({outboundService:async request=>{const url=new URL(request.url);const body=request.method==='POST'?await request.json():null;calls.push({host:url.hostname,path:url.pathname,method:request.method,key:request.headers.get('x-api-key')||String(request.headers.get('authorization')||'').replace(/^Bearer /,''),auth:request.headers.get('authorization'),beta:request.headers.get('anthropic-beta'),body});
   if(url.hostname==='api.openai.com')return Response.json({data:[]});
   assert.equal(url.hostname,'api.anthropic.com');
   if(mode==='denied')return Response.json({type:'error',error:{type:'authentication_error',message:'bad key '+fixtureKey}},{status:401});
   if(request.method==='GET')return Response.json({type:'model',id:url.pathname.split('/').pop(),display_name:'test',created_at:'2026-01-01T00:00:00Z'});
   const prompt=body.messages[0].content;const text=prompt.includes('אסטרטגיית תוכן')?'{"title":"אסטרטגיה מ-Claude","goals":"בדיקה","articles":[]}':'{"title":"מאמר Claude בבדיקה","content":"<p>תוכן בדיקה מקומי.</p>","meta_description":"בדיקה"}';
   return Response.json({id:'msg_test',type:'message',role:'assistant',model:body.model,content:[{type:'text',text}],stop_reason:'end_turn',stop_details:null,usage:{input_tokens:1,output_tokens:1}});},
  modules:[{type:'ESModule',path:'dist/server/index.js'},...readdirSync('dist/server',{recursive:true}).filter(p=>/\.(m?js)$/.test(p)&&p!=='index.js').map(p=>({type:'ESModule',path:'dist/server/'+p}))],compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],r2Buckets:['BUCKET'],bindings:{SETTINGS_ENCRYPTION_KEY:randomBytes(32).toString('base64'),POSTFLOW_OWNER_EMAIL:'owner@example.test',OPENAI_API_KEY:openaiKey,...(withEnvironment?{ANTHROPIC_API_KEY:environmentKey}:{})},assets:{directory:'dist/client',binding:'ASSETS',routerConfig:{has_user_worker:true,invoke_user_worker_ahead_of_assets:true}},cf:false});
 async function req(path,method='GET',body,user='owner',expected=200){const headers={'Content-Type':'application/json'};if(user){headers['oai-authenticated-user-id']=user;headers['oai-authenticated-user-email']=user+'@example.test';}const response=await mf.dispatchFetch('https://postflow.test/api/'+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});const result=await response.json();assert.equal(response.status,expected,`${method} ${path}: ${JSON.stringify(result)}`);for(const k of [fixtureKey,environmentKey,openaiKey])assert(!JSON.stringify(result).includes(k),'no response echoes a key');checks++;return result;}
 const stored=async()=>JSON.parse((await db.prepare("SELECT value FROM settings WHERE key='integration_ai'").first())?.value||'{}');
 let db;
 try{
  db=await mf.getD1Database('DB');for(const migration of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())for(const part of readFileSync('drizzle/'+migration,'utf8').split('--> statement-breakpoint').map(x=>x.trim()).filter(Boolean))await db.prepare(part).run();
  await req('me');await req('me','GET',undefined,'client');
  let ai=(await req('admin/settings')).connections.ai;
  assert.equal(ai.provider,'anthropic','a new AI connection defaults to Claude');assert.equal(ai.environment_key,'ANTHROPIC_API_KEY');assert.equal(ai.has_environment_secret,withEnvironment);checks++;
  // A row saved before providers were explicit was OpenAI and stays OpenAI.
  await db.prepare('INSERT INTO settings(key,value) VALUES (?,?)').bind('integration_ai',JSON.stringify({enabled:true,secret_storage:'environment',model:'gpt-4.1-mini'})).run();
  ai=(await req('admin/settings')).connections.ai;assert.equal(ai.provider,'openai');assert.equal(ai.environment_key,'OPENAI_API_KEY');assert(ai.has_secret);checks++;
  await req('admin/integration/ai/test','POST',{});assert.equal(calls.at(-1).host,'api.openai.com');assert.equal(calls.at(-1).auth,'Bearer '+openaiKey);checks++;
  await req('admin/integration/ai','PATCH',{enabled:true,secret_storage:'environment'});assert.equal((await stored()).provider,'openai','saving keeps the legacy provider and writes it down');checks++;
  // Claude with a key stored encrypted on the server.
  await req('admin/integration/ai','PATCH',{provider:'anthropic',model:'gpt-4.1-mini',secret_storage:'encrypted_server',secret:fixtureKey,enabled:true},'owner',400);
  await req('admin/integration/ai','PATCH',{provider:'anthropic',model:'claude-sonnet-5-5',secret_storage:'encrypted_server',secret:fixtureKey,enabled:true},'client',403);
  await req('admin/integration/ai','PATCH',{provider:'anthropic',model:'claude-sonnet-5-5',secret_storage:'encrypted_server',secret:fixtureKey,enabled:true});
  let row=await db.prepare("SELECT value FROM settings WHERE key='integration_ai'").first();let saved=JSON.parse(row.value);
  assert.equal(saved.provider,'anthropic');assert.equal(saved.model,'claude-sonnet-5-5');assert(saved.secret&&!row.value.includes(fixtureKey),'only ciphertext is stored');checks++;
  ai=(await req('admin/settings')).connections.ai;assert.equal(ai.provider,'anthropic');assert(ai.has_secret&&ai.has_stored_secret&&!('secret' in ai));checks++;
  await req('admin/integration/ai/test','POST',{});assert.deepEqual([calls.at(-1).method,calls.at(-1).path,calls.at(-1).key],['GET','/v1/models/claude-sonnet-5-5',fixtureKey]);checks++;
  const strategy=await req('strategy-generate','POST',{brand:'מותג בדיקה',topic:'בדיקות'});assert.equal(strategy.title,'אסטרטגיה מ-Claude');
  const sent=calls.at(-1);assert.equal(sent.path,'/v1/messages');assert.equal(sent.key,fixtureKey);assert.match(sent.beta||'',/server-side-fallback-2026-07-01/);assert.equal(sent.body.model,'claude-sonnet-5-5');assert.equal(sent.body.fallbacks,'default');assert(!('thinking' in sent.body)&&!('temperature' in sent.body));checks++;
  await req('admin/integration/ai','PATCH',{provider:'anthropic',model:'claude-haiku-5-5',secret_storage:'encrypted_server',secret:'',enabled:true});assert.equal((await stored()).secret,saved.secret,'blank input keeps the stored key');checks++;
  await db.prepare('INSERT INTO websites(id,name,url,category,price,dr,active,data,updated) VALUES (?,?,?,?,?,?,?,?,?)').bind('claude-site','אתר בדיקה','https://example.test','general',10000,50,1,JSON.stringify({procurement_verified:true,cost_cents:5000}),'2026-11-27').run();
  await db.prepare('INSERT INTO orders(id,user_id,number,status,subtotal,vat,total,payment,paid,data,idempotency,created,updated) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)').bind('claude-order','client','#9100','paid',10000,1800,11800,'invoice',1,'{}','claude-order','2026-11-27','2026-11-27').run();
  await db.prepare('INSERT INTO articles(id,order_id,user_id,website_id,status,title,data,updated) VALUES (?,?,?,?,?,?,?,?)').bind('claude-article','claude-order','client','claude-site','draft','',JSON.stringify({topic:'בדיקת כתיבה',words:400,editorial:false}),'2026-11-27').run();
  await req('articles/claude-article/generate','POST',{},'client');const article=(await req('articles/claude-article','GET',undefined,'client')).article;
  assert.equal(article.title,'מאמר Claude בבדיקה');assert.equal(calls.at(-1).body.model,'claude-haiku-5-5');assert(!calls.at(-1).beta&&!('fallbacks' in calls.at(-1).body),'Haiku request has no fallback');checks++;
  mode='denied';const failed=await req('admin/integration/ai/test','POST',{},'owner',502);assert(failed.error.includes('מפתח Claude לא אומת'));mode='ok';checks++;
  const activity=await db.prepare('SELECT data FROM activity').all();assert(!JSON.stringify(activity.results).includes(fixtureKey),'audit holds no key');checks++;
  // Environment mode: the key comes only from ANTHROPIC_API_KEY.
  await req('admin/integration/ai','PATCH',{provider:'anthropic',model:'claude-opus-5-5',secret_storage:'environment',secret:fixtureKey,enabled:true},'owner',400);
  await req('admin/integration/ai','PATCH',{provider:'anthropic',model:'claude-opus-5-5',secret_storage:'environment',enabled:true},'owner',withEnvironment?200:400);
  if(withEnvironment){saved=await stored();assert.equal(saved.secret,'');assert.equal(saved.secret_storage,'environment');await req('admin/integration/ai/test','POST',{});assert.equal(calls.at(-1).key,environmentKey);assert.equal(calls.at(-1).path,'/v1/models/claude-opus-5-5');checks++;}
 }finally{await mf.dispose();}
}
console.log('ANTHROPIC PROVIDER PASSED:',checks,'checks: request shape, fallbacks on Opus/Sonnet only, refusal/length/error messages without keys, Claude as the new default, legacy OpenAI rows kept, encrypted and environment keys, connection test, strategy and article generation. All provider calls were mocked.');
