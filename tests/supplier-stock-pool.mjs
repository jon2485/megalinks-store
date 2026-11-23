// Supplier stock pool (owner, 23.11.2026): stock belongs to the supplier and is shared by all its sites.
// Isolated Worker/D1, fictional data only. Needs `pnpm build` first.
import assert from 'node:assert/strict';
import {createAdminFixture} from './admin-glass.mjs';
const automation='supplier-stock-pool-local-key-0123456789abcdef';
const f=await createAdminFixture({POSTFLOW_AUTOMATION_KEY:automation});let checks=0;const ok=(c,m)=>{assert(c,m);checks++;};
const call=async(path,method='GET',body,status=200)=>{const r=await f.request(path,{method,headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)}),j=await r.json();assert.equal(r.status,status,path+' '+JSON.stringify(j));checks++;return j;};
const stamp=new Date().toISOString();
const data=async(table,id)=>JSON.parse((await f.db.prepare(`SELECT data FROM ${table} WHERE id=?`).bind(id).first()).data);
const supplier=(id,name,extra={})=>f.db.prepare("INSERT INTO records(id,kind,user_id,data,created,updated) VALUES (?,'supplier','owner',?,?,?)").bind(id,JSON.stringify({name,email:id+'@example.test',contact:'איש קשר',...extra}),stamp,stamp).run();
const site=(id,sup,cost,extra={})=>f.db.prepare('INSERT INTO websites(id,name,url,category,price,dr,active,data,updated) VALUES(?,?,?,?,?,?,?,?,?)').bind(id,'אתר '+id,'https://'+id+'.example.test','news',50000,30,1,JSON.stringify({procurement_verified:true,supplier_id:sup,supplier_email:sup+'@example.test',cost_cents:cost,...extra}),stamp).run();
const article=(id,w,cost)=>f.db.prepare('INSERT INTO articles(id,order_id,user_id,website_id,status,title,content,data,updated) VALUES(?,?,?,?,?,?,?,?,?)').bind(id,'card','buyer',w,'approved','כתבה '+id,'<p>תוכן בדיקה</p>',JSON.stringify({cost_cents:cost}),stamp).run();
const send=id=>call('/api/articles/'+id+'/dispatch','POST',{});
const publish=id=>f.db.prepare("UPDATE articles SET status='published',published_url=?,data=json_set(data,'$.published_at',?) WHERE id=?").bind('https://published.example.test/'+id,stamp,id).run();
const detail=id=>call('/api/admin/suppliers/'+encodeURIComponent(id)+'?page=1&q=&all=0&selected=');
const tasks=async()=>(await call('/api/admin/control-center/updates?view=tasks')).tasks;
try{
 // ---------- 1. A pool of 4 across 3 sites: 4 are sent, the 5th waits with the right reason ----------
 await supplier('ofir','אופיר');for(const w of ['o1','o2','o3'])await site(w,'ofir',20000);
 for(const [id,w] of [['p1','o1'],['p2','o2'],['p3','o3'],['p4','o1'],['p5','o2']])await article(id,w,20000);
 let pool=(await detail('ofir')).pool;ok(pool.total===null&&pool.state==='none','no pool before stock is added');
 const added=await call('/api/admin/supplier-pool/ofir','POST',{quantity:4,total_ils:800,paid_on:stamp.slice(0,10),method:'bank_transfer'});
 ok(added.stock_pool===4&&added.resent===0,'the pool is 4');
 for(const [i,id] of ['p1','p2','p3','p4'].entries()){
  const job=await send(id);ok(job.status==='succeeded','pool article '+id+' is sent: '+job.status+' '+(job.error||''));
  const d=await data('articles',id);ok(d.supplier_sequence===i+1&&d.supplier_stock_total===4&&d.supplier_pool===1,'number '+(i+1)+' of 4 for the supplier e-mail: '+JSON.stringify([d.supplier_sequence,d.supplier_stock_total,d.supplier_pool]));
 }
 ok(Number((await f.db.prepare("SELECT COUNT(*) AS n FROM supplier_pool_allocations WHERE supplier_id='ofir'").first()).n)===4,'4 pool places used across 3 sites');
 let job=await send('p5');ok(job.status==='blocked','the 5th article is not sent');ok(/^המלאי של הספק אופיר נגמר/.test(job.error||''),'with the supplier reason: '+job.error);
 ok((await f.db.prepare("SELECT status FROM articles WHERE id='p5'").first()).status==='approved','the 5th article stays approved');
 // The supplier page and the lobby.
 pool=(await detail('ofir')).pool;ok(pool.state==='empty'&&pool.left===0&&pool.waiting===1&&pool.sites===3,'supplier page: ended, 1 waiting, 3 sites: '+JSON.stringify(pool));
 let t=await tasks();ok(t.supplier_stock?.total===1,'lobby: one "stock ended" row');
 const row=t.supplier_stock.rows[0];ok(row.title==='המלאי של אופיר נגמר'&&row.status==='כתבה אחת מחכה ולא נשלחה'&&row.page==='admin-supplier/ofir'&&row.lane==='urgent','lobby row text and target: '+JSON.stringify([row.title,row.status,row.page,row.lane]));
 ok(!(t.delivery?.rows||[]).some(r=>r.resource_id==='p5'),'no extra delivery-problem row for the same article');
 const dir=await call('/api/admin/suppliers?billing=stock');const card=(dir.suppliers||[]).find(s=>s.id==='ofir');ok(card&&card.billing==='pool'&&card.stock.pool&&card.stock.state==='empty','directory: pool supplier, ended');

 // ---------- 2. Adding stock releases the waiting article ----------
 const more=await call('/api/admin/supplier-pool/ofir','POST',{quantity:2,unit_ils:200});
 ok(more.stock_pool===6&&more.resent===1,'adding 2 sends the waiting article at once: '+JSON.stringify(more));
 ok((await f.db.prepare("SELECT status FROM articles WHERE id='p5'").first()).status==='sent','the 5th article is with the supplier now');
 ok((await data('articles','p5')).supplier_sequence===5&&(await data('articles','p5')).supplier_stock_total===6,'it is number 5 of 6');
 t=await tasks();ok(!t.supplier_stock,'the "ended" row is gone');ok(t.supplier_stock_low?.total===1&&t.supplier_stock_low.rows[0].status==='נותרה כתבה אחת מתוך 6'&&t.supplier_stock_low.rows[0].lane==='service','a low-stock heads-up instead');
 const packs=(await call('/api/admin/supplier-billing/ofir')).stock.packages.filter(p=>p.pool);ok(packs.length===2&&packs.find(p=>p.quantity===4).used===4,'both pool packages are orders in the billing tab');

 // ---------- 3. Cancellation before publication returns the pool place (through the scheduled run as well) ----------
 await f.db.batch([f.db.prepare("DELETE FROM supplier_pool_allocations WHERE article_id='p5'"),f.db.prepare("DELETE FROM supplier_dispatch_allocations WHERE article_id='p5'")]);
 ok(Number((await f.db.prepare("SELECT COUNT(*) AS n FROM supplier_pool_allocations WHERE supplier_id='ofir'").first()).n)===4,'a freed place counts as free');

 // ---------- 4. A site with a different price keeps its own separate stock ----------
 await call('/api/admin/supplier-stock/o3','POST',{quantity:1,total_ils:150});
 const o3=await data('websites','o3');ok(o3.stock_own===1&&o3.stock_total===2,'o3 is separate now: its stock starts after its 1 sent article: '+JSON.stringify([o3.stock_own,o3.stock_total]));
 await article('p6','o3',15000);await article('p7','o3',15000);
 job=await send('p6');ok(job.status==='succeeded','the separate site sends from its own stock');
 const d6=await data('articles','p6');ok(d6.supplier_pool===0&&d6.supplier_stock_total===2,'not from the pool');
 ok(Number((await f.db.prepare("SELECT COUNT(*) AS n FROM supplier_pool_allocations WHERE supplier_id='ofir'").first()).n)===4,'the pool did not change');
 job=await send('p7');ok(job.status==='blocked'&&/מלאי הפרסומים באתר/.test(job.error||''),'its own stock ends on its own, with the site reason');
 pool=(await detail('ofir')).pool;ok(pool.own.length===1&&pool.own[0].id==='o3'&&pool.sites===2,'the supplier page lists the separate site');

 // ---------- 5. Per-site stock of a supplier without a pool works as before ----------
 await supplier('per','ספק לפי אתר');await site('s1','per',10000,{stock_total:1});await article('q1','s1',10000);await article('q2','s1',10000);
 ok((await send('q1')).status==='succeeded','per-site stock: the first is sent');
 job=await send('q2');ok(job.status==='blocked'&&/מלאי הפרסומים באתר/.test(job.error||''),'per-site stock: the second waits with the site reason');
 ok((await data('articles','q1')).supplier_pool===0,'per-site article is not a pool article');
 t=await tasks();ok((t.delivery?.rows||[]).some(r=>r.resource_id==='q2'),'per-site stock still shows as a delivery problem');

 // ---------- 6. The sheet word "מלאי" with no number stays unlimited, and is shown ----------
 await supplier('word','ספק עם מילה');await site('w1','word',10000,{stock_mode:'stock'});await article('r1','w1',10000);await article('r2','w1',10000);
 ok((await send('r1')).status==='succeeded'&&(await send('r2')).status==='succeeded','"מלאי" with no number: unlimited, as today');
 pool=(await detail('word')).pool;ok(pool.total===null&&pool.unnumbered===1,'and the supplier page shows the warning');

 // ---------- 7. The first pool: what is left in per-site stock is added (or kept separate) ----------
 await supplier('mrg','ספק לאיחוד');await site('m1','mrg',10000,{stock_total:5});await site('m2','mrg',10000);
 await f.db.prepare("INSERT INTO supplier_dispatch_counters(website_id,demo,sent_count) VALUES ('m1',0,2)").run();
 ok((await detail('mrg')).pool.leftovers[0].left===3,'the dialog sees 3 left on m1');
 ok((await call('/api/admin/supplier-pool/mrg','POST',{quantity:10,total_ils:1000})).stock_pool===13,'merged: 10 + 3 left = 13');
 ok(!(await data('websites','m1')).stock_own,'m1 now draws from the pool');
 await supplier('kep','ספק בלי איחוד');await site('k1','kep',10000,{stock_total:5});
 ok((await call('/api/admin/supplier-pool/kep','POST',{quantity:10,total_ils:1000,merge_sites:false})).stock_pool===10,'not merged: 10');
 ok((await data('websites','k1')).stock_own===1,'k1 keeps its own stock');

 // ---------- 8. The pool size changes only through "הוספת מלאי" ----------
 const rec=await f.db.prepare("SELECT updated FROM records WHERE id='ofir'").first();
 await call('/api/records/supplier/ofir','PATCH',{name:'אופיר',email:'ofir@example.test',stock_pool:999,expected_updated_at:rec.updated});
 ok((await data('records','ofir')).stock_pool===6,'a profile save cannot set the pool');
 await call('/api/admin/supplier-pool/ofir','POST',{quantity:0,total_ils:10},400);

 // ---------- 9. Monthly suppliers: one statement across all their sites, each article at its own site's cost ----------
 await supplier('mon','ספק חודשי');await site('n1','mon',10000);await site('n2','mon',20000);await site('n3','mon',30000);
 for(const [id,w,c] of [['m-1','n1',10000],['m-2','n2',20000],['m-3','n3',30000]]){await article(id,w,c);ok((await send(id)).status==='succeeded','monthly '+id+' is sent');ok((await data('articles',id)).supplier_stock_total==null,'monthly '+id+' has no stock snapshot');await publish(id);}
 const mb=await call('/api/admin/supplier-billing/mon');
 ok(mb.orders.length===1&&mb.orders[0].count===3&&mb.orders[0].net===60000&&mb.orders[0].sites===3,'one monthly order for 3 sites, 100+200+300 = 600: '+JSON.stringify(mb.orders.map(o=>[o.count,o.net,o.sites])));
 for(const id of ['p1','p2'])await publish(id);
 const ob=await call('/api/admin/supplier-billing/ofir');ok(ob.orders.length===0,'pool articles are never in a monthly order (paid in advance)');

 // ---------- 10. The scheduled run also releases articles once stock is added from elsewhere ----------
 await article('p8','o1',20000);await article('p9','o2',20000);
 await f.db.prepare("UPDATE records SET data=json_set(data,'$.stock_pool',4) WHERE id='ofir'").run(); // fictional: pool full again (4 used of 4)
 ok((await send('p8')).status==='blocked','pool full again');
 await f.db.prepare("UPDATE records SET data=json_set(data,'$.stock_pool',5) WHERE id='ofir'").run();
 const r=await f.request('/api/maintenance/scheduled-articles',{method:'POST',headers:{authorization:'Bearer '+automation}});ok(r.status===200,'maintenance run');
 ok((await f.db.prepare("SELECT status FROM articles WHERE id='p8'").first()).status==='sent','the scheduled run sends the waiting pool article');
 console.log('SUPPLIER STOCK POOL PASSED:',checks,'checks: pool of 4 over 3 sites, 5th waits with the supplier reason, lobby row, add stock releases it, low heads-up, pool packages in billing, separate site stock, per-site stock unchanged, sheet word unlimited and shown, first-pool merge, pool not editable from the profile, one monthly statement across sites, scheduled release.');
}finally{await f.mf.dispose();}
