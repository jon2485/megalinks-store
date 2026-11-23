import { env } from 'cloudflare:workers';
import {emailList} from './catalog-fields';
import { one, all, stmt, now, connection, externalFetch, parse, ApiError, mapIn } from './server';
import { articleDocx } from './delivery-docx';
import { Row } from './shared';
import {articleImages,supplierPublicationNotes,supplierArticleEmailHtml,supplierHoldEmailHtml,supplierCounter,supplierEmailSubject,israelMonth} from './supplier-mail-content';
import {supplierIssueLinkText,supplierAnswerEmailHtml} from './supplier-issue-mail';
import {brandedEmailHtml,withMailFiles,mailFilesText,MAIL_FILE_DAYS,type MailFileLink} from './mail-template';
import {safeFailure} from './security';
import {fixRequestEmailHtml,fixRequestSubject,fixRequestText,publishedEmailHtml,publishedSubject,publishedText,cancelledEmailHtml,cancelledSubject,cancelledText} from './fix-request-mail';
import {RESEND_URL,RESEND_TEST_FROM} from './resend';

export type MailFile={filename:string;content_type:string;bytes:Uint8Array;label:string;image?:boolean};
// The download link allows indexes up to MAIL_FILES_MAX-1 (Word file, up to 20 images, the original document).
const MAIL_FILES_MAX=30;
// A webhook service (Zapier and the like) takes about 10MB per message; Resend takes 40MB and Gmail receives 25MB,
// so with Resend up to 15MB of files are attached (owner, 16.11.2026). Larger sets travel as download links only.
const INLINE_FILES_LIMIT=6*1024*1024,RESEND_INLINE_LIMIT=15*1024*1024;
// A single file up to this size is always offered, attached or as a link, so nothing is dropped without a word.
const MAIL_FILE_MAX=25*1024*1024;
const base64=(bytes:Uint8Array)=>{let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(binary);};
// Takes the file row (read beforehand for all of a mail's files in one query), not an id.
const storedFile=async(f:Row|null|undefined,max:number)=>{if(!f||Number(f.size)>max)return null;const blob=await (env as any).BUCKET?.get(f.key);return blob?{file:f as Row,bytes:new Uint8Array(await blob.arrayBuffer())}:null;};
// The site address the email belongs to (for the logo and the file links). A button may lead to an outside site, so a stored origin wins.
const mailOrigin=(job:Row)=>{for(const v of [job.origin,job.button?.url]){try{if(v)return new URL(String(v)).origin;}catch{}}return '';};

// Every file an email carries, in one place: used for the attachments and for the download links.
export async function mailFiles(job:Row):Promise<MailFile[]>{
 const files:MailFile[]=[];
 // A stored document (the Green Invoice PDF of a payment, 23.11.2026).
 if(job.attach_file_id){const s=await storedFile(await one('SELECT * FROM files WHERE id=?',job.attach_file_id),MAIL_FILE_MAX);if(s)files.push({filename:String(s.file.name||'document.pdf'),content_type:String(s.file.type||'application/pdf'),bytes:s.bytes,label:'חשבונית מס/קבלה'});}
 if(job.attach_order_statement){const {storedOrderPdf}=await import('./order-statement');const pdf=await storedOrderPdf(job.attach_order_statement,job.origin);files.push({filename:pdf.filename,content_type:'application/pdf',bytes:pdf.bytes,label:'סיכום ההזמנה'});}
 if(job.attach_writing_brief){const {writingBriefFile}=await import('./writing-brief-file');const pdf=await writingBriefFile(job.attach_writing_brief,job.origin);files.length=0;files.push({filename:pdf.filename,content_type:'application/pdf',bytes:pdf.bytes,label:'פרטי הכתיבה'});}
 if(job.attach_article){const a=await one('SELECT * FROM articles WHERE id=?',job.attach_article);if(a){
  // Staging 22.11.2026: one image Word cannot show (WEBP, HEIC, a damaged or missing file) failed the whole supplier
  // e-mail. Now the Word file goes without that image (a short note in its place) and the image travels as its own file.
  const skipped:string[]=[],docx=await articleDocx(a,{lenient:true,skipped});
  files.length=0;files.push({filename:'article.docx',content_type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',bytes:docx,label:skipped.length?'קובץ Word של הכתבה (חלק מהתמונות מצורפות רק כקבצים נפרדים)':'קובץ Word של הכתבה, עם התמונות והקרדיטים'});
  if(job.attach_images){const d=JSON.parse(a.data||'{}'),images=articleImages(a),fileRows=await mapIn('files','id',[...images.map(i=>i.id),d.document_id]);
   // Owner (22.11.2026): every image of the article travels as its own file too, not only inside the Word file. Images
   // placed inside the text (the editor's pictures) were missing: only the main and secondary fields were attached.
   for(const img of images){const s=await storedFile(fileRows.get(img.id),MAIL_FILE_MAX).catch(()=>null);if(s&&String(s.file.type).startsWith('image/'))files.push({filename:'image-'+img.n+'.'+(String(s.file.type).split('/')[1]||'jpg').replace('jpeg','jpg'),content_type:s.file.type,bytes:s.bytes,label:img.label,image:true});}
   // The page no longer shows the article, so the customer's original document travels with the email too.
   const doc=await storedFile(fileRows.get(String(d.document_id)),MAIL_FILE_MAX).catch(()=>null);if(doc)files.push({filename:'original-'+String(doc.file.name||'document').replace(/[^\w.\-֐-׿ ]/g,'_').slice(-80),content_type:doc.file.type||'application/octet-stream',bytes:doc.bytes,label:'המסמך המקורי של הכתבה'});
  }}}
 return files;
}
async function fileToken(id:string,job:Row){
 if(job.file_token)return String(job.file_token);
 const token=[...crypto.getRandomValues(new Uint8Array(24))].map(b=>b.toString(16).padStart(2,'0')).join('');
 await stmt("UPDATE jobs SET data=json_set(data,'$.file_token',?) WHERE id=?",token,id).run();return token;
}
// A download link from an email: the personal token of that email and the file's place in it.
export async function mailFileByToken(token:string,index:number):Promise<MailFile|null>{
 if(!/^[0-9a-f]{48}$/.test(token)||!Number.isInteger(index)||index<0||index>=MAIL_FILES_MAX)return null;
 const job=parse(await one("SELECT * FROM jobs WHERE kind='email' AND json_extract(data,'$.file_token')=?",token));
 if(!job||!(Date.parse(job.created)>Date.now()-MAIL_FILE_DAYS*86400000))return null;
 // An article that was pulled back from the supplier closes its files as well.
 if(job.attach_article){const a=await one('SELECT status FROM articles WHERE id=?',job.attach_article);if(!a||!['sent','published'].includes(a.status))return null;}
 return (await mailFiles(job))[index]||null;
}

// Resend's own format (owner, 16.11.2026). With a test inbox set, every message goes only there and the subject names
// the real recipient, so a trial never reaches a customer or a supplier.
// One fixed id per article for the supplier's first e-mail; follow-ups point to it (In-Reply-To / References).
export function supplierThreadId(articleId:string,from:string){const domain=(String(from).match(/@([^>\s]+)/)?.[1]||'megalinks.local').toLowerCase();return '<supplier-article-'+articleId+'@'+domain+'>';}
export function resendMessage(payload:Row,c:Row){const test=String(c.test_to||'').trim();
 // A supplier with several addresses ("a, b") gets one message addressed to all of them (owner, 20.11.2026).
 const to=test?[test]:emailList(payload.to).length?emailList(payload.to):[String(payload.to||'')];
 // The test mark goes after a leading "Re: ", so a reply keeps the thread's subject (owner, 22.11.2026: on Staging the
 // follow-up "[בדיקה · אל: x] Re: ..." opened a new Gmail conversation instead of joining "[בדיקה · אל: x] ...").
 const subject=String(payload.subject||''),re=/^Re:\s*/i.exec(subject)?.[0]||'';
 return {from:String(c.from||RESEND_TEST_FROM),to,subject:test?(re?'Re: ':'')+'[בדיקה · אל: '+payload.to+'] '+subject.slice(re.length):subject,html:payload.html,text:payload.text,
  ...(payload.headers&&Object.keys(payload.headers).length?{headers:payload.headers}:{}),
  // A customer who presses "reply" writes straight to the owner's inbox (owner, 22.11.2026).
  ...(String(c.reply_to||'').trim()?{reply_to:String(c.reply_to).trim()}:{}),
  ...(Array.isArray(payload.attachments)&&payload.attachments.length?{attachments:payload.attachments.map((a:Row)=>({filename:a.filename,content:a.content_base64}))}:{})};}
const resendFailure=(status:number)=>status===401?'Resend דחה את המפתח. בדקו את מפתח ה-API בחיבור הדוא״ל.':status===403?'Resend חסם את השליחה: בלי דומיין מאומת אפשר לשלוח רק לכתובת שאיתה נרשמתם. מלאו "כתובת לבדיקה" או אמתו דומיין.':status===422?'Resend דחה את פרטי המייל (בדרך כלל כתובת השולח). בדקו את כתובת השולח בחיבור.':status===429?'Resend הגביל את קצב השליחה. נסו שוב בעוד דקה.':'Resend החזיר '+status;
export async function sendQueuedMail(id:string){const job=parse(await one('SELECT * FROM jobs WHERE id=? AND kind=?',id,'email'));if(!job||['succeeded','demo','writing'].includes(job.status))return job;
 const c=await connection('email');if(job.demo){await stmt("UPDATE jobs SET status='demo',updated=? WHERE id=?",now(),id).run();return {status:'demo'};}
 if(!c.enabled||!c.url||!c.secret){await stmt("UPDATE jobs SET status='blocked',updated=? WHERE id=?",now(),id).run();return {status:'blocked'};}
 const claim=await stmt("UPDATE jobs SET status='writing',updated=? WHERE id=? AND status IN ('requested','blocked','failed')",now(),id).run();if(!claim.meta.changes)return {status:'writing'};
 try {const payload:Row={event:'send_email',idempotency_key:id,to:job.to,subject:job.subject,text:job.text,button:job.button},origin=mailOrigin(job);
  // Files: attached to the message and, in addition, each one gets a personal download link in the body.
  const files=await mailFiles(job);let links:MailFileLink[]=files.map(f=>({label:f.label,name:f.filename,size:f.bytes.length,url:''}));
  if(files.length){
   if(origin){const token=await fileToken(id,job);links=links.map((l,i)=>({...l,url:origin+'/api/mail-file/'+token+'/'+i+'/'+encodeURIComponent(l.name)}));payload.attachment_urls=links.map(l=>l.url);payload.attachment_names=links.map(l=>l.name);links.forEach((l,i)=>{payload['attachment_'+(i+1)+'_url']=l.url;payload['attachment_'+(i+1)+'_name']=l.name;});}
   // Owner (22.11.2026): attach what fits, in order (the Word file first, then the images), instead of all or nothing;
   // a file that does not fit keeps its download link and the message says so.
   const limit=c.provider==='resend'?RESEND_INLINE_LIMIT:INLINE_FILES_LIMIT;let used=0;
   const attached=files.map(f=>{if(!origin)return true;if(used+f.bytes.length>limit)return false;used+=f.bytes.length;return true;});
   links=links.map((l,i)=>({...l,attached:attached[i],image:!!files[i].image}));
   if(attached.some(Boolean))payload.attachments=files.filter((_,i)=>attached[i]).map(f=>({filename:f.filename,content_type:f.content_type,content_base64:base64(f.bytes)}));
  }
  // Rebuild supplier messages from publication fields on every send (also for retries of older jobs).
  if(job.attach_article||job.supplier_article){const a=await one('SELECT * FROM articles WHERE id=?',job.attach_article||job.supplier_article);if(!a)throw new Error('הכתבה אינה זמינה לשליחה');const d=JSON.parse(a.data||'{}');const w=await one('SELECT name,url,data FROM websites WHERE id=?',a.website_id),site=d.website_name||w?.name||'',siteUrl=String(d.website_url||w?.url||''),link=String(job.button?.url||'');
   // Owner decision (23.11.2026): the article's number for its supplier. A stock supplier: its number within the stock (3/10).
   // A monthly-billing supplier: how many articles were sent to that supplier (supplier_id, any of its sites) in the same
   // Israel-time month up to this one; a site without a supplier counts by the site, as before.
   const seq=Number(d.supplier_sequence)||0,total=Number(d.supplier_stock_total)||0,sentAt=String(d.supplier_sent_at||new Date().toISOString());
   const supplierId=String(d.supplier_id||(()=>{try{return JSON.parse(w?.data||'{}').supplier_id;}catch{return '';}})()||'');
   let monthNumber=0;if(!(total&&seq)){const peers=await all(`SELECT json_extract(a.data,'$.supplier_sent_at') AS s FROM articles a LEFT JOIN websites w ON w.id=a.website_id WHERE ${supplierId?"COALESCE(NULLIF(json_extract(a.data,'$.supplier_id'),''),json_extract(w.data,'$.supplier_id'))=?":'a.website_id=?'} AND COALESCE(json_extract(a.data,'$.demo'),0)=? AND json_extract(a.data,'$.supplier_sent_at')>=? AND json_extract(a.data,'$.supplier_sent_at')<=?`,supplierId||a.website_id,d.demo?1:0,new Date(Date.parse(sentAt)-32*86400000).toISOString(),sentAt);monthNumber=peers.filter((x:Row)=>x.s&&israelMonth(x.s)===israelMonth(sentAt)).length;}
   const {counter,label:counterLabel}=supplierCounter(seq,total,monthNumber);
   // Owner (22.11.2026): one thread per article, never per supplier or batch. The article's first e-mail carries a fixed
   // id and a subject unique to the article; reminders and follow-ups answer it with "Re:". An article whose first e-mail
   // went out before this (no stored id) gets fresh e-mails with their own unique subject instead.
   let unique=supplierEmailSubject(site,siteUrl,total&&seq?seq:Math.max(1,monthNumber),total&&seq?{total}:{sentAt}),firstMail=id==='email:supplier:'+a.id;
   // A first e-mail sent again after the article was pulled back from the supplier (its old job renamed ":recalled:")
   // answers the article's existing thread: same Gmail conversation, and never a second message with the same Message-ID
   // (Gmail drops a message whose Message-ID it already has).
   const ownThread='<supplier-article-'+a.id+'@';
   const found=parse(firstMail?await one("SELECT data FROM jobs WHERE kind='email' AND id LIKE ? AND json_extract(data,'$.thread_id') IS NOT NULL ORDER BY created LIMIT 1",'email:supplier:'+a.id+':recalled:%'):await one("SELECT data FROM jobs WHERE id=? AND kind='email'",'email:supplier:'+a.id));
   // A thread id is used only if it is this article's own (it carries the article id): never another article's thread.
   const opened=found&&String(found.thread_id||'').startsWith(ownThread)?found:found?{...found,thread_id:undefined}:null;
   // A subject another article already used (a stock slot freed by a recall and given to this one) gets the article's
   // short code, so two articles never share a subject.
   if(firstMail&&!opened?.thread_id){const taken=await one("SELECT id FROM jobs WHERE kind='email' AND id LIKE 'email:supplier:%' AND id NOT LIKE ? AND json_extract(data,'$.thread_subject')=? LIMIT 1",'email:supplier:'+a.id+'%',unique);if(taken)unique+=' · '+String(a.id).replace(/[^\w]/g,'').slice(0,6).toUpperCase();}
   if(firstMail&&opened?.thread_id){payload.thread={id:String(opened.thread_id),subject:String(opened.thread_subject||unique)};payload.subject='Re: '+payload.thread.subject;payload.headers={'In-Reply-To':payload.thread.id,References:payload.thread.id};}
   else if(firstMail){payload.thread={id:supplierThreadId(a.id,String(c.from||RESEND_TEST_FROM)),subject:unique};payload.subject=unique;payload.headers={'Message-ID':payload.thread.id};}
   else if(opened?.thread_id){payload.subject='Re: '+opened.thread_subject;payload.headers={'In-Reply-To':opened.thread_id,References:opened.thread_id};}
   else payload.subject=job.supplier_followup==='hold'?'נא להמתין עם פרסום הכתבה · '+unique:job.supplier_followup==='update'?'הנחיות מעודכנות · '+unique:unique;
   if(job.supplier_followup==='hold'){payload.text=['נא להמתין עם פרסום הכתבה',a.title,'הכתבה חזרה ללקוח לתיקונים. כשהתיקונים יאושרו, נשלח לכם כאן הנחיות מעודכנות וקובץ חדש.',link?'הקישור האישי שלכם לכתבה ממשיך לעבוד: '+link:''].filter(Boolean).join('\n\n');payload.html=supplierHoldEmailHtml(a,site,counterLabel,link,origin);}
   // The admin's answer to a supplier's request for fixes or rejection (owner, 22.11.2026).
   // answer_type 'link' (23.11.2026): a link waiting for the manual check that the admin did not approve.
   else if(job.supplier_followup==='answer'){const isLink=job.answer_type==='link';if(!opened?.thread_id)payload.subject=(isLink?'הקישור לא אושר · ':'תשובה לבקשה שלכם · ')+unique;payload.text=[isLink?'הקישור ששלחתם לא אושר':job.answer_type==='reject'?'הכתבה נשארת לפרסום':'אפשר לפרסם את הכתבה כמו שהיא',a.title,'מה כתבנו לכם:\n'+String(job.answer_note||''),link?(isLink?'אחרי התיקון, שלחו את הקישור שוב כאן: ':'אחרי הפרסום, שלחו את הקישור לכתבה כאן: ')+link:''].filter(Boolean).join('\n\n');payload.html=supplierAnswerEmailHtml(a,site,counterLabel,link,origin,String(job.answer_type||''),String(job.answer_note||''));}
   else{
   payload.text=['כתבה חדשה לפרסום',a.title,siteUrl?'לפרסום באתר: '+siteUrl:site?'אתר: '+site:'',supplierPublicationNotes(a,links),links.some(l=>l.attached===false)?'חלק מהקבצים גדולים מדי לצירוף למייל, ואפשר להוריד אותם בקישורים כאן. התמונות נמצאות גם בקובץ ה-Word.':'',mailFilesText(links.filter(l=>l.url)),link?'אחרי הפרסום, שלחו את הקישור לכתבה כאן: '+link:'',supplierIssueLinkText(link)].filter(Boolean).join('\n\n');payload.html=supplierArticleEmailHtml(a,site,siteUrl,counterLabel,link,origin,links,job.supplier_followup==='update');if(job.supplier_followup==='update')payload.text='הנחיות מעודכנות לפרסום. הגרסה הזו מחליפה את הקודמת.\n\n'+payload.text;if(links[0]?.url)payload.word_file_url=links[0].url;}}
  else{
   // Every other message goes out as a designed right-to-left page: its own design when it has one, the standard one otherwise.
   payload.html=job.html?withMailFiles(String(job.html),links):brandedEmailHtml({subject:String(job.subject||''),text:String(job.text||''),button:job.button,origin,files:links});
   const fileText=mailFilesText(links.filter(l=>l.url));if(fileText)payload.text=[payload.text,fileText].filter(Boolean).join('\n\n');
  }
  const resend=c.provider==='resend';
  const res=await externalFetch(resend?RESEND_URL:c.url,{method:'POST',headers:{Authorization:'Bearer '+c.secret,'Content-Type':'application/json','Idempotency-Key':id},body:JSON.stringify(resend?resendMessage(payload,c):{...payload,thread:undefined})});
  if(!res.ok)throw resend?new ApiError(502,resendFailure(res.status)):new Error('שירות הדיוור החזיר '+res.status);if(payload.thread)await stmt("UPDATE jobs SET status='succeeded',updated=?,data=json_set(data,'$.thread_id',?,'$.thread_subject',?) WHERE id=?",now(),payload.thread.id,payload.thread.subject,id).run();else await stmt("UPDATE jobs SET status='succeeded',updated=? WHERE id=?",now(),id).run();return {status:'succeeded'};
 }catch(e){await stmt("UPDATE jobs SET status='failed',data=json_set(data,'$.delivery_error',?),updated=? WHERE id=?",mailFailure(e),now(),id).run();return {status:'failed'};}}
// The real cause for the admin (Staging 22.11.2026: only "בדקו את החיבור" was stored). Our own errors are Hebrew and safe to
// show; anything else is named by its type and a short message, with anything that looks like a key or token removed.
export function mailFailure(e:unknown){
 const own=safeFailure(e,'');if(own)return own;
 const raw=String((e as any)?.message||e||''),msg=raw.replace(/(re_|sk-|Bearer\s+)[\w.-]+/gi,'[מוסתר]').replace(/https?:\/\/\S+/g,'[כתובת]').replace(/\s+/g,' ').trim().slice(0,200);
 if(/[֐-׿]/.test(raw))return 'שליחת המייל נכשלה: '+msg;
 return 'שליחת המייל נכשלה בהכנת ההודעה, לפני השליחה לשירות הדיוור. פרטים טכניים: '+(String((e as any)?.name||'Error'))+(msg?': '+msg:'');
}
export async function queueMail(id:string,userId:string,data:Row){await stmt('INSERT OR IGNORE INTO jobs(id,user_id,kind,status,data,created,updated) VALUES (?,?,?,?,?,?,?)',id,userId,'email','requested',JSON.stringify(data),now(),now()).run();return sendQueuedMail(id);}
// pre: what the caller already read for many articles at once (the order, the admin addresses), so a loop of
// mails does not read them again per article. The customer is only needed when the mail goes to the customer.
export async function articleMail(a:Row,event:'submitted'|'revisions'|'published',origin:string,note='',pre:{order?:Row,admins?:string[]}={}){if(event==='revisions')return revisionMail(a,origin,note,pre);if(event==='published')return publishedMail(a,origin,pre);const o=pre.order||parse(await one('SELECT * FROM orders WHERE id=?',a.order_id))!;let recipients=event==='submitted'?(pre.admins||(await all("SELECT email FROM users WHERE role='admin'")).map(x=>x.email)):[(await one('SELECT * FROM users WHERE id=?',a.user_id))?.email];if(event==='submitted')recipients.push(String((env as any).POSTFLOW_OWNER_EMAIL||''),...String((env as any).POSTFLOW_ADMIN_EMAILS||'').split(','));for(const email of new Set(recipients.filter(Boolean))){await queueMail('email:'+event+':'+a.id+':'+a.version+':'+email,a.user_id,{to:email,subject:'מאמר חדש ממתין לאישור',text:a.title+'\n'+(note||a.published_url||''),button:{label:'פתיחת המאמר',url:origin+'/article/'+a.id},demo:!!o.demo,article_id:a.id,origin});}}

// The customer's article e-mails (lib/fix-request-mail.ts), one family since 22.11.2026. The shared facts of the
// article are read once here: the order, the customer and the site.
async function articleFacts(a:Row,origin:string,pre:{order?:Row}={}){
 const d=typeof a.data==='string'?JSON.parse(a.data||'{}'):a.data||{};
 const [order,customer,w]=await Promise.all([pre.order?Promise.resolve(pre.order):one('SELECT * FROM orders WHERE id=?',a.order_id).then(r=>parse(r)),one('SELECT name,email FROM users WHERE id=?',a.user_id),one('SELECT name,url FROM websites WHERE id=?',a.website_id)]);
 const base={origin,site:String(d.website_name||w?.name||a.website_name||'').trim(),siteUrl:String(d.website_url||w?.url||a.website_url||''),title:String(a.title||d.topic||'המאמר שלך'),orderNumber:order?.number?String(order.number):'',name:String(customer?.name||'').trim().split(/\s+/)[0]||'',url:origin+'/article/'+a.id};
 return {base,email:String(customer?.email||''),demo:!!order?.demo||!!d.demo};
}

// Returned for a fix: the note is kept on the article, so the updates popup and the editor show the same words.
async function revisionMail(a:Row,origin:string,note:string,pre:{order?:Row}){
 await stmt("UPDATE articles SET data=json_set(data,'$.revision_note',?,'$.revision_requested_at',?) WHERE id=?",String(note||''),now(),a.id).run();
 const {base,email,demo}=await articleFacts(a,origin,pre);if(!email)return;
 const m={...base,note:String(note||'').trim()||'הפרטים מופיעים בעמוד המאמר.'};
 await queueMail('email:revisions:'+a.id+':'+a.version+':'+email,a.user_id,{to:email,subject:fixRequestSubject(m.site),text:fixRequestText(m),html:fixRequestEmailHtml(m),button:{label:'פתיחת המאמר לתיקון',url:m.url},demo,article_id:a.id,origin});
}

// Published, with the live link.
async function publishedMail(a:Row,origin:string,pre:{order?:Row}){
 const {base,email,demo}=await articleFacts(a,origin,pre);if(!email||!a.published_url)return;
 const m={...base,publishedUrl:String(a.published_url),publishedOn:new Intl.DateTimeFormat('he-IL',{timeZone:'Asia/Jerusalem',day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date())};
 await queueMail('email:published:'+a.id+':'+a.version+':'+email,a.user_id,{to:email,subject:publishedSubject(m.site),text:publishedText(m),html:publishedEmailHtml(m),button:{label:'לצפייה בכתבה שפורסמה',url:m.publishedUrl},demo,article_id:a.id,origin});
}

/** The admin cancelled the article (all of it, or only its publication) and the money was settled: one e-mail to the customer. */
export async function cancelledMail(a:Row,origin:string,info:{reason:string;full:boolean;refund?:string;stamp:string}){
 const {base,email,demo}=await articleFacts(a,origin);if(!email)return;
 const m={...base,note:info.reason.trim()||'הפרטים מופיעים בעמוד המאמר.',full:info.full,refund:info.refund};
 await queueMail('email:cancelled:'+a.id+':'+info.stamp+':'+email,a.user_id,{to:email,subject:cancelledSubject(m.site,m.full),text:cancelledText(m),html:cancelledEmailHtml(m),button:{label:'צפייה בפרטי המאמר',url:m.url},demo,article_id:a.id,origin});
}

export async function writingRequestMail(a:Row,origin:string){
 const data=typeof a.data==='string'?JSON.parse(a.data):a.data||a;
 const order=parse(await one('SELECT * FROM orders WHERE id=?',a.order_id))!;
 const customer=await one('SELECT name,email FROM users WHERE id=?',a.user_id);
 const recipients=new Set([...(await all("SELECT email FROM users WHERE role='admin'")).map(x=>x.email),String((env as any).POSTFLOW_OWNER_EMAIL||''),...String((env as any).POSTFLOW_ADMIN_EMAILS||'').split(',')].map(email=>email.trim()).filter(Boolean));
 const text=[`הזמנה: ${order.number}`,`לקוח: ${customer?.name||''} · ${customer?.email||''}`,`אתר: ${data.website_name||''}`,`מספר מילים שנרכש: ${data.editorial_words||400}`,...[['topic','נושא'],['keywords','מילות מפתח'],['brand','מותג'],['audience','קהל יעד'],['style','סגנון'],['notes','דגשים לכתיבה'],['target_url','קישור'],['anchor','טקסט הקישור'],['target_url_2','קישור נוסף'],['anchor_2','טקסט קישור נוסף'],['client_notes','הערות לפרסום']].filter(([key])=>data[key]).map(([key,label])=>label+': '+data[key])].join('\n');
 let result:Row={status:'requested'};for(const email of recipients)result=await queueMail('email:writing-request:'+a.id+':'+a.version+':'+email,a.user_id,{to:email,subject:'פרטי כתיבה חדשים: '+data.topic,text,button:{label:'פתיחת הזמנת הכתיבה',url:origin+'/admin-article/'+a.id},demo:!!order.demo,article_id:a.id,attach_writing_brief:a.id,origin});return result;
}
