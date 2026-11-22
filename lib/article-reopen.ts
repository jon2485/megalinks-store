import {articleMail,sendQueuedMail} from './mail';
import {assertNoCancelRequest} from './cancel-request';
import {one,stmt,parse,now,assert,audit,notify,syncOrder} from './server';
import type {Row} from './shared';

// Owner decision (22.11.2026): an approved article is locked for the customer, but the admin can return it
// for editing as long as it is not published. When it is already with the supplier, the supplier's link stays
// alive and shows a waiting page, the stock slot stays held, and the supplier gets an e-mail in the same thread.
// After the next approval the supplier gets the updated version on the same link (resumeHeldArticle).
export const REOPEN_STATUSES=['approved','sent'];
const maxText=(v:unknown,n:number)=>String(v??'').slice(0,n);

export async function reopenApprovedArticle(a:Row,u:Row,body:Row,origin:string){
 const d=JSON.parse(a.data||'{}');
 assert(REOPEN_STATUSES.includes(a.status),'אפשר להחזיר לעריכה רק כתבה שאושרה ועוד לא פורסמה',409);
 assert(!a.published_url&&!d.cancel_pending&&!d.publication_refunded,'הכתבה פורסמה או בביטול, ואי אפשר להחזיר אותה לעריכה',409);
 await assertNoCancelRequest(a.order_id,a.id);
 assert(Number(body.version)===a.version,'הכתבה עודכנה במקביל. טענו מחדש ונסו שוב',409);
 const note=maxText(body.note,3000).trim();
 assert(note,'יש לכתוב ללקוח מה צריך לשנות');
 // A writer's article goes back to the customer's review screen; "revisions" would put it in the writer's queue.
 const next=d.editorial?'review':'revisions',held=a.status==='sent',stamp=now();
 const data={...d,reopened_at:stamp,reopen_note:note};
 delete data.dispatch_at;delete data.dispatch_attempted_at;
 if(held)data.supplier_hold_at=stamp;
 const result=await stmt('UPDATE articles SET status=?,data=?,version=version+1,updated=? WHERE id=? AND version=? AND status=?',next,JSON.stringify(data),stamp,a.id,a.version,a.status).run();
 assert(result.meta.changes,'הכתבה עודכנה במקביל. טענו מחדש ונסו שוב',409);
 const fresh={...a,status:next,version:a.version+1,data:JSON.stringify(data)};
 await articleMail(fresh,'revisions',origin,note);
 let supplier_mail='';
 if(held)supplier_mail=await supplierFollowUp(fresh,'hold');
 await audit(u,a.id,'הכתבה הוחזרה לעריכה אחרי אישור',{from:a.status,to:next,note,supplier_hold:held,supplier_mail});
 const customer=await one('SELECT email,phone FROM users WHERE id=?',a.user_id);
 await notify(u,'article_status',{article_id:a.id,status:next,recipient_email:customer?.email,recipient_phone:customer?.phone});
 await syncOrder(a.order_id);
 return {ok:true,status:next,supplier_hold:held,supplier_mail};
}

/** A follow-up to the supplier's first e-mail of this article, in the same thread, with the same link.
 *  hold: wait with publishing. update: the updated version, with the new Word file. */
export async function supplierFollowUp(article:Row,kind:'hold'|'update'){
 const first=parse(await one("SELECT * FROM jobs WHERE id=? AND kind='email'",'email:supplier:'+article.id));
 if(!first)return 'missing';
 const id='email:supplier-'+kind+':'+article.id+':'+article.version;
 const mail:Row={to:first.to,subject:'',text:'',button:first.button,demo:!!first.demo,supplier_followup:kind,supplier_article:article.id};
 if(kind==='update'){mail.attach_article=article.id;mail.attach_images=true;}
 await stmt('INSERT OR IGNORE INTO jobs(id,user_id,kind,status,data,created,updated) VALUES (?,?,?,?,?,?,?)',id,article.user_id,'email','requested',JSON.stringify(mail),now(),now()).run();
 return (await sendQueuedMail(id))?.status||'requested';
}
