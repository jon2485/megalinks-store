import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createAdminFixture} from './admin-glass.mjs';
const f=await createAdminFixture(),stamp=new Date().toISOString();
async function request(path,method='GET',body,user='buyer',expected=200){
 const res=await f.mf.dispatchFetch('http://admin.test/api/'+path,{method,headers:{'Content-Type':'application/json','oai-authenticated-user-id':user,'oai-authenticated-user-email':user+'@example.test'},...(body?{body:JSON.stringify(body)}:{})});
 const result=await res.json();assert.equal(res.status,expected,path+' '+JSON.stringify(result));return result;
}
try{
 for(const [id,user] of [['owned','buyer'],['foreign','noa']])await f.db.prepare('INSERT INTO records(id,kind,user_id,data,created,updated) VALUES(?,?,?,?,?,?)').bind(id,'customer',user,JSON.stringify({name:'לקוח '+id}),stamp,stamp).run();
 await f.db.prepare("UPDATE users SET credits=1000000,phone='0500000000' WHERE id='buyer'").run();
 const item=await request('cart','POST',{website_id:'site',topic:'פרסום כתבה'},'buyer',201);
 await request('cart/'+item.id,'PATCH',{customer_id:'foreign'},'buyer',403);
 await request('cart/'+item.id,'PATCH',{customer_id:'owned'});
 let cart=(await request('cart')).items;assert.equal(cart[0].customer_id,'owned');assert(!cart[0].editorial,'assignment must not enable paid writing');
 await request('cart/'+item.id,'PATCH',{customer_id:''});assert.equal((await request('cart')).items[0].customer_id,'');
 await request('cart/'+item.id,'PATCH',{customer_id:'owned'});
 const quote=await request('quote','POST',{});
 const order=await request('checkout','POST',{payment:'credits',phone:'0500000000',invoice_name:'לקוח בדיקה',accepted:true,idempotency:randomUUID(),pricing_token:quote.pricing_token,expected_total:quote.total},'buyer',201);
 const articles=(await request('records/customer/owned/articles')).articles;
 assert.equal(articles.length,1);assert.equal(articles[0].order_id,order.id);
 assert.equal((await request('records/customer/foreign/articles','GET',undefined,'noa')).articles.length,0);
 await request('records/customer/owned/articles','GET',undefined,'noa',403);
 assert.equal((await request('cart')).items.length,0);
 console.log('CART CUSTOMER ASSIGNMENT PASS: owned selection/clear, foreign rejection, optional writing, purchase propagation, My Customers visibility and privacy. Isolated database only.');
}finally{await f.mf.dispose();}
