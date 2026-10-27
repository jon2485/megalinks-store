import {one,parse,stmt,db,assert,now,connection,externalFetch,externalUrl} from './server';
import {financialGuard} from './monthly-order';
import type {Row} from './shared';

// Credit is granted only by a signed, amount-checked provider callback, never a browser return.
export async function createWalletCard(r:Request,u:Row,b:Row){
 const amount=Number(b.amount_cents),request=String(b.request_id||'');
 assert(Number.isSafeInteger(amount)&&amount>0&&amount<=100000000,'סכום אינו תקין');assert(/^[\w-]{8,80}$/.test(request),'מזהה בקשה אינו תקין');
 const c=await connection('payments');assert(c.enabled&&c.url&&c.secret,'חיבור הסליקה טרם הוגדר. לא בוצע חיוב או שינוי ביתרה',503);
 const id='topup:'+u.id+':'+request,prior=parse(await one('SELECT * FROM records WHERE id=?',id));
 if(prior){assert(prior.payment_method==='card'&&prior.amount_cents===amount,'הבקשה כבר נשמרה עם פרטים אחרים',409);if(prior.payment_url)return {payment_url:prior.payment_url,id};assert(prior.decision==='awaiting_gateway','הבקשה כבר נסגרה',409);}
 else await stmt('INSERT OR IGNORE INTO records(id,kind,user_id,data,created,updated) VALUES (?,?,?,?,?,?)',id,'wallet_topup',u.id,JSON.stringify({name:'הטענת יתרה באשראי',payment_method:'card',amount_cents:amount,decision:'awaiting_gateway',status:'open'}),now(),now()).run();
 const stored=parse(await one('SELECT * FROM records WHERE id=?',id));assert(stored?.amount_cents===amount&&stored.payment_method==='card','הבקשה כבר נשמרה עם פרטים אחרים',409);
 const response=await externalFetch(c.url,{method:'POST',headers:{Authorization:'Bearer '+c.secret,'Content-Type':'application/json','Idempotency-Key':id},body:JSON.stringify({event:'create_payment',purpose:'wallet_topup',topup_id:id,order_id:id,amount_cents:amount,currency:'ILS',customer:{name:u.name,email:u.email},return_url:new URL('/wallet',r.url).href,cancel_url:new URL('/wallet',r.url).href,callback_url:new URL('/api/payment-callback',r.url).href})});
 assert(response.ok,'ספק הסליקה לא החזיר קישור תשלום. ניתן לנסות שוב; היתרה לא עודכנה',502);const payload=await response.json() as Row,payment_url=externalUrl(payload.payment_url).href;
 await stmt("UPDATE records SET data=json_set(data,'$.payment_url',?),updated=? WHERE id=?",payment_url,now(),id).run();return {id,payment_url};
}
export async function completeWalletCard(b:Row){
 const id=String(b.topup_id||b.order_id||''),raw=await one('SELECT * FROM records WHERE id=? AND kind=?',id,'wallet_topup'),row=parse(raw);
 assert(row&&row.payment_method==='card','בקשת ההטענה לא נמצאה',404);assert(b.currency==='ILS'&&b.event_id&&String(b.event_id).length<=100,'אירוע סליקה אינו תקין');assert(Number.isSafeInteger(b.amount_cents)&&b.amount_cents===row.amount_cents,'סכום ההטענה אינו תואם',409);
 const event='wallet-gateway:'+String(b.event_id);if(row.decision==='approved'||await one('SELECT id FROM records WHERE id=?',event))return {ok:true,duplicate:true};
 assert(row.decision==='awaiting_gateway','בקשת ההטענה כבר נסגרה',409);assert(['paid','failed','cancelled'].includes(b.status),'מצב תשלום אינו תקין');
 // An unsuccessful attempt is informational; a later verified paid event may still settle it.
 if(b.status!=='paid'){await stmt("UPDATE records SET data=json_set(data,'$.gateway_last_status',?,'$.gateway_last_at',?),updated=? WHERE id=? AND json_extract(data,'$.decision')='awaiting_gateway'",b.status,now(),now(),id).run();return {ok:true,credited:false};}
 const user=await one('SELECT * FROM users WHERE id=?',row.user_id);assert(user,'לקוח לא נמצא',404);const stamp=now();
 try{await db().batch([financialGuard(user),stmt("UPDATE records SET data=CASE WHEN data=? THEN json_set(data,'$.decision','approved','$.status','closed','$.handled_at',?,'$.approved_at',?,'$.reference',?,'$.approval_type','gateway') ELSE NULL END,updated=? WHERE id=?",raw!.data,stamp,stamp,String(b.event_id),stamp,id),stmt('INSERT INTO ledger(id,user_id,amount,reason,reference,created) VALUES (?,?,?,?,?,?)','wallet-credit:'+id,row.user_id,row.amount_cents,'הטענת יתרה באשראי','wallet-card:'+id,stamp),stmt('UPDATE users SET credits=credits+? WHERE id=?',row.amount_cents,row.user_id),stmt('INSERT INTO records(id,kind,user_id,data,created,updated) VALUES (?,?,?,?,?,?)',event,'payment_event',row.user_id,JSON.stringify({topup_id:id,amount_cents:row.amount_cents}),stamp,stamp)]);}catch(e){if(parse(await one('SELECT * FROM records WHERE id=?',id))?.decision==='approved')return {ok:true,duplicate:true};throw e;}
 return {ok:true,credited:true};
}
