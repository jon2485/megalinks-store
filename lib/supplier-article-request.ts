import type {Row} from './shared';
import {one,all,stmt,parse,now,assert,audit} from './server';
import {sendQueuedMail} from './mail';
import {pendingCancelRequest} from './cancel-request';

// Owner decision (22.11.2026): the supplier who received an article can ask for fixes or ask to reject it, with a text.
// The request never changes the order, never cancels, never refunds and never tells the customer. It only reaches the
// admin, who decides on the article screen: fixes -> return the article to the customer ("החזרה לעריכה", article-reopen)
// or let the supplier publish as is; rejection -> the existing cancel-and-refund window, or refuse with a note.
// One open request per article; earlier ones stay in `history`.
export const ISSUE_KIND='supplier_article_request';
export const issueRecordId=(articleId:string)=>'supplier-issue:'+articleId;
export type IssueType='fix'|'reject';
const TYPES:IssueType[]=['fix','reject'];
// Activity is recorded on the request (supplier-issue:<article>), not on the article: the customer sees the
// article's activity, and must not learn about the supplier's request.
const clip=(v:unknown,n:number)=>String(v??'').trim().slice(0,n);

/** SQL: the request `r` is open and its article `a` is still with the supplier (not cancelled, not back with the customer). */
export const openIssueSql=(r='r',a='a')=>`${r}.kind='${ISSUE_KIND}' AND json_extract(${r}.data,'$.status')='pending' AND ${a}.status='sent' AND COALESCE(json_extract(${a}.data,'$.cancel_pending'),0)=0 AND COALESCE(json_extract(${a}.data,'$.publication_refunded'),0)=0 AND json_extract(${a}.data,'$.supplier_hold_at') IS NULL`;

const articleData=(a:Row)=>typeof a.data==='string'?JSON.parse(a.data||'{}'):a.data||{};
/** A stored "pending" request that no longer applies: the article left the supplier (returned, cancelled) or a newer version went out. */
function stale(r:Row,a:Row){const d=articleData(a);return a.status!=='sent'||!!d.cancel_pending||!!d.publication_refunded||!!d.supplier_hold_at||(!!d.supplier_updated_at&&String(d.supplier_updated_at)>String(r.requested_at||''));}
async function stored(articleId:string){return parse(await one('SELECT * FROM records WHERE id=? AND kind=?',issueRecordId(articleId),ISSUE_KIND));}

/** What the supplier's link page shows: the open request, or the admin's last answer to a closed one. */
export async function issueForSupplier(a:Row){
 const r=await stored(a.id);if(!r)return null;
 if(r.status==='pending'&&!stale(r,a))return {open:true,type:r.type,text:r.text,at:r.requested_at};
 if(r.status==='dismissed')return {open:false,type:r.type,answer:r.decision_note||'',at:r.handled_at};
 return null;
}
/** The open request for the admin article screen, or null. */
export async function issueForAdmin(a:Row){
 const r=await stored(a.id);if(!r||r.status!=='pending'||stale(r,a))return null;
 return {type:r.type,text:r.text,at:r.requested_at};
}

/** The supplier, through its personal link (token already checked by the caller), asks for fixes or to reject. */
export async function requestSupplierIssue(a:Row,token:Row,b:Row,_origin:string){
 const type=String(b.issue) as IssueType,text=clip(b.text,1500),d=articleData(a);
 assert(TYPES.includes(type),'יש לבחור בקשת תיקונים או דחיית הכתבה');
 assert(text.length>=5,type==='fix'?'יש לכתוב מה צריך לתקן':'יש לכתוב למה אי אפשר לפרסם את הכתבה');
 assert(a.status==='sent'&&!d.supplier_hold_at,'הכתבה כבר אינה ממתינה לפרסום אצלכם',409);
 assert(!d.cancel_pending&&!d.publication_refunded,'הכתבה בטיפול ביטול. אין צורך לפרסם אותה',409);
 assert(!await pendingCancelRequest(a.order_id,a.id),'הכתבה בטיפול ביטול. נחזור אליכם בהקדם',409);
 const prior=await stored(a.id),stamp=now();
 assert(!(prior?.status==='pending'&&!stale(prior,a)),'כבר שלחתם בקשה, והיא ממתינה לתשובת המנהל',409);
 const history=[...(prior?.history||[]),...(prior?[{status:prior.status==='pending'?'returned':prior.status,type:prior.type,text:prior.text,requested_at:prior.requested_at,handled_at:prior.handled_at||'',decision_note:prior.decision_note||''}]:[])];
 const data={status:'pending',type,text,article_id:a.id,order_id:a.order_id,requested_at:stamp,history};
 // The upsert only replaces a closed request; a stale "pending" one is closed first so a parallel request cannot slip through.
 if(prior?.status==='pending')await stmt("UPDATE records SET data=json_set(data,'$.status','returned','$.handled_at',?),updated=? WHERE id=? AND json_extract(data,'$.requested_at')=?",stamp,stamp,issueRecordId(a.id),prior.requested_at).run();
 const saved=await stmt("INSERT INTO records(id,kind,user_id,data,created,updated) VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,updated=excluded.updated WHERE json_extract(records.data,'$.status')<>'pending'",issueRecordId(a.id),ISSUE_KIND,a.user_id,JSON.stringify(data),stamp,stamp).run();
 assert(saved.meta.changes,'כבר שלחתם בקשה, והיא ממתינה לתשובת המנהל',409);
 await audit({id:token.user_id},issueRecordId(a.id),type==='fix'?'הספק ביקש תיקונים בכתבה':'הספק ביקש לדחות את הכתבה',{text});
 // No e-mail about the request (owner, 22.11.2026: "הוא לא אמור לדעת מי ביקש"): the admin sees it in the work center
 // and on the article screen, and the customer only ever gets the admin's own words if the article is returned.
 return {ok:true,issue:{open:true,type,text,at:stamp}};
}

/** The admin closes the open request without changing the article: the supplier may publish, and gets the note by e-mail. */
export async function dismissSupplierIssue(a:Row,u:Row,b:Row){
 const r=await stored(a.id);assert(r&&r.status==='pending'&&!stale(r,a),'אין בקשה פתוחה מהספק לכתבה הזו',409);
 const note=clip(b.note,1500);assert(note.length>=2,r.type==='fix'?'יש לכתוב לספק הערה קצרה':'יש לכתוב לספק למה הבקשה נדחתה');
 const stamp=now();
 const done=await stmt("UPDATE records SET data=json_set(data,'$.status','dismissed','$.decision_note',?,'$.handled_at',?,'$.handled_by',?),updated=? WHERE id=? AND json_extract(data,'$.status')='pending' AND json_extract(data,'$.requested_at')=?",note,stamp,u.id,stamp,r.id,r.requested_at).run();
 assert(done.meta.changes,'הבקשה כבר טופלה',409);
 const mail=await answerSupplier(a,r.type,note,stamp);
 await audit(u,issueRecordId(a.id),r.type==='fix'?'בקשת התיקונים של הספק נסגרה, הספק יפרסם':'בקשת הדחייה של הספק סורבה',{note,supplier_mail:mail});
 return {ok:true,supplier_mail:mail};
}

/** Closes the open request when the admin returned the article to the customer ("החזרה לעריכה"). */
export async function closeIssueOnReopen(articleId:string,u:Row){
 const r=await stored(articleId);if(!r||r.status!=='pending')return;
 const stamp=now();
 const done=await stmt("UPDATE records SET data=json_set(data,'$.status','returned','$.handled_at',?,'$.handled_by',?),updated=? WHERE id=? AND json_extract(data,'$.status')='pending'",stamp,u.id,stamp,r.id).run();
 if(done.meta.changes)await audit(u,issueRecordId(articleId),'בקשת הספק טופלה: הכתבה הוחזרה ללקוח',{type:r.type});
}

// The answer goes out in the article's e-mail thread, to the same addresses as the first e-mail, with the same link.
// Also used for a published link the admin did not approve after the manual check (type 'link', supplier-link-review.ts).
export async function answerSupplier(a:Row,type:IssueType|'link',note:string,stamp:string){
 const first=parse(await one("SELECT * FROM jobs WHERE id=? AND kind='email'",'email:supplier:'+a.id));
 if(!first)return 'missing';
 const id='email:supplier-answer:'+a.id+':'+stamp;
 await stmt('INSERT OR IGNORE INTO jobs(id,user_id,kind,status,data,created,updated) VALUES (?,?,?,?,?,?,?)',id,a.user_id,'email','requested',JSON.stringify({to:first.to,subject:'',text:'',button:first.button,demo:!!first.demo,supplier_followup:'answer',supplier_article:a.id,answer_type:type,answer_note:note}),stamp,stamp).run();
 return (await sendQueuedMail(id))?.status||'requested';
}
