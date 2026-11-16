// Per-site billing (owner, 16.11.2026): one supplier may have stock sites and monthly sites. Isolated D1, fictional data.
import assert from 'node:assert/strict';
import {createAdminFixture} from './admin-glass.mjs';
const automation='per-site-billing-local-key-0123456789abcdef';
const f=await createAdminFixture({POSTFLOW_AUTOMATION_KEY:automation});let checks=0;const ok=(c,m)=>{assert(c,m);checks++;};
const call=async(path,method='GET',body,status=200)=>{const r=await f.request(path,{method,headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)}),j=await r.json();assert.equal(r.status,status,path+' '+JSON.stringify(j));checks++;return j;};
const stamp=new Date().toISOString();
try{
 // A supplier saved with the old supplier-level "stock" type, with one stock site and one monthly site.
 await f.db.prepare("INSERT INTO records(id,kind,user_id,data,created,updated) VALUES ('sup','supplier','owner',?,?,?)").bind(JSON.stringify({name:'ספק מעורב',email:'mixed@example.test',billing:'stock'}),stamp,stamp).run();
 const site=(id,stock)=>f.db.prepare('INSERT INTO websites(id,name,url,category,price,dr,active,data,updated) VALUES(?,?,?,?,?,?,?,?,?)').bind(id,'אתר '+id,'https://'+id+'.example.test','news',50000,30,1,JSON.stringify({procurement_verified:true,supplier_id:'sup',supplier_email:'mixed@example.test',supplier_name:'ספק מעורב',cost_cents:20000,...(stock==null?{}:{stock_total:stock})}),stamp).run();
 await site('st',1);await site('mo',null);
 const article=(id,w)=>f.db.prepare('INSERT INTO articles(id,order_id,user_id,website_id,status,title,content,data,updated) VALUES(?,?,?,?,?,?,?,?,?)').bind(id,'card','buyer',w,'approved','כתבה '+id,'<p>תוכן בדיקה</p>',JSON.stringify({cost_cents:20000}),stamp).run();
 for(const [id,w] of [['a-mo','mo'],['a-st','st'],['a-st2','st'],['a-old','mo']])await article(id,w);
 // A job blocked by the old supplier-level rule before this change.
 await f.db.prepare("INSERT INTO jobs(id,user_id,kind,status,data,created,updated) VALUES ('publication:a-old','buyer','supplier_publication','blocked',?,?,?)").bind(JSON.stringify({article_id:'a-old',website_id:'mo',error:'הספק עובד במלאי ולאתר עדיין אין חבילה. הוסיפו מלאי והכתבה תישלח לספק.'}),stamp,stamp).run();

 let job=await call('/api/articles/a-mo/dispatch','POST',{});
 ok(job.status==='succeeded','a monthly site of a supplier with stock sites is sent (was blocked): '+job.status+' '+(job.error||''));
 let d=JSON.parse((await f.db.prepare("SELECT data FROM articles WHERE id='a-mo'").first()).data);ok(d.supplier_stock_total==null,'the monthly article carries no stock snapshot, so it is billed monthly');
 job=await call('/api/articles/a-st/dispatch','POST',{});ok(job.status==='succeeded','the stock site sends from its package');
 d=JSON.parse((await f.db.prepare("SELECT data FROM articles WHERE id='a-st'").first()).data);ok(Number(d.supplier_stock_total)===1,'the stock article is counted in the package');
 job=await call('/api/articles/a-st2/dispatch','POST',{});ok(job.status==='blocked'&&/מלאי/.test(job.error||''),'a stock site with no free slot still waits for stock');

 // The scheduled run releases the job the old rule had blocked.
 const r=await f.request('/api/maintenance/scheduled-articles',{method:'POST',headers:{authorization:'Bearer '+automation}});ok(r.status===200,'maintenance run');
 ok((await f.db.prepare("SELECT status FROM jobs WHERE id='publication:a-old'").first()).status==='succeeded','an article blocked by the old rule is sent by the scheduled run');

 // Settlement: the monthly order holds only the monthly-site articles (suppliers are paid for published ones).
 for(const id of ['a-mo','a-old','a-st'])await f.db.prepare("UPDATE articles SET status='published',published_url=?,data=json_set(data,'$.published_at',?) WHERE id=?").bind('https://published.example.test/'+id,stamp,id).run();
 const billing=await call('/api/admin/supplier-billing/sup');
 ok(billing.supplier.billing==='mixed','the supplier summary is "mixed"');
 const monthly=billing.orders.reduce((n,o)=>n+Number(o.count||0),0);ok(monthly===2,'two monthly articles in the monthly orders, the stock one is not there: '+monthly);
 ok(billing.stock.sites===1&&billing.stock.used===1,'the stock site shows its used package slot');

 // Adding a package to the monthly site is allowed even though the supplier had a "type".
 await call('/api/admin/supplier-stock/mo','POST',{quantity:3,total_ils:300});
 ok(Number(JSON.parse((await f.db.prepare("SELECT data FROM websites WHERE id='mo'").first()).data).stock_total)===2+3,'the package starts after the 2 articles already sent monthly');
 ok((await call('/api/admin/supplier-billing/sup')).supplier.billing==='stock','both sites on stock now');

 // A supplier-level type sent by an older screen is ignored, not an error.
 const rec=await f.db.prepare("SELECT updated FROM records WHERE id='sup'").first();
 await call('/api/records/supplier/sup','PATCH',{name:'ספק מעורב',email:'mixed@example.test',billing:'monthly',expected_updated_at:rec.updated});
 ok(JSON.parse((await f.db.prepare("SELECT data FROM records WHERE id='sup'").first()).data).billing==='stock','the old field is left as it was and has no effect');

 // Back to monthly from the site: the next article is monthly.
 const cat=await call('/api/catalog?scope=admin'),w=cat.websites.find(x=>x.id==='st');
 await call('/api/admin/catalog-bulk','POST',{pricing_version:cat.pricing_version,rows:[{id:'st',create:false,expected_updated:w.updated,values:{stock_total:'חודשי'}}]});
 ok(JSON.parse((await f.db.prepare("SELECT data FROM websites WHERE id='st'").first()).data).stock_total==null,'"חודשי" in the stock column returns the site to monthly billing');
 job=await call('/api/articles/a-st2/dispatch','POST',{});ok(job.status==='succeeded','the waiting article goes out as monthly');
 d=JSON.parse((await f.db.prepare("SELECT data FROM articles WHERE id='a-st2'").first()).data);ok(d.supplier_stock_total==null,'and is billed monthly');
 const dir=await call('/api/admin/suppliers?billing=monthly');ok((dir.suppliers||dir.rows||[]).some(s=>s.id==='sup'),'the directory "חודשי" filter finds a supplier with monthly sites');
 console.log('PER-SITE BILLING PASSED:',checks,'checks: monthly and stock sites under one supplier, stuck jobs released, monthly orders without stock articles, stock added to a monthly site, old type ignored, back to monthly.');
}finally{await f.mf.dispose();}
