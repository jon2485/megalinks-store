// Site limits (owner 23.11.2026): one link only and a word limit, checked before an article is sent. (Was: Pixabay as a stock photo library next to Pexels (owner 23.11.2026): search in Hebrew, English or both mixed; Hebrew
// is turned into English with the AI connection or a short dictionary; results cached for 24 hours; the chosen photo
// is copied into our storage with "מקור: Pixabay" and the photographer; Pexels only when Pixabay has nothing.
// Every outgoing call goes to a local stub. Fictional data only.
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {readFileSync,realpathSync,readdirSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(realpathSync('node_modules/wrangler')+'/package.json');
const {Miniflare}=require('miniflare');
const secret=randomBytes(32).toString('base64');
const mf=new Miniflare({outboundService:async request=>new Response('<html><head><title>page</title></head><body>ok</body></html>',{status:200,headers:{'Content-Type':'text/html'}}),
 modules:[{type:'ESModule',path:'dist/server/index.js'},...readdirSync('dist/server',{recursive:true}).filter(p=>/\.(m?js)$/.test(p)&&p!=='index.js').map(p=>({type:'ESModule',path:'dist/server/'+p}))],compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],r2Buckets:['BUCKET'],bindings:{SETTINGS_ENCRYPTION_KEY:secret,POSTFLOW_OWNER_EMAIL:'owner@example.test'},assets:{directory:'dist/client',binding:'ASSETS',routerConfig:{has_user_worker:true,invoke_user_worker_ahead_of_assets:true}},cf:false});
let checks=0;const check=(c,m)=>{assert(c,m);checks++;};
async function req(path,method='GET',body,user='owner',expected=200){const headers={};if(user){headers['oai-authenticated-user-id']=user;headers['oai-authenticated-user-email']=user+'@example.test';}if(body!==undefined)headers['Content-Type']='application/json';const res=await mf.dispatchFetch('https://postflow.test/api/'+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});const text=await res.text();assert.equal(res.status,expected,path+' '+method+' → '+res.status+' '+text.slice(0,300));try{return JSON.parse(text);}catch{return text;}}
const words=n=>Array.from({length:n},(_,i)=>'מילה'+i).join(' ');
try{
 const db=await mf.getD1Database('DB');for(const m of readdirSync('drizzle').filter(x=>x.endsWith('.sql')).sort())for(const part of readFileSync('drizzle/'+m,'utf8').split('--> statement-breakpoint').map(x=>x.trim()).filter(Boolean))await db.prepare(part).run();
 for(const u of ['owner','buyer'])await req('me','GET',undefined,u);
 // Limits are saved on the site (bad values refused), and the customer sees them.
 await req('admin/websites','POST',{name:'אתר שגוי',url:'https://bad-limit.example.com',category:'general',price_ils:300,cost_ils:100,max_words:'abc',acknowledge:true},'owner',400);check(true,'a bad word limit is refused');
 const site=(await req('admin/websites','POST',{name:'אתר עם מגבלות',url:'https://limits.example.com',category:'general',price_ils:300,cost_ils:100,procurement_verified:true,single_link_only:true,max_words:60,public_notes:'האתר לא מפרסם כתבות הימורים',acknowledge:true})).id;
 let row=JSON.parse((await db.prepare('SELECT data FROM websites WHERE id=?').bind(site).first()).data);check(row.max_words===60&&row.single_link_only===true,'site keeps max_words 60 and one link only');
 const cat=await req('catalog','GET',undefined,'buyer');const pub=cat.websites.find(w=>w.id===site);check(pub&&pub.max_words===60&&pub.single_link_only===true&&pub.public_notes==='האתר לא מפרסם כתבות הימורים','the customer catalog has the note and the limits');
 // The catalog form path (bulk save): '' removes the limit, a number sets it.
 const cv=(await req('catalog?scope=admin')).pricing_version,cw=(await req('catalog?scope=admin')).websites.find(w=>w.id===site);
 await req('admin/catalog-bulk','POST',{pricing_version:cv,rows:[{id:site,expected_updated:cw.updated,values:{max_words:'40'}}]},'owner',400);check(true,'bulk save refuses a limit under 50');
 const cw2=(await req('catalog?scope=admin')).websites.find(w=>w.id===site);await req('admin/catalog-bulk','POST',{pricing_version:(await req('catalog?scope=admin')).pricing_version,rows:[{id:site,expected_updated:cw2.updated,values:{max_words:'60'}}]});
 row=JSON.parse((await db.prepare('SELECT data FROM websites WHERE id=?').bind(site).first()).data);check(row.max_words===60,'bulk save stores the limit as a number');
 // A paid order at the site.
 await req('cart','POST',{website_id:site,topic:'כתבה עם מגבלות'},'buyer',201);const quote=await req('quote','POST',{},'buyer');
 const order=await req('checkout','POST',{payment:'invoice',phone:'0500000000',accepted:true,expected_total:quote.total,idempotency:'lim-'+Date.now(),pricing_token:quote.pricing_token,invoice_name:'לקוח בדיקה'},'buyer',201);
 const total=(await req('orders/'+order.id,'GET',undefined,'buyer')).order.total,rid='pay-'+Date.now();
 await req('orders/'+order.id+'/payment-report','POST',{confirmed_closure:true,payment_method:'bank_transfer',reference:'BANK-LIM-1',payment_date:new Date().toISOString().slice(0,10),amount_ils:total/100,request_id:rid},'buyer');
 await req('admin/payment-reports/'+order.id,'POST',{decision:'approve',confirmed:true,request_id:rid});
 let article=(await req('orders/'+order.id,'GET',undefined,'buyer')).articles[0];article=(await req('articles/'+article.id,'GET',undefined,'buyer')).article;
 const save=async content=>{article=(await req('articles/'+article.id,'GET',undefined,'buyer')).article;await req('articles/'+article.id,'PATCH',{version:article.version,title:'כתבה',content,content_format:'html'},'buyer');article=(await req('articles/'+article.id,'GET',undefined,'buyer')).article;return req('articles/'+article.id+'/validate','POST',{},'buyer');};
 // Too long and two links: blocked, with the reason and how much to cut.
 let v=await save('<p>'+words(70)+' <a href="https://brand.example.com/a">קישור</a> <a href="https://brand.example.com/b">עוד</a></p>');
 check(!v.ok&&v.errors.some(e=>e.includes('מותר קישור אחד בלבד')&&e.includes('2 קישורים')),'two links at a one-link site are refused');
 check(v.errors.some(e=>e.includes('עד 60 מילים')&&e.includes('צריך לקצר ב-')),'too many words are refused with how much to cut');
 // Within the limits: no limit errors.
 v=await save('<p>'+words(40)+' <a href="https://brand.example.com/a">קישור</a></p>');
 check(!v.errors.some(e=>e.includes('מותר קישור אחד')||e.includes('מילים')),'within the limits there is no limit error');
 // Removing the limit through the bulk save.
 const cw3=(await req('catalog?scope=admin')).websites.find(w=>w.id===site);await req('admin/catalog-bulk','POST',{pricing_version:(await req('catalog?scope=admin')).pricing_version,rows:[{id:site,expected_updated:cw3.updated,values:{max_words:''}}]});
 row=JSON.parse((await db.prepare('SELECT data FROM websites WHERE id=?').bind(site).first()).data);check(row.max_words===undefined,'an empty limit removes it');
 v=await save('<p>'+words(70)+' <a href="https://brand.example.com/a">קישור</a></p>');check(!v.errors.some(e=>e.includes('מילים')),'without a limit a long article is fine');
 console.log('site-limits: '+checks+' checks passed');
}finally{await mf.dispose();}
