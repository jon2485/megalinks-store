// Owner (22.11.2026): one e-mail thread per article, never per supplier or batch. The first e-mail of an article has a
// fixed id and a subject unique to the article; its hold, update and reminder e-mails answer it with "Re:".
// An article whose first e-mail went out before this (no stored id) gets fresh e-mails with their own unique subject.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {realpathSync,mkdirSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const require=createRequire(realpathSync('node_modules/wrangler')+'/package.json'),{build}=require('esbuild');
const server=`export class ApiError extends Error{};export const assert=(ok,m)=>{if(!ok)throw new ApiError(m)};
export const one=async(sql,...a)=>sql.includes(' LIKE ')?(globalThis.recalled?.[a[0]]||null):sql.includes('FROM jobs')?(globalThis.jobs[a[0]]||null):sql.includes('FROM articles')?globalThis.articles[a[0]]:{name:'מאקו',url:'https://www.mako.co.il'};
export const mapIn=async()=>new Map();export const parse=r=>r?({...r,...JSON.parse(r.data||'{}')}):null;
export const connection=async()=>({enabled:true,provider:'resend',url:'https://api.resend.com/emails',secret:'fixture',from:'Mega Links <news@megalinks.example>',test_to:globalThis.testTo||''});
export const stmt=(sql,...a)=>({run:async()=>{globalThis.writes.push({sql,a});if(sql.includes("'$.thread_id'")){const j=globalThis.jobs[a[3]];const d=JSON.parse(j.data);d.thread_id=a[1];d.thread_subject=a[2];j.data=JSON.stringify(d);}return {meta:{changes:1}};}});
export const now=()=>'2026-11-22T10:00:00.000Z';export const all=async()=>[];
export const externalFetch=async(url,o)=>{globalThis.sent.push(JSON.parse(o.body));return new Response('{}');};`;
const result=await build({entryPoints:['lib/mail.ts'],bundle:true,platform:'node',format:'esm',write:false,plugins:[{name:'thread-fixtures',setup(b){b.onResolve({filter:/^(cloudflare:workers|\.\/server|\.\/delivery-docx|\.\/order-statement)$/},a=>({path:a.path,namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},a=>({loader:'js',contents:a.path==='cloudflare:workers'?'export const env={};':a.path==='./delivery-docx'?'export const articleDocx=async()=>new Uint8Array([80,75,3,4]);':a.path==='./order-statement'?'export async function storedOrderPdf(){}':server}));}}]});
mkdirSync('.sites-runtime',{recursive:true});writeFileSync('.sites-runtime/supplier-thread.mjs',result.outputFiles[0].text);
const {sendQueuedMail,mailFailure}=await import(pathToFileURL(realpathSync('.sites-runtime/supplier-thread.mjs')));

const article=(id,title,seq)=>({id,title,website_id:'w',content:'<p>x</p>',data:JSON.stringify({supplier_sequence:seq,supplier_stock_total:10})});
const job=(data)=>({status:'requested',data:JSON.stringify({to:'supplier@example.test',subject:'',text:'',button:{label:'x',url:'https://example.test/supplier/tok'},...data})});
globalThis.articles={a1:article('a1','עשרה יעדים בארץ',3),a2:article('a2','מדריך לבחירת מזרן',4),old:article('old','כתבה ישנה',5)};
globalThis.writes=[];globalThis.sent=[];
globalThis.jobs={'email:supplier:a1':job({attach_article:'a1'}),'email:supplier:a2':job({attach_article:'a2'}),'email:supplier:old':job({attach_article:'old',thread_id:undefined})};
globalThis.jobs['email:supplier:old'].status='succeeded';

// Two articles to the same supplier at the same moment: two separate e-mails, two separate threads, unique subjects.
await sendQueuedMail('email:supplier:a1');await sendQueuedMail('email:supplier:a2');
const [first1,first2]=globalThis.sent;
assert.equal(first1.subject,'כתבה לפרסום באתר מאקו 3/10 · עשרה יעדים בארץ');
assert.equal(first2.subject,'כתבה לפרסום באתר מאקו 4/10 · מדריך לבחירת מזרן');
assert.match(first1.headers['Message-ID'],/^<supplier-article-a1@megalinks\.example>$/);
assert.notEqual(first1.headers['Message-ID'],first2.headers['Message-ID']);
assert(!first1.headers['In-Reply-To']&&!first1.headers.References,'a first e-mail answers nothing');
assert.equal(JSON.parse(globalThis.jobs['email:supplier:a1'].data).thread_id,first1.headers['Message-ID'],'the id is stored with the first e-mail');

// Hold and update of article a1 join a1's thread only.
for(const kind of ['hold','update']){
 globalThis.jobs['email:supplier-'+kind+':a1:9']=job(kind==='update'?{supplier_followup:kind,supplier_article:'a1',attach_article:'a1'}:{supplier_followup:kind,supplier_article:'a1'});
 await sendQueuedMail('email:supplier-'+kind+':a1:9');const m=globalThis.sent.at(-1);
 assert.equal(m.subject,'Re: כתבה לפרסום באתר מאקו 3/10 · עשרה יעדים בארץ',kind);
 assert.equal(m.headers['In-Reply-To'],first1.headers['Message-ID']);assert.equal(m.headers.References,first1.headers['Message-ID']);assert(!m.headers['Message-ID']);
 assert(m.html.includes(kind==='hold'?'נא להמתין עם פרסום הכתבה':'הנחיות מעודכנות לפרסום'));
 assert.equal(!!m.attachments?.length,kind==='update','only the update carries the new Word file');
}

// An article sent before this change: no "Re:", a fresh e-mail with a subject unique to the article, no thread headers.
globalThis.jobs['email:supplier-hold:old:9']=job({supplier_followup:'hold',supplier_article:'old'});
await sendQueuedMail('email:supplier-hold:old:9');const old=globalThis.sent.at(-1);
assert.equal(old.subject,'נא להמתין עם פרסום הכתבה · כתבה לפרסום באתר מאקו 5/10 · כתבה ישנה');assert(!old.headers);

// Test inbox mode (Staging): the test mark comes after "Re:", so Gmail keeps the follow-up in the article's thread.
globalThis.testTo='owner.inbox@example.test';
globalThis.jobs['email:supplier:t1']=job({attach_article:'a1'});globalThis.articles.t1=article('t1','כתבה בבדיקה',6);globalThis.jobs['email:supplier:t1'].data=JSON.stringify({...JSON.parse(globalThis.jobs['email:supplier:t1'].data),attach_article:'t1'});
await sendQueuedMail('email:supplier:t1');const tFirst=globalThis.sent.at(-1);
assert.equal(tFirst.subject,'[בדיקה · אל: supplier@example.test] כתבה לפרסום באתר מאקו 6/10 · כתבה בבדיקה');assert.deepEqual(tFirst.to,['owner.inbox@example.test']);
assert.match(tFirst.headers['Message-ID'],/^<supplier-article-t1@megalinks\.example>$/);
globalThis.jobs['email:supplier-hold:t1:9']=job({supplier_followup:'hold',supplier_article:'t1'});
await sendQueuedMail('email:supplier-hold:t1:9');const tHold=globalThis.sent.at(-1);
assert.equal(tHold.subject,'Re: '+tFirst.subject,'test mode: the reply subject is "Re: " + the exact first subject');
assert.equal(tHold.headers['In-Reply-To'],tFirst.headers['Message-ID']);assert.equal(tHold.headers.References,tFirst.headers['Message-ID']);
globalThis.testTo='';

// Pulled back from the supplier and approved again (the old first e-mail renamed ":recalled:"): the new first e-mail
// answers the same thread and does not reuse the Message-ID (Gmail would drop a second message with the same id).
globalThis.recalled={'email:supplier:a2:recalled:%':{data:JSON.stringify({thread_id:first2.headers['Message-ID'],thread_subject:first2.subject})}};
globalThis.jobs['email:supplier:a2']=job({attach_article:'a2'});await sendQueuedMail('email:supplier:a2');const again=globalThis.sent.at(-1);
assert.equal(again.subject,'Re: '+first2.subject);assert.equal(again.headers['In-Reply-To'],first2.headers['Message-ID']);assert(!again.headers['Message-ID'],'no second message with the same Message-ID');
assert.equal(JSON.parse(globalThis.jobs['email:supplier:a2'].data).thread_id,first2.headers['Message-ID'],'later follow-ups keep answering the same thread');

// The admin sees the real cause of a failed e-mail, never a key (Staging 22.11.2026: only the generic text was stored).
assert.equal(mailFailure(new Error('תמונה אינה תקינה או אינה נתמכת ב־Word.')),'שליחת המייל נכשלה: תמונה אינה תקינה או אינה נתמכת ב־Word.');
{const m=mailFailure(new TypeError('Cannot read properties of undefined (reading "x") Bearer re_abc123 https://api.resend.com/emails?k=1'));
 assert(m.startsWith('שליחת המייל נכשלה בהכנת ההודעה')&&m.includes('TypeError')&&!m.includes('re_abc123')&&!m.includes('api.resend.com'),m);}
console.log('SUPPLIER THREAD PASS: one thread per article (fixed id stored with the first e-mail), unique subject per article, hold/update answer only their own article, old articles get fresh e-mails without "Re:".');
