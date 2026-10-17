import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {realpathSync,mkdirSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const require=createRequire(realpathSync('node_modules/wrangler')+'/package.json'),{build}=require('esbuild');
globalThis.generationToasts=[];
const built=await build({entryPoints:['lib/article-generation-client.ts'],bundle:true,platform:'node',format:'esm',write:false,plugins:[{name:'notifications',setup(b){b.onResolve({filter:/^sonner$/},()=>({path:'sonner',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export const toast={success:m=>globalThis.generationToasts.push({success:m}),error:m=>globalThis.generationToasts.push({error:m})}',loader:'js'}));}}]});
mkdirSync('.sites-runtime',{recursive:true});writeFileSync('.sites-runtime/generation-client.mjs',built.outputFiles[0].text);
const {startArticleGeneration:start,articleGenerationPending:pending,getArticleGeneration:state}=await import(pathToFileURL(realpathSync('.sites-runtime/generation-client.mjs')));
const controllers=new Map(),events=[],requests=[];let rejectStart=false;
globalThis.window={dispatchEvent(event){events.push(event.detail);}};
globalThis.fetch=async(url,options)=>{requests.push({url,options});const id=decodeURIComponent(url.split('/')[3]);assert.equal(options.method,'POST');assert.equal(options.signal,undefined,'editor cleanup must not own or cancel the request');if(rejectStart)return Response.json({error:'אין הרשאה'},{status:403});return new Response(new ReadableStream({start(c){controllers.set(id,c)}}),{headers:{'Content-Type':'application/x-ndjson'}});};
const tick=()=>new Promise(resolve=>setImmediate(resolve)),encoder=new TextEncoder();
function send(id,data,close=false){controllers.get(id).enqueue(encoder.encode(JSON.stringify(data)+'\n'));if(close)controllers.get(id).close();}
let acknowledged=false;const first=start('article-a').then(()=>acknowledged=true);await tick();assert(!acknowledged,'the popup must await a real server acknowledgement');const duplicate=start('article-a');assert.equal(requests.length,1,'a second click cannot launch a duplicate request');send('article-a',{status:'writing',job:'a'});await Promise.all([first,duplicate]);assert(pending('article-a'));assert.equal(state('article-a').status,'writing');
const second=start('article-b');await tick();send('article-b',{status:'writing',job:'b'});await second;
send('article-a',{status:'heartbeat',job:'a'});await tick();assert(pending('article-a'));assert.equal(state('article-a').status,'writing','heartbeat must not finish or restart the job');
// Remove the editor surface: the module-owned reader still receives completions.
globalThis.window={dispatchEvent(){}};send('article-b',{status:'succeeded'},true);await tick();assert(!pending('article-b'));assert(pending('article-a'),'finishing B cannot release A');assert.equal(state('article-b').status,'succeeded');assert(globalThis.generationToasts.some(t=>t.success));
send('article-a',{status:'failed',error:'שגיאת כתיבה לבדיקה'},true);await tick();assert(!pending('article-a'));assert.equal(state('article-a').error,'שגיאת כתיבה לבדיקה');assert(globalThis.generationToasts.some(t=>t.error==='שגיאת כתיבה לבדיקה'));
const retry=start('article-a');await tick();send('article-a',{status:'writing'});await retry;
const json=encoder.encode(JSON.stringify({status:'succeeded'})+'\n');controllers.get('article-a').enqueue(json.slice(0,9));controllers.get('article-a').enqueue(json.slice(9));controllers.get('article-a').close();await tick();assert.equal(state('article-a').status,'succeeded');
rejectStart=true;await assert.rejects(start('forbidden'),/אין הרשאה/);assert(!pending('forbidden'));rejectStart=false;
const broken=start('broken');await tick();controllers.get('broken').close();await assert.rejects(broken,/נותק/);assert(!pending('broken'));
const noAck=start('no-ack');await tick();send('no-ack',{status:'succeeded'},true);await assert.rejects(noAck,/אישור/);assert(!pending('no-ack'));
assert(requests.every(r=>r.url.endsWith('/generate?background=1')));
console.log('BACKGROUND GENERATION CLIENT PASSED: server acknowledgement before notice, nonblocking reader across editor departure, independent articles, duplicate prevention, completion/error notifications, retries, fragmented packets and refused/broken starts.');
