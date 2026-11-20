// The bulk actions added to avoid one request or query per row (20.11.2026): supplier reminders for several articles
// in one request, and removing many addresses from the marketing list in one batch. Fictional data only.
import assert from 'node:assert/strict';
import {createAdminFixture} from './admin-glass.mjs';
const f=await createAdminFixture(),stamp=new Date().toISOString();
const post=async(path,body)=>{const r=await f.request(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:r.status,body:await r.json()};};
try{
 // Two articles waiting at the supplier, each with its original supplier mail, and one that is not waiting.
 const ids=['n1-remind-a','n1-remind-b'],draft='n1-remind-draft';
 for(const id of [...ids,draft]){
  await f.db.prepare('INSERT INTO articles(id,order_id,user_id,website_id,status,title,data,updated) VALUES (?,?,?,?,?,?,?,?)').bind(id,'n1-order','n1-customer','n1-site',id===draft?'draft':'sent','כתבה '+id,'{}',stamp).run();
  await f.db.prepare('INSERT INTO jobs(id,user_id,kind,status,data,created,updated) VALUES (?,?,?,?,?,?,?)').bind('email:supplier:'+id,'n1-customer','email','succeeded',JSON.stringify({to:'supplier@example.test',subject:'כתבה לפרסום',text:'פרטים'}),stamp,stamp).run();
 }
 // Not waiting at the supplier: refused, and nothing is sent for the other article either.
 const refused=await post('/api/admin/supplier-remind',{article_ids:[ids[0],draft]});
 assert.equal(refused.status,400,JSON.stringify(refused.body));
 assert.equal((await f.db.prepare("SELECT COUNT(*) AS n FROM jobs WHERE id LIKE 'reminder:n1-%'").first()).n,0,'no reminder when one article is refused');
 // Both waiting: one request, one reminder per article, same id and subject as the single-article reminder.
 const ok=await post('/api/admin/supplier-remind',{article_ids:ids});
 assert.equal(ok.status,200,JSON.stringify(ok.body));assert.equal(ok.body.sent,2);
 const reminders=(await f.db.prepare("SELECT id,data FROM jobs WHERE id LIKE 'reminder:n1-%' ORDER BY id").all()).results;
 assert.deepEqual(reminders.map(r=>r.id),ids.map(id=>'reminder:'+id+':'+stamp.slice(0,10)));
 for(const r of reminders)assert.match(JSON.parse(r.data).subject,/^תזכורת לפרסום: כתבה n1-remind-/);
 // A customer (not admin) cannot use it.
 const customer=await f.mf.dispatchFetch('http://admin.test/api/admin/supplier-remind',{method:'POST',headers:{'Content-Type':'application/json','oai-authenticated-user-id':'buyer','oai-authenticated-user-email':'buyer@example.test'},body:JSON.stringify({article_ids:ids})});
 assert.equal(customer.status,403);

 // Marketing list: two subscribed accounts and one unknown address, removed in one call.
 for(const [id,email] of [['n1-sub-a','n1-a@example.test'],['n1-sub-b','n1-b@example.test']]){
  await f.db.prepare('INSERT INTO users(id,email,name,role,created) VALUES (?,?,?,?,?)').bind(id,email,'לקוח '+id,'customer',stamp).run();
  await f.db.prepare('INSERT INTO records(id,kind,user_id,data,created,updated) VALUES (?,?,?,?,?,?)').bind('marketing:'+id,'marketing_consent',id,JSON.stringify({status:'subscribed',email,history:[]}),stamp,stamp).run();
 }
 const removed=await post('/api/admin/marketing/remove',{text:'N1-A@example.test\nn1-b@example.test\nnobody-n1@example.test'});
 assert.equal(removed.status,200,JSON.stringify(removed.body));
 assert.equal(removed.body.removed,2);assert.deepEqual(removed.body.unknown,['nobody-n1@example.test']);
 for(const id of ['n1-sub-a','n1-sub-b']){
  const d=JSON.parse((await f.db.prepare('SELECT data FROM records WHERE id=?').bind('marketing:'+id).first()).data);
  assert.equal(d.status,'unsubscribed');assert.equal(d.unsubscribed_source,'admin');assert.equal(d.history.at(-1).status,'unsubscribed');
 }
 assert.equal((await f.db.prepare("SELECT COUNT(*) AS n FROM activity WHERE resource LIKE 'marketing:n1-sub-%' AND action='הסרה מדיוור שיווקי'").first()).n,2,'one activity row per removed address');
 // Removing again changes nothing.
 assert.equal((await post('/api/admin/marketing/remove',{text:'n1-a@example.test'})).body.removed,0);
 console.log('n-plus-one-batch: ok');
}finally{await f.mf.dispose();}
