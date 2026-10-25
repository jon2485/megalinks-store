import assert from 'node:assert/strict';
import {createAdminFixture} from './admin-glass.mjs';
const f=await createAdminFixture();
const headers=user=>user?{'oai-authenticated-user-id':user,'oai-authenticated-user-email':user==='owner'?'owner@example.test':user+'@example.test'}:{};
const get=(path,user='buyer')=>f.mf.dispatchFetch('http://admin.test/api/'+path,{headers:headers(user)});
try{
 const pdf='%PDF-1.7\n1 0 obj << /Type /Catalog >> endobj\n%%EOF',stamp=new Date().toISOString();
 await (await f.mf.getR2Bucket('BUCKET')).put('invoice-original',pdf);
 await f.db.prepare('INSERT INTO files(id,user_id,name,type,size,key,created) VALUES(?,?,?,?,?,?,?)').bind('pdf','owner','original.pdf','application/pdf',pdf.length,'invoice-original',stamp).run();
 const attach=await f.mf.dispatchFetch('http://admin.test/api/orders/card/invoice',{method:'POST',headers:{...headers('owner'),'Content-Type':'application/json'},body:JSON.stringify({file_id:'pdf',document_type:'invoice',document_number:'QA-1010'})});
 assert.equal(attach.status,200);
 const detail=await (await get('orders/card')).json();assert.equal(detail.order.invoice_file_id,'pdf');assert.equal(detail.order.invoice_document_type,'invoice');
 for(const view of ['', '?view=inline']){
  const res=await get('orders/card/invoice'+view);assert.equal(res.status,200);assert.equal(await res.text(),pdf,'exact uploaded PDF, never statement regeneration');
  assert.match(res.headers.get('Content-Disposition'),view?/^inline;/:/^attachment;/);
  assert.equal(res.headers.get('Content-Type'),'application/pdf');assert.match(res.headers.get('Cache-Control'),/private, no-store/);assert.equal(res.headers.get('X-Content-Type-Options'),'nosniff');
  for(const user of ['noa','supplier',null])assert.equal((await get('orders/card/invoice'+view,user)).status,user?403:401,'document ownership in both modes');
 }
 assert.equal((await get('orders/wallet/invoice?view=inline')).status,404,'no phantom invoice');
 // A confirmed receipt can differ from the selected purchase route. Only its method is public.
 await f.db.prepare("INSERT INTO records(id,kind,user_id,data,created,updated) VALUES(?,?,?,?,?,?)").bind('paid-order:card','payment_completion','buyer',JSON.stringify({payment_method:'bank_transfer',payment_date:'2026-10-20',reference:'PRIVATE-REFERENCE',actor:'PRIVATE-STAFF'}),stamp,stamp).run();
 const publicOrder=(await (await get('orders/card')).json()).order;
 assert.equal(publicOrder.confirmed_payment_method,'bank_transfer');assert(!JSON.stringify(publicOrder).includes('PRIVATE-'));
 const listed=(await (await get('orders')).json()).orders.find(o=>o.id==='card');assert.equal(listed.confirmed_payment_method,'bank_transfer');
 // Split payments always show both sources, and unpaid orders never borrow a receipt.
 await f.db.prepare("UPDATE orders SET payment='credits_card' WHERE id='card'").run();
 assert.equal((await (await get('orders/card')).json()).order.confirmed_payment_method,'credits_card');
 await f.db.prepare("UPDATE orders SET paid=0 WHERE id='card'").run();
 assert.equal((await (await get('orders/card')).json()).order.confirmed_payment_method,null);
 console.log('CUSTOMER DOCUMENT API PASS: exact admin PDF, inline/download headers, owner-only access, missing file, confirmed method without private references/staff, split and unpaid states. Isolated fixture only.');
}finally{await f.mf.dispose();}
