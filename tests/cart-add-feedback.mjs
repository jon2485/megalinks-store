import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {realpathSync,mkdirSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const require=createRequire(realpathSync('node_modules/wrangler')+'/package.json'),{build}=require('esbuild');
let values=[],index=0,effects=[];
globalThis.feedbackHooks={state(value){const i=index++;if(!(i in values))values[i]=typeof value==='function'?value():value;return [values[i],v=>values[i]=v];},ref(value){const i=index++;return values[i]??(values[i]={current:value});},effect(fn){effects.push(fn);}};
const result=await build({entryPoints:['app/cart-add-feedback.tsx'],bundle:true,platform:'node',format:'esm',jsx:'automatic',external:['react/jsx-runtime'],write:false,plugins:[{name:'feedback-fixture',setup(b){b.onResolve({filter:/^react$/},()=>({path:'react',namespace:'fixture'}));b.onResolve({filter:new RegExp('^@/components/ui/button$')},()=>({path:'button',namespace:'fixture'}));b.onResolve({filter:/^lucide-react$/},()=>({path:'icons',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},a=>({loader:'js',contents:a.path==='icons'?'export function Check(){}':a.path==='react'?'export default {};export const useState=v=>globalThis.feedbackHooks.state(v);export const useRef=v=>globalThis.feedbackHooks.ref(v);export const useEffect=fn=>globalThis.feedbackHooks.effect(fn);':'export function Button(){}'}));}}]});
mkdirSync('.sites-runtime',{recursive:true});writeFileSync('.sites-runtime/cart-add-feedback.mjs',result.outputFiles[0].text);
const {CartFeedbackButton,notifyCartAdded}=await import(pathToFileURL(realpathSync('.sites-runtime/cart-add-feedback.mjs')));
globalThis.window=new EventTarget();
globalThis.CustomEvent=class extends Event{constructor(name,options){super(name);this.detail=options.detail;}};
let timerId=0;const timers=new Map(),originalTimeout=globalThis.setTimeout,originalClear=globalThis.clearTimeout;
globalThis.setTimeout=(fn,delay)=>{const id=++timerId;timers.set(id,{fn:()=>{timers.delete(id);fn();},delay});return id;};globalThis.clearTimeout=id=>timers.delete(id);
try{
 const props={websiteId:'site-a',onClick(){},className:'purchase',label:'הוספה לסל',icon:'cart'};
 const render=()=>{index=0;effects=[];return CartFeedbackButton(props);};
 let tree=render();const cleanup=effects[0]();tree=render();assert.equal(tree.props['data-added'],false);
 notifyCartAdded('site-b');tree=render();assert.equal(tree.props['data-added'],false,'other site is ignored');
 notifyCartAdded('site-a');tree=render();assert.equal(tree.props['data-added'],true);assert.equal(timers.size,1);assert.equal([...timers.values()][0].delay,2400);
 notifyCartAdded('site-a');assert.equal(timers.size,1,'repeated success replaces timer');
 [...timers.values()][0].fn();tree=render();assert.equal(tree.props['data-added'],false,'success returns to purchase state');
 notifyCartAdded('site-a');cleanup();assert.equal(timers.size,0,'unmount clears timer');notifyCartAdded('site-a');assert.equal(timers.size,0,'unmounted listener removed');
 values=[];props.enabled=false;tree=render();effects[0]();notifyCartAdded('site-a');tree=render();assert.equal(tree.props['data-added'],false,'admin/custom buttons do not confirm a purchase');
 console.log('CART FEEDBACK PASSED: success event, site isolation, 2.4s reset, repeated confirmation, disabled mode and cleanup.');
}finally{globalThis.setTimeout=originalTimeout;globalThis.clearTimeout=originalClear;}
