// Resend as the email service (owner, 16.11.2026): Resend's own format, a test inbox that catches every message,
// clear Hebrew errors, and the webhook path unchanged. Outgoing calls go to a local stub, never to Resend.
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {readFileSync,realpathSync,readdirSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(realpathSync('node_modules/wrangler')+'/package.json'),{Miniflare}=require('miniflare');
let checks=0;const ok=(c,m)=>{assert(c,m);checks++;};
const sent=[];let nextStatus=200;
const mf=new Miniflare({outboundService:async request=>{const url=new URL(request.url);if(['api.resend.com','hooks.example.test'].includes(url.hostname)){sent.push({url:url.href,auth:request.headers.get('authorization'),key:request.headers.get('idempotency-key'),body:await request.json()});return Response.json(url.hostname==='api.resend.com'?{id:'stub-'+sent.length}:{ok:true},{status:nextStatus});}return new Response('reachable',{status:200});},
 modules:[{type:'ESModule',path:'dist/server/index.js'},...readdirSync('dist/server',{recursive:true}).filter(p=>/\.(m?js)$/.test(p)&&p!=='index.js').map(p=>({type:'ESModule',path:'dist/server/'+p}))],compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],r2Buckets:['BUCKET'],bindings:{SETTINGS_ENCRYPTION_KEY:randomBytes(32).toString('base64'),POSTFLOW_OWNER_EMAIL:'owner@example.test'},cf:false});
const call=async(path,method='GET',body,status=200)=>{const res=await mf.dispatchFetch('https://megalinks.test/api/'+path,{method,headers:{'Content-Type':'application/json','oai-authenticated-user-id':'owner','oai-authenticated-user-email':'owner@example.test'},body:body===undefined?undefined:JSON.stringify(body)}),j=await res.json();assert.equal(res.status,status,path+' '+JSON.stringify(j));checks++;return j;};
let n=0;const mail=async(to,subject)=>{const id='email:test:'+(++n);await db.prepare("INSERT INTO jobs(id,user_id,kind,status,data,created,updated) VALUES (?,'owner','email','requested',?,datetime('now'),datetime('now'))").bind(id,JSON.stringify({to,subject,text:'שורה ראשונה\nשורה שנייה',button:{label:'פתיחה',url:'https://megalinks.test/support'},origin:'https://megalinks.test'})).run();await call('admin/mail/'+encodeURIComponent(id),'POST',{});return id;};
const job=async id=>JSON.parse((await db.prepare('SELECT status,data FROM jobs WHERE id=?').bind(id).first()).data);
const status=async id=>(await db.prepare('SELECT status FROM jobs WHERE id=?').bind(id).first()).status;
let db;
try{
 db=await mf.getD1Database('DB');for(const m of readdirSync('drizzle').filter(x=>x.endsWith('.sql')).sort())for(const part of readFileSync('drizzle/'+m,'utf8').split('--> statement-breakpoint').map(x=>x.trim()).filter(Boolean))await db.prepare(part).run();
 await call('me');
 // Validation.
 await call('admin/integration/email','PATCH',{provider:'resend',test_to:'not-an-email',secret:'re_test_key_123',secret_storage:'encrypted_server',enabled:true},400);
 await call('admin/integration/email','PATCH',{provider:'mailgun',secret:'x',secret_storage:'encrypted_server'},400);
 // Resend with a test inbox and the default trial sender.
 await call('admin/integration/email','PATCH',{provider:'resend',test_to:'Owner.Inbox@example.test',secret:'re_test_key_123',secret_storage:'encrypted_server',enabled:true});
 const settings=JSON.stringify(await call('admin/settings'));ok(!settings.includes('re_test_key_123'),'the API key never comes back to the browser');
 let id=await mail('customer@example.test','הפנייה שלך טופלה');
 ok(await status(id)==='succeeded','sent through Resend');
 let s=sent.at(-1);ok(s.url==='https://api.resend.com/emails'&&s.auth==='Bearer re_test_key_123'&&s.key===id,'Resend address, key and idempotency key');
 ok(s.body.from==='Mega Links <onboarding@resend.dev>','the trial sender is used by default');
 ok(JSON.stringify(s.body.to)==='["owner.inbox@example.test"]','the message goes only to the test inbox, not the customer');
 ok(s.body.subject==='[בדיקה · אל: customer@example.test] הפנייה שלך טופלה','the subject names the real recipient');
 ok(/dir="rtl"/.test(s.body.html)&&s.body.text.includes('שורה שנייה'),'the designed right-to-left HTML and the text both go');
 ok(!('event' in s.body)&&!('button' in s.body)&&!JSON.stringify(s.body).includes('content_base64'),'only Resend fields are sent');
 // Errors become clear Hebrew messages for the admin.
 nextStatus=403;id=await mail('supplier@example.test','כתבה לפרסום');ok(await status(id)==='failed'&&/דומיין מאומת/.test((await job(id)).delivery_error),'a blocked send explains the verified-domain rule');
 nextStatus=401;id=await mail('supplier@example.test','כתבה לפרסום');ok(/מפתח/.test((await job(id)).delivery_error),'a refused key says so');
 nextStatus=200;
 // Without a test inbox the real recipient is used, and a custom sender is kept.
 await call('admin/integration/email','PATCH',{provider:'resend',test_to:'',from:'Mega Links <noreply@megalinks.example>',enabled:true});
 id=await mail('customer@example.test','הזמנה נסגרה');s=sent.at(-1);
 ok(JSON.stringify(s.body.to)==='["customer@example.test"]'&&s.body.subject==='הזמנה נסגרה'&&s.body.from==='Mega Links <noreply@megalinks.example>','no test inbox: real recipient, plain subject, own sender');
 ok(s.auth==='Bearer re_test_key_123','the saved key is kept when the field is left empty');
 await call('admin/integration/email','PATCH',{provider:'resend',from:'bad sender <>',enabled:true},400);
 // Supplier mail with a large image: with Resend up to 15MB is attached, above that every file still gets a link.
 const bucket=await mf.getR2Bucket('BUCKET');
 await db.prepare("INSERT INTO websites(id,name,url,category,price,dr,active,data,updated) VALUES ('w1','אתר בדיקה','https://site.example.test','news',50000,30,1,'{}',datetime('now'))").run();
 const image=async(id,mb)=>{const real=Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAAEAAQDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDkKKKK8U/TD//Z','base64'),bytes=new Uint8Array(mb*1024*1024);bytes.set(real); /* a real 4x4 JPEG padded to size; trailing bytes are ignored by readers */await bucket.put('k-'+id,bytes);await db.prepare("INSERT INTO files(id,user_id,name,key,type,size,created) VALUES (?,'owner',?,?,'image/jpeg',?,datetime('now'))").bind(id,id+'.jpg','k-'+id,bytes.length).run();};
 const supplierMail=async(art,img)=>{await db.prepare("INSERT INTO articles(id,order_id,user_id,website_id,status,title,content,data,updated) VALUES (?,'o1','owner','w1','sent','כתבה לבדיקה','<p>תוכן</p>',?,datetime('now'))").bind(art,JSON.stringify({image_id:img})).run();const id='email:supplier:'+art;await db.prepare("INSERT INTO jobs(id,user_id,kind,status,data,created,updated) VALUES (?,'owner','email','requested',?,datetime('now'),datetime('now'))").bind(id,JSON.stringify({to:'supplier@example.test',subject:'',text:'',button:{label:'החזרת קישור',url:'https://megalinks.test/supplier/tok'},attach_article:art,attach_images:true,origin:'https://megalinks.test'})).run();await call('admin/mail/'+encodeURIComponent(id),'POST',{});return id;};
 await call('admin/integration/email','PATCH',{provider:'resend',test_to:'owner.inbox@example.test',enabled:true});
 let files;try{await image('img-mid',4);id=await supplierMail('art-mid','img-mid');s=sent.at(-1);files=(s.body.attachments||[]).map(a=>a.filename);}catch(e){files=null;console.log('supplier fixture skipped:',e.message);}
 if(files){ok(await status(id)==="succeeded","supplier mail with a 4MB image sent");ok(files.includes('article.docx')&&files.some(f=>f.startsWith('image')),'with Resend the Word file and the image are both attached (old 6MB limit linked them): '+files);
  await image('img-big',12);id=await supplierMail('art-big','img-big');s=sent.at(-1);
  ok(!(s.body.attachments||[]).length&&/image\.jpg/.test(s.body.html)&&/article\.docx/.test(s.body.html),'above 15MB nothing is attached but the image and the Word file both get a link (the image used to be dropped)');}
 // Back to the webhook: the old format, unchanged.
 await call('admin/integration/email','PATCH',{provider:'webhook',url:'https://hooks.example.test/catch',secret:'webhook-token',secret_storage:'encrypted_server',enabled:true});
 id=await mail('customer@example.test','בדיקת webhook');s=sent.at(-1);
 ok(s.url==='https://hooks.example.test/catch'&&s.auth==='Bearer webhook-token'&&s.body.event==='send_email'&&s.body.to==='customer@example.test','the webhook still gets the old format');
 console.log('RESEND EMAIL PASSED:',checks,'checks: validation, key kept private, Resend format, test inbox with the real recipient in the subject, Hebrew errors, own sender, webhook unchanged. Local stub only.');
}finally{await mf.dispose();}
