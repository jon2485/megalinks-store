import {one,all,stmt,assert,audit,now} from './server';
import type {Row} from './shared';

// A signed provider callback says a card was charged, but the money could not be applied to the order
// (already paid, wrong amount, or the order is closed). Nothing is credited or refunded automatically:
// the event is written once and waits for the admin. Admin-only data, never shown to the customer.
export const unappliedReasons:Record<string,string>={order_already_paid:'ההזמנה כבר שולמה',amount_mismatch:'הסכום אינו תואם להזמנה',order_not_payable:'ההזמנה אינה זמינה לתשלום'};
const unappliedActions:Record<string,string>={
 order_already_paid:'התקבל תשלום בכרטיס על הזמנה שכבר שולמה. הסכום לא זוכה, נדרש טיפול',
 amount_mismatch:'התקבל תשלום בכרטיס בסכום שאינו תואם להזמנה. הסכום לא זוכה, נדרש טיפול',
 order_not_payable:'התקבל תשלום בכרטיס על הזמנה שאינה זמינה לתשלום. הסכום לא זוכה, נדרש טיפול',
};
export const unappliedId=(eventId:string)=>'payment-unapplied:'+eventId;
/** Waiting for the admin. An event that was applied to its order later (same provider event id) is not open. */
export const unappliedOpenSql=(r='r')=>`${r}.kind='payment_unapplied' AND COALESCE(json_extract(${r}.data,'$.status'),'open')='open' AND NOT EXISTS(SELECT 1 FROM records applied WHERE applied.id='payment:'||json_extract(${r}.data,'$.event_id') AND applied.kind='payment_event')`;
export const unappliedReasonSql=(r='r')=>`CASE json_extract(${r}.data,'$.reason') ${Object.entries(unappliedReasons).map(([id,label])=>`WHEN '${id}' THEN '${label}'`).join(' ')} ELSE '' END`;
/** One record per provider event: a repeated callback writes nothing and adds no audit line. */
export async function recordUnappliedPayment(order:Row,eventId:string,amount:unknown,reason:keyof typeof unappliedActions){
 // A provider retry of an event that was already applied to its order is not a new charge.
 if(await one("SELECT id FROM records WHERE id=? AND kind='payment_event'",'payment:'+eventId))return false;
 const id=unappliedId(eventId),stamp=now(),cents=Number.isSafeInteger(Number(amount))&&Number(amount)>0?Number(amount):0;
 const details={order_id:order.id,order_number:order.number,amount_cents:cents,event_id:eventId,reason};
 const result=await stmt('INSERT OR IGNORE INTO records(id,kind,user_id,data,created,updated) VALUES (?,?,?,?,?,?)',id,'payment_unapplied',order.user_id,JSON.stringify({...details,user_id:order.user_id,status:'open'}),stamp,stamp).run();
 // The audit line is kept off the order itself: order activity is part of what the customer can read.
 if(result.meta.changes)await audit({id:order.user_id},id,unappliedActions[reason],details);
 return !!result.meta.changes;
}
export async function unappliedPaymentCount(){return Number((await one(`SELECT COUNT(*) AS n FROM records r WHERE ${unappliedOpenSql()}`))?.n||0);}
export async function adminUnappliedPayments(){
 const payments=await all(`SELECT r.id,r.created,json_extract(r.data,'$.order_id') AS order_id,COALESCE(o.number,json_extract(r.data,'$.order_number'),'') AS number,json_extract(r.data,'$.amount_cents') AS amount_cents,json_extract(r.data,'$.reason') AS reason,json_extract(r.data,'$.event_id') AS event_id,COALESCE(u.name,'') AS user_name,COALESCE(u.email,'') AS user_email FROM records r LEFT JOIN orders o ON o.id=json_extract(r.data,'$.order_id') LEFT JOIN users u ON u.id=r.user_id WHERE ${unappliedOpenSql()} ORDER BY r.created LIMIT 200`);
 return {payments:payments.map(p=>({...p,reason_label:unappliedReasons[p.reason]||''})),count:await unappliedPaymentCount()};
}
/** The admin closes the item with a note saying what was done. No money moves here. */
export async function handleUnappliedPayment(user:Row,body:Row){
 const id=typeof body.id==='string'?body.id:'',note=String(body.note||'').trim().slice(0,500);
 assert(id.startsWith('payment-unapplied:')&&id.length<200,'התשלום לא נמצא',404);assert(note.length>=2,'יש לכתוב מה נעשה עם התשלום');
 const row=await one("SELECT * FROM records WHERE id=? AND kind='payment_unapplied'",id);assert(row,'התשלום לא נמצא',404);
 const stamp=now(),result=await stmt("UPDATE records SET data=json_set(data,'$.status','handled','$.handled_at',?,'$.handled_by',?,'$.note',?),updated=? WHERE id=? AND kind='payment_unapplied' AND COALESCE(json_extract(data,'$.status'),'open')='open'",stamp,user.id,note,stamp,id).run();
 assert(result.meta.changes,'התשלום כבר סומן כטופל',409);
 const data=JSON.parse(row.data||'{}');await audit(user,id,'תשלום בכרטיס שלא זוכה סומן כטופל',{order_id:data.order_id,order_number:data.order_number,amount_cents:data.amount_cents,event_id:data.event_id,reason:data.reason,note});
 return {ok:true};
}
