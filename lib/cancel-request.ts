import type {Row} from './shared';
import {one,all,stmt,now,assert,admin,audit,parse} from './server';
import {queueMail} from './mail';

// Owner rule (11.11.2026): a customer never cancels an order alone. The customer sends a request,
// and the admin approves it (the regular order cancel runs) or rejects it with a note the customer sees.
export const cancelRequestId=(orderId:string)=>'cancel-request:'+orderId;
export const pendingCancelRequestSql=(orderId:string)=>`EXISTS(SELECT 1 FROM records cr WHERE cr.id='cancel-request:'||${orderId} AND cr.kind='order_cancel_request' AND json_extract(cr.data,'$.status')='pending')`;
const orderLink=(origin:string,orderId:string)=>origin+'/purchased/articles/order/'+encodeURIComponent(orderId);

export async function pendingCancelRequest(orderId:string){
 return parse(await one("SELECT * FROM records WHERE id=? AND kind='order_cancel_request' AND json_extract(data,'$.status')='pending'",cancelRequestId(orderId)));
}

export async function requestOrderCancel(order:Row,u:Row,b:Row,origin:string){
 assert(u.id===order.user_id,'רק הלקוח של ההזמנה יכול לבקש לבטל אותה',403);
 assert(!['cancelled','completed'].includes(order.status),'ההזמנה כבר נסגרה',409);
 const articles=await all('SELECT status FROM articles WHERE order_id=?',order.id);
 assert(articles.some(a=>a.status!=='cancelled'),'כל פריטי ההזמנה כבר בוטלו',409);
 assert(articles.every(a=>!['sent','published'].includes(a.status)),'חלק מהכתבות כבר נשלחו לפרסום. לביטול יש לפנות אלינו בפנייה.',409);
 const reason=String(b.reason||'').trim().slice(0,1500);assert(reason.length>=2,'יש לכתוב את סיבת הביטול');
 const id=cancelRequestId(order.id),prior=parse(await one('SELECT * FROM records WHERE id=?',id));
 assert(prior?.status!=='pending','בקשת ביטול כבר נשלחה ומחכה לאישור המנהל',409);
 const stamp=now(),history=[...(prior?.history||[]),...(prior?[{status:prior.status,reason:prior.reason,decision_note:prior.decision_note||'',requested_at:prior.requested_at,handled_at:prior.handled_at||''}]:[])];
 const data={status:'pending',order_id:order.id,order_number:order.number,reason,requested_at:stamp,requested_by:u.id,history};
 const saved=await stmt("INSERT INTO records(id,kind,user_id,data,created,updated) VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,updated=excluded.updated WHERE json_extract(records.data,'$.status')<>'pending'",id,'order_cancel_request',order.user_id,JSON.stringify(data),stamp,stamp).run();
 assert(saved.meta.changes,'בקשת ביטול כבר נשלחה ומחכה לאישור המנהל',409);
 await audit(u,order.id,'הלקוח ביקש לבטל את ההזמנה',{reason});
 const demo=!!JSON.parse(order.data||'{}').demo;
 for(const user of await all("SELECT email FROM users WHERE role='admin'"))if(user.email)try{await queueMail('email:cancel-request:'+order.id+':'+stamp+':'+user.email,order.user_id,{to:user.email,subject:'בקשת ביטול להזמנה '+order.number,text:'הלקוח ביקש לבטל את ההזמנה '+order.number+'.\nסיבה: '+reason,button:{label:'טיפול בבקשה',url:origin+'/admin-order/'+encodeURIComponent(order.id)},demo,order_id:order.id});}catch{/* the request is saved; the work center shows it even if the mail fails */}
 return {ok:true,pending:true};
}

export async function rejectOrderCancel(order:Row,u:Row,b:Row,origin:string){
 admin(u);
 const note=String(b.note||'').trim().slice(0,1500);assert(note.length>=2,'יש לכתוב ללקוח למה הבקשה נדחתה');
 const stamp=now(),result=await stmt("UPDATE records SET data=json_set(data,'$.status','rejected','$.decision_note',?,'$.handled_at',?,'$.handled_by',?),updated=? WHERE id=? AND kind='order_cancel_request' AND json_extract(data,'$.status')='pending'",note,stamp,u.id,stamp,cancelRequestId(order.id)).run();
 assert(result.meta.changes,'אין בקשת ביטול ממתינה להזמנה הזו',409);
 await audit(u,order.id,'בקשת הביטול נדחתה',{note});
 const customer=await one('SELECT email FROM users WHERE id=?',order.user_id);let mail_status='skipped';
 if(customer?.email)try{mail_status=(await queueMail('email:cancel-rejected:'+order.id+':'+stamp,order.user_id,{to:customer.email,subject:'בקשת הביטול להזמנה '+order.number+' לא אושרה',text:'בקשת הביטול להזמנה '+order.number+' לא אושרה, וההזמנה ממשיכה כרגיל.\n'+note,button:{label:'צפייה בהזמנה',url:orderLink(origin,order.id)},demo:!!JSON.parse(order.data||'{}').demo,order_id:order.id}))?.status||'requested';}catch{mail_status='failed';}
 return {ok:true,mail_status};
}

/** Called after the admin cancelled the order: closes a pending request and tells the customer. */
export async function approveOrderCancel(order:Row,u:Row,note:string,origin:string){
 const stamp=now(),result=await stmt("UPDATE records SET data=json_set(data,'$.status','approved','$.decision_note',?,'$.handled_at',?,'$.handled_by',?),updated=? WHERE id=? AND kind='order_cancel_request' AND json_extract(data,'$.status')='pending'",note,stamp,u.id,stamp,cancelRequestId(order.id)).run();
 if(!result.meta.changes)return;
 const customer=await one('SELECT email FROM users WHERE id=?',order.user_id);
 if(customer?.email)try{await queueMail('email:cancel-approved:'+order.id+':'+stamp,order.user_id,{to:customer.email,subject:'בקשת הביטול להזמנה '+order.number+' אושרה',text:'ההזמנה '+order.number+' בוטלה לפי בקשתך.'+(note?'\n'+note:''),button:{label:'צפייה בהזמנה',url:orderLink(origin,order.id)},demo:!!JSON.parse(order.data||'{}').demo,order_id:order.id});}catch{/* cancellation is already saved */}
}
