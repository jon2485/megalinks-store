import {all,parse} from './server';
import type {Row} from './shared';
// Only the payment date is exposed publicly. References and staff identities
// remain in private records and are attached exclusively to admin responses.
export function paymentDateSql(alias='o'){
 return `CASE WHEN ${alias}.paid=1 AND COALESCE(json_extract(${alias}.data,'$.demo'),0)=0 THEN COALESCE(
 json_extract(${alias}.data,'$.payment_date'),json_extract(${alias}.data,'$.paid_at'),
 (SELECT COALESCE(json_extract(r.data,'$.payment_date'),r.created) FROM records r WHERE r.id='paid-order:'||${alias}.id),
 (SELECT json_extract(r.data,'$.payment_date') FROM records r WHERE r.kind='monthly_payment' AND EXISTS(SELECT 1 FROM json_each(r.data,'$.order_ids') j WHERE j.value=${alias}.id) ORDER BY r.created LIMIT 1),
 (SELECT r.created FROM records r WHERE r.kind='payment_event' AND json_extract(r.data,'$.order_id')=${alias}.id ORDER BY r.created LIMIT 1),
 CASE WHEN ${alias}.payment='credits' THEN ${alias}.created END) END AS paid_date`;
}
export async function paymentEvidenceRows(userId?:string){return (await all(`SELECT r.*,u.name AS approved_by_name FROM records r LEFT JOIN users u ON u.id=COALESCE(json_extract(r.data,'$.actor'),json_extract(r.data,'$.recorded_by')) WHERE r.kind IN ('payment_completion','monthly_payment') ${userId?'AND r.user_id=?':''} ORDER BY r.created DESC`,...(userId?[userId]:[]))).map(parse) as Row[];}
export function orderPaymentEvidence(order:Row,rows:Row[]){
 const receipt=rows.find(r=>r.id==='paid-order:'+order.id||(r.kind==='monthly_payment'&&r.order_ids?.includes(order.id)));
 if(!order.paid&&!order.settled&&!order.payment_settled)return null;
 if(order.demo)return null;
 return {payment_date:order.paid_date||order.payment_date||order.paid_at||receipt?.payment_date||receipt?.created||null,payment_method:receipt?.payment_method||order.payment,amount_cents:order.total,reference:receipt?.reference||'',approved_by_name:receipt?.approved_by_name||'',approval_type:receipt?.actor||receipt?.recorded_by||['invoice','bank_transfer'].includes(order.payment)||order.on_account?'manager':order.payment==='credits'?'wallet':'gateway',monthly_payment_amount:receipt?.kind==='monthly_payment'?receipt.amount:null};
}
