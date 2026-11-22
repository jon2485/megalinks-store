// The customer's "your article needs a fix" email (owner, 22.11.2026): the site, the article title, the order,
// what the admin asked to fix in its own box, one button back to the article in the personal area, and a short
// service footer (why the mail came, the personal area, reply for questions). A service mail has no unsubscribe link.
import {escapeHtml as esc,richLine,mailLogoHtml} from './mail-template';

export type FixRequestMail={origin:string;site:string;siteUrl?:string;title:string;orderNumber?:string;note:string;name?:string;url:string};
const ink='#0b1b2f',muted='#4f5d6e',faint='#7b8796',line='#e6ecf2',blue='#1673e6',soft='#f5f8fc';
const font='Heebo,Arial,Helvetica,sans-serif';
const host=(url:string)=>{try{return new URL(url).host.replace(/^www\./,'')+new URL(url).pathname.replace(/\/$/,'');}catch{return '';}};

export const fixRequestSubject=(site:string)=>'המאמר שלך לאתר '+(site.trim()||'שהזמנת')+' דורש תיקון';

// Plain text for mail clients without HTML, in the same order as the designed message.
export function fixRequestText(m:FixRequestMail){
 return [m.name?'שלום '+m.name+',':'','בדקנו את המאמר ששלחת. לפני שהוא יוצא לפרסום צריך לתקן בו כמה דברים.','אתר: '+m.site+(m.siteUrl?' · '+host(m.siteUrl):''),'כותרת המאמר: '+m.title,m.orderNumber?'מספר הזמנה: '+m.orderNumber:'','מה צריך לתקן:\n'+m.note,'פתיחת המאמר לתיקון: '+m.url,'אחרי התיקון לוחצים שוב על "שליחה לפרסום", והמאמר חוזר אלינו לבדיקה.'].filter(Boolean).join('\n\n');
}

export function fixRequestEmailHtml(m:FixRequestMail){
 const row=(label:string,value:string,first=false)=>`<tr><td dir="rtl" style="padding:11px 18px;${first?'':`border-top:1px solid ${line};`}text-align:right"><div style="font-size:13px;color:${faint};font-weight:600;line-height:1.5">${esc(label)}</div><div style="font-size:15px;color:${ink};font-weight:700;line-height:1.6">${value}</div></td></tr>`;
 const siteValue=esc(m.site)+(m.siteUrl&&host(m.siteUrl)?` · <a href="${esc(m.siteUrl)}" dir="ltr" style="color:${blue};text-decoration:none;unicode-bidi:isolate">${esc(host(m.siteUrl))}</a>`:'');
 const account=m.origin?m.origin+'/purchased':'';
 return `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body dir="rtl" style="margin:0;padding:0;background:#f5f7fa;font-family:${font};color:${ink}"><div dir="rtl" style="max-width:560px;margin:0 auto;padding:28px 14px;background:#f5f7fa;font-family:${font};color:${ink};text-align:right">
<div dir="rtl" style="background:#ffffff;border:1px solid ${line};border-radius:28px;overflow:hidden">
<div style="padding:30px 28px 6px;text-align:center">${mailLogoHtml(m.origin)}</div>
<div dir="rtl" style="padding:12px 28px 30px;text-align:right">
<div style="text-align:center;margin-top:14px"><span style="display:inline-block;padding:5px 14px;border-radius:999px;background:#fff0cc;color:#704a00;font-size:13px;font-weight:700">נדרש תיקון לפני הפרסום</span></div>
<h1 dir="rtl" style="margin:12px 0 18px;font-size:24px;line-height:1.35;font-weight:700;text-align:center;color:${ink}">${esc(fixRequestSubject(m.site))}</h1>
${m.name?`<p dir="rtl" style="margin:0;font-size:16px;line-height:1.7;color:${ink};font-weight:700">שלום ${esc(m.name)},</p>`:''}
<p dir="rtl" style="margin:6px 0 0;font-size:16px;line-height:1.7;color:${muted}">בדקנו את המאמר ששלחת. לפני שהוא יוצא לפרסום צריך לתקן בו כמה דברים.</p>
<table role="presentation" dir="rtl" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:separate;margin:18px 0 4px;background:${soft};border-radius:16px">
${row('אתר',siteValue,true)}${row('כותרת המאמר',`<bdi>${esc(m.title)}</bdi>`)}${m.orderNumber?row('מספר הזמנה',`<bdi>${esc(m.orderNumber)}</bdi>`):''}
</table>
<div dir="rtl" style="margin:16px 0 0;padding:16px 18px;border-radius:16px;background:#fff8e6;border:1px solid #f3dca0;text-align:right">
<div style="font-size:14px;color:#704a00;font-weight:700;line-height:1.5">מה צריך לתקן</div>
<div style="margin-top:6px;font-size:16px;color:${ink};line-height:1.75">${String(m.note||'').split('\n').map(l=>richLine(l)).join('<br>')}</div>
</div>
<table role="presentation" dir="rtl" cellpadding="0" cellspacing="0" style="width:100%;margin-top:24px"><tr><td align="center"><a href="${esc(m.url)}" style="display:block;background:${blue};color:#ffffff;text-decoration:none;font-size:17px;font-weight:700;padding:16px 20px;border-radius:15px;text-align:center;font-family:${font}">פתיחת המאמר לתיקון</a></td></tr></table>
<p dir="rtl" style="margin:14px 0 0;font-size:14px;line-height:1.7;color:${muted};text-align:center">אחרי התיקון לוחצים שוב על "שליחה לפרסום", והמאמר חוזר אלינו לבדיקה.</p>
</div></div>
<div dir="rtl" style="padding:18px 10px 0;text-align:center;font-size:12px;line-height:1.8;color:${faint}">
<div>קיבלת את המייל כי יש לך חשבון ב-Mega Links.</div>
<div>${account?`<a href="${esc(account)}" style="color:${blue};text-decoration:none;font-weight:600">כניסה לאזור האישי</a> · `:''}יש שאלה? אפשר פשוט להשיב למייל הזה.</div>
<div style="margin-top:6px">Mega Links · בניית קישורים וכתבות</div>
</div>
</div></body></html>`;
}
