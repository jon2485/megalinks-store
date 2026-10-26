import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createAdminFixture} from './admin-glass.mjs';
const f=await createAdminFixture(),stamp=new Date().toISOString();let requests=0;
async function request(path,method='GET',body,user='buyer',status=200){
 const response=await f.mf.dispatchFetch('http://admin.test/api/'+path,{method,headers:{'Content-Type':'application/json','oai-authenticated-user-id':user,'oai-authenticated-user-email':user+'@example.test'},...(body?{body:JSON.stringify(body)}:{})});
 const result=await response.json();assert.equal(response.status,status,path+' '+JSON.stringify(result));requests++;return result;
}
const assign=(id,version,body={},user='buyer',status=200)=>request('articles/'+id+'/customer','POST',{assignment_version:version,request_id:randomUUID(),...body},user,status);
try{
 for(const [id,user,name] of [['old','buyer','לקוח ותיק'],['new','buyer','לקוח חדש'],['foreign','noa','לקוח פרטי']])await f.db.prepare("INSERT INTO records(id,kind,user_id,data,created,updated) VALUES(?,'customer',?,?,?,?)").bind(id,user,JSON.stringify({name,company:'חברה',email:'private@example.test',notes:'PRIVATE-NOTES'}),stamp,stamp).run();
 await f.db.prepare("UPDATE articles SET data=json_set(data,'$.customer_id','old') WHERE id='review'").run();
 let rows=(await request('articles')).articles;assert.equal(rows.find(a=>a.id==='review').customer_name,'לקוח ותיק');assert.equal(rows.find(a=>a.id==='review').customer_id,'old');
 const options=await request('articles/customer-options');assert.equal(options.customers.length,2);assert(!JSON.stringify(options).includes('PRIVATE-NOTES'));assert(!JSON.stringify(options).includes('private@example.test'));
 await assign('review',0,{customer_id:'foreign'},'buyer',403);
 await assign('review',0,{customer_id:'old'},'noa',403);
 await assign('review',0,{customer_id:'old'},'owner',403);
 const financialBefore=JSON.stringify({orders:(await f.db.prepare('SELECT * FROM orders ORDER BY id').all()).results,article:await f.db.prepare("SELECT status,version,title,content,data,updated FROM articles WHERE id='review'").first()});
 await assign('review',0,{customer_id:'new'});
 const financialAfter=JSON.stringify({orders:(await f.db.prepare('SELECT * FROM orders ORDER BY id').all()).results,article:await f.db.prepare("SELECT status,version,title,content,data,updated FROM articles WHERE id='review'").first()});assert.equal(financialBefore,financialAfter,'assignment changes metadata only, never content, versions, status or money');
 assert(!(await request('records/customer/old/articles')).articles.some(a=>a.id==='review'));
 assert((await request('records/customer/new/articles')).articles.some(a=>a.id==='review'));
 for(const path of ['articles','orders/card']){rows=(await request(path)).articles;assert.equal(rows.find(a=>a.id==='review').customer_name,'לקוח חדש');assert.equal(rows.find(a=>a.id==='review').customer_id,'new');}
 assert.equal((await request('articles/review')).article.customer_id,'new');
 await assign('review',0,{customer_id:'old'},'buyer',409);
 await f.db.prepare("UPDATE articles SET data=json_set(data,'$.customer_id','old'),version=version+1 WHERE id='review'").run();
 assert.equal((await request('articles/review')).article.customer_id,'new','later content autosaves cannot overwrite the link');
 for(const status of ['published','scheduled','writing','sent','cancelled']){
  await f.db.prepare('UPDATE articles SET status=? WHERE id=?').bind(status,'ready').run();const before=await f.db.prepare("SELECT status,version FROM articles WHERE id='ready'").first();
  const current=(await request('articles/ready')).article;await assign('ready',current.assignment_version,{customer_id:'new'});assert.deepEqual(await f.db.prepare("SELECT status,version FROM articles WHERE id='ready'").first(),before);
 }
 await assign('unpaid',0,{customer_id:'new'});assert.equal((await f.db.prepare("SELECT paid FROM orders WHERE id='bank'").first()).paid,0);
 const count=async()=>Number((await f.db.prepare("SELECT COUNT(*) AS n FROM records WHERE kind='customer' AND user_id='buyer'").first()).n);
 const before=await count();await assign('review',1,{new_customer:{name:' ',email:'bad'}},'buyer',400);assert.equal(await count(),before);
 const request_id=randomUUID(),body={new_customer:{name:'מרפאת אלון',company:'אלון',email:'alon@example.test',phone:'0501234567',notes:'הערה ללקוח'},request_id};
 const created=await assign('review',1,body);assert.equal(await count(),before+1);assert.equal((await request('articles/review')).article.customer_name,'מרפאת אלון');
 const repeated=await assign('review',1,body);assert.equal(repeated.customer_id,created.customer_id);assert(repeated.repeated);assert.equal(await count(),before+1);
 await assign('review',1,{...body,new_customer:{name:'אחר'}},'buyer',409);assert.equal(await count(),before+1);
 await assign('review',1,{new_customer:{name:'לא ייווצר'}},'buyer',409);assert.equal(await count(),before+1,'stale create and assign is atomic');
 assert((await request('records/customer/'+encodeURIComponent(created.customer_id)+'/articles')).articles.some(a=>a.id==='review'));
 await request('records/customer/'+encodeURIComponent(created.customer_id)+'/articles','GET',undefined,'noa',403);
 await request('records/article_customer_assignment','GET',undefined,'buyer',400);
 await assign('review',2,{customer_id:''});let article=(await request('articles/review')).article;assert.equal(article.customer_id,'');assert.equal(article.customer_name,null);
 await assign('review',3,{customer_id:'new'});await request('records/customer/new','DELETE');article=(await request('articles/review')).article;assert.equal(article.customer_id,'');assert.equal(article.customer_name,null,'deleted clients never expose a legacy/foreign client name');
 assert.equal((await request('records/customer/old/articles')).articles.length,0);
 console.log('ARTICLE CUSTOMER ASSIGNMENT PASS:',requests,'requests; legacy/current names, all stages, owned-only list, private fields, atomic create/link, retry/conflict, clear/delete, unchanged content/publication/payment and My Customers propagation.');
}finally{await f.mf.dispose();}
