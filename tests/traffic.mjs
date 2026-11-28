import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {realpathSync} from 'node:fs';
const require=createRequire(realpathSync('node_modules/wrangler')+'/package.json'),{build}=require('esbuild');
// "תנועה באתר" (owner 28.11.2026). The real module with a fake database that records what would be written:
// nothing personal is stored, bots and admin screens are not counted, and only the same visitor can add time to a view.
const fakes={'./server':`
  import {createHash} from 'node:crypto';
  export const T=globalThis.__tr={writes:[],settings:new Map(),nextId:1};
  export class ApiError extends Error{constructor(status,message){super(message);this.status=status;}}
  export function assert(ok,message,status=400){if(!ok)throw new ApiError(status,message);}
  export const admin=u=>assert(u.role==='admin','admin only',403);
  export const hash=async v=>createHash('sha256').update(v).digest('hex');
  export const setting=async(k,f)=>T.settings.has(k)?T.settings.get(k):f;export const saveSetting=async(k,v)=>{T.settings.set(k,v);};
  export const stmt=(sql,...a)=>({run:async()=>{T.writes.push({sql,a});}});
  export const one=async(sql,...a)=>{if(/^INSERT INTO page_views/.test(sql)){T.writes.push({sql,a});return {id:T.nextId++};}return null;};
  export const all=async()=>[];`};
const out=await build({entryPoints:['lib/traffic.ts'],bundle:true,platform:'node',format:'esm',write:false,plugins:[{name:'fakes',setup(b){b.onResolve({filter:/^\.\//},a=>fakes[a.path]?{path:a.path,namespace:'fake'}:null);b.onLoad({filter:/.*/,namespace:'fake'},a=>({contents:fakes[a.path],loader:'js',resolveDir:process.cwd()}));}}]});
const m=await import('data:text/javascript;base64,'+Buffer.from(out.outputFiles[0].text).toString('base64'));
const T=globalThis.__tr;

// 1. pages: no query, ids folded, so pages of one kind count together
assert.equal(m.trafficPath('/catalog?quote=abc#x'),'/catalog');assert.equal(m.trafficPath('catalog/'),'/catalog');assert.equal(m.trafficPath(''),'/');
assert.equal(m.trafficPath('/article/4bc6d458-448c-4d2d-875d-4b056cd40ad7'),'/article/*');assert.equal(m.trafficPath('/site/69c3b7a4c1282aa9e1b5e551'),'/site/*');
assert.equal(m.trafficPath('/Knowledge/What-Is-A-Link'),'/knowledge/what-is-a-link');assert.equal(m.trafficPath('/orders/1042'),'/orders/*');assert.equal(m.trafficPath('/'+'z'.repeat(300)).length,120);
// 2. sources
const src=(r,c='')=>m.trafficSource(r,c,'megalinks.co.il');
assert.equal(src('https://www.google.com/search?q=x'),'google');assert.equal(src('https://google.co.il/'),'google');assert.equal(src(''),'direct');assert.equal(src('not a url'),'direct');
assert.equal(src('https://megalinks.co.il/catalog'),'','a reload inside the site is not a new arrival');assert.equal(src('https://www.megalinks.co.il/'),'');assert.equal(src('https://l.facebook.com/x'),'facebook');assert.equal(src('https://www.instagram.com/'),'facebook');
assert.equal(src('https://wa.me/972500000000'),'whatsapp');assert.equal(src('https://web.whatsapp.com/'),'whatsapp');assert.equal(src('https://www.bing.com/search'),'search');
assert.equal(src('https://some-blog.example/post'),'other');assert.equal(src('https://www.google.com/','newsletter'),'campaign');
// 3. the start of a day in Israel, in winter (UTC+2) and in summer (UTC+3)
assert.equal(new Date(m.dayStart('2026-11-28')).toISOString(),'2026-11-27T22:00:00.000Z');assert.equal(new Date(m.dayStart('2026-07-01')).toISOString(),'2026-06-30T21:00:00.000Z');

// 4. a view: what is written
const req=(agent,ip='203.0.113.7')=>new Request('https://megalinks.co.il/api/track',{method:'POST',headers:{'user-agent':agent,'cf-connecting-ip':ip}});
const chrome='Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140 Safari/537.36',phone='Mozilla/5.0 (iPhone; CPU iPhone OS 19_0) Mobile Safari/604.1';
let r=await m.trackView(req(chrome),{path:'/catalog?utm_source=x',entry:true,referrer:'https://www.google.com/'});
assert.equal(r.id,1);const row=T.writes.find(w=>/^INSERT INTO page_views/.test(w.sql)).a;
assert.equal(row[3],'/catalog');assert.equal(row[4],'google');assert.equal(row[5],'desktop');assert.match(row[0],/^\d{4}-\d{2}-\d{2}$/);assert.match(row[2],/^[0-9a-f]{24}$/);
const stored=JSON.stringify(T.writes);
assert(!stored.includes('203.0.113.7'),'the address is never written');assert(!stored.includes('Chrome'),'the browser string is never written');assert(!stored.includes(T.settings.get('traffic_salt')),'the secret stays in the settings');
// the same person again: the same visitor; another address or another browser: another visitor
const visitor=row[2];const again=async(a,ip)=>{T.writes.length=0;await m.trackView(req(a,ip),{path:'/cart'});return T.writes.find(w=>/^INSERT INTO page_views/.test(w.sql))?.a;};
let next=await again(chrome);assert.equal(next[2],visitor);assert.equal(next[4],'','only the entry carries a source');
assert.notEqual((await again(chrome,'198.51.100.9'))[2],visitor);next=await again(phone);assert.notEqual(next[2],visitor);assert.equal(next[5],'mobile');
// the address the gateway passes wins over anything else, so two people behind one loopback are two visitors
const viaGateway=async ip=>{T.writes.length=0;await m.trackView(new Request('https://megalinks.co.il/api/track',{method:'POST',headers:{'user-agent':chrome,'x-megalinks-visitor-ip':ip,'cf-connecting-ip':'127.0.0.1'}}),{path:'/cart'});return T.writes[0].a[2];};
assert.notEqual(await viaGateway('203.0.113.7'),await viaGateway('198.51.100.9'));assert.equal(await viaGateway('203.0.113.7'),visitor);
// 5. not counted: bots, admin screens, the API, a request with no browser
for(const [agent,path] of [['Googlebot/2.1','/catalog'],['Mozilla/5.0 HeadlessChrome','/catalog'],['curl/8.0','/catalog'],[chrome,'/admin-orders'],[chrome,'/admin/x'],[chrome,'/api/me'],[chrome,'/__qa/login'],['','/catalog']]){T.writes.length=0;const res=await m.trackView(req(agent),{path});assert.equal(res.id,undefined,agent+' '+path);assert.equal(T.writes.length,0,agent+' '+path);}
// 6. time on a page: capped, and tied to the visitor and the day
T.writes.length=0;await m.trackView(req(chrome),{id:1,seconds:99999});
let up=T.writes[0];assert.match(up.sql,/^UPDATE page_views SET seconds=MAX\(seconds,\?\) WHERE id=\? AND visitor=\? AND day=\?$/);assert.deepEqual(up.a.slice(0,3),[1800,1,visitor]);
T.writes.length=0;await m.trackView(req(chrome,'198.51.100.9'),{id:1,seconds:60});assert.notEqual(T.writes[0].a[2],visitor,'another visitor cannot touch this view');
for(const bad of [{id:'x',seconds:5},{id:0,seconds:5},{id:1,seconds:0},{id:1,seconds:-4},{id:1.5,seconds:'abc'}]){T.writes.length=0;await m.trackView(req(chrome),bad);assert.equal(T.writes.length,0,JSON.stringify(bad));}
// 7. the report is for admins only
await assert.rejects(m.trafficRoutes(new Request('https://megalinks.co.il/api/admin/traffic'),['admin','traffic'],{role:'customer'}),e=>e.status===403);
assert.equal(await m.trafficRoutes(new Request('https://megalinks.co.il/api/cart'),['cart'],{role:'customer'}),null);
const empty=await m.trafficRoutes(new Request('https://megalinks.co.il/api/admin/traffic?range=7'),['admin','traffic'],{role:'admin'});
assert.equal(empty.days,7);assert.equal(empty.series.length,7);assert.equal(empty.current.visitors,0);assert.equal(empty.current.bounce_percent,0);assert.deepEqual(empty.pages,[]);
assert.equal((await m.trafficReport(12345)).days,30);
console.log('traffic: ok');
