// Isolated React-handler harness: no server, browser, database, or network writes.
import {createRequire} from 'node:module';
import {realpathSync,mkdirSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const require=createRequire(realpathSync('node_modules/wrangler')+'/package.json');
const {build}=require('esbuild'),react=realpathSync('node_modules/react/index.js');
export const nodes=n=>!n||typeof n!=='object'?[]:[n,...[n.props?.children].flat(Infinity).flatMap(nodes)];
export const text=n=>n==null?'':typeof n==='string'||typeof n==='number'?String(n):[n.props?.children].flat(Infinity).map(text).join('');
export const event=()=>({button:0,prevented:false,preventDefault(){this.prevented=true;},stopPropagation(){}});
export function reset(data={}){
 globalThis.adminHandlerHarness={states:[],refs:[],cursor:0,refCursor:0,data,calls:[],reads:[],failure:null};
 return globalThis.adminHandlerHarness;
}
export function render(View,props){const h=globalThis.adminHandlerHarness;h.cursor=0;h.refCursor=0;return View(props);}
export async function compile(entry,name,{stubs={}}={}){
 const result=await build({entryPoints:[entry],bundle:true,platform:'node',format:'esm',jsx:'automatic',write:false,external:[react,'react/jsx-runtime','react-dom'],loader:{'.css':'empty'},plugins:[{name:'isolated-admin-handler-fixtures',setup(b){
  b.onResolve({filter:/^(react|@\/lib\/client|\.\/workspace)$/},a=>({path:a.path,namespace:'admin-fixture'}));
  for(const key of Object.keys(stubs))b.onResolve({filter:new RegExp('^'+key.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'$')},()=>({path:key,namespace:'admin-fixture'}));
  b.onLoad({filter:/.*/,namespace:'admin-fixture'},a=>({loader:'jsx',contents:stubs[a.path]??(a.path==='react'?`
   export * from ${JSON.stringify(react)};export {default} from ${JSON.stringify(react)};
   export function useState(initial){const h=globalThis.adminHandlerHarness,i=h.cursor++;if(!(i in h.states))h.states[i]=typeof initial==='function'?initial():initial;return [h.states[i],v=>{h.states[i]=typeof v==='function'?v(h.states[i]):v}];}
   export function useRef(initial){const h=globalThis.adminHandlerHarness,i=h.refCursor++;return h.refs[i]??=( {current:initial} );}
   export function useEffect(){};export function useMemo(fn){return fn()};export function useCallback(fn){return fn};
  `:a.path==='@/lib/client'?`
   export function useData(path,revision,enabled=true){const h=globalThis.adminHandlerHarness;h.reads.push({path,enabled});return h.data[path]??{data:null,loading:false};}
   export async function pricingApi(path,method,body){return api(path,method,body)}
   export async function api(path,method,body){const h=globalThis.adminHandlerHarness;h.calls.push({path,method,body});if(h.failure)throw Error(h.failure);return {id:'fixture-created',url:'https://fixture.invalid/logo.png'}}
   export function download(){};export function csv(){};export function decodeHtml(x){return x};
  `:`import React from ${JSON.stringify(react)};export const categories={general:'כללי',news:'חדשות'};export function Field({children,label}){return <label>{label}{children}</label>};export function ErrorBox({error}){return error?<p role="alert">{error}</p>:null};export function Heading(){return null};export function Badge(){return null};export function UploadField(){return null};`)}));
 }}]});
 mkdirSync('.sites-runtime',{recursive:true});const file='.sites-runtime/'+name+'.mjs';writeFileSync(file,result.outputFiles[0].text);return import(pathToFileURL(realpathSync(file)));
}
