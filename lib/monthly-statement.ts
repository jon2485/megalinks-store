import {all,one,stmt,db,assert,parse,now,uid} from './server';
import {businessMonth} from './monthly';
import {financialGuard,orderGuard} from './monthly-order';
import {effectiveOrderAmounts,remainingArticleNet,articleAmounts,orderCancellation} from './order-finance';
import {Row} from './shared';
import {orderSummarySql} from './order-summary';
export const statementId=(userId:string,month:string,demo:boolean)=>'monthly:'+month+':'+userId+':'+(demo?1:0);
export async function statementData(userId:string,month:string,demo=false){
 assert(/^\d{4}-(0[1-9]|1[0-2])$/.test(month),'חודש לא תקין');
 const customer=await one('SELECT id,name,company,email FROM users WHERE id=?',userId);assert(customer,'הלקוח לא נמצא',404);
 const orders=(await all(`SELECT o.*,${orderSummarySql()},c.settled FROM orders o JOIN monthly_charges c ON c.order_id=o.id WHERE c.user_id=? AND c.month=? AND c.demo=? ORDER BY o.created,o.id`,userId,month,demo?1:0)).map(x=>parse(x)!);
 assert(orders.length,'אין הזמנות בחודש שנבחר',404);
 const articles=(await all('SELECT a.*,w.name AS website_name,w.url AS website_url FROM articles a JOIN websites w ON w.id=a.website_id JOIN monthly_charges c ON c.order_id=a.order_id WHERE c.user_id=? AND c.month=? AND c.demo=? ORDER BY a.updated,a.id',userId,month,demo?1:0)).map(x=>parse(x)!);
 const byOrder=new Map(orders.map(o=>[o.id,o])),totals=orders.reduce((s,o)=>{const x=effectiveOrderAmounts(o);return {net:s.net+x.net,vat:s.vat+x.vat,total:s.total+x.total};},{net:0,vat:0,total:0});
 return {month,demo,customer,orders:orders.map(o=>({id:o.id,number:o.number,...effectiveOrderAmounts(o)})),items:articles.map(a=>{const o=byOrder.get(a.order_id)!;return {id:a.id,order_number:o.number,name:a.website_name,url:a.website_url,title:a.title||a.topic||'טרם נוספה כותרת',net:remainingArticleNet(a,o),cancelled:!!(a.publication_refunded||a.writing_refunded||orderCancellation(o)==='full'),original_net:articleAmounts(a).publicationNet+articleAmounts(a).writingNet};}),...totals};
}
export async function closeCustomerMonth(userId:string,month:string,demo=false,expected?:number,recordedBy=''){
 assert(/^\d{4}-(0[1-9]|1[0-2])$/.test(month)&&month<=businessMonth(),'ניתן לסגור חודש נוכחי או חודש שהסתיים');
 const id=statementId(userId,month,demo),prior=parse(await one('SELECT * FROM records WHERE id=?',id));
 if(prior?.summary)return {ok:true,id,month,already_closed:true};
 const target=await one('SELECT * FROM users WHERE id=?',userId);assert(target,'הלקוח לא נמצא',404);
 const summary=await statementData(userId,month,demo);if(expected!==undefined)assert(Number(expected)===summary.total,'סכום החודש השתנה. רעננו את הפירוט לפני סגירת החודש',409);
 const orders=await all('SELECT o.* FROM orders o JOIN monthly_charges c ON c.order_id=o.id WHERE c.user_id=? AND c.month=? AND c.demo=?',userId,month,demo?1:0),stamp=now();
 const data={...(prior?.data||{}),month,amount:summary.total,demo,summary:{...summary,closed_at:stamp},status:orders.every(o=>o.paid)?'paid':'awaiting_payment',closed_at:stamp,recorded_by:recordedBy};
 await db().batch([financialGuard(target!),...orders.map(orderGuard),stmt('INSERT INTO records(id,kind,user_id,data,created,updated) VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,updated=excluded.updated',id,'monthly_statement',userId,JSON.stringify(data),prior?.created||stamp,stamp),stmt('INSERT INTO activity(id,user_id,resource,action,data,created) VALUES (?,?,?,?,?,?)',uid(),recordedBy||userId,userId,'חודש נסגר והופק סיכום לתשלום',JSON.stringify({month,amount:summary.total,demo}),stamp)]);
 return {ok:true,id,month,already_closed:!!prior};
}
