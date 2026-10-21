import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,realpathSync,mkdirSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const require=createRequire(realpathSync('node_modules/wrangler')+'/package.json'),{build}=require('esbuild');
const result=await build({entryPoints:['lib/client-updates.ts'],bundle:true,platform:'node',format:'esm',write:false});
mkdirSync('.sites-runtime',{recursive:true});writeFileSync('.sites-runtime/client-updates-test.mjs',result.outputFiles[0].text);
const {buildClientUpdates,displayUpdateDate}=await import(pathToFileURL(realpathSync('.sites-runtime/client-updates-test.mjs')));
const articles=[
 {id:'published',status:'published',title:'כתבה שפורסמה',website_name:'אתר א',order_id:'o1',number:'#1005',published_url:'https://example.test/article',updated:'2026-10-21T10:00:00Z',image_id:'image 1'},
 {id:'revision',status:'revisions',title:'כתבה לתיקון',updated:'2026-10-20T12:00:00Z',admin_notes:'PRIVATE INTERNAL'},
 {id:'cancelled',status:'cancelled',title:'ביטול',cancelled_at:'2026-10-19T12:00:00Z',cancel_reason:'הלקוח ביקש ביטול'},
 {id:'demo',status:'published',demo:true},
 {id:'draft',status:'draft'}
];
const orders=[{id:'o1',number:'#1005',paid:1,total:610060,paid_refund_total:10000,payment:'monthly',settlement_payment_method:'bank_transfer',paid_at:'2026-10-21T09:00:00Z'},
 {id:'legacy',number:'#1000',paid:1,total:10000,payment:'card',created:'2026-10-18T10:00:00Z'},
 {id:'pending',paid:0,total:10000,payment:'invoice'},
 {id:'demo',demo:true,paid:1,total:10000}];
const transactions=[{id:'c1',amount:10000,order_id:'o1',order_number:'#1005',reason:'זיכוי',created:'2026-10-21T08:00:00Z'},{id:'debit',amount:-10000},{id:'zero',amount:0}];
const notifications=[{id:'reply',subject:'המאמר הוחזר לתיקון',text:'כתבה לתיקון\nנא לעדכן את הפסקה האחרונה.',button:{url:'https://example.test/article/revision'},created:'2026-10-21T11:00:00Z'},
 {id:'wrong',subject:'נושא אחר',text:'DO NOT DISPLAY',button:{url:'https://example.test/article/revision'}}];
const input=JSON.stringify({articles,orders,transactions,notifications}),events=buildClientUpdates(articles,orders,transactions,notifications);
assert.equal(events.length,6);assert.equal(events[0].kind,'revision');
assert.equal(events[0].note,'נא לעדכן את הפסקה האחרונה.');assert(!JSON.stringify(events).includes('PRIVATE INTERNAL'));assert(!JSON.stringify(events).includes('DO NOT DISPLAY'));
const payment=events.find(x=>x.id==='payment:o1');assert.equal(payment.amount,610060,'original payment, not a net/refund-adjusted invented amount');assert.equal(payment.method,'העברה בנקאית');assert.equal(payment.dateLabel,'תאריך התשלום');
assert.equal(events.find(x=>x.id==='payment:legacy').dateLabel,'תאריך ההזמנה','never claim an unknown approval date');
assert.equal(events.find(x=>x.kind==='published').image,'/api/files/image%201');assert.equal(events.find(x=>x.kind==='credit').amount,10000);
assert.equal(events.find(x=>x.kind==='cancelled').note,'הלקוח ביקש ביטול');assert.equal(JSON.stringify({articles,orders,transactions,notifications}),input,'read-only projection');
assert.deepEqual(buildClientUpdates([],[],[],[]),[]);assert.equal(displayUpdateDate('invalid'),'לא תועד');
assert.equal(buildClientUpdates([{id:'bad',status:'published',published_url:'javascript:alert(1)'}],[],[],[])[0].url,'');
const noReply=buildClientUpdates([articles[1]],[],[],[])[0];assert.equal(noReply.note,'','no internal fallback');
assert.equal(noReply.dateLabel,'עודכן בתאריך');
assert.equal(events.find(x=>x.kind==='published').dateLabel,'עודכן בתאריך');
assert.equal(buildClientUpdates([{id:'c',status:'cancelled',updated:'2026-10-20T10:00:00Z'}],[],[],[])[0].dateLabel,'עודכן בתאריך');
const workspace=readFileSync('app/workspace.tsx','utf8'),direct=workspace.slice(workspace.indexOf('const open ='),workspace.indexOf('const ctx: Ctx'));
assert(direct.indexOf("api('cart','POST'")<direct.indexOf('notifyCartAdded(modal.site.id)'));assert(direct.includes('.then(()=>{notifyCartAdded(modal.site.id);'));
console.log('CLIENT UPDATES PASS: five event kinds, safe manager reply, actual totals/methods/dates, signed amounts, no demos/pending payment, safe URL, no mutation; direct catalog confirmation wired after POST success.');
