import type {Row} from './shared';
import {db,one,stmt,parse,now,assert,audit,syncOrder} from './server';
import {articleGuard} from './monthly-order';
import {publicationPeriod} from './publication-period';
import {articleMail} from './mail';
import {answerSupplier} from './supplier-article-request';

// Owner decision (23.11.2026): when the automatic check cannot read the supplier's published page (no answer, the
// site refused the check, a server error), the link is accepted as "ממתין לבדיקה ידנית". The article stays "sent"
// (with the supplier) until the admin opens the link and decides:
//  approve -> the normal published flow (article published, supplier link closed, the customer's published e-mail);
//  reject  -> back to the supplier with the admin's reason (link page and e-mail), who can send a corrected link.
// The customer hears nothing until the admin approves. One record per article; earlier ones stay in `history`.
export const LINK_REVIEW_KIND='supplier_link_review';
export const linkReviewId=(articleId:string)=>'supplier-link-review:'+articleId;
const clip=(v:unknown,n:number)=>String(v??'').trim().slice(0,n);
const articleData=(a:Row)=>typeof a.data==='string'?JSON.parse(a.data||'{}'):a.data||{};

/** SQL: the review `r` waits for the admin and its article `a` is still with the supplier. */
export const pendingLinkReviewSql=(r='r',a='a')=>`${r}.kind='${LINK_REVIEW_KIND}' AND json_extract(${r}.data,'$.status')='pending' AND ${a}.status='sent' AND COALESCE(json_extract(${a}.data,'$.cancel_pending'),0)=0 AND COALESCE(json_extract(${a}.data,'$.publication_refunded'),0)=0 AND json_extract(${a}.data,'$.supplier_hold_at') IS NULL AND COALESCE(json_extract(${a}.data,'$.supplier_updated_at'),'')<=json_extract(${r}.data,'$.submitted_at')`;
/** SQL for an article alias: it has a link waiting for the manual check (so it is not "late at the supplier"). */
export const hasPendingLinkReviewSql=(a='a')=>`EXISTS(SELECT 1 FROM records lr WHERE lr.id='supplier-link-review:'||${a}.id AND ${pendingLinkReviewSql('lr',a)})`;

/** A stored review that no longer applies: the article left the supplier, or a newer version went out. */
function stale(r:Row,a:Row){const d=articleData(a);return a.status!=='sent'||!!d.cancel_pending||!!d.publication_refunded||!!d.supplier_hold_at||(!!d.supplier_updated_at&&String(d.supplier_updated_at)>String(r.submitted_at||''));}
async function stored(articleId:string){return parse(await one('SELECT * FROM records WHERE id=? AND kind=?',linkReviewId(articleId),LINK_REVIEW_KIND));}

/** Saves the link for the manual check. A link sent again replaces the waiting one. */
export async function saveLinkReview(a:Row,url:string,check:Row,by:Row,via:'token'|'inbox'){
 const prior=await stored(a.id),stamp=now();
 const history=[...(prior?.history||[]),...(prior?[{status:prior.status==='pending'?'replaced':prior.status,url:prior.url,review_reason:prior.review_reason,submitted_at:prior.submitted_at,handled_at:prior.handled_at||'',decision_note:prior.decision_note||''}]:[])].slice(-10);
 const data={status:'pending',article_id:a.id,order_id:a.order_id,url,final_url:check.final_url||'',reason:check.reason||'',status_code:check.status??null,review_reason:clip(check.review_reason,300),submitted_at:stamp,submitted_by:by.id||'',via,history};
 await stmt('INSERT INTO records(id,kind,user_id,data,created,updated) VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,updated=excluded.updated',linkReviewId(a.id),LINK_REVIEW_KIND,a.user_id,JSON.stringify(data),stamp,stamp).run();
 // Recorded on the review, not on the article: the customer sees the article's activity.
 await audit({id:by.id},linkReviewId(a.id),'הקישור התקבל וממתין לבדיקה ידנית',{url,reason:data.review_reason});
 return {ok:true,manual_review:true,message:String(check.message||''),link_review:{status:'pending',url,at:stamp}};
}

/** What the supplier's link page shows: the link waiting for the check, or the admin's reason after a rejection. */
export async function linkReviewForSupplier(a:Row){
 const r=await stored(a.id);if(!r||stale(r,a))return null;
 if(r.status==='pending')return {status:'pending',url:r.url,at:r.submitted_at};
 if(r.status==='rejected')return {status:'rejected',url:r.url,note:r.decision_note||'',at:r.handled_at};
 return null;
}
/** The waiting link for the admin's article screen, or null. */
export async function linkReviewForAdmin(a:Row){
 const r=await stored(a.id);if(!r||r.status!=='pending'||stale(r,a))return null;
 return {url:r.url,reason:r.review_reason||'',status_code:r.status_code??null,at:r.submitted_at,via:r.via||''};
}

/** The admin opened the link and it is right: the same steps as a link that passed the automatic check. */
export async function approveLinkReview(a:Row,u:Row,origin:string){
 const r=await stored(a.id);assert(r&&r.status==='pending'&&!stale(r,a),'אין קישור שממתין לבדיקה בכתבה הזו',409);
 const url=String(r.url||''),publication=publicationPeriod(),stamp=now();
 const result=await db().batch([articleGuard(a),
  stmt("UPDATE articles SET status='published',published_url=?,version=version+1,updated=?,data=json_set(data,'$.published_month',?,'$.published_at',?) WHERE id=? AND status='sent'",url,publication.stamp,publication.month,publication.stamp,a.id),
  stmt("UPDATE records SET data=json_set(data,'$.status','approved','$.handled_at',?,'$.handled_by',?),updated=? WHERE id=? AND json_extract(data,'$.status')='pending' AND json_extract(data,'$.submitted_at')=?",stamp,u.id,stamp,r.id,r.submitted_at)]);
 assert(result[1].meta.changes===1&&result[2].meta.changes===1,'הכתבה כבר טופלה',409);
 await stmt("UPDATE jobs SET status='completed',updated=? WHERE id=? AND kind='supplier_publication'",stamp,'publication:'+a.id).run();
 await stmt("UPDATE tokens SET used=1 WHERE kind='supplier' AND resource=?",a.id).run();
 await audit({id:r.submitted_by||u.id},a.id,'הספק דיווח על פרסום',{url});
 await audit(u,linkReviewId(a.id),'הקישור אושר אחרי בדיקה ידנית',{url});
 await articleMail({...a,published_url:url},'published',origin);
 await syncOrder(a.order_id);
 return {ok:true,published_url:url};
}

/** The admin did not approve the link: the supplier sees the reason on the link page and by e-mail, and sends another. */
export async function rejectLinkReview(a:Row,u:Row,b:Row){
 const r=await stored(a.id);assert(r&&r.status==='pending'&&!stale(r,a),'אין קישור שממתין לבדיקה בכתבה הזו',409);
 const note=clip(b.note,1500);assert(note.length>=2,'יש לכתוב לספק למה הקישור לא אושר');
 const stamp=now();
 const done=await stmt("UPDATE records SET data=json_set(data,'$.status','rejected','$.decision_note',?,'$.handled_at',?,'$.handled_by',?),updated=? WHERE id=? AND json_extract(data,'$.status')='pending' AND json_extract(data,'$.submitted_at')=?",note,stamp,u.id,stamp,r.id,r.submitted_at).run();
 assert(done.meta.changes,'הקישור כבר טופל',409);
 const mail=await answerSupplier(a,'link',note,stamp);
 await audit(u,linkReviewId(a.id),'הקישור לא אושר בבדיקה ידנית, הוחזר לספק',{url:r.url,note,supplier_mail:mail});
 return {ok:true,supplier_mail:mail};
}
