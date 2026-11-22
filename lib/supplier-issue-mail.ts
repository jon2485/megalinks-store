import type {Row} from './shared';

// Owner decision (22.11.2026): under the main "send the published link" button the supplier gets one small link
// to the same page, opened on the fixes/rejection option (#issue). Kept apart from the article e-mail body so the
// reopen work (hold / update e-mails) and this one merge cleanly.
const esc=(v:unknown)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
/** Only a personal token link gets it; the demo portal has no such page. */
export const supplierIssueUrl=(link:string)=>/\/supplier\/[^/#?]+$/.test(link)?link+'#issue':'';
export function supplierIssueLinkHtml(link:string){
 const url=supplierIssueUrl(link);if(!url)return '';
 return `<p dir="rtl" style="margin:16px 0 0;font-size:14px;line-height:1.6;color:#4f5d6e;text-align:center">יש בעיה בכתבה? <a href="${esc(url)}" style="color:#1673e6;font-weight:700;text-decoration:underline">בקשת תיקונים או דחיית הכתבה</a></p>`;
}
export const supplierIssueLinkText=(link:string)=>{const url=supplierIssueUrl(link);return url?'יש בעיה בכתבה? בקשת תיקונים או דחיית הכתבה: '+url:'';};

/** The admin's answer when the supplier's request is closed without changing the article: the supplier may publish. */
export function supplierAnswerEmailHtml(article:Row,websiteName:string,counterLabel:string,link:string,origin:string,type:string,note:string){
 const ink='#0b1b2f',muted='#4f5d6e',faint='#7b8796',line='#e6ecf2',blue='#1673e6';
 // type 'link' (23.11.2026): the admin checked by hand a link the system could not read, and did not approve it.
 const isLink=type==='link';
 const title=isLink?'הקישור ששלחתם לא אושר':type==='reject'?'הכתבה נשארת לפרסום':'אפשר לפרסם את הכתבה כמו שהיא';
 const lead=isLink?'בדקנו בעצמנו את הקישור ששלחתם, ולא יכולנו לאשר אותו. ההסבר שלנו כאן. אחרי התיקון, שלחו את הקישור שוב.':type==='reject'?'בדקנו את בקשת הדחייה שלכם, והכתבה נשארת לפרסום. ההסבר שלנו כאן.':'בדקנו את בקשת התיקונים שלכם. הכתבה נשארת כמו שהיא, וההסבר שלנו כאן.';
 return `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body dir="rtl" style="margin:0;padding:0;background:#f5f7fa;font-family:Heebo,Arial,Helvetica,sans-serif;color:${ink}"><div dir="rtl" style="max-width:560px;margin:0 auto;padding:28px 14px;background:#f5f7fa;font-family:Heebo,Arial,Helvetica,sans-serif;color:${ink};text-align:right">
<div dir="rtl" style="background:#ffffff;border:1px solid ${line};border-radius:28px;overflow:hidden">
<div style="padding:30px 28px 6px;text-align:center"><img src="${esc(origin)}/brand/megalinks-logo-dark.png" alt="Mega Links" width="190" style="max-width:190px;height:auto;border:0;font-size:22px;font-weight:700;color:${ink}"></div>
<div dir="rtl" style="padding:12px 28px 30px;text-align:right">
<div style="text-align:center"><span style="display:inline-block;padding:5px 14px;border-radius:999px;background:#eef5ff;color:${blue};font-size:13px;font-weight:700">${isLink?'בדיקת הקישור':'תשובה לבקשה שלכם'}</span></div>
<h1 style="margin:14px 0 8px;font-size:26px;line-height:1.25;font-weight:700;text-align:center;color:${ink}">${title}</h1>
<p dir="rtl" style="margin:0 0 22px;font-size:16px;line-height:1.6;color:${muted};text-align:center">${lead}</p>
<div dir="rtl" style="padding:15px 18px;background:#f5f8fc;border-radius:16px;text-align:right"><div style="font-size:13px;color:${faint};font-weight:600">${esc(counterLabel||websiteName)}</div><div style="font-size:18px;font-weight:700;line-height:1.45;color:${ink}">${esc(article.title)}</div></div>
<div dir="rtl" style="margin-top:16px;padding:14px 18px;background:#fffaf0;border:1px solid #f2dcae;border-radius:16px;text-align:right"><div style="font-size:13px;color:#8a4b00;font-weight:700;margin-bottom:4px">מה כתבנו לכם</div><div style="font-size:15px;line-height:1.6;color:${ink};white-space:pre-wrap">${esc(note)}</div></div>
${link?`<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin-top:24px"><tr><td align="center"><a href="${esc(link)}" style="display:block;background:${blue};color:#ffffff;text-decoration:none;font-size:17px;font-weight:700;padding:16px 20px;border-radius:15px;text-align:center">${isLink?'שליחת קישור מתוקן':'שליחת הקישור לכתבה שפורסמה'}</a></td></tr></table>${supplierIssueLinkHtml(link)}`:''}
<p style="margin:14px 0 0;font-size:13px;color:${faint};text-align:center;line-height:1.6">כל פרטי הכתבה והקבצים נמצאים במייל הראשון בשרשור הזה.</p>
</div></div>
<p style="margin:16px 0 0;font-size:12px;color:${faint};text-align:center">Mega Links · בניית קישורים וכתבות</p>
</div></body></html>`;
}
