// "תוכנית פרסום מהאתר שלכם" (design/idea-site-plan, owner 14.11.2026): the pure logic (lib/site-plan.ts) and the built
// server route POST /api/site-plan. The customer's website, DNS and redirects are local stubs; no real network.
// Run after `pnpm build` (it loads dist/server like the payment tests).
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {readFileSync,realpathSync,readdirSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(realpathSync('node_modules/wrangler')+'/package.json'),{build}=require('esbuild');
let checks=0;const check=(test,msg)=>{assert(test,msg);checks++;};
const fixture=n=>readFileSync('tests/fixtures/site-plan/'+n,'utf8');

// ---------- 1. pure logic ----------
await build({entryPoints:['lib/site-plan.ts'],outfile:'.sites-runtime/site-plan.cjs',bundle:true,platform:'node',format:'cjs'});
const sp=require(realpathSync('.sites-runtime/site-plan.cjs'));
for(const [input,ok] of [['cafe-boker.co.il',true],['https://www.ynet.co.il/path?x=1#top',true],['http://localhost:3000',false],['https://10.0.0.1/',false],['https://user:pw@shop.co.il',false],['ftp://shop.co.il',false],['https://db.internal',false],['https://shop.co.il:8080/',false],['https://my.local',false],['javascript:alert(1)',false],['',false]])
 check(('error' in sp.planUrl(input))!==ok,'address '+JSON.stringify(input)+(ok?' accepted':' refused'));
check(!sp.planUrl('https://www.ynet.co.il/path#top').url.includes('#'),'the #part is dropped');
for(const ip of ['127.0.0.1','10.2.3.4','172.20.1.1','192.168.1.1','169.254.169.254','100.100.1.1','0.0.0.0','::1','fd00::1','fe80::1','::ffff:10.0.0.1','not an ip'])check(sp.privateAddress(ip),ip+' is not public');
for(const ip of ['8.8.8.8','93.184.216.34','2606:4700::1111'])check(!sp.privateAddress(ip),ip+' is public');
const home=sp.readPage(fixture('home.html'),'https://cafe-boker.co.il/');
check(home.siteName==='קפה הבוקר'&&home.locality==='חיפה','site name and city from the page data');
check(!home.text.includes('tracking')&&!home.text.includes('color:red'),'script and style text is not read as page text');
const toRead=sp.pagesToRead(home);
check(toRead.some(p=>p.kind==='value'&&p.url.endsWith('/menu'))&&toRead.some(p=>p.kind==='about'),'menu and about pages are read next');
check(!toRead.some(p=>/privacy|instagram|tel:/.test(p.url)),'policy pages, other sites and phone links are skipped');
const others=[{...sp.readPage(fixture('menu.html'),'https://cafe-boker.co.il/menu'),kind:'value'},{...sp.readPage(fixture('about.html'),'https://cafe-boker.co.il/about'),kind:'about'}];
const an=sp.analyzeSite(home,others);
check(an.name==='קפה הבוקר','business name',an.name);
check(an.field?.category==='food'&&an.field.term==='בית קפה','field: a café',JSON.stringify(an.field));
check(an.city?.name==='חיפה'&&an.city.region==='haifa','city: Haifa (not the Tel Aviv word inside a script)');
check(an.targets[0].url.endsWith('/menu')&&an.targets.at(-1).kind==='home','link targets: a real page first, the home page last');
const catalog=JSON.parse(readFileSync('data/catalog.json','utf8')).map(w=>({id:w.id,name:w.name,url:w.url,category:w.category,dr:Number(w.dr||0),price_cents:w.price_cents}));
const plan=sp.buildPlan(an,catalog);
check(plan.map(s=>s.key).join()==='economy,balanced,strong','three plan sizes');
for(const s of plan){
 check(new Set(s.items.map(i=>i.website_id)).size===s.items.length,s.key+': no site twice');
 check(new Set(s.items.map(i=>i.anchor)).size===s.items.length,s.key+': every anchor different');
 check(new Set(s.items.map(i=>i.topic)).size===s.items.length,s.key+': every topic different');
 check(s.total_cents===s.items.reduce((n,i)=>n+i.price_cents,0),s.key+': total adds up');
 for(const i of s.items){const real=catalog.find(c=>c.id===i.website_id);check(real&&real.price_cents===i.price_cents,s.key+': price is the catalog price ('+i.name+')');check(i.target_url.startsWith('https://cafe-boker.co.il/'),s.key+': links only to the customer\'s own site');check(i.why&&i.topic&&i.anchor,s.key+': why, topic and anchor filled');}
}
const local=plan.find(s=>s.key==='balanced').items.find(i=>i.slot==='local');
check(local&&sp.siteCity(local,'חיפה'),'balanced plan has a Haifa site',local?.name);
check(plan.find(s=>s.key==='economy').items.every(i=>i.price_cents<=30000),'economy stays cheap');
// No city on the site: still a plan, from national and field sites.
const noCity=sp.analyzeSite(sp.readPage('<html><head><title>משרד עורכי דין לוי | ייעוץ משפטי</title></head><body><h1>עורך דין לענייני משפחה</h1><p>עורך דין, גירושין, צוואות.</p></body></html>','https://levi-law.co.il/'),[]);
check(noCity.field?.category==='legal'&&noCity.city===null,'a law office with no city');
const p2=sp.buildPlan(noCity,catalog);check(p2.length&&p2.every(s=>s.items.length>=1),'still gets a plan');
check(p2.every(s=>s.items.every(i=>i.slot!=='local'&&i.slot!=='region')),'no local sites when the city is unknown');
// Sites taken out (used for the customer) never come back.
const usedIds=new Set(plan.flatMap(s=>s.items.map(i=>i.website_id)));
const again=sp.buildPlan(an,catalog.filter(c=>!usedIds.has(c.id)));check(again.every(s=>s.items.every(i=>!usedIds.has(i.website_id))),'left-out sites are not offered');
check(sp.buildPlan(an,[]).length===0,'an empty catalog gives no plan');
console.log('site plan logic: ok');

// ---------- 2. the built server ----------
const {Miniflare}=require('miniflare');
const PUBLIC='93.184.216.34',dns={'cafe-boker.co.il':[PUBLIC],'www.cafe-boker.co.il':[PUBLIC],'evil-rebind.co.il':['127.0.0.1'],'moved.co.il':[PUBLIC],'nope.co.il':[],'pdf-only.co.il':[PUBLIC]};
const fetched=[];
const mf=new Miniflare({outboundService:async request=>{const url=new URL(request.url);fetched.push(url.href);
  if(url.hostname==='cloudflare-dns.com'){const name=url.searchParams.get('name'),type=url.searchParams.get('type');const ips=(dns[name]||[]).filter(ip=>type==='AAAA'?ip.includes(':'):!ip.includes(':'));return Response.json({Status:0,Answer:ips.map(data=>({type:type==='AAAA'?28:1,data}))});}
  const html=t=>new Response(t,{headers:{'content-type':'text/html; charset=utf-8'}});
  if(url.hostname==='cafe-boker.co.il'){if(url.pathname==='/')return html(fixture('home.html'));if(url.pathname==='/menu')return html(fixture('menu.html'));if(url.pathname==='/about')return html(fixture('about.html'));return new Response('nf',{status:404});}
  if(url.hostname==='moved.co.il')return new Response(null,{status:302,headers:{location:'http://127.0.0.1:8787/admin'}});
  if(url.hostname==='pdf-only.co.il')return new Response('%PDF',{headers:{'content-type':'application/pdf'}});
  return new Response('should not be fetched',{status:599});},
 modules:[{type:'ESModule',path:'dist/server/index.js'},...readdirSync('dist/server',{recursive:true}).filter(p=>/\.(m?js)$/.test(p)&&p!=='index.js').map(p=>({type:'ESModule',path:'dist/server/'+p}))],compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],r2Buckets:['BUCKET'],bindings:{SETTINGS_ENCRYPTION_KEY:randomBytes(32).toString('base64'),POSTFLOW_OWNER_EMAIL:'owner@example.test'},assets:{directory:'dist/client',binding:'ASSETS',routerConfig:{has_user_worker:true,invoke_user_worker_ahead_of_assets:true}},cf:false});
async function req(path,method='GET',body,user='buyer',expected=200){const headers={};if(user){headers['oai-authenticated-user-id']=user;headers['oai-authenticated-user-email']=user+'@example.test';}if(body!==undefined)headers['Content-Type']='application/json';const res=await mf.dispatchFetch('https://postflow.test/api/'+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});const out=(res.headers.get('Content-Type')||'').includes('json')?await res.json():await res.text();assert.equal(res.status,expected,`${method} ${path}: ${JSON.stringify(out).slice(0,400)}`);checks++;return out;}
try{
 const database=await mf.getD1Database('DB');for(const m of readdirSync('drizzle').filter(x=>x.endsWith('.sql')).sort())for(const part of readFileSync('drizzle/'+m,'utf8').split('--> statement-breakpoint').map(x=>x.trim()).filter(Boolean))await database.prepare(part).run();
 for(const u of ['owner','buyer','other'])await req('me','GET',undefined,u);
 await req('catalog');
 const out=await req('site-plan','POST',{url:'cafe-boker.co.il'});
 check(out.analysis.name==='קפה הבוקר'&&out.analysis.city?.name==='חיפה'&&out.analysis.field?.term==='בית קפה','server reads the site: name, city, field');
 check(out.analysis.pages_read===3&&out.analysis.targets.length===3,'home, menu and about read; the contact page that does not open is skipped');
 check(out.sizes.length===3&&out.sizes.every(s=>s.items.length>=2),'three sizes with sites');
 const catalogNow=(await req('catalog')).websites;
 for(const s of out.sizes)for(const i of s.items){const w=catalogNow.find(x=>x.id===i.website_id);check(w&&w.price_cents===i.price_cents,'server price is the price this customer sees in the catalog');}
 check(!JSON.stringify(out).match(/"(cost|supplier[a-z_]*|admin_note[a-z_]*)":/),'no cost or supplier field in the answer');
 check(fetched.every(u=>/^https:\/\/(cloudflare-dns\.com|cafe-boker\.co\.il)\//.test(u)),'only DNS and the customer\'s own site were fetched',fetched);
 // Guards
 await req('site-plan','POST',{url:'http://127.0.0.1:8787/admin'},'buyer',400);
 await req('site-plan','POST',{url:'https://evil-rebind.co.il/'},'buyer',400);
 check(!fetched.some(u=>u.startsWith('https://evil-rebind')),'a name pointing to a private address is never fetched');
 await req('site-plan','POST',{url:'https://moved.co.il/'},'buyer',422);
 check(!fetched.some(u=>u.includes('127.0.0.1')),'a redirect to an internal address is not followed');
 await req('site-plan','POST',{url:'https://nope.co.il/'},'buyer',404);
 await req('site-plan','POST',{url:'https://pdf-only.co.il/'},'buyer',422);
 await req('site-plan','POST',{url:''},'buyer',400);
 await req('site-plan','POST',{url:'cafe-boker.co.il'},null,401);
 await req('site-plan','GET',undefined,'buyer',404);
 // A customer of another account cannot be used to see that account's used sites.
 await req('site-plan','POST',{url:'cafe-boker.co.il',customer_id:'customer-of-someone-else'},'other',404);
 // Plans stay private: the generic records route does not serve them.
 await req('records/site_plan','GET',undefined,'buyer',400);
 // The cart takes a plan item as an ordinary item, at the ordinary price.
 const item=out.sizes.find(s=>s.key==='balanced').items[0];
 await req('cart','POST',{website_id:item.website_id,topic:item.topic,target_url:item.target_url,anchor:item.anchor,brand:out.analysis.name},'buyer',201);
 const quote=await req('quote','POST',{},'buyer');check(quote.subtotal===item.price_cents||quote.items?.[0]?.price_cents===item.price_cents||quote.total>=item.price_cents,'quote prices the plan item as usual');
 // Rate limit: 20 plans an hour.
 let left=20-1;for(let i=0;i<left;i++)await req('site-plan','POST',{url:'cafe-boker.co.il'},'buyer');
 await req('site-plan','POST',{url:'cafe-boker.co.il'},'buyer',429);
 await req('site-plan','POST',{url:'cafe-boker.co.il'},'other');
 console.log(`PASS site plan: ${checks} checks`);
}finally{await mf.dispose();}
