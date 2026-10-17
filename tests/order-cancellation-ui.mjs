import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {realpathSync,mkdirSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {orderCancellation,orderCancellationLabel,effectiveOrderTotal} from '../lib/order-finance.ts';
const require=createRequire(realpathSync('node_modules/wrangler')+'/package.json'),{build}=require('esbuild');
const buildResult=await build({entryPoints:['app/customer-order-screen.tsx'],bundle:true,platform:'node',format:'esm',jsx:'automatic',external:['react','react/jsx-runtime','react-dom','react-dom/server'],write:false,banner:{js:"import {createRequire as __cr} from 'node:module';const require=__cr(import.meta.url);"},plugins:[{name:'fixtures',setup(b){b.onResolve({filter:/^(\.\/workspace|@\/lib\/client)$/},a=>({path:a.path,namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},a=>({loader:'js',contents:a.path==='./workspace'?'export function Heading(){return null} export function ErrorBox(){return null} export function UploadField(){return null} export function Field(){return null}':'export function useData(path){return {data:globalThis.billingFixture[path]||{},loading:false}} export function api(){throw Error("render must not mutate data")} export function csv(){} export function download(){}'}));}}]});mkdirSync('.sites-runtime',{recursive:true});writeFileSync('.sites-runtime/order-cancellation-ui.mjs',buildResult.outputFiles[0].text);const {default:Billing}=await import(pathToFileURL(realpathSync('.sites-runtime/order-cancellation-ui.mjs')));
const ctx={user:{id:'client',monthly_account:{enabled:1}},catalog:[],revision:0,open(){},go(){}};
const base={id:'order1',order_id:'order1',number:'#1001',created:'2026-10-11T10:00:00Z',month:'2026-10',status:'on_account',total:0,amount:0,on_account:true,article_count:1,fully_refunded_count:1,refunded_count:1};
const render=(o,monthly)=>{globalThis.billingFixture={'orders':{orders:[o]},'monthly?scope=own&details=all':{details:[o],account:{balance:o.amount,credit_limit:100000}},credits:{ledger:[]}};return renderToStaticMarkup(React.createElement(Billing,{ctx,monthly}));};
for(const monthly of [false,true]){const html=render(base,monthly);assert(html.includes('בוטלה'),'full cancellation shown without expansion');assert(!html.includes('ממתין לתשלום'));assert(!html.includes('צפייה בהזמנה'));}
const partial={...base,total:7080,amount:7080,fully_refunded_count:0,editorial_price:6000};assert.equal(orderCancellation(partial),'partial');assert.equal(orderCancellationLabel(partial),'');for(const monthly of [false,true])assert(!render(partial,monthly).includes('זוכתה חלקית'),'unpaid list has no partial-refund label');
const paid={...partial,paid:1,settled:1,payment_settled:1};assert.equal(orderCancellationLabel(paid),'זוכתה חלקית');for(const monthly of [false,true])assert(render(paid,monthly).includes('הזמנה סגורה'));
const active={...partial,fully_refunded_count:0,refunded_count:0,article_count:2};assert.equal(orderCancellation(active),'none');assert.equal(effectiveOrderTotal(base),0);assert.equal(effectiveOrderTotal(partial),7080);assert.equal(orderCancellation({status:'cancelled',total:5000}),'full');
console.log('Cancellation UI passed: collapsed full cancellation, cancellation-details label, writing retained, paid-only partial refund label, legacy cancellations.');
assert.equal(effectiveOrderTotal({total:10000,paid:0,refunded_count:1,paid_refund_total:3000}),7000,'unpaid closed order reflects cancellation');
assert.equal(effectiveOrderTotal({total:7000,paid:0,refund_total:3000}),7000,'open monthly total already reduced is not deducted twice');
