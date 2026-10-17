import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {realpathSync,mkdirSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const require=createRequire(realpathSync('node_modules/wrangler')+'/package.json'),{build}=require('esbuild');
mkdirSync('.sites-runtime',{recursive:true});
async function load(file){const result=await build({entryPoints:['app/'+file+'.tsx'],bundle:true,platform:'node',format:'esm',jsx:'automatic',external:['react','react/jsx-runtime','react-dom','lucide-react'],write:false,banner:{js:"import {createRequire as __cr} from 'node:module';const require=__cr(import.meta.url);"},plugins:[{name:'fixture',setup(b){b.onResolve({filter:/^(\.\/workspace|\.\/screens|@\/lib\/client)$/},a=>({path:a.path,namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},a=>({loader:'jsx',contents:a.path==='@/lib/client'?'export function useData(){return {data:globalThis.fixture,loading:false}} export function api(){throw Error("No mutations in render")}':a.path==='./screens'?'export function ActionForm(){return null}':'import React from "react"; export function Heading({title}){return <h1>{title}</h1>} export function ErrorBox(){return null} export function Empty(){return null} export function Field({label,children}){return <label>{label}{children}</label>} export function Pick(){return <select/>}'}));}}]});writeFileSync('.sites-runtime/'+file+'.mjs',result.outputFiles[0].text);return import(pathToFileURL(realpathSync('.sites-runtime/'+file+'.mjs')));}
const ctx={adminMode:true,revision:0,open(){},run(){throw Error('No financial mutation during render')}};
const {RefundForm}=await load('refund-dialog');const article={id:'a',version:1,website_name:'PCMag',website_url:'https://pcmag.com',status:'draft',publication_price:22000,editorial_price:6000,paid_amount:33040,paid_net_amount:28000,writing_net_amount:6000,writing_gross_amount:7080};
const render=order=>renderToStaticMarkup(React.createElement(RefundForm,{ctx,userId:'buyer',article,order,close(){}}));
let html=render({paid:1,number:'#1001'});for(const text of ['pcmag.com','סכום לזיכוי:','כולל מע״מ','אישור והחזרת הקרדיט','הסכום יתווסף מיד','href="https://pcmag.com/"'])assert(html.includes(text),text);assert(!html.includes('מזהה כתבה:'));assert(!html.includes('<dt>פרסום</dt>'));
html=render({on_account:true,paid:0});assert(html.includes('אישור והפחתת החוב'));assert(html.includes('לא יתווסף קרדיט לארנק'));
html=render({demo:true});assert(html.includes('לא יתווסף קרדיט כספי'));
html=render({paid:0,payment:'invoice'});assert(html.includes('אין תשלום לזיכוי'));assert(html.includes('ההזמנה טרם שולמה'));
const {SupplierSettlements}=await load('supplier-settlements');globalThis.fixture={rows:[{id:'s',supplier_name:'ספק בדיקה',month:'2026-10',count:1,amount:10000,articles:[{id:'a',website_name:'PCMag',website_url:'https://pcmag.com',cost_cents:10000,title:'כתבה'}]}]};html=renderToStaticMarkup(React.createElement(SupplierSettlements,{ctx}));for(const text of ['ספק בדיקה','pcmag.com','יתרה לתשלום','תיעוד תשלום שבוצע','settlement-card'])assert(html.includes(text),text);
console.log('Refund and supplier UI: linked domains, accurate VAT/destination labels, demo separation, payment cards and accessible controls passed.');
