// One clean right-to-left look for every outgoing email.
// Mail clients drop <html>, <head> and <body>, so the direction is set on every block
// and all styles are inline. Addresses, amounts and file names are isolated as
// left-to-right runs so they never reorder inside Hebrew lines.
export type MailFileLink={label:string;name:string;size:number;url:string};
export const MAIL_FILES_MARK='<!--MAIL:FILES-->';
export const MAIL_FILE_DAYS=45;
const ink='#0b1b2f',muted='#4f5d6e',faint='#7b8796',line='#e6ecf2',blue='#1673e6',soft='#f5f8fc';
const font='Heebo,Arial,Helvetica,sans-serif';
export const escapeHtml=(v:unknown)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const esc=escapeHtml;
const shortUrl=(url:string)=>{const s=url.replace(/^https?:\/\//,'').replace(/\/$/,'');return s.length>58?s.slice(0,55)+'...':s;};
// Text with its web addresses turned into links that keep their own direction.
export function richLine(text:string){
    return String(text).split(/(https?:\/\/[^\s<>"']+)/g).map((part,i)=>i%2?`<a href="${esc(part)}" dir="ltr" style="color:${blue};text-decoration:none;font-weight:700;unicode-bidi:isolate;word-break:break-all">${esc(shortUrl(part))}</a>`:esc(part)).join('');
}
const fileSize=(bytes:number)=>bytes>=1048576?(bytes/1048576).toFixed(1)+' MB':Math.max(1,Math.round(bytes/1024))+' KB';
// The files of the email, each with its own download button. Works in every mail client,
// also when the sending service does not pass attachments on.
export function mailFilesHtml(files:MailFileLink[]){
    if(!files.length)return '';
    const rows=files.map((f,i)=>`<tr><td dir="rtl" style="padding:12px 0;${i?`border-top:1px solid ${line};`:''}text-align:right;vertical-align:middle"><div style="font-size:15px;font-weight:700;color:${ink};line-height:1.5">${esc(f.label)}</div><div style="font-size:12px;color:${faint};line-height:1.5"><span dir="ltr" style="unicode-bidi:isolate">${esc(f.name)}</span> · <span dir="ltr" style="unicode-bidi:isolate;white-space:nowrap">${fileSize(f.size)}</span></div></td><td style="padding:12px 0;${i?`border-top:1px solid ${line};`:''}text-align:left;vertical-align:middle;width:96px">${f.url?`<a href="${esc(f.url)}" style="display:inline-block;padding:9px 16px;border-radius:999px;background:#eef5ff;color:${blue};font-size:14px;font-weight:700;text-decoration:none;white-space:nowrap">הורדה</a>`:`<span style="font-size:13px;color:${faint};white-space:nowrap">מצורף</span>`}</td></tr>`).join('');
    const linked=files.some(f=>f.url);
    return `<div dir="rtl" style="margin-top:18px;padding:14px 18px 8px;border-radius:16px;border:1px solid ${line};text-align:right;font-family:${font}"><div style="font-size:13px;color:${faint};font-weight:700">${files.length===1?'הקובץ שלכם':'הקבצים שלכם'} (${files.length})</div><table role="presentation" dir="rtl" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse">${rows}</table><div style="padding:6px 0 8px;font-size:12px;color:${faint};line-height:1.6">${linked?`לחיצה על "הורדה" שומרת את הקובץ. הקישורים תקפים ${MAIL_FILE_DAYS} יום.`:'הקבצים מצורפים למייל הזה.'}</div></div>`;
}
export function mailFilesText(files:MailFileLink[]){
    return files.length?'קבצים להורדה:\n'+files.map(f=>f.label+': '+f.url).join('\n'):'';
}
export const mailLogoHtml=(origin:string,dark=true)=>origin
    ?`<img src="${esc(origin)}/brand/${dark?'megalinks-logo-dark.png':'megalinks-logo.png'}" alt="Mega Links" width="190" style="max-width:190px;height:auto;border:0;font-family:${font};font-size:22px;font-weight:700;color:${ink}">`
    :`<span style="font-family:${font};font-size:24px;font-weight:700;color:${ink}">Mega Links</span>`;
type Block={kind:'p'|'rows'|'list';lines:string[]};
// Splits the plain text of a message into paragraphs, "label: value" rows and numbered lists.
function blocksOf(text:string):Block[]{
    const blocks:Block[]=[];
    for(const raw of String(text||'').split('\n')){
        const lineText=raw.trim();if(!lineText)continue;
        const kind:Block['kind']=/^\d+\.\s/.test(lineText)?'list':/^[^:.!?]{2,34}:\s+\S/.test(lineText)&&!/^https?:/i.test(lineText)?'rows':'p';
        const last=blocks[blocks.length-1];
        if(last&&last.kind===kind&&kind!=='p')last.lines.push(lineText);else blocks.push({kind,lines:[lineText]});
    }
    return blocks;
}
function blockHtml(b:Block,first:boolean){
    if(b.kind==='rows')return `<table role="presentation" dir="rtl" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:separate;margin:14px 0 4px;background:${soft};border-radius:16px">${b.lines.map((l,i)=>{const at=l.indexOf(':'),label=l.slice(0,at),value=l.slice(at+1).trim();return `<tr><td dir="rtl" style="padding:11px 18px;${i?`border-top:1px solid ${line};`:''}text-align:right"><div style="font-size:13px;color:${faint};font-weight:600;line-height:1.5">${esc(label)}</div><div style="font-size:15px;color:${ink};font-weight:700;line-height:1.6"><bdi>${richLine(value)}</bdi></div></td></tr>`;}).join('')}</table>`;
    if(b.kind==='list')return `<table role="presentation" dir="rtl" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:14px 0 4px">${b.lines.map((l,i)=>{const m=l.match(/^(\d+)\.\s+(.*)$/)!;const parts=m[2].split(' · ');return `<tr><td style="padding:10px 0;${i?`border-top:1px solid ${line};`:''}width:36px;vertical-align:top;text-align:right"><div style="width:26px;height:26px;border-radius:50%;background:#eef5ff;color:${blue};font-size:13px;font-weight:700;line-height:26px;text-align:center">${m[1]}</div></td><td dir="rtl" style="padding:10px 0;${i?`border-top:1px solid ${line};`:''}text-align:right;vertical-align:top"><div style="font-size:15px;color:${ink};font-weight:700;line-height:1.6"><bdi>${richLine(parts[0])}</bdi></div>${parts.slice(1).map(x=>`<div style="font-size:14px;color:${muted};line-height:1.6"><bdi>${richLine(x)}</bdi></div>`).join('')}</td></tr>`;}).join('')}</table>`;
    return `<p dir="rtl" style="margin:${first?'0':'12px'} 0 0;font-size:16px;line-height:1.7;color:${first?ink:muted};${first?'font-weight:700;':''}text-align:right">${richLine(b.lines[0])}</p>`;
}
// The standard message: logo, headline (the subject), the text in order, files, one button.
export function brandedEmailHtml(input:{subject:string;text:string;button?:{label?:string;url?:string}|null;origin:string;files?:MailFileLink[]}){
    const blocks=blocksOf(input.text),greeting=blocks.length>1&&blocks[0].kind==='p'&&/^שלום/.test(blocks[0].lines[0]);
    const body=blocks.map((b,i)=>blockHtml(b,i===0&&greeting)).join('');
    const button=input.button?.url&&input.button?.label?`<table role="presentation" dir="rtl" cellpadding="0" cellspacing="0" style="width:100%;margin-top:24px"><tr><td align="center"><a href="${esc(input.button.url)}" style="display:block;background:${blue};color:#ffffff;text-decoration:none;font-size:17px;font-weight:700;padding:16px 20px;border-radius:15px;text-align:center;font-family:${font}">${esc(input.button.label)}</a></td></tr></table>`:'';
    return `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body dir="rtl" style="margin:0;padding:0;background:#f5f7fa;font-family:${font};color:${ink}"><div dir="rtl" style="max-width:560px;margin:0 auto;padding:28px 14px;background:#f5f7fa;font-family:${font};color:${ink};text-align:right">
<div dir="rtl" style="background:#ffffff;border:1px solid ${line};border-radius:28px;overflow:hidden">
<div style="padding:30px 28px 6px;text-align:center">${mailLogoHtml(input.origin)}</div>
<div dir="rtl" style="padding:12px 28px 30px;text-align:right">
<h1 dir="rtl" style="margin:14px 0 18px;font-size:24px;line-height:1.3;font-weight:700;text-align:center;color:${ink}">${richLine(input.subject)}</h1>
${body}
${mailFilesHtml(input.files||[])}
${button}
</div></div>
<p dir="rtl" style="margin:16px 0 0;font-size:12px;color:${faint};text-align:center">Mega Links · בניית קישורים וכתבות</p>
</div></body></html>`;
}
// Adds the files to a message that has its own design.
export function withMailFiles(html:string,files:MailFileLink[]){
    const block=mailFilesHtml(files);
    if(html.includes(MAIL_FILES_MARK))return html.replace(MAIL_FILES_MARK,block);
    if(!block)return html;
    const boxed=`<div dir="rtl" style="max-width:560px;margin:0 auto;padding:0 14px 24px">${block}</div>`;
    return /<\/body>/i.test(html)?html.replace(/<\/body>/i,boxed+'</body>'):html+boxed;
}
