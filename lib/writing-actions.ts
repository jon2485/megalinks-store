import {one,parse,assert,admin,stmt,now,audit,syncOrder} from './server';
import {plainText,type Row} from './shared';
import {writingSubmitted,writingCustomerEditor,writingData} from './writing-workflow';
import {articleChecks} from './checks';
import {dispatchArticle} from './publication';
import {writingReadyMail,writingRevisionMail} from './writing-mail';
export async function writingAction(a:Row,u:Row,b:Row,origin:string,action:string){
 const data=writingData(a);assert(writingSubmitted(data),'הלקוח טרם שלח הנחיות לכותב',409);
 assert(Number(b.version)===a.version,'הכתבה עודכנה במקביל. טענו מחדש',409);
 const stamp=now(),d=JSON.parse(a.data);let next:string;
 if(action==='writing-complete'){
  admin(u);assert(['writing','revisions'].includes(a.status),'הכתבה אינה ממתינה לכותב',409);
  assert(plainText(a.content).trim(),'יש להוסיף את הטקסט המוכן בעורך');
  assert(['return','publish'].includes(b.action),'בחרו החזרה ללקוח או שליחה לפרסום');
  assert(b.action==='publish'?!!d.publish_without_review:!d.publish_without_review,'הפעולה אינה תואמת לבחירת הלקוח',409);
  if(b.action==='publish'){const validation=await articleChecks(a);assert(validation.ok,validation.errors.join(' · '),422);}
  next=b.action==='publish'?'approved':'review';d.writing_completed_at=stamp;if(next==='review')d.writing_returned_at=stamp;
 }else{
  assert(u.role!=='supplier'&&u.id===a.user_id,'בקשת תיקונים זמינה ללקוח של הכתבה בלבד',403);
  assert(['draft','review','revisions'].includes(a.status)&&writingCustomerEditor(data),'המאמר אינו פתוח לבדיקה',409);
  const note=String(b.note||'').trim();assert(note&&note.length<=3000,'יש לפרט את התיקונים המבוקשים (עד 3,000 תווים)');
  if(b.publish_without_review!==undefined){assert(typeof b.publish_without_review==='boolean','בחירת מסלול הפרסום אינה תקינה');d.publish_without_review=b.publish_without_review;}
  next='writing';d.writing_revision_note=note;d.writing_revision_requested_at=stamp;
 }
 const result=await stmt('UPDATE articles SET status=?,data=?,version=version+1,updated=? WHERE id=? AND version=?',next,JSON.stringify(d),stamp,a.id,a.version).run();assert(result.meta.changes,'הכתבה עודכנה במקביל',409);
 const updated={...a,data:JSON.stringify(d),status:next,version:a.version+1};
 await audit(u,a.id,next==='review'?'המאמר המוכן הוחזר ללקוח':next==='approved'?'כתיבה מקצועית אושרה לפרסום ללא החזרה':'הלקוח ביקש תיקונים מהכותב',{note:d.writing_revision_note||'',publish_without_review:!!d.publish_without_review});
 const mail=next==='review'?await writingReadyMail(updated,origin):next==='writing'?await writingRevisionMail(updated,origin):null;
 if(next==='approved')await dispatchArticle(updated,u,origin);
 await syncOrder(a.order_id);return {ok:true,status:next,mail_status:mail?.status||null};
}
