// The customer's article e-mails, one family in the layout the owner approved on 22.11.2026: logo, a badge, the
// heading, labelled rows (site, article title, order), one highlighted box, one button, and a short service footer
// (why the mail came, the personal area, reply for questions; a service mail has no unsubscribe link).
// Three kinds: returned for a fix, cancelled, published. None of them says who asked for what (owner: "הוא לא אמור
// לדעת מי ביקש"); the box holds the admin's own words.
import {escapeHtml as esc,richLine,mailLogoHtml} from './mail-template';

export type ArticleMailBase={origin:string;site:string;siteUrl?:string;title:string;orderNumber?:string;name?:string;url:string};
export type FixRequestMail=ArticleMailBase&{note:string};
export type CancelledMail=ArticleMailBase&{note:string;full:boolean;refund?:string};
export type PublishedMail=ArticleMailBase&{publishedUrl:string;publishedOn?:string};
type Tone={bg:string;fg:string;line:string};
const ink='#0b1b2f',muted='#4f5d6e',faint='#7b8796',line='#e6ecf2',blue='#1673e6',soft='#f5f8fc';
const font='Heebo,Arial,Helvetica,sans-serif';
const amber:Tone={bg:'#fff8e6',fg:'#704a00',line:'#f3dca0'},rose:Tone={bg:'#fdf1f4',fg:'#a32343',line:'#f4cfd9'},green:Tone={bg:'#ecf8f1',fg:'#11683f',line:'#bfe6cf'};
const badgeBg:Record<string,string>={[amber.fg]:'#fff0cc',[rose.fg]:'#fbe0e7',[green.fg]:'#d5f2e1'};
const host=(url:string)=>{try{const u=new URL(url);return u.host.replace(/^www\./,'')+u.pathname.replace(/\/$/,'');}catch{return '';}};
const siteName=(site:string)=>site.trim()||'שהזמנת';
const hello=(name?:string)=>name?'שלום '+name+',':'';

export const fixRequestSubject=(site:string)=>'המאמר שלך לאתר '+siteName(site)+' דורש תיקון';
export const cancelledSubject=(site:string,full=true)=>(full?'המאמר שלך לאתר ':'פרסום המאמר שלך באתר ')+siteName(site)+' בוטל';
export const publishedSubject=(site:string)=>'המאמר שלך פורסם באתר '+siteName(site);

function rowsText(m:ArticleMailBase,extra:[string,string][]=[]){
 return ['אתר: '+m.site+(m.siteUrl&&host(m.siteUrl)?' · '+host(m.siteUrl):''),'כותרת המאמר: '+m.title,m.orderNumber?'מספר הזמנה: '+m.orderNumber:'',...extra.map(([l,v])=>l+': '+v)].filter(Boolean).join('\n');
}

type Layout={m:ArticleMailBase;tone:Tone;badge:string;heading:string;intro:string;extra?:[string,string][];boxLabel:string;boxHtml:string;button:{label:string;url:string};after?:string};
function layout(x:Layout){
 const {m,tone}=x;
 const row=(label:string,value:string,first=false)=>`<tr><td dir="rtl" style="padding:11px 18px;${first?'':`border-top:1px solid ${line};`}text-align:right"><div style="font-size:13px;color:${faint};font-weight:600;line-height:1.5">${esc(label)}</div><div style="font-size:15px;color:${ink};font-weight:700;line-height:1.6">${value}</div></td></tr>`;
 const siteValue=esc(m.site)+(m.siteUrl&&host(m.siteUrl)?` · <a href="${esc(m.siteUrl)}" dir="ltr" style="color:${blue};text-decoration:none;unicode-bidi:isolate">${esc(host(m.siteUrl))}</a>`:'');
 const account=m.origin?m.origin+'/purchased':'';
 return `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body dir="rtl" style="margin:0;padding:0;background:#f5f7fa;font-family:${font};color:${ink}"><div dir="rtl" style="max-width:560px;margin:0 auto;padding:28px 14px;background:#f5f7fa;font-family:${font};color:${ink};text-align:right">
<div dir="rtl" style="background:#ffffff;border:1px solid ${line};border-radius:28px;overflow:hidden">
<div style="padding:30px 28px 6px;text-align:center">${mailLogoHtml(m.origin)}</div>
<div dir="rtl" style="padding:12px 28px 30px;text-align:right">
<div style="text-align:center;margin-top:14px"><span style="display:inline-block;padding:5px 14px;border-radius:999px;background:${badgeBg[tone.fg]};color:${tone.fg};font-size:13px;font-weight:700">${esc(x.badge)}</span></div>
<h1 dir="rtl" style="margin:12px 0 18px;font-size:24px;line-height:1.35;font-weight:700;text-align:center;color:${ink}">${esc(x.heading)}</h1>
${m.name?`<p dir="rtl" style="margin:0;font-size:16px;line-height:1.7;color:${ink};font-weight:700">${esc(hello(m.name))}</p>`:''}
<p dir="rtl" style="margin:6px 0 0;font-size:16px;line-height:1.7;color:${muted}">${esc(x.intro)}</p>
<table role="presentation" dir="rtl" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:separate;margin:18px 0 4px;background:${soft};border-radius:16px">
${row('אתר',siteValue,true)}${row('כותרת המאמר',`<bdi>${esc(m.title)}</bdi>`)}${m.orderNumber?row('מספר הזמנה',`<bdi>${esc(m.orderNumber)}</bdi>`):''}${(x.extra||[]).map(([l,v])=>row(l,`<bdi>${esc(v)}</bdi>`)).join('')}
</table>
<div dir="rtl" style="margin:16px 0 0;padding:16px 18px;border-radius:16px;background:${tone.bg};border:1px solid ${tone.line};text-align:right">
<div style="font-size:14px;color:${tone.fg};font-weight:700;line-height:1.5">${esc(x.boxLabel)}</div>
<div style="margin-top:6px;font-size:16px;color:${ink};line-height:1.75">${x.boxHtml}</div>
</div>
<table role="presentation" dir="rtl" cellpadding="0" cellspacing="0" style="width:100%;margin-top:24px"><tr><td align="center"><a href="${esc(x.button.url)}" style="display:block;background:${blue};color:#ffffff;text-decoration:none;font-size:17px;font-weight:700;padding:16px 20px;border-radius:15px;text-align:center;font-family:${font}">${esc(x.button.label)}</a></td></tr></table>
${x.after?`<p dir="rtl" style="margin:14px 0 0;font-size:14px;line-height:1.7;color:${muted};text-align:center">${esc(x.after)}</p>`:''}
</div></div>
<div dir="rtl" style="padding:18px 10px 0;text-align:center;font-size:12px;line-height:1.8;color:${faint}">
<div>קיבלת את המייל כי יש לך חשבון ב-Mega Links.</div>
<div>${account?`<a href="${esc(account)}" style="color:${blue};text-decoration:none;font-weight:600">כניסה לאזור האישי</a> · `:''}יש שאלה? אפשר פשוט להשיב למייל הזה.</div>
<div style="margin-top:6px">Mega Links · בניית קישורים וכתבות</div>
</div>
</div></body></html>`;
}
const noteHtml=(note:string)=>String(note||'').split('\n').map(l=>richLine(l)).join('<br>');

// (a) Returned for a fix.
const FIX_INTRO='בדקנו את המאמר ששלחת. לפני שהוא יוצא לפרסום צריך לתקן בו כמה דברים.',FIX_AFTER='אחרי התיקון לוחצים שוב על "שליחה לפרסום", והמאמר חוזר אלינו לבדיקה.';
export function fixRequestText(m:FixRequestMail){
 return [hello(m.name),FIX_INTRO,rowsText(m),'מה צריך לתקן:\n'+m.note,'פתיחת המאמר לתיקון: '+m.url,FIX_AFTER].filter(Boolean).join('\n\n');
}
export function fixRequestEmailHtml(m:FixRequestMail){
 return layout({m,tone:amber,badge:'נדרש תיקון לפני הפרסום',heading:fixRequestSubject(m.site),intro:FIX_INTRO,boxLabel:'מה צריך לתקן',boxHtml:noteHtml(m.note),button:{label:'פתיחת המאמר לתיקון',url:m.url},after:FIX_AFTER});
}

// (b) Cancelled: the whole article, or only its publication (the writing stays).
const cancelIntro=(full:boolean)=>full?'המאמר בוטל ולא יפורסם.':'פרסום המאמר בוטל. שירות הכתיבה נשאר בהזמנה.';
export function cancelledText(m:CancelledMail){
 return [hello(m.name),cancelIntro(m.full),rowsText(m,m.refund?[['הזיכוי',m.refund]]:[]),'סיבת הביטול:\n'+m.note,'צפייה בפרטי המאמר: '+m.url].filter(Boolean).join('\n\n');
}
export function cancelledEmailHtml(m:CancelledMail){
 return layout({m,tone:rose,badge:m.full?'המאמר בוטל':'הפרסום בוטל',heading:cancelledSubject(m.site,m.full),intro:cancelIntro(m.full),extra:m.refund?[['הזיכוי',m.refund]]:[],boxLabel:'סיבת הביטול',boxHtml:noteHtml(m.note),button:{label:'צפייה בפרטי המאמר',url:m.url}});
}

// (c) Published, with the live link.
const PUBLISHED_INTRO='המאמר שלך עלה לאוויר. אפשר לצפות בו ולשתף אותו.';
export function publishedText(m:PublishedMail){
 return [hello(m.name),PUBLISHED_INTRO,rowsText(m,m.publishedOn?[['תאריך הפרסום',m.publishedOn]]:[]),'הקישור לכתבה:\n'+m.publishedUrl,'פרטי המאמר באזור האישי: '+m.url].filter(Boolean).join('\n\n');
}
export function publishedEmailHtml(m:PublishedMail){
 const link=`<a href="${esc(m.publishedUrl)}" dir="ltr" style="color:${blue};font-weight:700;text-decoration:none;word-break:break-all;unicode-bidi:isolate">${esc(m.publishedUrl.replace(/^https?:\/\//,''))}</a>`;
 return layout({m,tone:green,badge:'המאמר פורסם',heading:publishedSubject(m.site),intro:PUBLISHED_INTRO,extra:m.publishedOn?[['תאריך הפרסום',m.publishedOn]]:[],boxLabel:'הקישור לכתבה',boxHtml:link,button:{label:'לצפייה בכתבה שפורסמה',url:m.publishedUrl},after:'כל הפרטים נשמרים גם באזור האישי, בכתבות שלי.'});
}
