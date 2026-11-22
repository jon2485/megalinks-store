// Owner report (22.11.2026): a supplier's published link got "the site did not answer" because our check timed out,
// not because the page was wrong. Each real cause now has its own message; fetch is mocked, no network.
import assert from 'node:assert/strict';
import {compile} from './admin-ui-harness.mjs';

const lib=await compile('lib/checks.ts','supplier-link-check',{stubs:{
 './server':`
  export class ApiError extends Error{constructor(status,message){super(message);this.status=status;}}
  export function assert(ok,message,status=400){if(!ok)throw new ApiError(status,message);}
  export function externalUrl(value){const u=new URL(value);assert(u.protocol==='https:','https');assert(!/^(localhost|\\d+(\\.\\d+){3})$/.test(u.hostname)&&u.hostname.includes('.'),'public');return u;}
  export const now=()=>'2026-11-22T10:00:00.000Z';export function stmt(){return {run:async()=>({})};}export async function one(){return null;}export async function mapIn(){return new Map();}`,
 './shared':`export function plainText(x){return String(x||'').replace(/<[^>]+>/g,'');}`,
 './rich-content':`export async function inlineImages(){return [];}`,
}});

// Minimal HTMLRewriter for the handlers lib/checks.ts uses (Workers runtime only in production).
globalThis.HTMLRewriter=class{
 constructor(){this.rules=[];}
 on(selector,handlers){this.rules.push([selector,handlers]);return this;}
 transform(res){const rules=this.rules;return {text:async()=>{const html=await res.text();
  for(const [sel,h] of rules){
   if(sel==='a[href]')for(const m of html.matchAll(/<a\b[^>]*?href=["']([^"']*)["'][^>]*>/gi))h.element?.({getAttribute:()=>m[1]});
   else if(sel.startsWith('meta'))for(const m of html.matchAll(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']*)["'][^>]*>/gi))h.element?.({getAttribute:()=>m[1]});
   else if(sel==='title'||sel==='h1')for(const m of html.matchAll(new RegExp(`<${sel}[^>]*>([\\s\\S]*?)</${sel}>`,'gi'))){let end;h.element?.({onEndTag:cb=>{end=cb;}});h.text?.({text:m[1].replace(/<[^>]+>/g,'')});end?.();}
   else if(sel==='body'){const b=/<body[^>]*>([\s\S]*)<\/body>/i.exec(html);if(b)h.text?.({text:b[1].replace(/<[^>]+>/g,' ')});}
  }
  return html;}};}
};

// Mocked fetch: each call takes the next planned answer; "timeout" throws like AbortSignal.timeout does.
let plan=[],calls=[];
globalThis.fetch=async(url,init)=>{calls.push({url,init});const next=plan.shift();assert.ok(next,'unexpected fetch '+url);
 if(next==='timeout'){const e=new Error('The operation was aborted due to timeout');e.name='TimeoutError';throw e;}
 if(next==='network')throw new TypeError('fetch failed');
 return new Response(next.body??'',{status:next.status??200,headers:next.headers??{'content-type':'text/html; charset=utf-8'}});};
const run=async(answers,fn)=>{plan=[...answers];calls=[];const result=await fn();assert.equal(plan.length,0,'every planned answer was used');return result;};

const site='https://www.magazine-example.co.il/';
const article={title:'המדריך המלא לבחירת ריהוט גן עמיד לשמש ולגשם',content:'<p>טקסט <a href="https://brand-example.com/garden">מותג</a></p>'};
const page=(title,links=['https://brand-example.com/garden'])=>({body:`<html><head><title>${title} - מגזין</title><meta property="og:title" content="${title}"></head><body><h1>${title}</h1><p>תוכן</p>${links.map(l=>`<a href="${l}">קישור</a>`).join('')}</body></html>`});
const verify=(url=site+'garden-furniture')=>lib.verifyPublishedArticle(url,site,article);

// 1. Browser-like request: headers, no Range, a 15 s limit.
let r=await run([page(article.title)],()=>verify());
assert.equal(r.ok,true,r.message);
assert.equal(calls.length,1,'the page is fetched once, not twice');
const headers=calls[0].init.headers;
assert.match(headers['User-Agent'],/Mozilla\/5\.0 .*Chrome\//);
assert.match(headers['Accept'],/text\/html/);
assert.match(headers['Accept-Language'],/^he/);
assert.equal(Object.keys(headers).some(k=>k.toLowerCase()==='range'),false);
assert.equal(calls[0].init.redirect,'manual');
assert.ok(calls[0].init.signal instanceof AbortSignal);
assert.equal(lib.PAGE_TIMEOUT_MS,15000);

// 2. Owner decision (23.11.2026): ordinary retries, then the manual check. No real waiting in the test.
lib.LINK_RETRY.waitMs=0;
assert.equal(lib.LINK_RETRY.budgetMs,45000,'about 45 s in total');
const given=site+'garden-furniture',spellings=[given,given,'http://www.magazine-example.co.il/garden-furniture','https://magazine-example.co.il/garden-furniture','http://magazine-example.co.il/garden-furniture'];
r=await run(['timeout',page(article.title)],()=>verify());
assert.equal(r.ok,true,'a slow first answer is retried');
r=await run(['network',page(article.title)],()=>verify());
assert.equal(r.ok,true,'a network failure is retried');
r=await run([{status:503},page(article.title)],()=>verify());
assert.equal(r.ok,true,'a server error is retried');
// The same address twice, then https/http and with/without "www"; another spelling that opens is checked as usual.
r=await run(['timeout','timeout',page(article.title)],()=>verify());
assert.equal(r.ok,true);assert.equal(r.final_url,spellings[2]);assert.deepEqual(calls.map(c=>c.url),spellings.slice(0,3));
assert.equal(r.url,given,'the link the supplier sent is kept');
assert.ok(calls.every(c=>c.init.redirect==='manual'&&c.init.headers===lib.BROWSER_HEADERS),'plain browser-like requests only');
// Nothing opens: the link waits for the admin's manual check, with the cause in Hebrew.
r=await run(['timeout','timeout','timeout','network','timeout'],()=>verify());
assert.equal(r.ok,false);assert.equal(r.manual_review,true);assert.equal(r.reason,'unreachable');
assert.deepEqual(calls.map(c=>c.url),spellings,'every ordinary spelling once, nothing more');
assert.equal(r.message,'הקישור התקבל ויאושר אחרי בדיקה ידנית.');assert.match(r.review_reason,/האתר לא ענה לבדיקה האוטומטית \(ניסינו 5 פעמים\)/);
r=await run(Array(5).fill({status:403}),()=>verify());
assert.equal(r.manual_review,true);assert.equal(r.reason,'blocked');assert.match(r.review_reason,/האתר חסם את הבדיקה האוטומטית \(שגיאה 403\)/);
for(const status of [429,503,500]){r=await run(Array(5).fill({status}),()=>verify());assert.equal(r.manual_review,true,String(status));assert.equal(r.status,status);}
r=await run(Array(5).fill({status:503}),()=>verify());assert.match(r.review_reason,/שגיאת שרת \(שגיאה 503\)/);
// Another spelling's 404 never replaces the cause of the address the supplier sent.
r=await run([{status:503},{status:503},{status:404},{status:404},{status:404}],()=>verify());
assert.equal(r.manual_review,true);assert.equal(r.status,503);
// The same address answering 404 on the second try is a real answer: an error, as today.
r=await run([{status:503},{status:404}],()=>verify());
assert.equal(r.manual_review,undefined);assert.equal(r.reason,'not_found');
// A bot-check page instead of the article (200) goes to the manual check, judged by its <title>.
r=await run([{body:'<html><head><title>Just a moment...</title></head><body><p>Checking your browser</p></body></html>'}],()=>verify());
assert.equal(r.manual_review,true);assert.equal(r.reason,'blocked');assert.match(r.review_reason,/דף אימות נגד רובוטים/);
// The time limit holds: when the budget is used up, no more tries.
lib.LINK_RETRY.budgetMs=0;r=await run(['timeout'],()=>verify());assert.equal(r.manual_review,true);assert.equal(calls.length,1);lib.LINK_RETRY.budgetMs=45000;

// 3. A real answer stays an error, with no manual check: not found, other HTTP errors.
r=await run([{status:404}],()=>verify());
assert.equal(r.reason,'not_found');assert.match(r.message,/הדף לא נמצא באתר \(שגיאה 404\)/);assert.match(r.message,/ושהכתבה כבר פורסמה/);
assert.equal(r.manual_review,undefined);assert.equal(calls.length,1,'a 404 is final, no retry');
r=await run([{status:410}],()=>verify());assert.equal(r.reason,'not_found');assert.equal(r.manual_review,undefined);
r=await run([{status:400}],()=>verify());
assert.equal(r.reason,'http');assert.match(r.message,/הדף לא נפתח \(שגיאה 400\)/);assert.equal(r.manual_review,undefined);
assert.equal(calls.length,1,'an HTTP answer is final, no retry');
// checkLink (links inside a customer's article) keeps today's single retry and its message.
r=await run(['timeout','timeout'],()=>lib.checkLink('https://brand-example.com/x'));
assert.equal(r.reason,'unreachable');assert.equal(calls.length,2);assert.equal(r.manual_review,undefined);
assert.match(r.message,/האתר לא ענה לבדיקה שלנו בזמן/);assert.match(r.message,/לא בעיה בקישור/);assert.match(r.message,/נסו שוב/);
r=await run([{status:403}],()=>lib.checkLink('https://brand-example.com/x'));
assert.equal(r.reason,'blocked');assert.match(r.message,/האתר לא אפשר לנו לבדוק את הדף \(שגיאה 403\)/);
r=await run([{status:503}],()=>lib.checkLink('https://brand-example.com/x'));
assert.equal(r.reason,'http');assert.match(r.message,/שגיאת שרת \(שגיאה 503\)/);

// 4. Another domain, directly or through a redirect; a redirect on the same site is followed.
r=await run([],()=>verify('https://other-example.co.il/garden'));
assert.equal(r.reason,'domain');assert.match(r.message,/הקישור הוא לאתר אחר \(other-example\.co\.il\)/);assert.match(r.message,/magazine-example\.co\.il/);
r=await run([{status:301,headers:{location:'https://spam-example.com/x'}}],()=>verify());
assert.equal(r.reason,'domain');assert.match(r.message,/הקישור מעביר לאתר אחר \(spam-example\.com\)/);
r=await run([{status:301,headers:{location:'https://127.0.0.1/x'}}],()=>verify());
assert.equal(r.reason,'redirect');assert.match(r.message,/כתובת לא תקינה/);
r=await run([{status:301,headers:{location:'/garden-furniture/'}},page(article.title)],()=>verify());
assert.equal(r.ok,true);assert.equal(r.final_url,'https://www.magazine-example.co.il/garden-furniture/');

// 5. The owner's case: a real page of another article on the same site.
r=await run([page('איך לבחור מזרן אורתופדי לגב',['https://other-example.com/'])],()=>verify());
assert.equal(r.ok,false);assert.equal(r.reason,'topic');
assert.match(r.message,/^נראה שהקישור מוביל לכתבה אחרת\./);
assert.match(r.message,/כותרת הדף שמצאנו: "איך לבחור מזרן אורתופדי לגב"/);
assert.match(r.message,/הכתבה שצריך לפרסם: "המדריך המלא לבחירת ריהוט גן עמיד לשמש ולגשם"/);
assert.equal(r.manual_review,undefined,'a wrong article stays an error, never a manual check');
// A wrong article whose page merely mentions "access" in its h1 is still a wrong article (only the <title> of a bot check counts).
r=await run([page('Access denied: איך לבחור מזרן')],()=>verify());
assert.equal(r.reason,'topic');assert.equal(r.manual_review,undefined);

// 6. The right article without the links that were sent.
r=await run([page(article.title,['https://other-example.com/'])],()=>verify());
assert.equal(r.reason,'links');assert.match(r.message,/לא מצאנו בדף את הקישור שהיה בכתבה: https:\/\/brand-example\.com\/garden/);
assert.equal(r.manual_review,undefined,'missing links stay an error');

// 7. checkLink for links inside an article (customer side): same causes, no "published" wording.
r=await run([{status:404}],()=>lib.checkLink('https://brand-example.com/missing'));
assert.equal(r.ok,false);assert.equal(r.reason,'not_found');assert.doesNotMatch(r.message,/פורסמה/);
r=await run([{status:200}],()=>lib.checkLink('https://brand-example.com/'));
assert.equal(r.ok,true);
r=await run([],()=>lib.checkLink('http://localhost/x'));
assert.equal(r.reason,'invalid');

// 8. The manual check (lib/supplier-link-review.ts): saved for the admin, approve -> published flow, reject -> back to the supplier.
const review=await compile('lib/supplier-link-review.ts','supplier-link-review',{stubs:{
 './server':`
  export const log=globalThis.reviewLog=[];
  export class ApiError extends Error{constructor(status,message){super(message);this.status=status;}}
  export function assert(ok,message,status=400){if(!ok)throw new ApiError(status,message);}
  export const now=()=>'2026-11-23T10:00:00.000Z';
  export function parse(row){return row?{...(row.data?JSON.parse(row.data):{}),...row}:null;}
  export function stmt(sql,...args){return {sql,args,run:async()=>{log.push({sql,args});if(sql.startsWith('INSERT INTO records'))globalThis.reviewStored={id:args[0],kind:args[1],data:args[3]};return {meta:{changes:globalThis.reviewChanges??1}};}};}
  export function db(){return {batch:async list=>{for(const s of list)log.push({sql:s.sql,args:s.args,batch:true});return list.map(()=>({meta:{changes:globalThis.reviewChanges??1}}));}};}
  export async function one(sql){return sql.includes('FROM records')?globalThis.reviewStored??null:null;}
  export async function audit(u,resource,action,data){log.push({audit:action,resource,data,by:u.id});}
  export async function syncOrder(id){log.push({sync:id});}`,
 './monthly-order':`export function articleGuard(a){return {sql:'GUARD '+a.id,args:[a.version]};}`,
 './publication-period':`export function publicationPeriod(){return {stamp:'2026-11-23T10:00:00.000Z',month:'2026-11'};}`,
 './mail':`export async function articleMail(a,event){globalThis.reviewLog.push({mail:event,url:a.published_url});}`,
 './supplier-article-request':`export async function answerSupplier(a,type,note){globalThis.reviewLog.push({answer:type,note});return 'succeeded';}`,
}});
const reviewLog=()=>globalThis.reviewLog,sqls=()=>reviewLog().filter(c=>c.sql).map(c=>c.sql);
const sent=(data={})=>({id:'art-1',order_id:'ord-1',user_id:'qa-customer',title:article.title,status:'sent',version:6,data:JSON.stringify(data)});
const start=()=>{reviewLog().length=0;};

// An unreadable page: the supplier's link is saved for the admin; nothing is published and the customer gets nothing.
r=await run(Array(5).fill({status:403}),()=>verify());
start();let saved=await review.saveLinkReview(sent(),given,r,{id:'qa-supplier'},'token');
assert.equal(saved.ok,true);assert.equal(saved.manual_review,true);assert.equal(saved.message,'הקישור התקבל ויאושר אחרי בדיקה ידנית.');
assert.ok(sqls().some(s=>s.startsWith('INSERT INTO records')),'saved as a review record');
assert.ok(!sqls().some(s=>/UPDATE (articles|tokens|jobs)/.test(s)),'article, link and delivery untouched');
assert.equal(reviewLog().filter(c=>c.mail).length,0,'no published e-mail to the customer before the admin approves');
assert.equal(reviewLog().find(c=>c.audit).resource,'supplier-link-review:art-1','logged on the review, not on the customer\'s article');
assert.deepEqual(await review.linkReviewForSupplier(sent()),{status:'pending',url:given,at:'2026-11-23T10:00:00.000Z'});
const forAdmin=await review.linkReviewForAdmin(sent());
assert.equal(forAdmin.url,given);assert.match(forAdmin.reason,/האתר חסם את הבדיקה האוטומטית \(שגיאה 403\)/);
assert.equal(await review.linkReviewForAdmin(sent({cancel_pending:true})),null,'cancellation pending: not shown');
assert.equal(await review.linkReviewForAdmin(sent({supplier_hold_at:'2026-11-23'})),null,'back with the customer: not shown');
assert.equal(await review.linkReviewForAdmin({...sent(),status:'published'}),null,'published another way: not shown');
assert.match(review.pendingLinkReviewSql('r','a'),/json_extract\(r\.data,'\$\.status'\)='pending' AND a\.status='sent'/);

// Reject: a reason is required; the supplier gets it (link page and e-mail); the article stays with the supplier.
const pending=globalThis.reviewStored;
await assert.rejects(review.rejectLinkReview(sent(),{id:'qa-admin'},{note:' '}),/למה הקישור לא אושר/);
start();let res=await review.rejectLinkReview(sent(),{id:'qa-admin'},{note:'הכתבה עדיין לא מופיעה באתר'});
assert.equal(res.ok,true);assert.equal(res.supplier_mail,'succeeded');
assert.deepEqual(reviewLog().find(c=>c.answer),{answer:'link',note:'הכתבה עדיין לא מופיעה באתר'});
assert.ok(sqls().some(s=>s.startsWith('UPDATE records')&&s.includes("'rejected'")));
assert.ok(!sqls().some(s=>/UPDATE articles/.test(s)),'not published');assert.equal(reviewLog().filter(c=>c.mail).length,0,'no customer e-mail');
globalThis.reviewStored={...pending,data:JSON.stringify({...JSON.parse(pending.data),status:'rejected',decision_note:'הכתבה עדיין לא מופיעה באתר',handled_at:'2026-11-23T10:05:00.000Z'})};
assert.deepEqual(await review.linkReviewForSupplier(sent()),{status:'rejected',url:given,note:'הכתבה עדיין לא מופיעה באתר',at:'2026-11-23T10:05:00.000Z'});
await assert.rejects(review.approveLinkReview(sent(),{id:'qa-admin'},'http://localhost'),/אין קישור שממתין/,'a rejected link cannot be approved');

// Approve: the normal published flow (article published with the supplier's link, link and delivery closed, customer e-mail).
globalThis.reviewStored=pending;
start();res=await review.approveLinkReview(sent(),{id:'qa-admin'},'http://localhost');
assert.equal(res.ok,true);assert.equal(res.published_url,given);
const batch=reviewLog().filter(c=>c.batch);
assert.equal(batch[0].sql,'GUARD art-1','version guard first');
assert.match(batch[1].sql,/UPDATE articles SET status='published',published_url=\?/);assert.equal(batch[1].args[0],given);assert.match(batch[1].sql,/WHERE id=\? AND status='sent'/);
assert.match(batch[2].sql,/'\$\.status','approved'/);
assert.ok(sqls().some(s=>/UPDATE jobs SET status='completed'/.test(s)),'delivery completed');
assert.ok(sqls().some(s=>/UPDATE tokens SET used=1/.test(s)),'supplier link closed');
assert.deepEqual(reviewLog().find(c=>c.mail),{mail:'published',url:given},'the customer\'s published e-mail goes out now');
assert.ok(reviewLog().some(c=>c.sync==='ord-1'),'order synced');
assert.ok(reviewLog().some(c=>c.audit==='הספק דיווח על פרסום'&&c.resource==='art-1'&&c.by==='qa-supplier'),'the article shows the supplier\'s report');
// Approving twice, or after the article changed in parallel, is refused.
globalThis.reviewChanges=0;await assert.rejects(review.approveLinkReview(sent(),{id:'qa-admin'},'http://localhost'),/כבר טופלה/);globalThis.reviewChanges=1;
await assert.rejects(review.approveLinkReview(sent({cancel_pending:true}),{id:'qa-admin'},'http://localhost'),/אין קישור שממתין/);

console.log('supplier link check: ok');
