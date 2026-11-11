import type {Row} from './shared';
import {one,all,stmt,now,assert,admin,audit,parse} from './server';
import {queueMail} from './mail';

// Owner rule (11.11.2026): a customer never cancels alone. The customer asks to cancel the whole order or one site
// in it; the admin approves (the regular order cancel, or the existing item "cancel and credit" for one site)
// or rejects with a note the customer sees.
export const cancelRequestId=(orderId:string)=>'cancel-request:'+orderId;
// A whole-order request holds every article of the order; a one-site request holds only that article.
export const pendingCancelRequestSql=(orderId:string,articleId:string)=>`EXISTS(SELECT 1 FROM records cr WHERE cr.id='cancel-request:'||${orderId} AND cr.kind='order_cancel_request' AND json_extract(cr.data,'$.status')='pending' AND (COALESCE(json_extract(cr.data,'$.scope'),'order')='order' OR json_extract(cr.data,'$.article_id')=${articleId}))`;
const orderLink=(origin:string,orderId:string)=>origin+'/purchased/articles/order/'+encodeURIComponent(orderId);
const isDemo=(o:Row)=>{try{return !!(typeof o.data==='string'?JSON.parse(o.data||'{}'):o.data||{}).demo||!!o.demo;}catch{return !!o.demo;}};
const siteLabel=(a:Row)=>String(a.website_url||a.website_name||'').replace(/^https?:\/\//,'').replace(/\/$/,'')||'אתר בהזמנה';

export async function pendingCancelRequest(orderId:string,articleId?:string){
 const r=parse(await one("SELECT * FROM records WHERE id=? AND kind='order_cancel_request' AND json_extract(data,'$.status')='pending'",cancelRequestId(orderId)));
 if(!r)return null;if(articleId&&r.scope==='article'&&r.article_id!==articleId)return null;return r;
}
const blockedText=(r:Row)=>r.scope==='article'?'הלקוח ביקש לבטל את האתר הזה בהזמנה. יש לאשר או לדחות את הבקשה לפני ההמשך.':'הלקוח ביקש לבטל את ההזמנה. יש לאשר או לדחות את הבקשה לפני ההמשך.';
export async function assertNoCancelRequest(orderId:string,articleId:string){const r=await pendingCancelRequest(orderId,articleId);assert(!r,r?blockedText(r):'',409);}

export async function requestOrderCancel(order:Row,u:Row,b:Row,origin:string){
 assert(u.id===order.user_id,'רק הלקוח של ההזמנה יכול לבקש ביטול',403);
 assert(!['cancelled','completed'].includes(order.status),'ההזמנה כבר נסגרה',409);
 const articles=await all('SELECT a.id,a.status,a.title,a.data,w.name AS website_name,w.url AS website_url FROM articles a LEFT JOIN websites w ON w.id=a.website_id WHERE a.order_id=?',order.id);
 const open=(a:Row)=>{const d=JSON.parse(a.data||'{}');return a.status!=='cancelled'&&!d.publication_refunded&&!d.cancel_pending;};
 const scope=b.scope==='article'?'article':'order';let target:Row|undefined;
 if(scope==='article'){
  target=articles.find(a=>a.id===b.article_id);assert(target,'האתר לא נמצא בהזמנה הזו',404);
  assert(open(target!),'האתר הזה כבר בוטל או בטיפול ביטול',409);
  assert(target!.status!=='published','הכתבה באתר הזה כבר פורסמה ואי אפשר לבטל אותה',409);
 }else{
  assert(articles.some(open),'כל פריטי ההזמנה כבר בוטלו',409);
  assert(articles.every(a=>!['sent','published'].includes(a.status)),'חלק מהאתרים כבר נשלחו לפרסום. אפשר לבקש ביטול של אתר אחד בכל פעם.',409);
 }
 const reason=String(b.reason||'').trim().slice(0,1500);assert(reason.length>=2,'יש לכתוב את סיבת הביטול');
 const id=cancelRequestId(order.id),prior=parse(await one('SELECT * FROM records WHERE id=?',id));
 assert(prior?.status!=='pending','בקשת ביטול כבר נשלחה ומחכה לאישור המנהל',409);
 const stamp=now(),history=[...(prior?.history||[]),...(prior?[{status:prior.status,scope:prior.scope||'order',article_id:prior.article_id||'',reason:prior.reason,decision_note:prior.decision_note||'',requested_at:prior.requested_at,handled_at:prior.handled_at||''}]:[])];
 const label=target?siteLabel(target):'';
 const data={status:'pending',scope,...(target?{article_id:target.id,target:label,article_title:target.title||''}:{}),order_id:order.id,order_number:order.number,reason,requested_at:stamp,requested_by:u.id,history};
 const saved=await stmt("INSERT INTO records(id,kind,user_id,data,created,updated) VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,updated=excluded.updated WHERE json_extract(records.data,'$.status')<>'pending'",id,'order_cancel_request',order.user_id,JSON.stringify(data),stamp,stamp).run();
 assert(saved.meta.changes,'בקשת ביטול כבר נשלחה ומחכה לאישור המנהל',409);
 await audit(u,order.id,scope==='article'?'הלקוח ביקש לבטל אתר בהזמנה':'הלקוח ביקש לבטל את ההזמנה',{reason,...(target?{article_id:target.id,site:label}:{})});
 const demo=isDemo(order),what=scope==='article'?'את האתר '+label+' בהזמנה '+order.number:'את ההזמנה '+order.number;
 for(const user of await all("SELECT email FROM users WHERE role='admin'"))if(user.email)try{await queueMail('email:cancel-request:'+order.id+':'+stamp+':'+user.email,order.user_id,{to:user.email,subject:'בקשת ביטול להזמנה '+order.number,text:'הלקוח ביקש לבטל '+what+'.\nסיבה: '+reason,button:{label:'טיפול בבקשה',url:origin+'/admin-order/'+encodeURIComponent(order.id)},demo,order_id:order.id});}catch{/* the request is saved; the work center shows it even if the mail fails */}
 return {ok:true,pending:true,scope};
}

export async function rejectOrderCancel(order:Row,u:Row,b:Row,origin:string){
 admin(u);
 const note=String(b.note||'').trim().slice(0,1500);assert(note.length>=2,'יש לכתוב ללקוח למה הבקשה נדחתה');
 const current=await pendingCancelRequest(order.id);assert(current,'אין בקשת ביטול ממתינה להזמנה הזו',409);
 const stamp=now(),result=await stmt("UPDATE records SET data=json_set(data,'$.status','rejected','$.decision_note',?,'$.handled_at',?,'$.handled_by',?),updated=? WHERE id=? AND kind='order_cancel_request' AND json_extract(data,'$.status')='pending'",note,stamp,u.id,stamp,cancelRequestId(order.id)).run();
 assert(result.meta.changes,'אין בקשת ביטול ממתינה להזמנה הזו',409);
 await audit(u,order.id,'בקשת הביטול נדחתה',{note});
 const customer=await one('SELECT email FROM users WHERE id=?',order.user_id);let mail_status='skipped';
 const what=current!.scope==='article'?'לאתר '+current!.target+' בהזמנה '+order.number:'להזמנה '+order.number;
 if(customer?.email)try{mail_status=(await queueMail('email:cancel-rejected:'+order.id+':'+stamp,order.user_id,{to:customer.email,subject:'בקשת הביטול '+what+' לא אושרה',text:'בקשת הביטול '+what+' לא אושרה, וההזמנה ממשיכה כרגיל.\n'+note,button:{label:'צפייה בהזמנה',url:orderLink(origin,order.id)},demo:isDemo(order),order_id:order.id}))?.status||'requested';}catch{mail_status='failed';}
 return {ok:true,mail_status};
}

/** Called after the admin cancelled the order, or cancelled and credited the requested site: closes the request and tells the customer. */
export async function approveOrderCancel(order:Row,u:Row,note:string,origin:string,articleId?:string){
 const current=await pendingCancelRequest(order.id);if(!current)return;
 if(articleId&&current.scope==='article'&&current.article_id!==articleId)return;
 if(!articleId&&current.scope==='article'){/* a whole-order cancel also settles a one-site request */}
 const stamp=now(),result=await stmt("UPDATE records SET data=json_set(data,'$.status','approved','$.decision_note',?,'$.handled_at',?,'$.handled_by',?),updated=? WHERE id=? AND kind='order_cancel_request' AND json_extract(data,'$.status')='pending'",note,stamp,u.id,stamp,cancelRequestId(order.id)).run();
 if(!result.meta.changes)return;
 const customer=await one('SELECT email FROM users WHERE id=?',order.user_id);
 const what=current.scope==='article'&&articleId?'האתר '+current.target+' בהזמנה '+order.number+' בוטל':'ההזמנה '+order.number+' בוטלה';
 if(customer?.email)try{await queueMail('email:cancel-approved:'+order.id+':'+stamp,order.user_id,{to:customer.email,subject:'בקשת הביטול אושרה · '+order.number,text:what+' לפי בקשתך.'+(note?'\n'+note:''),button:{label:'צפייה בהזמנה',url:orderLink(origin,order.id)},demo:isDemo(order),order_id:order.id});}catch{/* the cancellation is already saved */}
}
