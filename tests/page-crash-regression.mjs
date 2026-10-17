import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {realpathSync,mkdirSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const require=createRequire(realpathSync('node_modules/wrangler')+'/package.json'),{build}=require('esbuild');
mkdirSync('.sites-runtime',{recursive:true});
async function load(name){const result=await build({entryPoints:['app/'+name+'.tsx'],bundle:true,platform:'node',format:'esm',jsx:'automatic',external:['react','react/jsx-runtime','react-dom','react-dom/server'],write:false,banner:{js:"import {createRequire as __cr} from 'node:module';const require=__cr(import.meta.url);"},plugins:[{name:'fixture',setup(b){b.onResolve({filter:/^(\.\/workspace|\.\/screens|\.\/billing-workspace|\.\/pricing-admin|@\/lib\/client)$/},a=>({path:a.path,namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},a=>({loader:'jsx',contents:a.path==='@/lib/client'?'export function useData(path){return {data:globalThis.fixtures[path],loading:false}} export function api(){throw Error("No render mutations")} export function pricingApi(){throw Error("No render mutations")}':a.path==='./billing-workspace'?'export function OrderBreakdown(){return null}':a.path==='./pricing-admin'?'export function PersonalPricebook(){return null}':a.path==='./screens'?'export function ActionForm(){return null}':'import React from "react";export function Heading({title}){return <h1>{title}</h1>}export function Empty(){return null}export function ErrorBox(){return null}export function Field({children}){return <label>{children}</label>}export function Pick(){return null}'}));}}]});const path='.sites-runtime/'+name+'-crash-regression.mjs';writeFileSync(path,result.outputFiles[0].text);return (await import(pathToFileURL(realpathSync(path)))).default;}
const ctx={revision:0,catalog:[],user:{id:'customer'},adminMode:false,go(){},open(){}};
const Purchased=await load('purchased-view');
for(const payment of ['bank_transfer','card','monthly','split']){
 globalThis.fixtures={orders:{orders:[{id:'unpaid',number:'#1234',paid:0,status:'pending',payment,total:12345}]},articles:{articles:[]}};
 const html=renderToStaticMarkup(React.createElement(Purchased,{ctx}));
 assert(!html.includes('#1234'));assert(!html.includes('pending-customer-orders'));
}
globalThis.fixtures={orders:{orders:[{id:'paid',number:'#PAID',paid:1,total:12345}]},articles:{articles:[]}};
assert(!renderToStaticMarkup(React.createElement(Purchased,{ctx})).includes('#PAID'));
const Account=await load('customer-account-admin');globalThis.fixtures={};
for(const initialTab of [undefined,'orders','payments'])assert.doesNotThrow(()=>renderToStaticMarkup(React.createElement(Account,{ctx:{...ctx,adminMode:true},id:'customer',initialTab})));
console.log('PAGE CRASH REGRESSION PASSED: personal area opens without payment reminders; customer account opens with default and payment tabs.');
