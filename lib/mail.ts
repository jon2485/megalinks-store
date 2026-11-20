import { env } from 'cloudflare:workers';
import { one, all, stmt, now, connection, externalFetch, parse, ApiError, mapIn } from './server';
import { articleDocx } from './delivery-docx';
import { Row } from './shared';
import {supplierPublicationNotes,supplierArticleEmailHtml,supplierCounter,supplierEmailSubject,israelMonth} from './supplier-mail-content';
import {brandedEmailHtml,withMailFiles,mailFilesText,MAIL_FILE_DAYS,type MailFileLink} from './mail-template';
import {safeFailure} from './security';
import {RESEND_URL,RESEND_TEST_FROM} from './resend';

export type MailFile={filename:string;content_type:string;bytes:Uint8Array;label:string};
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
 if(job.attach_order_statement){const {storedOrderPdf}=await import('./order-statement');const pdf=await storedOrderPdf(job.attach_order_statement,job.origin);files.push({filename:pdf.filename,content_type:'application/pdf',bytes:pdf.bytes,label:'סיכום ההזמנה'});}
 if(job.attach_writing_brief){const {writingBriefFile}=await import('./writing-brief-file');const pdf=await writingBriefFile(job.attach_writing_brief,job.origin);files.length=0;files.push({filename:pdf.filename,content_type:'application/pdf',bytes:pdf.bytes,label:'פרטי הכתיבה'});}
 if(job.attach_article){const a=await one('SELECT * FROM articles WHERE id=?',job.attach_article);if(a){
  files.length=0;files.push({filename:'article.docx',content_type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',bytes:await articleDocx(a),label:'קובץ Word של הכתבה, עם התמונות והקרדיטים'});
  if(job.attach_images){const d=JSON.parse(a.data||'{}'),fileRows=await mapIn('files','id',[d.image_id,d.secondary_image_id,d.document_id]);
   for(const [fid,name,label] of [[d.image_id,'image','התמונה הראשית'],[d.secondary_image_id,'image-2','תמונה נוספת']]){const s=await storedFile(fileRows.get(String(fid)),MAIL_FILE_MAX);if(s)files.push({filename:name+'.'+(String(s.file.type).split('/')[1]||'jpg').replace('jpeg','jpg'),content_type:s.file.type,bytes:s.bytes,label});}
   // The page no longer shows the article, so the customer's original document travels with the email too.
   const doc=await storedFile(fileRows.get(String(d.document_id)),MAIL_FILE_MAX);if(doc)files.push({filename:'original-'+String(doc.file.name||'document').replace(/[^\w.\-֐-׿ ]/g,'_').slice(-80),content_type:doc.file.type||'application/octet-stream',bytes:doc.bytes,label:'המסמך המקורי של הכתבה'});
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
 if(!/^[0-9a-f]{48}$/.test(token)||!Number.isInteger(index)||index<0||index>9)return null;
 const job=parse(await one("SELECT * FROM jobs WHERE kind='email' AND json_extract(data,'$.file_token')=?",token));
 if(!job||!(Date.parse(job.created)>Date.now()-MAIL_FILE_DAYS*86400000))return null;
 // An article that was pulled back from the supplier closes its files as well.
 if(job.attach_article){const a=await one('SELECT status FROM articles WHERE id=?',job.attach_article);if(!a||!['sent','published'].includes(a.status))return null;}
 return (await mailFiles(job))[index]||null;
}

// Resend's own format (owner, 16.11.2026). With a test inbox set, every message goes only there and the subject names
// the real recipient, so a trial never reaches a customer or a supplier.
export function resendMessage(payload:Row,c:Row){const test=String(c.test_to||'').trim();
 return {from:String(c.from||RESEND_TEST_FROM),to:[test||String(payload.to||'')],subject:(test?'[בדיקה · אל: '+payload.to+'] ':'')+String(payload.subject||''),html:payload.html,text:payload.text,
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
   if(!origin||files.reduce((n,f)=>n+f.bytes.length,0)<=(c.provider==='resend'?RESEND_INLINE_LIMIT:INLINE_FILES_LIMIT))payload.attachments=files.map(f=>({filename:f.filename,content_type:f.content_type,content_base64:base64(f.bytes)}));
  }
  // Rebuild supplier messages from publication fields on every send (also for retries of older jobs).
  if(job.attach_article){const a=await one('SELECT * FROM articles WHERE id=?',job.attach_article);if(!a)throw new Error('הכתבה אינה זמינה לשליחה');const d=JSON.parse(a.data||'{}');const w=await one('SELECT name,url FROM websites WHERE id=?',a.website_id),site=d.website_name||w?.name||'',siteUrl=String(d.website_url||w?.url||''),link=String(job.button?.url||'');
   // Owner decision (11.11.2026): the subject names the site and its package count (3/10); without a package, the article's number for that site this month.
   const seq=Number(d.supplier_sequence)||0,total=Number(d.supplier_stock_total)||0,sentAt=String(d.supplier_sent_at||new Date().toISOString());
   let monthNumber=0;if(!(total&&seq)){const peers=await all("SELECT json_extract(data,'$.supplier_sent_at') AS s FROM articles WHERE website_id=? AND COALESCE(json_extract(data,'$.demo'),0)=? AND json_extract(data,'$.supplier_sent_at')>=? AND json_extract(data,'$.supplier_sent_at')<=?",a.website_id,d.demo?1:0,new Date(Date.parse(sentAt)-32*86400000).toISOString(),sentAt);monthNumber=peers.filter((x:Row)=>x.s&&israelMonth(x.s)===israelMonth(sentAt)).length;}
   const {counter,label:counterLabel}=supplierCounter(seq,total,monthNumber);
   payload.subject=supplierEmailSubject(site,counter);payload.text=['כתבה חדשה לפרסום',a.title,siteUrl?'לפרסום באתר: '+siteUrl:site?'אתר: '+site:'',supplierPublicationNotes(a),mailFilesText(links.filter(l=>l.url)),link?'אחרי הפרסום, שלחו את הקישור לכתבה כאן: '+link:''].filter(Boolean).join('\n\n');payload.html=supplierArticleEmailHtml(a,site,siteUrl,counterLabel,link,origin,links);if(links[0]?.url)payload.word_file_url=links[0].url;}
  else{
   // Every other message goes out as a designed right-to-left page: its own design when it has one, the standard one otherwise.
   payload.html=job.html?withMailFiles(String(job.html),links):brandedEmailHtml({subject:String(job.subject||''),text:String(job.text||''),button:job.button,origin,files:links});
   const fileText=mailFilesText(links.filter(l=>l.url));if(fileText)payload.text=[payload.text,fileText].filter(Boolean).join('\n\n');
  }
  const resend=c.provider==='resend';
  const res=await externalFetch(resend?RESEND_URL:c.url,{method:'POST',headers:{Authorization:'Bearer '+c.secret,'Content-Type':'application/json','Idempotency-Key':id},body:JSON.stringify(resend?resendMessage(payload,c):payload)});
  if(!res.ok)throw resend?new ApiError(502,resendFailure(res.status)):new Error('שירות הדיוור החזיר '+res.status);await stmt("UPDATE jobs SET status='succeeded',updated=? WHERE id=?",now(),id).run();return {status:'succeeded'};
 }catch(e){await stmt("UPDATE jobs SET status='failed',data=json_set(data,'$.delivery_error',?),updated=? WHERE id=?",safeFailure(e,'שליחת המייל נכשלה. בדקו את החיבור ונסו שוב.'),now(),id).run();return {status:'failed'};}}
export async function queueMail(id:string,userId:string,data:Row){await stmt('INSERT OR IGNORE INTO jobs(id,user_id,kind,status,data,created,updated) VALUES (?,?,?,?,?,?,?)',id,userId,'email','requested',JSON.stringify(data),now(),now()).run();return sendQueuedMail(id);}
// pre: what the caller already read for many articles at once (the order, the admin addresses), so a loop of
// mails does not read them again per article. The customer is only needed when the mail goes to the customer.
export async function articleMail(a:Row,event:'submitted'|'revisions'|'published',origin:string,note='',pre:{order?:Row,admins?:string[]}={}){const o=pre.order||parse(await one('SELECT * FROM orders WHERE id=?',a.order_id))!;let recipients=event==='submitted'?(pre.admins||(await all("SELECT email FROM users WHERE role='admin'")).map(x=>x.email)):[(await one('SELECT * FROM users WHERE id=?',a.user_id))?.email];if(event==='submitted')recipients.push(String((env as any).POSTFLOW_OWNER_EMAIL||''),...String((env as any).POSTFLOW_ADMIN_EMAILS||'').split(','));for(const email of new Set(recipients.filter(Boolean))){await queueMail('email:'+event+':'+a.id+':'+a.version+':'+email,a.user_id,{to:email,subject:event==='submitted'?'מאמר חדש ממתין לאישור':event==='revisions'?'המאמר הוחזר לתיקון':'המאמר פורסם',text:a.title+'\n'+(note||a.published_url||''),button:{label:event==='published'?'לכתבה שפורסמה':'פתיחת המאמר',url:event==='published'?a.published_url:origin+'/article/'+a.id},demo:!!o.demo,article_id:a.id,origin});}}

export async function writingRequestMail(a:Row,origin:string){
 const data=typeof a.data==='string'?JSON.parse(a.data):a.data||a;
 const order=parse(await one('SELECT * FROM orders WHERE id=?',a.order_id))!;
 const customer=await one('SELECT name,email FROM users WHERE id=?',a.user_id);
 const recipients=new Set([...(await all("SELECT email FROM users WHERE role='admin'")).map(x=>x.email),String((env as any).POSTFLOW_OWNER_EMAIL||''),...String((env as any).POSTFLOW_ADMIN_EMAILS||'').split(',')].map(email=>email.trim()).filter(Boolean));
 const text=[`הזמנה: ${order.number}`,`לקוח: ${customer?.name||''} · ${customer?.email||''}`,`אתר: ${data.website_name||''}`,`מספר מילים שנרכש: ${data.editorial_words||400}`,...[['topic','נושא'],['keywords','מילות מפתח'],['brand','מותג'],['audience','קהל יעד'],['style','סגנון'],['notes','דגשים לכתיבה'],['target_url','קישור'],['anchor','טקסט הקישור'],['target_url_2','קישור נוסף'],['anchor_2','טקסט קישור נוסף'],['client_notes','הערות לפרסום']].filter(([key])=>data[key]).map(([key,label])=>label+': '+data[key])].join('\n');
 let result:Row={status:'requested'};for(const email of recipients)result=await queueMail('email:writing-request:'+a.id+':'+a.version+':'+email,a.user_id,{to:email,subject:'פרטי כתיבה חדשים: '+data.topic,text,button:{label:'פתיחת הזמנת הכתיבה',url:origin+'/admin-article/'+a.id},demo:!!order.demo,article_id:a.id,attach_writing_brief:a.id,origin});return result;
}
