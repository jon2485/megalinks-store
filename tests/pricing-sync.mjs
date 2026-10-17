import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdirSync,realpathSync,writeFileSync,readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const require=createRequire(realpathSync('node_modules/wrangler')+'/package.json'),{build}=require('esbuild');
globalThis.syncRef={};globalThis.syncEffect=null;
const built=await build({entryPoints:['lib/pricing-sync.ts'],bundle:true,platform:'node',format:'esm',write:false,plugins:[{name:'hooks',setup(b){b.onResolve({filter:/^react$/},()=>({path:'react',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export const useRef=v=>globalThis.syncRef.current||(globalThis.syncRef.current={current:v});export const useEffect=f=>globalThis.syncEffect=f;export function useState(){}',loader:'js'}));}}]});
mkdirSync('.sites-runtime',{recursive:true});writeFileSync('.sites-runtime/pricing-sync-test.mjs',built.outputFiles[0].text);
const {useLivePricing}=await import(pathToFileURL(realpathSync('.sites-runtime/pricing-sync-test.mjs')));
const original={window:globalThis.window,document:globalThis.document,fetch:globalThis.fetch,setInterval:globalThis.setInterval,clearInterval:globalThis.clearInterval};
globalThis.window=new EventTarget();globalThis.document=new EventTarget();document.hidden=false;
let timer,cleared=false,requests=0,refreshes=0,serverVersion=3,localVersion=3,failFetch=false,failRefresh=false,pending;
globalThis.setInterval=(fn,ms)=>{assert.equal(ms,5000);timer=fn;return 1;};globalThis.clearInterval=id=>{assert.equal(id,1);cleared=true;};
globalThis.fetch=async(path,options)=>{assert.equal(path,'/api/pricing-version');assert.equal(options.cache,'no-store');assert.equal(options.method,'GET');requests++;if(pending)await pending;if(failFetch)throw Error('temporary connection failure');return Response.json({pricing_version:serverVersion});};
const flush=async()=>{for(let i=0;i<4;i++)await new Promise(resolve=>setImmediate(resolve));};
const refresh=async active=>{refreshes++;if(failRefresh)throw Error('temporary catalog failure');assert(active());localVersion=serverVersion;useLivePricing(localVersion,refresh);};
try{
 useLivePricing(localVersion,refresh);const stop=globalThis.syncEffect();await flush();assert.equal(requests,1);assert.equal(refreshes,0,'unchanged version never reloads catalog');
 serverVersion=4;await timer();assert.equal(refreshes,1,'other admin session changes trigger a targeted refresh');await timer();assert.equal(refreshes,1,'same saved version does not repeatedly refresh');
 document.hidden=true;const beforeHidden=requests;serverVersion=5;await timer();assert.equal(requests,beforeHidden,'hidden tab does not poll');document.hidden=false;document.dispatchEvent(new Event('visibilitychange'));await flush();assert.equal(localVersion,5,'returning to tab updates current prices');
 serverVersion=6;window.dispatchEvent(new Event('focus'));await flush();assert.equal(localVersion,6,'focus detects a changed price without waiting for timer');
 serverVersion='bad';await timer();assert.equal(localVersion,6,'invalid version is ignored');serverVersion=7;failFetch=true;await timer();assert.equal(localVersion,6);failFetch=false;await timer();assert.equal(localVersion,7,'network failure retries next tick');
 serverVersion=8;failRefresh=true;await timer();assert.equal(localVersion,7);failRefresh=false;await timer();assert.equal(localVersion,8,'catalog failure retries rather than getting stuck on a notified version');
 let release;pending=new Promise(resolve=>release=resolve);serverVersion=9;const first=timer();await flush();const beforeOverlap=requests;await timer();assert.equal(requests,beforeOverlap,'no overlapping pricing requests');stop();assert(cleared);release();await first;assert.equal(localVersion,8,'unmounted workspace cannot receive stale price data');pending=null;
 const beforeDisabled=requests;useLivePricing(8,refresh,false,'admin');assert.equal(globalThis.syncEffect(),undefined);await flush();assert.equal(requests,beforeDisabled,'automatic refresh cannot erase unsaved admin forms');
 const workspace=readFileSync('app/workspace.tsx','utf8'),cart=readFileSync('app/purchase-flow.tsx','utf8');assert(workspace.includes('catalogData.setData(updated);setPricingRevision(x=>x+1)'));assert(cart.includes("useData('cart',ctx.revision+(ctx.pricingRevision||0))"));assert(!workspace.slice(workspace.indexOf('useLivePricing(catalogData'),workspace.indexOf('const refresh =')).includes('setRevision'));
 console.log('LIVE PRICING SYNC PASSED: cross-session updates, no-store, visibility/focus, retries, overlap/unmount protection, separate pricing revision and preserved forms.');
}finally{Object.assign(globalThis,original);}
