import {all,ApiError} from './server';
/** Other payments that already use this bank reference. Rejected or cancelled requests do not count. */
export async function referenceUses(reference:unknown,orderId:string){
 const value=String(reference||'').trim();if(!value)return [] as string[];
 const rows=await all(`SELECT r.kind,o.number FROM records r LEFT JOIN orders o ON o.id=json_extract(r.data,'$.order_id') WHERE r.kind IN ('customer_payment_report','payment_event','wallet_topup') AND lower(trim(json_extract(r.data,'$.reference')))=lower(?) AND COALESCE(json_extract(r.data,'$.order_id'),'')<>? AND COALESCE(json_extract(r.data,'$.status'),'')<>'rejected' AND COALESCE(json_extract(r.data,'$.decision'),'') NOT IN ('rejected','cancelled')`,value,orderId);
 // Month payments list their orders instead of one order_id.
 const months=await all(`SELECT json_extract(r.data,'$.month') AS month FROM records r WHERE r.kind='monthly_payment' AND lower(trim(json_extract(r.data,'$.reference')))=lower(?) AND NOT EXISTS(SELECT 1 FROM json_each(r.data,'$.order_ids') j WHERE j.value=?)`,value,orderId);
 return [...new Set([...rows.map(r=>r.kind==='wallet_topup'?'הטענת יתרה':'הזמנה '+(r.number||'ללא מספר')),...months.map(m=>'חשבון חודשי '+(m.month||''))])];
}
/** referenceUses() for many reports in two queries in total (no queries per report). Same rules: the reference is
 *  trimmed here and compared lower-cased in SQL, the report's own order and rejected or cancelled requests don't count. */
export async function referenceUsesMany(items:{reference:unknown,orderId:string}[]){
 const values=items.map(x=>String(x.reference||'').trim()),list=[...new Set(values.filter(Boolean))];
 if(!list.length)return items.map(()=>[] as string[]);
 const rows=await all(`SELECT j.value AS input,r.kind,o.number,COALESCE(json_extract(r.data,'$.order_id'),'') AS order_id FROM json_each(?) j JOIN records r ON r.kind IN ('customer_payment_report','payment_event','wallet_topup') AND lower(trim(json_extract(r.data,'$.reference')))=lower(j.value) LEFT JOIN orders o ON o.id=json_extract(r.data,'$.order_id') WHERE COALESCE(json_extract(r.data,'$.status'),'')<>'rejected' AND COALESCE(json_extract(r.data,'$.decision'),'') NOT IN ('rejected','cancelled')`,JSON.stringify(list));
 const months=await all(`SELECT j.value AS input,json_extract(r.data,'$.month') AS month,COALESCE(json_extract(r.data,'$.order_ids'),'[]') AS order_ids FROM json_each(?) j JOIN records r ON r.kind='monthly_payment' AND lower(trim(json_extract(r.data,'$.reference')))=lower(j.value)`,JSON.stringify(list));
 return items.map((x,i)=>{const value=values[i];if(!value)return [] as string[];
  const own=rows.filter(r=>r.input===value&&String(r.order_id)!==String(x.orderId)),month=months.filter(m=>{if(m.input!==value)return false;let ids:unknown[]=[];try{ids=JSON.parse(String(m.order_ids));}catch{ids=[];}return !(Array.isArray(ids)&&ids.some(id=>id===x.orderId));});
  return [...new Set([...own.map(r=>r.kind==='wallet_topup'?'הטענת יתרה':'הזמנה '+(r.number||'ללא מספר')),...month.map(m=>'חשבון חודשי '+(m.month||''))])];});
}
export async function requireUnusedReference(reference:unknown,orderId:string,confirmed:unknown){
 if(confirmed===true)return;
 const uses=await referenceUses(reference,orderId);
 if(uses.length)throw Object.assign(new ApiError(409,'האסמכתא כבר נרשמה עבור: '+uses.join(', ')+'. יש לבדוק מול הבנק ולאשר שוב.'),{warnings:uses});
}
