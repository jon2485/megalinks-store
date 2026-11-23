import type {Row} from './shared';
import {displayPublicationDay} from './publication-date';
import {mailAttachedHtml,richLine,type MailFileLink} from './mail-template';
import {supplierIssueLinkHtml} from './supplier-issue-mail';

// Publication instructions belong in the message, never in the article attachment.
export function supplierPublicationFields(article:Row):[string,string][] {
    const data=typeof article.data==='string'?JSON.parse(article.data):article.data||article;
    return ([
        ['מועד הפרסום המבוקש',data.scheduled?displayPublicationDay(data.scheduled):''],
        ['תיאור קצר / תיאור מטא',data.meta_description],
        ['קישור בכתבה',[data.anchor,data.target_url].filter(Boolean).join(' · ')],
        ['קישור נוסף בכתבה',[data.anchor_2,data.target_url_2].filter(Boolean).join(' · ')],
        ['הערות לפרסום',data.client_notes],
        ['הנחיות המנהל לפרסום',data.admin_notes],
    ] as [string,unknown][]).filter(([,value])=>String(value||'').trim()).map(([label,value])=>[label,String(value).trim()]);
}
export type ArticleImage={id:string;n:number;label:string;credit:string;main?:boolean};
// Owner (23.11.2026): the main image is named as such in the e-mail: "תמונה מס׳ 1 - ראשית".
export const imageName=(img:{n:number;main?:boolean})=>'תמונה מס׳ '+img.n+(img.main?' - ראשית':'');
const decodeAttr=(v:string)=>v.replace(/&(#\d+|#x[\da-f]+|amp|lt|gt|quot|apos);/gi,(m,e:string)=>e[0]==='#'?String.fromCodePoint(e[1].toLowerCase()==='x'?parseInt(e.slice(2),16):Number(e.slice(1))):({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"} as Record<string,string>)[e.toLowerCase()]||m);
const attr=(tag:string,name:string)=>{const m=new RegExp('\\b'+name+'\\s*=\\s*(?:"([^"]*)"|\'([^\']*)\')','i').exec(tag);return m?decodeAttr(m[1]??m[2]??''):'';};
// The article's images in order: main, secondary, then the pictures inside the text; each id once, at most 20.
// n is the image's number everywhere: the attached file is image-<n>.<ext> and the credit says "קרדיט לתמונה מס׳ <n>".
export function articleImages(article:Row):ArticleImage[] {
    const d=typeof article.data==='string'?JSON.parse(article.data||'{}'):article.data||{},out:ArticleImage[]=[],seen=new Set<string>();
    const add=(id:unknown,label:string,credit:unknown)=>{const v=String(id||'');if(v&&/^[\w-]{1,100}$/.test(v)&&!seen.has(v)&&out.length<20){seen.add(v);const n=out.length+1;out.push({id:v,n,label:'תמונה מס׳ '+n+' ('+label+')',credit:String(credit||'').replace(/\s+/g,' ').trim(),...(v===String(d.image_id||'')?{main:true}:{})});}};
    add(d.image_id,'הראשית',[d.image_credit,d.image_credit_url].filter(Boolean).join(' · '));add(d.secondary_image_id,'נוספת',d.secondary_image_credit);
    for(const m of String(article.content||'').matchAll(/<img\b[^>]*>/gi)){const id=/^\/api\/files\/([\w-]{1,100})$/.exec(attr(m[0],'src'))?.[1];if(id)add(id,'מתוך הכתבה',attr(m[0],'data-credit'));}
    return out;
}
// Owner (22.11.2026): per image, in the order of the attachments: "קרדיט לתמונה מס׳ 1:" + the credit, and under it the
// exact name of the attached file, so the supplier can match them. An image too big to attach says it is in the Word file.
export function supplierImageCredits(article:Row,attachments:MailFileLink[]=[]){
    return articleImages(article).map(img=>{const file=attachments.find(f=>f.name.startsWith('image-'+img.n+'.'));
        return {...img,file:file?.name||'',attached:!!file&&file.attached!==false,url:file?.url||''};});
}
const creditFileText=(c:ReturnType<typeof supplierImageCredits>[number])=>c.attached?'קובץ: '+c.file:c.file?'הקובץ '+c.file+' גדול מדי לצירוף: התמונה נמצאת בקובץ ה-Word'+(c.url?' ואפשר להוריד אותה כאן: '+c.url:''):'התמונה נמצאת בקובץ ה-Word';
export function supplierPublicationNotes(article:Row,attachments:MailFileLink[]=[]):string {
    const credits=supplierImageCredits(article,attachments);
    return [...supplierPublicationFields(article).map(([label,value])=>label+':\n'+value),...(credits.length?['קרדיטים לתמונות:\n'+credits.map(c=>'קרדיט ל'+imageName(c)+': '+(c.credit||'לא צוין קרדיט')+'\n'+creditFileText(c)).join('\n')]:[])].join('\n\n');
}
// Owner decision (11.11.2026): the subject names the site and its package count (3/10); a site without a
// package gets the article's running number for that site in the current month.
export const israelMonth=(v:string)=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jerusalem',year:'numeric',month:'2-digit'}).format(new Date(v));
export function supplierCounter(seq:number,total:number,monthNumber:number){
    if(total>0&&seq>0)return {counter:seq+'/'+total,label:'כתבה '+seq+' מתוך '+total+' בחבילה'};
    const n=Math.max(1,monthNumber);return {counter:String(n),label:'כתבה מס׳ '+n+' החודש'};
}
// Owner (23.11.2026): the subject is only "כתבה מס׳ X לאתר <name> (<domain>)"; X is the article's number for its supplier
// (supplierCounter's rule). Everything else stays in the body. The thread per article is kept by Message-ID/References.
export const siteDomain=(url:string)=>{try{return new URL(/^https?:\/\//i.test(url)?url:'https://'+url).hostname.replace(/^www\./i,'').toLowerCase();}catch{return '';}};
// Owner (23.11.2026): a new month or a new stock package never repeats an older article's subject.
// Monthly billing: the month is part of the subject ("כתבה מס׳ 3 לנובמבר 2026 לאתר ..."), since the number restarts every month.
// Stock: "כתבה מס׳ 3 מתוך 10 לאתר ..." The stock number is the site's running count of deliveries
// (supplier_dispatch_allocations, unique per site), so a new package continues it (11 מתוך 20) and does not restart.
// The one way it can repeat (a slot freed by a recall and given to another article) is caught in sendQueuedMail.
export const israelMonthName=(iso:string)=>new Intl.DateTimeFormat('he-IL',{timeZone:'Asia/Jerusalem',month:'long',year:'numeric'}).format(new Date(iso));
export const supplierEmailSubject=(site:string,siteUrl:string,n:number,count:{total?:number;sentAt?:string}={})=>{const domain=siteDomain(String(siteUrl||'').trim()),name=String(site||'').trim()||domain;
    const which=Number(count.total)>0?' מתוך '+Number(count.total):count.sentAt?' ל'+israelMonthName(count.sentAt):'';
    return ('כתבה מס׳ '+Math.max(1,Number(n)||1)+which+' לאתר '+name+(domain&&domain!==name.toLowerCase().replace(/^www\./,'')?' ('+domain+')':'')).replace(/\s+/g,' ').trim();};
const esc=(v:unknown)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
// Owner decision (11.11.2026): everything the supplier needs arrives in the email (details + attached files);
// the link only opens a small page to send back the published address. Same clean white look as that page.
// update: the same article again after the customer's fixes (owner, 22.11.2026): an updated version that replaces the first.
export function supplierArticleEmailHtml(article:Row,websiteName:string,websiteUrl:string,counterLabel:string,link:string,origin:string,attachments:MailFileLink[],update=false){
    const ink='#0b1b2f',muted='#4f5d6e',faint='#7b8796',line='#e6ecf2',blue='#1673e6';
    const site=websiteUrl?`<tr><td dir="rtl" style="padding:14px 0;border-top:1px solid ${line};text-align:right"><div style="font-size:13px;color:${faint};font-weight:600;margin-bottom:3px">לפרסום באתר:</div><div style="font-size:15px;line-height:1.6"><a href="${esc(websiteUrl)}" dir="ltr" style="color:${blue};text-decoration:none;font-weight:700">${esc(websiteUrl.replace(/^https?:\/\//,'').replace(/\/$/,''))}</a>${websiteName?` <span style="color:${faint}">· ${esc(websiteName)}</span>`:''}</div></td></tr>`:'';
    const rows=site+supplierPublicationFields(article).map(([label,value])=>`<tr><td dir="rtl" style="padding:14px 0;border-top:1px solid ${line};text-align:right"><div style="font-size:13px;color:${faint};font-weight:600;margin-bottom:3px">${esc(label)}</div><div style="font-size:15px;color:${ink};line-height:1.6;white-space:pre-wrap"><bdi>${richLine(value)}</bdi></div></td></tr>`).join('');
    const credits=supplierImageCredits(article,attachments);
    const fileLine=(c:typeof credits[number])=>c.attached?`קובץ: <span dir="ltr" style="unicode-bidi:isolate;font-weight:700;color:${ink}">${esc(c.file)}</span>`:c.file?`<span dir="ltr" style="unicode-bidi:isolate">${esc(c.file)}</span> גדול מדי לצירוף, התמונה נמצאת בקובץ ה-Word${c.url?` · <a href="${esc(c.url)}" style="color:${blue};text-decoration:none;font-weight:700">הורדה</a>`:''}`:'התמונה נמצאת בקובץ ה-Word';
    const creditRow=credits.length?`<tr><td dir="rtl" style="padding:14px 0;border-top:1px solid ${line};text-align:right"><div style="font-size:13px;color:${faint};font-weight:600;margin-bottom:3px">קרדיטים לתמונות</div>${credits.map((c,i)=>`<div style="padding:${i?'8px':'2px'} 0 0"><div style="font-size:15px;color:${ink};line-height:1.6"><b>קרדיט ל${imageName(c)}:</b> <bdi>${c.credit?richLine(c.credit):`<span style="color:${faint}">לא צוין קרדיט</span>`}</bdi></div><div style="font-size:13px;color:${muted};line-height:1.6">${fileLine(c)}</div></div>`).join('')}</td></tr>`:'';
    const files=mailAttachedHtml(attachments);
    const step=(n:number,text:string)=>`<tr><td style="padding:6px 0;width:34px;vertical-align:top"><div style="width:26px;height:26px;border-radius:50%;background:#eef5ff;color:${blue};font-size:13px;font-weight:700;line-height:26px;text-align:center">${n}</div></td><td dir="rtl" style="padding:6px 0;font-size:15px;color:${ink};line-height:26px;text-align:right">${text}</td></tr>`;
    return `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body dir="rtl" style="margin:0;padding:0;background:#f5f7fa;font-family:Heebo,Arial,Helvetica,sans-serif;color:${ink}"><div dir="rtl" style="max-width:560px;margin:0 auto;padding:28px 14px;background:#f5f7fa;font-family:Heebo,Arial,Helvetica,sans-serif;color:${ink};text-align:right">
<div dir="rtl" style="background:#ffffff;border:1px solid ${line};border-radius:28px;overflow:hidden">
<div style="padding:30px 28px 6px;text-align:center"><img src="${esc(origin)}/brand/megalinks-logo-dark.png" alt="Mega Links" width="190" style="max-width:190px;height:auto;border:0;font-size:22px;font-weight:700;color:${ink}"></div>
<div dir="rtl" style="padding:12px 28px 30px;text-align:right">
<div style="text-align:center"><span style="display:inline-block;padding:5px 14px;border-radius:999px;background:#eef5ff;color:${blue};font-size:13px;font-weight:700">${esc(counterLabel||websiteName)}</span></div>
<h1 style="margin:14px 0 8px;font-size:26px;line-height:1.25;font-weight:700;text-align:center;color:${ink}">${update?'הנחיות מעודכנות לפרסום':'כתבה חדשה לפרסום'}</h1>
<p dir="rtl" style="margin:0 0 22px;font-size:16px;line-height:1.6;color:${muted};text-align:center">${update?'הלקוח סיים את התיקונים. כל הפרטים המעודכנים כאן, וקובץ ה-Word החדש מצורף. אפשר לפרסם.':'כל הפרטים נמצאים כאן, וקובץ ה-Word של הכתבה מצורף למייל. אחרי שהכתבה עולה, שולחים לנו את הקישור בלחיצה אחת.'}</p>
${update?`<div dir="rtl" style="margin:0 0 16px;padding:14px 18px;background:#fff7e6;border:1px solid #f6d79b;border-radius:16px;font-size:15px;line-height:1.6;color:#7a4b00;text-align:right"><b>הגרסה הזו מחליפה את הקודמת.</b> אם שמרתם את הקובץ מהמייל הראשון, השתמשו רק בקובץ שמצורף כאן.</div>`:''}
<div dir="rtl" style="padding:15px 18px;background:#f5f8fc;border-radius:16px;text-align:right"><div style="font-size:13px;color:${faint};font-weight:600">כותרת הכתבה</div><div style="font-size:18px;font-weight:700;line-height:1.45;color:${ink}">${esc(article.title)}</div></div>
${rows||creditRow?`<table role="presentation" dir="rtl" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin-top:8px">${rows}${creditRow}</table>`:''}
${files}
<div dir="rtl" style="margin-top:22px;padding:16px 18px;border-radius:16px;border:1px solid ${line};text-align:right"><div style="font-size:13px;color:${faint};font-weight:700;margin-bottom:4px">מה עושים עכשיו</div><table role="presentation" dir="rtl" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse">${step(1,'מפרסמים את הכתבה באתר')}${step(2,'לוחצים על הכפתור ומדביקים את הקישור')}${step(3,'אנחנו בודקים ומאשרים תוך כמה שניות')}</table></div>
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin-top:24px"><tr><td align="center"><a href="${esc(link)}" style="display:block;background:${blue};color:#ffffff;text-decoration:none;font-size:17px;font-weight:700;padding:16px 20px;border-radius:15px;text-align:center">שליחת הקישור לכתבה שפורסמה</a></td></tr></table>
${supplierIssueLinkHtml(link)}
<p style="margin:14px 0 0;font-size:13px;color:${faint};text-align:center;line-height:1.6">הקישור אישי לכתבה הזו ותקף 30 יום. אחרי שליחת קישור תקין הוא נסגר.</p>
</div></div>
<p style="margin:16px 0 0;font-size:12px;color:${faint};text-align:center">Mega Links · בניית קישורים וכתבות</p>
</div></body></html>`;
}

// The supplier's article went back to the customer for fixes (owner, 22.11.2026). Same look as the article e-mail;
// the supplier's link stays alive and shows a waiting page until the updated version arrives.
export function supplierHoldEmailHtml(article:Row,websiteName:string,counterLabel:string,link:string,origin:string){
    const ink='#0b1b2f',muted='#4f5d6e',faint='#7b8796',line='#e6ecf2',blue='#1673e6';
    const step=(n:number,text:string)=>`<tr><td style="padding:6px 0;width:34px;vertical-align:top"><div style="width:26px;height:26px;border-radius:50%;background:#fff3dc;color:#a15c00;font-size:13px;font-weight:700;line-height:26px;text-align:center">${n}</div></td><td dir="rtl" style="padding:6px 0;font-size:15px;color:${ink};line-height:26px;text-align:right">${text}</td></tr>`;
    return `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body dir="rtl" style="margin:0;padding:0;background:#f5f7fa;font-family:Heebo,Arial,Helvetica,sans-serif;color:${ink}"><div dir="rtl" style="max-width:560px;margin:0 auto;padding:28px 14px;background:#f5f7fa;font-family:Heebo,Arial,Helvetica,sans-serif;color:${ink};text-align:right">
<div dir="rtl" style="background:#ffffff;border:1px solid ${line};border-radius:28px;overflow:hidden">
<div style="padding:30px 28px 6px;text-align:center"><img src="${esc(origin)}/brand/megalinks-logo-dark.png" alt="Mega Links" width="190" style="max-width:190px;height:auto;border:0;font-size:22px;font-weight:700;color:${ink}"></div>
<div dir="rtl" style="padding:12px 28px 30px;text-align:right">
<div style="text-align:center"><span style="display:inline-block;padding:5px 14px;border-radius:999px;background:#fff3dc;color:#a15c00;font-size:13px;font-weight:700">ממתינה לתיקונים</span></div>
<h1 style="margin:14px 0 8px;font-size:26px;line-height:1.25;font-weight:700;text-align:center;color:${ink}">נא להמתין עם פרסום הכתבה</h1>
<p dir="rtl" style="margin:0 0 22px;font-size:16px;line-height:1.6;color:${muted};text-align:center">הכתבה חזרה ללקוח לתיקונים. כשהתיקונים יאושרו, נשלח לכם כאן הנחיות מעודכנות וקובץ חדש.</p>
<div dir="rtl" style="padding:15px 18px;background:#f5f8fc;border-radius:16px;text-align:right"><div style="font-size:13px;color:${faint};font-weight:600">${esc(counterLabel||websiteName)}</div><div style="font-size:18px;font-weight:700;line-height:1.45;color:${ink}">${esc(article.title)}</div></div>
<div dir="rtl" style="margin-top:22px;padding:16px 18px;border-radius:16px;border:1px solid ${line};text-align:right"><div style="font-size:13px;color:${faint};font-weight:700;margin-bottom:4px">מה עושים עכשיו</div><table role="presentation" dir="rtl" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse">${step(1,'ממתינים עם פרסום הכתבה')}${step(2,'מחכים למייל עם ההנחיות המעודכנות')}${step(3,'מפרסמים ושולחים את הקישור כרגיל')}</table></div>
${link?`<p style="margin:16px 0 0;font-size:13px;color:${faint};text-align:center;line-height:1.6">הקישור האישי שלכם לכתבה ממשיך לעבוד. <a href="${esc(link)}" style="color:${blue};text-decoration:none;font-weight:700">אפשר לבדוק בו את המצב</a>.</p>`:''}
</div></div>
<p style="margin:16px 0 0;font-size:12px;color:${faint};text-align:center">Mega Links · בניית קישורים וכתבות</p>
</div></body></html>`;
}
