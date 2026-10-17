import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {readFileSync,realpathSync,readdirSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(realpathSync('node_modules/wrangler')+'/package.json'),{Miniflare}=require('miniflare');
const syncKey=randomBytes(32).toString('base64url');
const mf=new Miniflare({modules:[{type:'ESModule',path:'dist/server/index.js'},...readdirSync('dist/server',{recursive:true}).filter(p=>/\.(m?js)$/.test(p)&&p!=='index.js').map(p=>({type:'ESModule',path:'dist/server/'+p}))],compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],r2Buckets:['BUCKET'],bindings:{SETTINGS_ENCRYPTION_KEY:randomBytes(32).toString('base64'),POSTFLOW_OWNER_EMAIL:'owner@example.test',POSTFLOW_SHEETS_SYNC_KEY:syncKey},assets:{directory:'dist/client',binding:'ASSETS',routerConfig:{has_user_worker:true,invoke_user_worker_ahead_of_assets:true}},cf:false});
async function req(path,method='GET',body,user='owner',status=200,authorization){const headers={'Content-Type':'application/json'};if(user){headers['oai-authenticated-user-id']=user;headers['oai-authenticated-user-email']=user+'@example.test';}if(authorization)headers.Authorization=authorization;const res=await mf.dispatchFetch('https://postflow.test/api/'+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});const j=await res.json();assert.equal(res.status,status,JSON.stringify(j));return j;}
const sheetId='1_bo5ubja3sLePWSPEVIkc5ySOvhCxRICQBf2VnqNmtE',head=['מזהה אתר','שם האתר','כתובת אתר','קטגוריה','מחיר מחירון ₪','עלות ₪','פעיל','הערות לאתר'];
const push=rows=>({spreadsheet_id:sheetId,sheet_name:'אתרים',nonce:randomUUID(),sent_at:new Date().toISOString(),rows:[head,...rows]});
try{
const database=await mf.getD1Database('DB');for(const m of readdirSync('drizzle').filter(x=>x.endsWith('.sql')).sort())for(const part of readFileSync('drizzle/'+m,'utf8').split('--> statement-breakpoint').map(x=>x.trim()).filter(Boolean))await database.prepare(part).run();
await req('me');await req('me','GET',undefined,'customer');
await req('admin/control-center','GET',undefined,'customer',403);
await req('admin/control-center','POST',{},'owner',405);
const account=await database.prepare("SELECT id FROM users WHERE email='customer@example.test'").first();
for(const [id,paid,status,payment,data] of [['paid',1,'paid','credits',{}],['bank',0,'pending','invoice',{}],['unpaid',0,'pending','card',{}],['demo',0,'demo_paid','demo_card',{demo:true}]]){
 await database.prepare('INSERT INTO orders(id,user_id,number,status,subtotal,vat,total,payment,paid,data,idempotency,created,updated) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(id,account.id,id,status,10000,1800,11800,payment,paid,JSON.stringify(data),id,'2026-10-01','2026-10-01').run();
}
for(const [id,order,status,data] of [['review','paid','admin_review',{}],['unpaid-review','unpaid','admin_review',{}],['write','paid','writing',{editorial:true,writing_requested_at:'2026-10-01'}],['cancel','paid','sent',{cancel_pending:true}]])await database.prepare('INSERT INTO articles(id,order_id,user_id,website_id,status,title,data,updated) VALUES (?,?,?,?,?,?,?,?)').bind(id,order,account.id,'a',status,id,JSON.stringify(data),'2026-10-01').run();
for(const [id,kind,data] of [['topup','wallet_topup',{decision:'pending',amount_cents:10000}],['legacy-topup','ticket',{payment_method:'bank_transfer',amount_cents:10000}],['support','ticket',{status:'open'}],['closed','ticket',{status:'closed'}]])await database.prepare('INSERT INTO records(id,kind,user_id,data,created,updated) VALUES (?,?,?,?,?,?)').bind(id,kind,account.id,JSON.stringify(data),'2026-10-01','2026-10-01').run();
let control=await req('admin/control-center');const counts=Object.fromEntries(control.queues.map(q=>[q.id,q.count]));
assert.equal(counts.content,1);assert.equal(counts.writing,1);assert.equal(counts.bank,1);assert.equal(counts.invoices,1);assert.equal(counts.topups,2);assert.equal(counts.support,1);assert.equal(counts.cancellations,1);assert.equal(control.cancellations[0].id,'cancel');
await database.prepare("UPDATE records SET data=json_set(data,'$.status','closed') WHERE id='support'").run();assert.equal((await req('admin/control-center')).queues.find(q=>q.id==='support').count,0);
console.log('Admin control center: admin-only access, read-only methods, paid-content eligibility, invoice/demo separation, legacy topups, closed support, and cancellation drilldown passed.');
await database.prepare('INSERT INTO websites(id,name,url,category,price,dr,active,data,updated) VALUES (?,?,?,?,?,?,?,?,?)').bind('a','אתר א','https://a.example/','general',20000,0,1,JSON.stringify({cost_cents:10000,public_notes:'ישן'}),'2026-01-01').run();
await req('admin/sheets','GET',undefined,'customer',403);await req('admin/sheets/token','POST',{confirm:true},'customer',403);
assert.equal((await req('admin/sheets/token','POST',{confirm:true})).token,syncKey);
const payload=push([['a','אתר א','https://a.example/','general',250,'','כן','חדש']]);
await req('sheets-sync/push','POST',payload,null,401);await req('sheets-sync/push','POST',payload,null,401,'Bearer wrong');
await req('sheets-sync/push','POST',{...payload,spreadsheet_id:'wrong'},null,403,'Bearer '+syncKey);
let result=await req('sheets-sync/push','POST',payload,null,200,'Bearer '+syncKey);assert.equal(result.status,'received');assert.equal((await database.prepare('SELECT price FROM websites WHERE id=?').bind('a').first()).price,20000);
await req('admin/sheets/config','POST',{enabled:true});result=await req('sheets-sync/push','POST',push(payload.rows.slice(1)),null,200,'Bearer '+syncKey);assert.equal(result.status,'conflict');const initial=await req('admin/sheets/preview','POST',{});result=await req('admin/sheets/apply','POST',{digest:initial.digest,pricing_version:initial.pricing_version,conflict_policy:'sheet'});assert.equal(result.status,'success');assert.equal(result.saved,1);assert.equal((await database.prepare('SELECT price FROM websites WHERE id=?').bind('a').first()).price,25000);
const repeat=await req('sheets-sync/push','POST',push(payload.rows.slice(1)),null,200,'Bearer '+syncKey);assert(repeat.unchanged_source);
result=await req('sheets-sync/push','POST',push([['a','אתר א','https://a.example/','general',50,'','כן','חדש']]),null,200,'Bearer '+syncKey);assert.equal(result.status,'needs_review');assert.equal((await database.prepare('SELECT price FROM websites WHERE id=?').bind('a').first()).price,25000);
const preview=await req('admin/sheets/preview','POST',{});assert(preview.warning_count>0);await req('admin/sheets/apply','POST',{digest:'wrong',pricing_version:preview.pricing_version,acknowledge:true},'owner',409);
result=await req('admin/sheets/apply','POST',{digest:preview.digest,pricing_version:preview.pricing_version,acknowledge:true});assert.equal(result.status,'success');assert.equal((await database.prepare('SELECT price FROM websites WHERE id=?').bind('a').first()).price,5000);
result=await req('sheets-sync/push','POST',push([['a','אתר א','https://a.example/','general','bad','','כן','bad']]),null,200,'Bearer '+syncKey);assert.equal(result.status,'invalid');assert.equal((await database.prepare('SELECT price FROM websites WHERE id=?').bind('a').first()).price,5000);
assert.equal((await req('admin/sheets')).key_configured,true);assert(!(JSON.stringify(await req('admin/sheets')).includes(syncKey)));
console.log('Sheets server: administrator access, private token, scoped source, staged receipt, automatic update, repeat delivery, price warning approval, stale snapshot rejection, invalid-row protection passed.');
}finally{await mf.dispose();}
