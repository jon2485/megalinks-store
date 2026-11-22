// Owner decision (22.11.2026): the supplier can ask for fixes or ask to reject an article from its link. The request
// only reaches the admin: no order change, no cancellation, no refund, no customer mail, one open request at a time.
import assert from 'node:assert/strict';
import {compile} from './admin-ui-harness.mjs';

const serverStub=`
 export const calls=globalThis.issueCalls=[];
 export class ApiError extends Error{constructor(status,message){super(message);this.status=status;}}
 export function assert(ok,message,status=400){if(!ok)throw new ApiError(status,message);}
 export const now=()=>'2026-11-22T10:00:00.000Z';
 export function parse(row){return row?{...(row.data?JSON.parse(row.data):{}),...row}:null;}
 export function stmt(sql,...args){return {run:async()=>{calls.push({sql,args});return {meta:{changes:globalThis.issueChanges??1}};}};}
 export async function one(sql,...args){calls.push({sql,args});if(sql.includes('FROM records'))return globalThis.issueStored??null;if(sql.includes('FROM orders'))return {number:'#1015',data:'{}'};if(sql.includes('FROM jobs'))return globalThis.issueFirstMail??null;return null;}
 export async function all(sql){calls.push({sql});return sql.includes('FROM users')?[{email:'admin@example.test'}]:[];}
 export async function audit(u,resource,action,data){calls.push({audit:action,resource,data});}
`;
const lib=await compile('lib/supplier-article-request.ts','supplier-article-request',{stubs:{
 './server':serverStub,
 './mail':`export async function queueMail(id,user,data){globalThis.issueCalls.push({mail:id,data});return {status:'blocked'};} export async function sendQueuedMail(id){globalThis.issueCalls.push({sent:id});return {status:'blocked'};}`,
 './cancel-request':`export async function pendingCancelRequest(){return globalThis.issueCancelRequest??null;}`,
}});
const calls=()=>globalThis.issueCalls;
const token={id:'tok-1',user_id:'qa-admin'};
const article=(status='sent',data={})=>({id:'art-1',order_id:'ord-1',user_id:'qa-customer',title:'כתבה לדוגמה',website_name:'מאקו',status,version:4,data:JSON.stringify(data)});
const ask=async(a,body)=>{calls().length=0;return lib.requestSupplierIssue(a,token,body,'http://localhost');};
const stored=(data)=>({id:'supplier-issue:art-1',kind:'supplier_article_request',data:JSON.stringify(data)});

// Input and article state.
await assert.rejects(ask(article(),{issue:'cancel',text:'טקסט ארוך מספיק'}),/בקשת תיקונים או דחיית/);
await assert.rejects(ask(article(),{issue:'fix',text:'abc'}),/מה צריך לתקן/);
await assert.rejects(ask(article(),{issue:'reject',text:'ab'}),/למה אי אפשר/);
for(const status of ['approved','published','cancelled','revisions'])await assert.rejects(ask(article(status),{issue:'fix',text:'צריך לתקן קישור'}),/אינה ממתינה/,status);
await assert.rejects(ask(article('sent',{supplier_hold_at:'2026-11-21'}),{issue:'fix',text:'צריך לתקן קישור'}),/אינה ממתינה/,'back with the customer');
await assert.rejects(ask(article('sent',{cancel_pending:true}),{issue:'reject',text:'לא מתאים לאתר'}),/ביטול/);
globalThis.issueCancelRequest={status:'pending'};
await assert.rejects(ask(article(),{issue:'reject',text:'לא מתאים לאתר'}),/ביטול/);
globalThis.issueCancelRequest=null;

// A valid request: saved, logged on the request (not the article), admin mailed, nothing else touched.
let r=await ask(article(),{issue:'reject',text:'  הנושא לא מתאים לאתר שלנו  '});
assert.equal(r.issue.open,true);assert.equal(r.issue.type,'reject');assert.equal(r.issue.text,'הנושא לא מתאים לאתר שלנו');
const sqls=calls().filter(c=>c.sql).map(c=>c.sql);
assert.ok(sqls.some(s=>s.startsWith('INSERT INTO records')),'request saved');
assert.ok(!sqls.some(s=>/UPDATE (articles|orders)|INSERT INTO (refunds|wallet|credits)/i.test(s)),'no article/order/refund change');
const log=calls().find(c=>c.audit);assert.equal(log.resource,'supplier-issue:art-1');assert.match(log.audit,/לדחות/);
const mails=calls().filter(c=>c.mail);assert.equal(mails.length,1);assert.equal(mails[0].data.to,'admin@example.test','only the admin is mailed');

// One open request at a time.
globalThis.issueStored=stored({status:'pending',type:'fix',text:'קודם',requested_at:'2026-11-22T09:00:00.000Z'});
await assert.rejects(ask(article(),{issue:'reject',text:'בקשה נוספת'}),/כבר שלחתם/);
// ...unless the stored one no longer applies (a newer version went out after it).
r=await ask(article('sent',{supplier_updated_at:'2026-11-22T09:30:00.000Z'}),{issue:'fix',text:'תיקון בגרסה החדשה'});
assert.equal(r.issue.type,'fix');
globalThis.issueChanges=0;await assert.rejects(ask(article(),{issue:'fix',text:'בקשה במקביל'}),/כבר שלחתם/);globalThis.issueChanges=1;

// What each side sees.
assert.deepEqual(await lib.issueForSupplier(article()),{open:true,type:'fix',text:'קודם',at:'2026-11-22T09:00:00.000Z'});
assert.equal(await lib.issueForAdmin(article('revisions')),null,'returned to the customer: nothing open for the admin');
assert.equal(await lib.issueForAdmin(article('sent',{publication_refunded:true})),null,'cancelled: nothing open');

// The admin lets the supplier publish: a note is required, the supplier is answered in the article thread.
const admin={id:'qa-admin',role:'admin'};
await assert.rejects(lib.dismissSupplierIssue(article(),admin,{note:' '}),/הערה/);
globalThis.issueFirstMail={id:'email:supplier:art-1',kind:'email',data:JSON.stringify({to:'supplier@example.test',button:{url:'http://localhost/supplier/t'}})};
calls().length=0;r=await lib.dismissSupplierIssue(article(),admin,{note:'אפשר לפרסם כמו שהיא'});
assert.equal(r.supplier_mail,'blocked');
const job=calls().find(c=>c.sql?.startsWith('INSERT OR IGNORE INTO jobs'));const jobData=JSON.parse(job.args[4]);
assert.equal(jobData.to,'supplier@example.test');assert.equal(jobData.supplier_followup,'answer');assert.equal(jobData.answer_note,'אפשר לפרסם כמו שהיא');
assert.ok(!calls().some(c=>/UPDATE (articles|orders)/.test(c.sql||'')),'the article stays as it is');
globalThis.issueStored=stored({status:'dismissed',type:'fix',text:'קודם',decision_note:'אפשר לפרסם כמו שהיא',handled_at:'2026-11-22T10:00:00.000Z'});
assert.deepEqual(await lib.issueForSupplier(article()),{open:false,type:'fix',answer:'אפשר לפרסם כמו שהיא',at:'2026-11-22T10:00:00.000Z'});
await assert.rejects(lib.dismissSupplierIssue(article(),admin,{note:'שוב'}),/אין בקשה פתוחה/);

// The e-mail link: only a personal token link gets the "#issue" link.
const mail=await compile('lib/supplier-issue-mail.ts','supplier-issue-mail');
assert.equal(mail.supplierIssueUrl('https://x.test/supplier/abc'),'https://x.test/supplier/abc#issue');
assert.equal(mail.supplierIssueUrl('https://x.test/supplier-workspace'),'');
assert.match(mail.supplierIssueLinkHtml('https://x.test/supplier/abc'),/בקשת תיקונים או דחיית הכתבה/);
console.log('SUPPLIER ARTICLE REQUEST PASS: fixes/reject reach the admin only, one open request, no order or refund change, logged on the request, admin answer e-mailed in the thread, #issue link only on personal links.');
