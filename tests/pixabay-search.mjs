// Pixabay as a stock photo library next to Pexels (owner 23.11.2026): search in Hebrew, English or both mixed; Hebrew
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
const JPEG=new Uint8Array([0xff,0xd8,0xff,0xe0,1,2,3,4,5,6,7,8,0xff,0xd9]);
const calls={search:[],id:[],download:[],pexels:[],ai:[]};let expireOnce=new Set();
const aiAnswers={'חתול על הספה':'cat on sofa','ארוחה ל-cat':'meal for cat'};
const hit=(id,q)=>({id,pageURL:'https://pixabay.com/photos/example-'+id+'/',type:'photo',tags:q+', example',previewURL:'https://cdn.pixabay.com/photo/x/'+id+'_150.jpg',webformatURL:'https://pixabay.com/get/w'+id+'_640.jpg',webformatWidth:640,webformatHeight:427,largeImageURL:id===666?'https://evil.example/x.jpg':'https://pixabay.com/get/large-'+id+'.jpg',user:'צלם בדיוני '+id,user_id:id});
const mf=new Miniflare({outboundService:async request=>{const url=new URL(request.url);
  if(url.hostname==='pixabay.com'&&url.pathname==='/api/'){
   const p=Object.fromEntries(url.searchParams);
   if(p.key!=='pix-good')return new Response('[ERROR 400] Invalid or missing API key',{status:400});
   if(p.id){calls.id.push(p.id);return Response.json({total:1,totalHits:1,hits:Number(p.id)===404?[]:[hit(Number(p.id),'photo')]});}
   calls.search.push(p);
   if(/nothing/.test(p.q))return Response.json({total:0,totalHits:0,hits:[]});
   return Response.json({total:40,totalHits:40,hits:Array.from({length:40},(_,i)=>hit(100+i,p.q))});}
  if(url.hostname==='pixabay.com'&&url.pathname.startsWith('/get/large-')){const id=url.pathname.match(/large-(\d+)/)[1];calls.download.push(id);
   if(expireOnce.has(id)){expireOnce.delete(id);return new Response('gone',{status:410});}
   return new Response(JPEG,{headers:{'Content-Type':'image/jpeg','Content-Length':String(JPEG.length)}});}
  if(url.hostname==='api.pexels.com'&&url.pathname==='/v1/photos/9001')return Response.json({id:9001,url:'https://www.pexels.com/photo/9001/',photographer:'Pexels Person',src:{large:'https://images.pexels.com/9001-l.jpg'}});
  if(url.hostname==='images.pexels.com')return new Response(JPEG,{headers:{'Content-Type':'image/jpeg'}});
  if(url.hostname==='api.pexels.com'&&url.pathname==='/v1/search'){calls.pexels.push(url.searchParams.get('query'));return Response.json({photos:[{id:9001,url:'https://www.pexels.com/photo/9001/',photographer:'Pexels Person',src:{medium:'https://images.pexels.com/9001-m.jpg',large:'https://images.pexels.com/9001-l.jpg'}}]});}
  if(url.hostname==='api.openai.com'&&url.pathname==='/v1/chat/completions'){const b=await request.json();const prompt=b.messages[0].content;calls.ai.push(prompt);
   const text=JSON.parse(prompt.split('Search: ')[1]);if(text==='פרחים בגינה')return Response.json({error:'down'},{status:500});
   return Response.json({choices:[{message:{content:JSON.stringify({query:aiAnswers[text]||'unknown words'})}}]});}
  return new Response('reachable',{status:200});},
 modules:[{type:'ESModule',path:'dist/server/index.js'},...readdirSync('dist/server',{recursive:true}).filter(p=>/\.(m?js)$/.test(p)&&p!=='index.js').map(p=>({type:'ESModule',path:'dist/server/'+p}))],compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],r2Buckets:['BUCKET'],bindings:{SETTINGS_ENCRYPTION_KEY:secret,POSTFLOW_OWNER_EMAIL:'owner@example.test'},assets:{directory:'dist/client',binding:'ASSETS',routerConfig:{has_user_worker:true,invoke_user_worker_ahead_of_assets:true}},cf:false});
let checks=0;const check=(c,m)=>{assert(c,m);checks++;};
async function req(path,method='GET',body,user='owner',expected=200){const headers={};if(user){headers['oai-authenticated-user-id']=user;headers['oai-authenticated-user-email']=user+'@example.test';}if(body!==undefined)headers['Content-Type']='application/json';const res=await mf.dispatchFetch('https://postflow.test/api/'+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});const text=await res.text();assert.equal(res.status,expected,path+' '+method+' → '+res.status+' '+text.slice(0,300));try{return JSON.parse(text);}catch{return text;}}
const search=(q,extra='',user='buyer',expected=200)=>req('image-search?query='+encodeURIComponent(q)+extra,'GET',undefined,user,expected);
try{
 const db=await mf.getD1Database('DB');for(const m of readdirSync('drizzle').filter(x=>x.endsWith('.sql')).sort())for(const part of readFileSync('drizzle/'+m,'utf8').split('--> statement-breakpoint').map(x=>x.trim()).filter(Boolean))await db.prepare(part).run();
 for(const u of ['owner','buyer'])await req('me','GET',undefined,u);

 // Nothing connected: a clear message, no outside call.
 let err=await search('dog','','buyer',503);check(/מאגר התמונות/.test(err.error||JSON.stringify(err)),'no library connected → 503 with a Hebrew message');
 check(!calls.search.length&&!calls.pexels.length,'no outside call while nothing is connected');

 // The connection: stored encrypted, never sent back; the test button checks the key.
 await req('admin/integration/pixabay','PATCH',{enabled:true,secret:'pix-bad',secret_storage:'encrypted_server'});
 err=await req('admin/integration/pixabay/test','POST',{},'owner',502);check(/Pixabay/.test(JSON.stringify(err)),'a wrong key fails the test with a Pixabay message');
 err=await search('dog','','buyer',502);check(/Pixabay/.test(JSON.stringify(err)),'a wrong key: the customer gets a plain message');
 check(!/pix-bad/.test(JSON.stringify(err)),'the key is never in the error');
 await req('admin/integration/pixabay','PATCH',{enabled:true,secret:'pix-good',secret_storage:'encrypted_server'});
 await req('admin/integration/pixabay/test','POST',{});check(true,'the right key passes the test');
 const settings=await req('admin/settings');const c=settings.connections.pixabay;
 check(c&&c.enabled&&c.has_secret&&c.secret_storage==='encrypted_server','Pixabay row: enabled, key saved encrypted');
 check(!JSON.stringify(settings).includes('pix-good'),'the key never comes back to the browser');
 check(c.environment_key==='PIXABAY_API_KEY','environment name shown for the key');
 const row=await db.prepare("SELECT value FROM settings WHERE key='integration_pixabay'").first();check(row&&!String(row.value).includes('pix-good'),'the key is stored encrypted in the database');
 await req('admin/integration/pixabay','PATCH',{enabled:true},'buyer',403);check(true,'a customer cannot change the connection');

 // English: searched as written, with the required filters, up to 30 results.
 calls.search.length=0;
 let r=await search('dog food');
 check(r.source==='pixabay'&&r.query==='dog food'&&r.translated===false,'English is searched as written');
 const sent=calls.search.at(-1);
 check(sent.q==='dog food'&&sent.image_type==='photo'&&sent.safesearch==='true'&&sent.orientation==='horizontal'&&sent.per_page==='30'&&sent.lang==='en','photos only, safesearch, horizontal, 30, lang en');
 check(r.photos.length===30&&r.photos.every(p=>p.source==='pixabay'&&p.photographer&&p.src.startsWith('https://pixabay.com/get/')),'30 results at most, each with a photographer');
 check(!JSON.stringify(r).includes('pix-good'),'the key is not in the results');

 // Cache: the same words (any case or spacing) do not call Pixabay again.
 const before=calls.search.length;
 await search('dog food');await search('  Dog   FOOD ');
 check(calls.search.length===before,'repeat searches come from the 24-hour cache');
 await db.prepare("UPDATE image_search_cache SET created=? WHERE key='pixabay:s:dog food'").bind(new Date(Date.now()-25*3600e3).toISOString()).run();
 await search('dog food');check(calls.search.length===before+1,'after 24 hours the search goes to Pixabay again');

 // Hebrew, no AI connection: the dictionary.
 r=await search('אוכל לכלב');check(r.translated&&r.query==='dog food'&&r.original==='אוכל לכלב','Hebrew → "dog food" from the dictionary');
 r=await search('כלבים בים');check(r.translated&&r.query==='dogs sea','one-letter prefixes are removed ("בים" → sea)');
 r=await search('נדל"ן בתל אביב');check(r.translated&&/real estate/.test(r.query)&&/tel aviv/.test(r.query),'phrases: נדל"ן, תל אביב');
 // Mixed: only the Hebrew part is translated, English stays.
 r=await search('אוכל ל-dog');check(r.translated&&/\bfood\b/.test(r.query)&&/\bdog\b/.test(r.query)&&!/[֐-׿]/.test(r.query),'mixed text: Hebrew translated, English kept');
 // No match: searched as written.
 calls.search.length=0;r=await search('קרמבו');check(!r.translated&&r.query==='קרמבו'&&calls.search.at(-1).q==='קרמבו','no dictionary match → searched as written');

 // With the AI connection: the AI translates, once; then the cache.
 await req('admin/integration/ai','PATCH',{enabled:true,provider:'openai',model:'gpt-4.1-mini',secret:'sk-test-ai',secret_storage:'encrypted_server'});
 r=await search('חתול על הספה');check(r.translated&&r.query==='cat on sofa','Hebrew → English with the AI connection');
 check(calls.ai.length===1&&calls.ai[0].includes('חתול על הספה')&&/Translate only the Hebrew/.test(calls.ai[0]),'the AI gets the text and keeps English as written');
 await search('חתול על הספה');check(calls.ai.length===1,'a translation is cached: no second AI call');
 r=await search('ארוחה ל-cat');check(r.query==='meal for cat'&&!/[֐-׿]/.test(r.query),'mixed text with AI: English kept');
 r=await search('פרחים בגינה');check(r.translated&&r.query==='flowers garden','AI fails → dictionary');
 // Changing the searched words ("שינוי"): exact search, no translation.
 const aiCalls=calls.ai.length;r=await search('kitten','&exact=1');check(!r.translated&&r.query==='kitten'&&calls.ai.length===aiCalls,'exact words: no translation');

 // Pixabay first; Pexels only when Pixabay has nothing.
 await req('admin/integration/images','PATCH',{enabled:true,secret:'px-key',secret_storage:'encrypted_server'});
 calls.pexels.length=0;r=await search('mountain');check(r.source==='pixabay'&&!calls.pexels.length,'both connected: Pixabay first, Pexels not asked');
 r=await search('nothing at all');check(r.source==='pexels'&&r.photos[0].source==='pexels'&&calls.pexels.at(-1)==='nothing at all','no Pixabay results → Pexels');
 await req('admin/integration/pixabay','PATCH',{enabled:true,secret:'pix-bad',secret_storage:'encrypted_server'});
 r=await search('lake view');check(r.source==='pexels','Pixabay key failing and Pexels connected → Pexels results');
 await req('admin/integration/pixabay','PATCH',{enabled:true,secret:'pix-good',secret_storage:'encrypted_server'});

 // The chosen photo is copied to our storage, with source and photographer.
 calls.id.length=0;calls.download.length=0;
 let file=await req('image-import','POST',{source:'pixabay',photo_id:101},'buyer');
 check(file.id&&file.source==='Pixabay'&&file.credit==='צילום: צלם בדיוני 101 · מקור: Pixabay'&&file.photographer==='צלם בדיוני 101','import returns the credit "מקור: Pixabay" and the photographer');
 check(calls.id.join()==='101'&&calls.download.join()==='101','the photo is looked up once and downloaded once');
 const res=await mf.dispatchFetch('https://postflow.test/api/files/'+file.id,{headers:{'oai-authenticated-user-id':'buyer','oai-authenticated-user-email':'buyer@example.test'}});
 const bytes=new Uint8Array(await res.arrayBuffer());check(res.status===200&&bytes.length===JPEG.length&&bytes.every((b,i)=>b===JPEG[i]),'the image is served from our server, not from Pixabay');
 const stored=await db.prepare('SELECT name,type,size FROM files WHERE id=?').bind(file.id).first();check(stored.name==='Pixabay-101.jpg'&&stored.type==='image/jpeg','file row: Pixabay-101.jpg');
 file=await req('image-import','POST',{source:'pixabay',photo_id:101},'buyer');check(calls.id.length===1,'the same photo again: id lookup from the cache');
 // A cached download address that expired: looked up again and downloaded.
 await req('image-import','POST',{source:'pixabay',photo_id:102},'buyer');expireOnce.add('102');
 const ids=calls.id.length;await req('image-import','POST',{source:'pixabay',photo_id:102},'buyer');check(calls.id.length===ids+1,'expired cached address → fresh lookup, then saved');
 err=await req('image-import','POST',{source:'pixabay',photo_id:666},'buyer',502);check(/מקור תמונה/.test(JSON.stringify(err)),'an image outside Pixabay is refused');
 await req('image-import','POST',{source:'pixabay',photo_id:404},'buyer',404);check(true,'unknown photo → 404');
 await req('image-import','POST',{source:'pixabay',photo_id:'x'},'buyer',400);check(true,'bad photo id → 400');
 // Pexels import still works as before.
 const pex=await req('image-import','POST',{photo_id:9001},'buyer');check(pex.id&&pex.credit==='צילום: Pexels Person / Pexels','Pexels import works as before');

 // The article keeps "מקור: Pixabay" and the photographer.
 const site=(await req('admin/websites','POST',{name:'אתר תמונות',url:'https://pix-site.example.com',category:'general',price_ils:100,cost_ils:40,procurement_verified:true,acknowledge:true})).id;
 await req('cart','POST',{website_id:site,topic:'כתבה עם תמונה'},'buyer',201);
 const quote=await req('quote','POST',{},'buyer');
 const order=await req('checkout','POST',{payment:'invoice',phone:'0500000000',accepted:true,expected_total:quote.total,idempotency:'pix-'+Date.now(),pricing_token:quote.pricing_token,invoice_name:'לקוח בדיקה'},'buyer',201);
 const total=(await req('orders/'+order.id,'GET',undefined,'buyer')).order.total,requestId='pay-'+Date.now();
 await req('orders/'+order.id+'/payment-report','POST',{confirmed_closure:true,payment_method:'bank_transfer',reference:'BANK-PIX-1',payment_date:new Date().toISOString().slice(0,10),amount_ils:total/100,request_id:requestId},'buyer');
 await req('admin/payment-reports/'+order.id,'POST',{decision:'approve',confirmed:true,request_id:requestId});
 let article=(await req('orders/'+order.id,'GET',undefined,'buyer')).articles[0];
 article=(await req('articles/'+article.id,'GET',undefined,'buyer')).article;
 const main=await req('image-import','POST',{source:'pixabay',photo_id:110},'buyer');
 await req('articles/'+article.id,'PATCH',{version:article.version,title:'כתבה',content:'<p>תוכן</p>',content_format:'html',image_id:main.id,image_credit:main.credit},'buyer');
 article=(await req('articles/'+article.id,'GET',undefined,'buyer')).article;
 const data=JSON.parse((await db.prepare('SELECT data FROM articles WHERE id=?').bind(article.id).first()).data);
 check(data.image_source==='Pixabay'&&data.image_photographer==='צלם בדיוני 110'&&/מקור: Pixabay/.test(data.image_credit),'article: image_source Pixabay, photographer and credit saved');
 console.log('pixabay-search: '+checks+' checks passed');
}finally{await mf.dispose();}
