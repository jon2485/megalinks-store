import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {realpathSync,mkdirSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {renderToStaticMarkup} from 'react-dom/server';

const require=createRequire(realpathSync('node_modules/wrangler')+'/package.json');
mkdirSync('.sites-runtime',{recursive:true});
const react=realpathSync('node_modules/react/index.js');
async function compile(entry,name){
 const result=await require('esbuild').build({entryPoints:[entry],bundle:true,platform:'node',format:'esm',jsx:'automatic',write:false,external:['react/jsx-runtime'],plugins:[{name:'customer-finance-fixtures',setup(b){
  b.onResolve({filter:/^(react|\.\/workspace|@\/lib\/client|@\/lib\/office)$/},a=>({path:a.path,namespace:'fixture'}));
  b.onResolve({filter:/^\//,namespace:'fixture'},a=>({path:a.path,external:true}));
  b.onLoad({filter:/.*/,namespace:'fixture'},a=>({loader:'jsx',contents:a.path==='react'?`export * from ${JSON.stringify(react)};export {default} from ${JSON.stringify(react)};export function useState(v){return globalThis.financeStates?.shift()||[v,()=>{}]}export function useRef(v){return {current:v}}export function useEffect(){}`:a.path==='./workspace'?'export function ErrorBox(){return null}export function Field({children}){return children}export function UploadField(){return null}export function Heading(){return null}':a.path==='@/lib/office'?'export function exportSpreadsheet(name,rows){globalThis.financeExport={name,rows}}':'export function useData(path){return {data:globalThis.financeFixture[path]||{},loading:false}}export function api(){throw Error("No live financial writes allowed in UI fixtures")}export function csv(rows){return rows}export function download(...args){globalThis.financeDownload=args}'}));
 }}]});
 const file='.sites-runtime/'+name+'.mjs';writeFileSync(file,result.outputFiles[0].text);return import(pathToFileURL(realpathSync(file)));
}
const nodes=n=>!n||typeof n!=='object'?[]:[n,...[n.props?.children].flat(Infinity).flatMap(nodes)];
const text=n=>n==null?'':typeof n==='string'||typeof n==='number'?String(n):[n.props?.children].flat(Infinity).map(text).join('');
const {default:OrderDialog}=await compile('app/customer-order-dialog.tsx','customer-order-glass-fixture');
const ctx={revision:0,user:{id:'buyer',role:'customer'},catalog:[],open(config){globalThis.financeOpened=config;}};
const order={id:'order',user_id:'buyer',number:'#1004',created:'2026-10-19T10:00:00Z',payment:'invoice',paid:1,paid_date:'2026-10-19',total:38822,subtotal:32900,vat:5922,invoice_file_id:'invoice'};
const articles=[{id:'item',order_id:'order',website_name:'PCMag',website_url:'https://il.pcmag.com',title:'מאמר לדוגמה',publication_price:32900,paid_net_amount:32900}];
globalThis.financeFixture={};globalThis.financeStates=[];
let tree=OrderDialog({ctx,order,articles});let html=renderToStaticMarkup(tree);
assert(html.includes('שולמה'));assert(html.includes('388.22'));assert(html.includes('329.00'));assert(html.includes('59.22'));assert(html.includes('/api/orders/order/invoice'));assert(!html.includes('דיווח תשלום הזמנה זו'));assert(!html.includes('הוחזר ליתרה באתר'));
nodes(tree).find(n=>n.props?.onClick&&text(n).includes('ייצוא לאקסל')).props.onClick();assert(globalThis.financeExport.rows.some(r=>r[0]==='PCMag'&&r[3]===329));
globalThis.financeStates=[['לא נמצא',()=>{}]];tree=OrderDialog({ctx,order,articles});html=renderToStaticMarkup(tree);assert(html.includes('לא נמצאו פריטים התואמים לחיפוש'));assert(html.includes('388.22'),'filtering never changes order total');nodes(tree).find(n=>n.props?.onClick&&text(n).includes('ייצוא לאקסל')).props.onClick();assert(globalThis.financeExport.rows.some(r=>r[0]==='PCMag'),'export retains hidden items');
globalThis.financeStates=[];tree=OrderDialog({ctx,order:{...order,status:'cancelled',paid_refund_total:38822},articles:[{...articles[0],publication_refunded:1}]});html=renderToStaticMarkup(tree);assert(html.includes('פרטי הזמנה שבוטלה'));assert(html.includes('בוטל וזוכה'));assert(html.includes('הוחזר ליתרה באתר'));assert(html.includes('סכום לאחר זיכויים'));assert(html.includes('0.00'));assert(html.includes('/api/orders/order/invoice'),'historical invoice survives refund');assert(!html.includes('דיווח תשלום הזמנה זו'));
globalThis.financeStates=[];html=renderToStaticMarkup(OrderDialog({ctx,order:{...order,paid:0,paid_date:null,invoice_file_id:null,payment_report_status:'pending'},articles}));assert(html.includes('דווחה לתשלום'));assert(!html.includes('לא תועד'),'unpaid uses recorded order date');
globalThis.financeStates=[];html=renderToStaticMarkup(OrderDialog({ctx,order:{...order,paid_date:null},articles}));assert(html.includes('לא תועד'),'missing actual payment date is never invented');
const {default:Billing,OrderBreakdown}=await compile('app/billing-workspace.tsx','customer-balance-glass-fixture');
globalThis.financeFixture={credits:{available:180000,balance:200000,transactions:[{id:'topup',amount:200000,reason:'טעינת יתרה',created:order.created}]},orders:{orders:[]},'records/package':{records:[]},'wallet-topups':{requests:[{id:'pending',amount_cents:50000,created:order.created,reference:'REF',decision:'pending'}]},['orders/order']:{order,articles}};
globalThis.financeStates=[];tree=Billing({ctx,balanceOnly:true});html=renderToStaticMarkup(tree);assert(html.includes('customer-finance-glass'));assert(html.includes('1,800.00'));assert(html.includes('2,000.00'));assert(html.includes('200.00'),'reserved balance remains explained');assert(html.includes('500.00'));assert(html.includes('הסכום יתווסף ליתרה לאחר אישור מנהל'));assert(html.includes('היסטוריית שימושים'));assert(html.includes('הטענת יתרה'));
nodes(tree).find(n=>n.props?.onClick&&text(n).includes('ייצוא תנועות')).props.onClick();assert.equal(globalThis.financeDownload[1][0].amount,200000);
globalThis.financeStates=[];html=renderToStaticMarkup(Billing({ctx:{...ctx,user:{role:'admin'}},balanceOnly:true}));assert(!html.includes('customer-finance-glass'),'admin balance surface not restyled');
globalThis.financeStates=[];html=renderToStaticMarkup(OrderBreakdown({ctx,id:'order'}));assert(html.includes('customer-order-glass'),'real customer details entry uses new dialog');
globalThis.financeStates=[];html=renderToStaticMarkup(OrderBreakdown({ctx:{...ctx,user:{role:'admin'}},id:'order'}));assert(!html.includes('customer-order-glass'),'admin details keep original owner');
console.log('CUSTOMER FINANCE GLASS PASSED: paid/pending/full cancellation, exact totals, real/missing dates, retained invoice, search/export, actual balance/reservation/pending top-up, exports and customer-only routing. No live writes.');
