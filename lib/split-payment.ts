import {one,parse,stmt,db,assert,now,uid} from './server';
import {financialGuard,orderGuard} from './monthly-order';
import type {Row} from './shared';

// Pending split payments reserve funds without creating a debit. Cancelling the
// pending order releases the reservation; only verified payment creates a debit.
export async function walletAvailable(user:Row){
 const held=await one("SELECT COALESCE(SUM(json_extract(data,'$.wallet_amount')),0) AS amount FROM orders WHERE user_id=? AND payment='credits_card' AND paid=0 AND status='pending'",user.id);
 return Math.max(0,Number(user.credits||0)-Number(held?.amount||0));
}
export function cardAmount(order:Row){return order.payment==='credits_card'?Number(parse(order)?.card_amount):Number(order.total);}
export async function completeOrderPayment(order:Row,event:string,details:Row,additional:any[]=[]){
 if(order.paid)return {duplicate:true};
 assert(['pending','awaiting_approval'].includes(order.status),'ההזמנה אינה ממתינה לתשלום',409);
 const user=await one('SELECT * FROM users WHERE id=?',order.user_id);assert(user,'הלקוח לא נמצא',404);
 const data=parse(order)!,wallet=order.payment==='credits_card'?Number(data.wallet_amount):0;
 assert(Number.isSafeInteger(wallet)&&wallet>=0&&wallet<=order.total,'חלוקת תשלום אינה תקינה',409);
 assert(Number(user.credits)>=wallet,'יתרת התשלום השמורה אינה זמינה. נדרש טיפול מנהל',409);
 const stamp=now(),ops=[financialGuard(user),orderGuard(order),stmt('INSERT INTO records(id,kind,user_id,data,created,updated) VALUES (?,?,?,?,?,?)','paid-order:'+order.id,'payment_completion',order.user_id,JSON.stringify({event,...details}),stamp,stamp),stmt("UPDATE orders SET paid=1,status='paid',data=json_set(data,'$.paid_at',?,'$.payment_date',?),updated=? WHERE id=?",stamp,details.payment_date||stamp,stamp,order.id)];
 if(wallet)ops.push(stmt('INSERT INTO ledger(id,user_id,amount,reason,reference,created) VALUES (?,?,?,?,?,?)',uid(),order.user_id,-wallet,'תשלום הזמנה בשילוב יתרה ואשראי','order:'+order.id,stamp),stmt('UPDATE users SET credits=credits-? WHERE id=?',wallet,order.user_id));
 ops.push(stmt('INSERT INTO records(id,kind,user_id,data,created,updated) VALUES (?,?,?,?,?,?)',event,'payment_event',order.user_id,JSON.stringify({order_id:order.id,...details}),stamp,stamp));
 await db().batch([...ops,...additional]);return {ok:true};
}
