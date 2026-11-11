import type {Row} from './shared';
import {displayPublicationDay} from './publication-date';

// Publication instructions belong in the message, never in the article attachment.
export function supplierPublicationFields(article:Row):[string,string][] {
    const data=typeof article.data==='string'?JSON.parse(article.data):article.data||article;
    return ([
        ['מועד הפרסום המבוקש',data.scheduled?displayPublicationDay(data.scheduled):''],
        ['תיאור קצר / תיאור מטא',data.meta_description],
        ['הערות לפרסום',data.client_notes],
        ['הנחיות המנהל לפרסום',data.admin_notes],
        ['קרדיט לתמונה הראשית',[data.image_credit,data.image_credit_url].filter(Boolean).join(' · ')],
        ['קרדיט לתמונה נוספת',data.secondary_image_credit],
    ] as [string,unknown][]).filter(([,value])=>String(value||'').trim()).map(([label,value])=>[label,String(value).trim()]);
}
export function supplierPublicationNotes(article:Row):string {
    return supplierPublicationFields(article).map(([label,value])=>label+':\n'+value).join('\n\n');
}
const esc=(v:unknown)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
// Owner decision (11.11.2026): everything the supplier needs arrives in the email (details + attached files);
// the link only opens a small page to send back the published address.
export function supplierArticleEmailHtml(article:Row,websiteName:string,link:string,origin:string,attachments:string[]){
    const rows=supplierPublicationFields(article).map(([label,value])=>`<tr><td style="padding:10px 0;border-top:1px solid #e3eef6;vertical-align:top;width:34%;color:#4a6283;font-size:14px">${esc(label)}</td><td style="padding:10px 0;border-top:1px solid #e3eef6;font-size:15px;white-space:pre-wrap">${esc(value)}</td></tr>`).join('');
    const files=attachments.length?`<div style="margin:18px 0;padding:14px 16px;background:#edfaff;border-radius:12px;font-size:14px"><b>מצורף למייל:</b><br>${attachments.map(esc).join('<br>')}</div>`:'';
    return `<!doctype html><html lang="he" dir="rtl"><body style="margin:0;background:#edf8ff;font-family:Arial,sans-serif;color:#071f4b"><div style="max-width:620px;margin:24px auto;background:#ffffff;border:1px solid #bde7f6;border-radius:18px;overflow:hidden"><div style="padding:24px;background:#071f4b;text-align:center"><img src="${esc(origin)}/brand/megalinks-logo.png" alt="Mega Links" width="260" style="max-width:100%;height:auto"></div><div style="padding:28px;text-align:right;line-height:1.7"><h1 style="margin:0 0 6px;font-size:24px;text-align:center">כתבה חדשה לפרסום</h1><p style="margin:0 0 20px;text-align:center;color:#4a6283">${esc(websiteName)}</p><div style="padding:16px;background:#f5fbff;border:1px solid #d6ecf8;border-radius:12px"><div style="font-size:13px;color:#4a6283">כותרת הכתבה</div><div style="font-size:18px;font-weight:bold">${esc(article.title)}</div></div>${rows?`<table role="presentation" style="width:100%;border-collapse:collapse;margin-top:16px">${rows}</table>`:''}${files}<p style="margin:22px 0 10px">אחרי שהכתבה עולה לאתר, לחצו על הכפתור והדביקו את הקישור לכתבה שפורסמה. המערכת תבדוק אותו ותסגור את הטיפול.</p><div style="text-align:center;margin:22px 0"><a href="${esc(link)}" style="display:inline-block;background:#0571da;color:#ffffff;text-decoration:none;font-weight:bold;padding:14px 28px;border-radius:12px">שליחת הקישור לכתבה שפורסמה</a></div><p style="margin:0;font-size:13px;color:#4a6283;text-align:center">הקישור אישי לכתבה הזו ותקף 30 יום. אחרי שליחת קישור תקין הוא נסגר.</p></div></div></body></html>`;
}
