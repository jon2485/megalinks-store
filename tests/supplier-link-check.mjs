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

// 2. One retry when the site does not answer in time or the network fails.
r=await run(['timeout',page(article.title)],()=>verify());
assert.equal(r.ok,true,'a slow first answer is retried once');
r=await run(['network',page(article.title)],()=>verify());
assert.equal(r.ok,true,'a network failure is retried once');
r=await run(['timeout','timeout'],()=>verify());
assert.equal(r.ok,false);assert.equal(r.reason,'unreachable');assert.equal(calls.length,2,'only one retry');
assert.match(r.message,/האתר לא ענה לבדיקה שלנו בזמן/);assert.match(r.message,/לא בעיה בקישור/);assert.match(r.message,/נסו שוב/);

// 3. HTTP errors: not found, blocked, server error, other.
r=await run([{status:404}],()=>verify());
assert.equal(r.reason,'not_found');assert.match(r.message,/הדף לא נמצא באתר \(שגיאה 404\)/);assert.match(r.message,/ושהכתבה כבר פורסמה/);
r=await run([{status:403}],()=>verify());
assert.equal(r.reason,'blocked');assert.match(r.message,/האתר לא אפשר לנו לבדוק את הדף \(שגיאה 403\)/);
r=await run([{status:503}],()=>verify());
assert.equal(r.reason,'http');assert.match(r.message,/שגיאת שרת \(שגיאה 503\)/);
r=await run([{status:400}],()=>verify());
assert.equal(r.reason,'http');assert.match(r.message,/הדף לא נפתח \(שגיאה 400\)/);
assert.equal(calls.length,1,'an HTTP answer is final, no retry');

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

// 6. The right article without the links that were sent.
r=await run([page(article.title,['https://other-example.com/'])],()=>verify());
assert.equal(r.reason,'links');assert.match(r.message,/לא מצאנו בדף את הקישור שהיה בכתבה: https:\/\/brand-example\.com\/garden/);

// 7. checkLink for links inside an article (customer side): same causes, no "published" wording.
r=await run([{status:404}],()=>lib.checkLink('https://brand-example.com/missing'));
assert.equal(r.ok,false);assert.equal(r.reason,'not_found');assert.doesNotMatch(r.message,/פורסמה/);
r=await run([{status:200}],()=>lib.checkLink('https://brand-example.com/'));
assert.equal(r.ok,true);
r=await run([],()=>lib.checkLink('http://localhost/x'));
assert.equal(r.reason,'invalid');

console.log('supplier link check: ok');
