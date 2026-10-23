import assert from 'node:assert/strict';
import {readFileSync,readdirSync,realpathSync} from 'node:fs';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
const require=createRequire(realpathSync('node_modules/wrangler')+'/package.json'),{Miniflare}=require('miniflare');

export async function createAdminFixture(){
 const mf=new Miniflare({modules:[{type:'ESModule',path:'dist/server/index.js'},...readdirSync('dist/server',{recursive:true}).filter(p=>/\.(m?js)$/.test(p)&&p!=='index.js').map(p=>({type:'ESModule',path:'dist/server/'+p}))],compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],r2Buckets:['BUCKET'],bindings:{POSTFLOW_OWNER_EMAIL:'owner@example.test'},assets:{directory:'dist/client',binding:'ASSETS',routerConfig:{has_user_worker:true,invoke_user_worker_ahead_of_assets:false}},cf:false});
 const db=await mf.getD1Database('DB');
 for(const file of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())for(const sql of readFileSync('drizzle/'+file,'utf8').split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean))await db.prepare(sql).run();
 const headers={'oai-authenticated-user-id':'owner','oai-authenticated-user-email':'owner@example.test'};
 const request=(path,init={})=>mf.dispatchFetch('http://admin.test'+path,{...init,headers:{...headers,...init.headers}});
 const json=async(path)=>{const r=await request(path);const b=await r.json();assert.equal(r.status,200,path+' '+JSON.stringify(b));return b;};
 await json('/api/me');
 const stamp=new Date().toISOString();
 for(const [id,name,role] of [['buyer','אשר כהן','customer'],['noa','נועה לוי','customer'],['supplier','ספק בדיקה','supplier']])await db.prepare('INSERT INTO users(id,email,name,role,created) VALUES(?,?,?,?,?)').bind(id,id+'@example.test',name,role,stamp).run();
 await db.prepare('INSERT INTO websites(id,name,url,category,price,dr,active,data,updated) VALUES(?,?,?,?,?,?,?,?,?)').bind('site','ישראל היום','https://www.israelhayom.co.il','news',125000,85,1,JSON.stringify({procurement_verified:true,ur:44,logo_url:'/brand/loader-m.png',cost_cents:70000,supplier_id:'supplier',supplier_email:'supplier@example.test',supplier_stock:50}),stamp).run();
 for(const [id,number,payment,paid,total,status] of [['bank','#1005','bank_transfer',0,383500,'pending'],['card','#1004','card',1,236000,'in_progress'],['wallet','#1003','credits',1,118000,'in_progress'],['cancel','#1002','credits',1,118000,'cancelled']])await db.prepare('INSERT INTO orders(id,user_id,number,status,subtotal,discount,vat,total,payment,paid,data,idempotency,created,updated) VALUES(?,?,?,?,?,0,?,?,?,?,?,?,?,?)').bind(id,'buyer',number,status,Math.round(total/1.18),total-Math.round(total/1.18),total,payment,paid,JSON.stringify({name:'אשר כהן',phone:'0500000000',vat_percent:18,...(paid?{paid_at:stamp}:{})}),id,stamp,stamp).run();
 for(const [id,status] of [['review','admin_review'],['ready','approved'],['revision','revisions'],['unpaid','admin_review']])await db.prepare('INSERT INTO articles(id,order_id,user_id,website_id,status,title,content,data,updated) VALUES(?,?,?,?,?,?,?,?,?)').bind(id,id==='unpaid'?'bank':'card','buyer','site',status,'איך בוחרים אתר לפרסום?','<p>תוכן בדיקה מקומי</p>',JSON.stringify({price_cents:125000,topic:'פרסום כתבות',editorial_price:0}),stamp).run();
 await db.prepare('INSERT INTO records(id,kind,user_id,data,created,updated) VALUES(?,?,?,?,?,?)').bind('payment-report:bank','customer_payment_report','buyer',JSON.stringify({order_id:'bank',status:'pending',reference:'BANK-TEST',payment_method:'bank_transfer',amount_cents:383500,payment_date:stamp.slice(0,10),request_id:'test-report'}),stamp,stamp).run();
 for(let i=0;i<24;i++)await db.prepare('INSERT INTO records(id,kind,user_id,data,created,updated) VALUES(?,?,?,?,?,?)').bind('ticket-'+i,'ticket','noa',JSON.stringify({name:'בקשה לעדכון '+i,message:'אבקש לעדכן את הכתבה',status:i===23?'answered':'open'}),stamp,stamp).run();
 return {mf,db,headers,request,json};
}

if(import.meta.url===pathToFileURL(process.argv[1]).href){
 const f=await createAdminFixture();let checks=0;
 try{
  for(const identity of [null,'buyer','supplier']){const r=await f.mf.dispatchFetch('http://admin.test/api/admin/control-center/updates',{headers:identity?{'oai-authenticated-user-id':identity,'oai-authenticated-user-email':identity+'@example.test'}:{}});assert.equal(r.status,identity?403:401);checks++;}
  const updates=await f.json('/api/admin/control-center/updates');assert.equal(updates.updates.length,20);assert(updates.total>20);assert.equal(new Set(updates.updates.map(r=>r.id)).size,20);checks+=3;
  const second=await f.json('/api/admin/control-center/updates?page=2');assert(second.updates.length>0);assert(!second.updates.some(r=>updates.updates.some(x=>x.id===r.id)));checks+=2;
  const pages=[...updates.updates,...second.updates];
  for(const [kind,target] of [['article','admin-article/review'],['publication','admin-article/ready'],['revisions','admin-article/revision'],['bank','admin-order/bank'],['support','admin-support/ticket-0'],['paid','admin-order/card']]){assert(pages.some(r=>r.kind===kind&&r.page===target),kind+' exact deep target');checks++;}
  assert(!pages.some(r=>r.resource_id==='unpaid'||r.resource_id==='cancel'||r.resource_id==='ticket-23'));checks++;
  const info=await f.json('/api/admin/control-center/updates?filter=info');assert.equal(info.updates.length,2);assert(info.updates.every(r=>r.needs_action===0));checks+=2;
  const search=await f.json('/api/admin/control-center/updates?q='+encodeURIComponent('#1005'));assert.equal(search.total,1);assert.equal(search.updates[0].amount,383500);checks+=2;
  assert.equal((await f.json('/api/admin/control-center/updates?q=%25')).total,0);assert.equal((await f.json('/api/admin/control-center/updates?page=99999')).page,2);checks+=2;
  const attention=await f.json('/api/admin/control-center');assert.equal(attention.attention_counts['admin-orders'],1,'report and order count once');assert.equal(attention.attention_counts['admin-support'],23);assert.equal(attention.attention_counts['area:admin-support'],23);assert.equal(attention.attention_counts['area:admin-promotions'],0);assert.equal(attention.attention_counts['area:admin-approvals'],3,'article appears in multiple destinations but counts once');checks+=5;
  assert.equal((await f.json('/api/records/ticket/ticket-0')).record.id,'ticket-0');checks++;
  const denied=await f.mf.dispatchFetch('http://admin.test/api/records/ticket/ticket-0',{headers:{'oai-authenticated-user-id':'buyer','oai-authenticated-user-email':'buyer@example.test'}});assert.equal(denied.status,403);checks++;
  for(const path of ['/admin','/admin-order/bank','/admin-support/ticket-0','/admin-knowledge','/admin-pricebooks']){const r=await f.request(path);assert.equal(r.status,200,path);assert(r.headers.get('x-robots-tag')?.includes('noindex'));checks+=2;}
  assert.equal((await f.db.prepare("SELECT paid FROM orders WHERE id='bank'").first()).paid,0,'reading never approves');assert.equal((await f.db.prepare("SELECT status FROM articles WHERE id='review'").first()).status,'admin_review','reading never dispatches');checks+=2;
  console.log('ADMIN GLASS API PASS:',checks,'checks: auth, paginated exact-record feed, literal search, deduplicated actionable badges, routes, noindex, ownership and read-only behavior.');
 }finally{await f.mf.dispose();}
}
