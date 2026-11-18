// SEO audit 18.11.2026: one public address everywhere, structured data on the public pages, /llms.txt for AI assistants,
// sitemap on the public address, /favicon.ico. Local Miniflare with fictional data only.
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {readFileSync,realpathSync,readdirSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(realpathSync('node_modules/wrangler')+'/package.json'),{Miniflare}=require('miniflare');
let checks=0;const ok=(c,m)=>{assert(c,m);checks++;};
const mf=new Miniflare({outboundService:async()=>new Response('ok'),modules:[{type:'ESModule',path:'dist/server/index.js'},...readdirSync('dist/server',{recursive:true}).filter(p=>/\.(m?js)$/.test(p)&&p!=='index.js').map(p=>({type:'ESModule',path:'dist/server/'+p}))],compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],r2Buckets:['BUCKET'],bindings:{SETTINGS_ENCRYPTION_KEY:randomBytes(32).toString('base64'),POSTFLOW_OWNER_EMAIL:'owner@example.test'},cf:false});
const get=async path=>{const r=await mf.dispatchFetch('https://megalinks.test'+path,{redirect:'manual'});return {status:r.status,headers:r.headers,text:await r.text()};};
const ld=html=>[...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m=>JSON.parse(m[1])).flatMap(j=>j['@graph']||[j]);
try{
 const db=await mf.getD1Database('DB');for(const m of readdirSync('drizzle').filter(x=>x.endsWith('.sql')).sort())for(const part of readFileSync('drizzle/'+m,'utf8').split('--> statement-breakpoint').map(x=>x.trim()).filter(Boolean))await db.prepare(part).run();
 await mf.dispatchFetch('https://megalinks.test/api/cart',{headers:{'oai-authenticated-user-id':'u1','oai-authenticated-user-email':'u1@example.test'}});
 await db.prepare("INSERT INTO websites(id,name,url,category,price,dr,active,data,updated) VALUES ('s1','ווינט','https://www.ynet.co.il/','news_national',450000,91,1,?,datetime('now'))").bind(JSON.stringify({cost_cents:99900,supplier_email:'hidden-supplier@example.test'})).run();
 let r=await get('/');const home=ld(r.text).map(x=>x['@type']);
 ok(r.text.includes('<link rel="canonical" href="https://megalinks.co.il/">'),'homepage canonical on megalinks.co.il');
 ok(['Organization','WebSite','OfferCatalog','FAQPage'].every(t=>home.includes(t)),'homepage structured data: '+home);
 const org=ld(r.text).find(x=>x['@type']==='Organization');ok(org.telephone&&org.address&&org.logo,'organisation with phone, address and logo');
 ok(ld(r.text).find(x=>x['@type']==='FAQPage').mainEntity.length===8,'the 8 visible questions');
 ok(/<title>קניית קישורים וכתבות יח״צ/.test(r.text),'homepage title with the main search terms');
 r=await get('/pr');const pr=ld(r.text);ok(pr.some(x=>x['@type']==='Service'&&x.offers.length===1&&x.offers[0].price==='4999.00')&&pr.some(x=>x['@type']==='BreadcrumbList'),'PR page: service with an offer per site, breadcrumbs');
 r=await get('/catalog');ok(r.text.includes('מחירון אתרים לפרסום כתבות וקניית קישורים')&&ld(r.text).some(x=>x['@type']==='CollectionPage'),'catalog has its own title and structured data');
 ok(!/hidden-supplier|99900|999\.00/.test(r.text),'no cost or supplier in the catalog schema');
 r=await get('/llms.txt');ok(r.status===200&&r.headers.get('content-type').startsWith('text/plain')&&r.text.startsWith('# MegaLinks'),'llms.txt served as text');
 ok(r.text.includes('https://megalinks.co.il/pr')&&r.text.includes('ווינט (ynet.co.il): החל מ-₪4,999')&&!/hidden-supplier|99900/.test(r.text),'llms.txt: public pages and PR prices, nothing private');
 r=await get('/sitemap.xml');ok(r.text.includes('<loc>https://megalinks.co.il/pr</loc>')&&!r.text.includes('megalinks.test'),'sitemap on the public address');
 r=await get('/robots.txt');ok(r.text.includes('Sitemap: https://megalinks.co.il/sitemap.xml'),'robots.txt points to the public sitemap');
 r=await get('/favicon.ico');ok(r.status===301&&r.headers.get('location')==='/brand/loader-m.png','favicon.ico redirects to the site icon');
 console.log('SEO AUDIT PASSED:',checks,'checks: public address, titles, structured data, llms.txt, sitemap, robots, favicon. Local only.');
}finally{await mf.dispose();}
