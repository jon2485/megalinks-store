// Owner decision (22.11.2026): an approved article can be returned to the customer for editing until it is published.
// With the supplier, the supplier link waits (no cancel) and the supplier gets a follow-up e-mail in the same thread.
import assert from 'node:assert/strict';
import {compile,reset,render,nodes,text} from './admin-ui-harness.mjs';

// 1. Server rules, with a fake database.
const serverStub=`
 export const calls=globalThis.reopenCalls=[];
 export class ApiError extends Error{constructor(status,message){super(message);this.status=status;}}
 export function assert(ok,message,status=400){if(!ok)throw new ApiError(status,message);}
 export const now=()=>'2026-11-22T10:00:00.000Z';
 export function parse(row){return row?{...(row.data?JSON.parse(row.data):{}),...row}:null;}
 export function stmt(sql,...args){return {run:async()=>{calls.push({sql,args});return {meta:{changes:globalThis.reopenChanges??1}};}};}
 export async function one(sql,...args){calls.push({sql,args});if(sql.includes('FROM jobs'))return globalThis.reopenFirstMail??null;if(sql.includes('FROM users'))return {email:'customer@example.test',phone:''};return null;}
 export async function audit(u,id,action,data){calls.push({audit:action,data});}
 export async function notify(){}
 export async function syncOrder(){}
`;
const {reopenApprovedArticle}=await compile('lib/article-reopen.ts','article-reopen',{stubs:{
 './server':serverStub,
 './mail':`export async function articleMail(a,event,origin,note){globalThis.reopenCalls.push({mail:event,note,version:a.version});} export async function sendQueuedMail(id){globalThis.reopenCalls.push({sent:id});return {status:'demo'};}`,
 './cancel-request':`export async function assertNoCancelRequest(){}`,
}});
const admin={id:'qa-admin',role:'admin'};
const article=(status,data={})=>({id:'art-1',order_id:'ord-1',user_id:'qa-customer',status,version:4,published_url:'',data:JSON.stringify({scheduled:'2026-11-30',...data})});
const calls=()=>globalThis.reopenCalls;
const run=async(a,body={note:'לעדכן את הפסקה השנייה',version:4})=>{calls().length=0;return reopenApprovedArticle(a,admin,body,'http://localhost');};

for(const status of ['published','cancelled','draft','admin_review','revisions','demo_completed'])
 await assert.rejects(run(article(status)),/רק כתבה שאושרה/,status+' must not reopen');
await assert.rejects(run(article('approved',{cancel_pending:true})),/בביטול/);
await assert.rejects(run({...article('sent'),published_url:'https://example.test/p'}),/פורסמה/);
await assert.rejects(run(article('approved'),{note:'  ',version:4}),/מה צריך לשנות/);
await assert.rejects(run(article('approved'),{note:'x',version:3}),/במקביל/);

// Approved, waiting for its day: back to the customer, the scheduled send is cleared, no supplier mail.
let r=await run(article('approved',{dispatch_at:'2026-11-30T05:00:00.000Z'}));
assert.equal(r.status,'revisions');assert.equal(r.supplier_hold,false);
let update=calls().find(c=>c.sql?.startsWith('UPDATE articles'));
assert.equal(update.args[0],'revisions');const saved=JSON.parse(update.args[1]);
assert.equal(saved.dispatch_at,undefined);assert.equal(saved.supplier_hold_at,undefined);assert.equal(saved.reopen_note,'לעדכן את הפסקה השנייה');
assert(calls().some(c=>c.mail==='revisions'&&c.note==='לעדכן את הפסקה השנייה'&&c.version===5),'the customer gets the fix e-mail');
assert(!calls().some(c=>c.sent),'no supplier e-mail before the supplier got the article');
assert(calls().some(c=>c.audit==='הכתבה הוחזרה לעריכה אחרי אישור'),'the action is in the activity log');

// With the supplier: the link and the stock stay, the article is marked as waiting, the supplier gets a hold e-mail.
globalThis.reopenFirstMail={id:'email:supplier:art-1',data:JSON.stringify({to:'supplier@example.test',button:{label:'x',url:'http://localhost/supplier/tok'},demo:true})};
r=await run(article('sent'));
assert.equal(r.supplier_hold,true);
update=calls().find(c=>c.sql?.startsWith('UPDATE articles'));assert.equal(JSON.parse(update.args[1]).supplier_hold_at,'2026-11-22T10:00:00.000Z');
assert(!calls().some(c=>/tokens|supplier_dispatch|jobs SET status/.test(c.sql||'')),'the supplier link and the stock slot are kept');
const hold=calls().find(c=>c.sql?.startsWith('INSERT OR IGNORE INTO jobs'));assert(hold,'hold e-mail queued');
assert.equal(hold.args[0],'email:supplier-hold:art-1:5');const holdMail=JSON.parse(hold.args[4]);
assert.equal(holdMail.supplier_followup,'hold');assert.equal(holdMail.button.url,'http://localhost/supplier/tok');assert.equal(holdMail.attach_article,undefined);
// A writer's article goes to the customer's review screen, not to the writer's queue.
r=await run(article('approved',{editorial:true}));assert.equal(r.status,'review');

// 2. The supplier e-mails: same family as the article e-mail, the owner's wording.
const mails=await compile('lib/supplier-mail-content.ts','supplier-mail-reopen');
const holdHtml=mails.supplierHoldEmailHtml({title:'כתבת בדיקה'},'אתר בדיקה','כתבה 3 מתוך 10 בחבילה','http://localhost/supplier/tok','http://localhost');
assert(holdHtml.includes('נא להמתין עם פרסום הכתבה')&&!holdHtml.includes('לא לפרסם'));assert(holdHtml.includes('http://localhost/supplier/tok'));
const art={title:'כתבת בדיקה',data:JSON.stringify({})};
const updated=mails.supplierArticleEmailHtml(art,'אתר','https://example.test','כתבה 3',`http://localhost/supplier/tok`,'http://localhost',[],true);
assert(updated.includes('הנחיות מעודכנות לפרסום')&&updated.includes('מחליפה את הקודמת'));
assert(!mails.supplierArticleEmailHtml(art,'אתר','https://example.test','כתבה 3','x','http://localhost',[]).includes('מחליפה את הקודמת'),'the first e-mail is unchanged');

// 3. The admin screen: the action shows until publication, with the supplier wording when the supplier has it.
const {AdminDecision}=await compile('app/admin-article-decision.tsx','admin-article-reopen',{stubs:{'./cancel-focus':'export function openCancelFocus(){}'}});
const studio=(extra={})=>({ctx:{go(){},adminMode:true},id:'art-1',a:{id:'art-1',version:4,title:'כתבה',scheduled:'2026-11-30',...extra},w:{name:'אתר'},o:{},busy:false,dirty:false,note:'',setNote(){},status(){},act:async fn=>fn(),save:async()=>{},editArticle(){},checks:[],validated:true,validate(){},professionalPending:false,finishWriting(){},importFile(){},hasContent:true,canSend:false,sendLabel:'',downloadWord(){},saving:false});
const reopenNode=tree=>nodes(tree).find(n=>n.type?.name==='ReopenAction');
for(const stage of ['waiting_day','delivery','supplier']){
 reset();const tree=render(AdminDecision,{s:studio(),stage});const node=reopenNode(tree);assert(node,stage+' shows the action');
 reset();const closed=render(node.type,node.props);assert(text(closed).includes('החזרה לעריכה'));
 assert.equal(text(closed).includes('הקישור שלו יעבור להמתנה'),stage==='supplier');
}
for(const stage of ['published','cancelled','cancel_pending','review','customer']){reset();assert(!reopenNode(render(AdminDecision,{s:studio(),stage})),stage+' has no reopen action');}
// Opening, writing a note and sending calls the reopen API with the note and the version.
globalThis.requestAnimationFrame=()=>0;
reset();let node=reopenNode(render(AdminDecision,{s:studio(),stage:'supplier'}));const h=globalThis.adminHandlerHarness;
let view=render(node.type,node.props);nodes(view).find(n=>n.type==='button'&&text(n).includes('החזרה לעריכה')).props.onClick();
view=render(node.type,node.props);assert(text(view).includes('מה הלקוח צריך לשנות?'));
nodes(view).find(n=>n.props?.id==='ar-reopen-note').props.onChange({target:{value:'לעדכן מחיר'}});
view=render(node.type,node.props);await nodes(view).find(n=>n.type==='button'&&text(n).includes('החזרה לעריכה')&&!n.props.disabled).props.onClick();
assert.deepEqual(h.calls.at(-1),{path:'articles/art-1/reopen',method:'POST',body:{note:'לעדכן מחיר',version:4}});

console.log('ARTICLE REOPEN PASS: only approved/sent articles reopen, note and version required, customer mail + activity log, supplier link and stock kept with a hold e-mail, owner wording in both supplier e-mails, admin action in the three approved stages only.');
