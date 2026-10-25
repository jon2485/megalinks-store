import assert from 'node:assert/strict';
import {compile,reset,render,nodes,text} from './admin-ui-harness.mjs';
import {createAdminFixture} from './admin-glass.mjs';
const {default:Updates}=await compile('app/client-updates.tsx','customer-cancellation-actions');
const article={id:'cancelled-item',order_id:'order-1',number:'#1010',website_name:'ישראל היום',website_url:'https://example.test',title:'כתבה שבוטלה',status:'cancelled',paid_amount:11800,paid_net_amount:10000,publication_price:10000,editorial_price:0,publication_refunded:true,refund_total:11800,refunded_at:'2026-10-26T09:00:00Z',refund_reason:'הערת המנהל ללקוח\nהשורה השנייה',cancel_reason:'סיבה קודמת',admin_notes:'PRIVATE ADMIN NOTE',cost_cents:4000};
let h=reset({articles:{data:{articles:[article]},loading:false},orders:{data:{orders:[]},loading:false},credits:{data:{transactions:[]},loading:false},notifications:{data:{notifications:[]},loading:false}});
const opened=[],visits=[];let closed=0,refreshes=0;const ctx={revision:0,open:m=>opened.push(m),go:p=>visits.push(p),refresh:()=>refreshes++};
let tree=render(Updates,{ctx});assert(text(tree).includes('הערת המנהל ללקוח'),'final refund reason appears in update');
nodes(tree).find(n=>n.props?.onClick&&text(n).startsWith('פרטי הביטול')).props.onClick();assert.equal(opened.length,1);assert.equal(opened[0].kind,'customer-cancellation');assert.deepEqual(visits,[],'cancellation never opens writer route');assert.equal(h.calls.length,0);
const dialog=opened[0].render(()=>closed++),View=dialog.type,props=dialog.props;
h=reset();tree=render(View,props);assert.equal(h.reads.at(-1).path,'articles/cancelled-item');assert(text(tree).includes('טוען את פרטי העסקה והביטול'));
h.data['articles/cancelled-item']={data:{article,order:{id:'order-1',number:'#1010',created:'2026-10-20',payment:'monthly',settlement_payment_method:'bank_transfer',paid:1}},loading:false};tree=render(View,props);
for(const value of ['העסקה שבוצעה','פרטי הביטול','#1010','העברה בנקאית','118.00','סכום הביטול כולל מע״מ','הערת המנהל ללקוח'])assert(text(tree).includes(value),value);assert(!text(tree).includes('PRIVATE ADMIN NOTE'));assert(!text(tree).includes('סיבה קודמת'));assert(!text(tree).includes('הוחזר ליתרה'),'does not infer a refund destination');
nodes(tree).find(n=>n.props?.onClick&&text(n)==='סגירה').props.onClick();assert.equal(closed,1);assert.equal(h.calls.length,0,'details are read-only');
h.data['articles/cancelled-item']={data:{article:{...article,editorial_price:2000,writing_refunded:false,refund_reason:'',cancel_reason:''},order:{}},loading:false};tree=render(View,props);assert(text(tree).includes('שירות הכתיבה נשאר בחיוב'));assert(text(tree).includes('לא צורפה הערת מנהל'));
h.data['articles/cancelled-item']={data:{article:{id:article.id,status:'cancelled'},order:{}},loading:false};tree=render(View,props);assert(text(tree).includes('לא תועד סכום זיכוי נפרד'));assert(!text(tree).includes('0.00'),'unknown original/refund amounts are not fabricated as zero');
h.data['articles/cancelled-item']={data:null,error:'בדיקת תקלה',loading:false};tree=render(View,props);assert(text(tree).includes('בדיקת תקלה'));assert(!text(tree).includes('טוען את פרטי העסקה'));nodes(tree).find(n=>n.props?.onClick&&text(n).includes('ניסיון נוסף')).props.onClick();assert.equal(refreshes,1);
const f=await createAdminFixture();try{
 await f.db.prepare("UPDATE articles SET status='cancelled',data=json_set(data,'$.refund_reason',?,'$.admin_notes',?,'$.cost_cents',4000,'$.supplier_email',?,'$.refund_total',11800) WHERE id='review'").bind('סיבת הביטול שנועדה ללקוח','PRIVATE-STAFF-NOTE','PRIVATE-SUPPLIER@example.test').run();
 const read=who=>f.mf.dispatchFetch('http://admin.test/api/articles/review',{headers:who?{'oai-authenticated-user-id':who,'oai-authenticated-user-email':who+'@example.test'}:{}});
 const response=await read('buyer');assert.equal(response.status,200);const result=await response.json();assert.equal(result.article.refund_reason,'סיבת הביטול שנועדה ללקוח');assert.equal(result.article.data.refund_reason,result.article.refund_reason);assert.equal(result.article.refund_total,11800);assert(!JSON.stringify(result).includes('PRIVATE-STAFF-NOTE'));assert(!JSON.stringify(result).includes('PRIVATE-SUPPLIER'));assert.equal(result.article.cost_cents,undefined);
 assert.equal((await read('noa')).status,403);assert.equal((await read(null)).status,401);
 console.log('CUSTOMER CANCELLATION PASS: exact glass dialog callback instead of writer; real transaction/refund reason; no internal notes, false refund destination or unknown zero amounts; partial-writing distinction; close/loading/retry; owned API reason projection and foreign/anonymous denial; no financial writes.');
}finally{await f.mf.dispose();}
