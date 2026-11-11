import {all,ApiError} from './server';
/** Other payments that already use this bank reference. Rejected or cancelled requests do not count. */
export async function referenceUses(reference:unknown,orderId:string){
 const value=String(reference||'').trim();if(!value)return [] as string[];
 const rows=await all(`SELECT r.kind,o.number FROM records r LEFT JOIN orders o ON o.id=json_extract(r.data,'$.order_id') WHERE r.kind IN ('customer_payment_report','payment_event','wallet_topup') AND lower(trim(json_extract(r.data,'$.reference')))=lower(?) AND COALESCE(json_extract(r.data,'$.order_id'),'')<>? AND COALESCE(json_extract(r.data,'$.status'),'')<>'rejected' AND COALESCE(json_extract(r.data,'$.decision'),'') NOT IN ('rejected','cancelled')`,value,orderId);
 // Month payments list their orders instead of one order_id.
 const months=await all(`SELECT json_extract(r.data,'$.month') AS month FROM records r WHERE r.kind='monthly_payment' AND lower(trim(json_extract(r.data,'$.reference')))=lower(?) AND NOT EXISTS(SELECT 1 FROM json_each(r.data,'$.order_ids') j WHERE j.value=?)`,value,orderId);
 return [...new Set([...rows.map(r=>r.kind==='wallet_topup'?'הטענת יתרה':'הזמנה '+(r.number||'ללא מספר')),...months.map(m=>'חשבון חודשי '+(m.month||''))])];
}
export async function requireUnusedReference(reference:unknown,orderId:string,confirmed:unknown){
 if(confirmed===true)return;
 const uses=await referenceUses(reference,orderId);
 if(uses.length)throw Object.assign(new ApiError(409,'האסמכתא כבר נרשמה עבור: '+uses.join(', ')+'. יש לבדוק מול הבנק ולאשר שוב.'),{warnings:uses});
}
