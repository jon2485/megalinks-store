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
// the link only opens a small page to send back the published address. Same clean white look as that page.
export function supplierArticleEmailHtml(article:Row,websiteName:string,link:string,origin:string,attachments:string[]){
    const ink='#0b1b2f',muted='#4f5d6e',faint='#7b8796',line='#e6ecf2',blue='#1673e6';
    const rows=supplierPublicationFields(article).map(([label,value])=>`<tr><td style="padding:14px 0;border-top:1px solid ${line}"><div style="font-size:13px;color:${faint};font-weight:600;margin-bottom:3px">${esc(label)}</div><div style="font-size:15px;color:${ink};line-height:1.6;white-space:pre-wrap">${esc(value)}</div></td></tr>`).join('');
    const files=attachments.length?`<div style="margin-top:18px;padding:16px 18px;border-radius:16px;border:1px solid ${line}"><div style="font-size:13px;color:${faint};font-weight:700;margin-bottom:6px">מצורף למייל</div>${attachments.map(name=>`<div style="font-size:15px;color:${ink};line-height:1.9"><span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${blue};margin-left:8px;vertical-align:middle"></span>${esc(name)}</div>`).join('')}</div>`:'';
    const step=(n:number,text:string)=>`<tr><td style="padding:6px 0;width:34px;vertical-align:top"><div style="width:26px;height:26px;border-radius:50%;background:#eef5ff;color:${blue};font-size:13px;font-weight:800;line-height:26px;text-align:center">${n}</div></td><td style="padding:6px 0;font-size:15px;color:${ink};line-height:26px">${text}</td></tr>`;
    return `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;background:#f5f7fa;font-family:Heebo,Arial,Helvetica,sans-serif;color:${ink}"><div style="max-width:560px;margin:0 auto;padding:28px 14px">
<div style="background:#ffffff;border:1px solid ${line};border-radius:28px;overflow:hidden">
<div style="padding:30px 28px 6px;text-align:center"><img src="${esc(origin)}/brand/megalinks-logo-dark.png" alt="Mega Links" width="190" style="max-width:190px;height:auto"></div>
<div style="padding:12px 28px 30px;text-align:right">
<div style="text-align:center"><span style="display:inline-block;padding:5px 14px;border-radius:999px;background:#eef5ff;color:${blue};font-size:13px;font-weight:800">כתבה חדשה לפרסום · ${esc(websiteName)}</span></div>
<h1 style="margin:14px 0 8px;font-size:26px;line-height:1.25;font-weight:800;text-align:center;color:${ink}">יש לכם כתבה חדשה לפרסום</h1>
<p style="margin:0 0 22px;font-size:16px;line-height:1.6;color:${muted};text-align:center">כל הפרטים והקבצים נמצאים כאן במייל. אחרי שהכתבה עולה, שולחים לנו את הקישור בלחיצה אחת.</p>
<div style="padding:15px 18px;background:#f5f8fc;border-radius:16px"><div style="font-size:13px;color:${faint};font-weight:600">כותרת הכתבה</div><div style="font-size:18px;font-weight:800;line-height:1.45;color:${ink}">${esc(article.title)}</div></div>
${rows?`<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin-top:8px">${rows}</table>`:''}
${files}
<div style="margin-top:22px;padding:16px 18px;border-radius:16px;border:1px solid ${line}"><div style="font-size:13px;color:${faint};font-weight:700;margin-bottom:4px">מה עושים עכשיו</div><table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse">${step(1,'מפרסמים את הכתבה באתר')}${step(2,'לוחצים על הכפתור ומדביקים את הקישור')}${step(3,'אנחנו בודקים ומאשרים תוך כמה שניות')}</table></div>
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin-top:24px"><tr><td align="center"><a href="${esc(link)}" style="display:block;background:${blue};color:#ffffff;text-decoration:none;font-size:17px;font-weight:800;padding:16px 20px;border-radius:15px;text-align:center">שליחת הקישור לכתבה שפורסמה</a></td></tr></table>
<p style="margin:14px 0 0;font-size:13px;color:${faint};text-align:center;line-height:1.6">הקישור אישי לכתבה הזו ותקף 30 יום. אחרי שליחת קישור תקין הוא נסגר.</p>
</div></div>
<p style="margin:16px 0 0;font-size:12px;color:${faint};text-align:center">Mega Links · בניית קישורים וכתבות</p>
</div></body></html>`;
}
