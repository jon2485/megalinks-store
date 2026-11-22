// Owner decision (22.11.2026): when an approved article did not reach the supplier, the admin article screen
// shows the stored reason (jobs "publication:<article>", data.error) and what to do, instead of a general guess.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {compile,reset,render,nodes,text} from './admin-ui-harness.mjs';

// 1. Every reason dispatchArticle stores reads as one plain line with a next step.
const {deliveryReason}=await compile('lib/delivery-reason.ts','delivery-reason');
const unverified=deliveryReason('יש לאמת את הסכם הפרסום באתר','blocked');
assert.equal(unverified.fix,'site');assert.match(unverified.text,/הסכם פרסום מאומת/);
assert.equal(deliveryReason('יש להזין מייל לספק','blocked').fix,'site');
assert.match(deliveryReason('יש להזין מייל לספק','blocked').hint,/הוסיפו מייל ספק/);
assert.match(deliveryReason('מייל הספק אינו תקין','blocked').text,/אינו תקין/);
const stock=deliveryReason('מלאי הפרסומים באתר הסתיים, או שהכתבה אינה מאושרת. הגדילו את סה״כ המלאי ונסו שוב.','blocked');
assert.equal(stock.fix,'stock');assert.match(stock.hint,/הגדילו את המלאי/);
assert.equal(deliveryReason('המסירה לא הושלמה; אפשר לנסות שוב','failed').fix,'retry');
assert.equal(deliveryReason('סיבה חדשה','blocked').text,'סיבה חדשה','an unknown reason is shown as stored');
assert.equal(deliveryReason('','blocked'),null,'no stored reason keeps the general text');
assert.equal(deliveryReason('יש לאמת את הסכם הפרסום באתר','succeeded'),null,'a finished delivery shows no old reason');

// 2. The server reads the reason in one query with the customer name, for admins only.
const route=readFileSync('app/api/[...path]/route.ts','utf8'),publication=readFileSync('lib/publication.ts','utf8');
assert.match(route,/u\.role==='admin'\?\{\.\.\.\(await adminArticleExtras\(a\)\)/,'only admins get the delivery reason');
const extras=publication.slice(publication.indexOf('export async function adminArticleExtras'));
assert.equal((extras.match(/await one\(/g)||[]).length,1,'one query for name and delivery reason');
assert.match(extras,/LEFT JOIN jobs j ON j\.id=\?/);

// 3. The admin screen.
const stubs={'@/lib/client':'export async function api(path,method,body){const h=globalThis.adminHandlerHarness;h.calls.push({path,method,body});return h.dispatch||{};}','./cancel-focus':'export function openCancelFocus(){}','sonner':'export const toast={error(m){globalThis.adminHandlerHarness.toasts.push(m)},success(){}};'};
const {AdminDecision}=await compile('app/admin-article-decision.tsx','admin-delivery-reason',{stubs});
const went=[];
const studio=(extra={},act=async(fn,message)=>{const r=await fn();globalThis.adminHandlerHarness.label=typeof message==='function'?message(r||{}):message;})=>({ctx:{go(v){went.push(v);},adminMode:true},id:'art-1',a:{id:'art-1',version:4,title:'כתבה',status:'approved',website_id:'site-1',...extra},w:{name:'אתר בדיקה',supplier_id:'sup-1'},o:{},busy:false,dirty:false,note:'',setNote(){},status(){},act,save:async()=>{},editArticle(){},checks:[],validated:true,validate(){},professionalPending:false,finishWriting(){},importFile(){},hasContent:true,canSend:false,sendLabel:'',downloadWord(){},saving:false});
const button=(tree,label)=>nodes(tree).find(n=>n.type==='button'&&text(n).includes(label));

reset();let tree=render(AdminDecision,{s:studio(),stage:'delivery'});
assert(text(tree).includes('לפעמים חסר מלאי באתר או פרטי ספק'),'no stored reason keeps today\'s text');
assert(button(tree,'שליחה חוזרת לספק')&&button(tree,'הוספת מלאי'),'both buttons stay');

reset();tree=render(AdminDecision,{s:studio({delivery_status:'blocked',delivery_error:'יש לאמת את הסכם הפרסום באתר'}),stage:'delivery'});
assert(text(tree).includes('הסכם פרסום מאומת')&&!text(tree).includes('לפעמים חסר מלאי'),'the real reason replaces the guess');
assert(button(tree,'שליחה חוזרת לספק')&&button(tree,'הוספת מלאי'));
button(tree,'לעריכת האתר').props.onClick();assert.equal(went.pop(),'admin-supplier/sup-1','the link opens the site under its supplier');

reset();tree=render(AdminDecision,{s:studio({delivery_status:'blocked',delivery_error:'מלאי הפרסומים באתר הסתיים'}),stage:'delivery'});
assert(text(tree).includes('מלאי הפרסומים באתר נגמר')&&!button(tree,'לעריכת האתר'),'stock uses the stock button, no site link');

// A retry that comes back blocked shows its reason at once, with no success message.
const h=reset();h.toasts=[];h.dispatch={status:'blocked',error:'יש להזין מייל לספק'};
const s=studio();
await button(render(AdminDecision,{s,stage:'delivery'}),'שליחה חוזרת לספק').props.onClick();
assert.equal(h.label,'','blocked retry gives no success message');
assert.deepEqual(h.toasts,['לאתר אין מייל ספק, ולכן הכתבה לא נשלחה.']);
assert(text(render(AdminDecision,{s,stage:'delivery'})).includes('הוסיפו מייל ספק'),'the new reason shows in the box at once');
h.dispatch={status:'succeeded'};h.toasts=[];
await button(render(AdminDecision,{s,stage:'delivery'}),'שליחה חוזרת לספק').props.onClick();
assert.equal(h.label,'הכתבה נשלחה לספק');assert.deepEqual(h.toasts,[]);
console.log('delivery-reason: ok');
