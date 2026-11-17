// PR articles page (owner, 17.11.2026; design/pr-page/spec.md): /pr shows the live catalog's sites with a picture, a sample
// link and the price including the 499 ₪ interview; /pr/start keeps the interview details; one interview for several
// sites becomes one cart line per site sharing an interview id; after payment the admin sees an interview card and moves
// every article of that interview to writing at once. Fictional data, local Miniflare only.
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {readFileSync,realpathSync,readdirSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(realpathSync('node_modules/wrangler')+'/package.json'),{Miniflare}=require('miniflare');
let checks=0;const ok=(c,m)=>{assert(c,m);checks++;};
const mf=new Miniflare({outboundService:async()=>new Response('ok'),
 modules:[{type:'ESModule',path:'dist/server/index.js'},...readdirSync('dist/server',{recursive:true}).filter(p=>/\.(m?js)$/.test(p)&&p!=='index.js').map(p=>({type:'ESModule',path:'dist/server/'+p}))],compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],r2Buckets:['BUCKET'],bindings:{SETTINGS_ENCRYPTION_KEY:randomBytes(32).toString('base64'),POSTFLOW_OWNER_EMAIL:'owner@example.test'},cf:false});
const who={owner:['owner','owner@example.test'],dana:['dana','dana@example.test'],eli:['eli','eli@example.test']};
const call=async(as,path,method='GET',body,status=200)=>{const [id,email]=who[as];const res=await mf.dispatchFetch('https://megalinks.test/api/'+path,{method,headers:{'Content-Type':'application/json','origin':'https://megalinks.test','oai-authenticated-user-id':id,'oai-authenticated-user-email':email},body:body===undefined?undefined:JSON.stringify(body)}),j=await res.json();assert.equal(res.status,status,path+' '+JSON.stringify(j));checks++;return j;};
const page=async path=>{const res=await mf.dispatchFetch('https://megalinks.test'+path);return {status:res.status,html:await res.text()};};
let db;
try{
 db=await mf.getD1Database('DB');for(const m of readdirSync('drizzle').filter(x=>x.endsWith('.sql')).sort())for(const part of readFileSync('drizzle/'+m,'utf8').split('--> statement-breakpoint').map(x=>x.trim()).filter(Boolean))await db.prepare(part).run();
 await call('owner','me');await call('dana','me');await call('eli','me');
 await call('dana','cart'); // sets up the pricing tiers
 const site=(id,name,url,dr,price,data)=>db.prepare("INSERT INTO websites(id,name,url,category,price,dr,active,data,updated) VALUES (?,?,?,?,?,?,1,?,datetime('now'))").bind(id,name,url,'news_national',price,dr,JSON.stringify({cost_cents:123400,supplier_email:'secret-supplier@example.test',ur:60,features:['dofollow'],turnaround_days:3,public_notes:'הכתבה במדור התוכן השיווקי',...data})).run();
 await site('s-ynet','ווינט','https://www.ynet.co.il/',91,450000,{});
 await site('s-mako','מאקו','https://www.mako.co.il/',89,400000,{example_articles:['https://www.mako.co.il/sample-pr-article']});
 await site('s-globes','גלובס','https://www.globes.co.il/',84,350000,{});
 await site('s-old','אתר ישן בארכיון','https://old.example.test/',99,100000,{archived_at:'2026-11-16T00:00:00Z'});
 await db.prepare("INSERT INTO websites(id,name,url,category,price,dr,active,data,updated) VALUES ('s-off','אתר כבוי','https://off.example.test/','news_national',100000,98,0,'{}',datetime('now'))").run();

 // The page: live catalog sites only, strongest first, nothing private.
 let {status,html}=await page('/pr');ok(status===200,'the PR page answers');
 const cards=[...html.matchAll(/<article class="ps" data-site="([^"]+)"/g)].map(m=>m[1]);
 ok(JSON.stringify(cards)==='["s-ynet","s-mako","s-globes"]','active, non-archived sites by DR: '+cards);
 ok(!/secret-supplier|1,234|123400|cost_cents/.test(html),'no supplier e-mail or cost in the public page');
 ok(html.includes('₪4,999')&&html.includes('₪4,499')&&html.includes('₪3,999'),'price shown = publication + 499 ₪ interview');
 ok(html.includes('אתר החדשות של ידיעות אחרונות')&&html.includes('עיתון העסקים והכלכלה של ישראל'),'default descriptions for the sites in the catalog');
 ok(html.includes('href="https://www.mako.co.il/sample-pr-article"')&&html.includes('href="https://www.ynet.co.il/" target="_blank" rel="noopener noreferrer">'),'sample link: the saved example article, else the site address as a placeholder');
 ok((html.match(/class="ps__shot"/g)||[]).length===3,'every card has a picture of the site');
 ok(html.includes('גם עליכם יכולים לכתוב ככה')&&!html.includes('מתפרסמים ב'),'owner changes: samples heading, no site-name strip in the hero');
 ok(html.includes('<link rel="canonical" href="')&&/canonical" href="[^"]*\/pr"/.test(html)&&html.includes('index, follow'),'its own canonical address, open to search engines');
 ok(!html.includes("querySelector('[data-snake]')")&&!html.includes('%%SITE_URL%%')&&!html.includes('<!--PR:'),'no homepage-only script, every placeholder filled');
 // The owner can choose the sites later: marked sites only, in the owner's order.
 await db.prepare("UPDATE websites SET data=json_set(data,'$.pr_featured',json('true'),'$.pr_order',2,'$.pr_description','תיאור של הבעלים') WHERE id='s-globes'").run();
 await db.prepare("UPDATE websites SET data=json_set(data,'$.pr_featured',json('true'),'$.pr_order',1) WHERE id='s-mako'").run();
 ({html}=await page('/pr'));ok(JSON.stringify([...html.matchAll(/<article class="ps" data-site="([^"]+)"/g)].map(m=>m[1]))==='["s-mako","s-globes"]'&&html.includes('תיאור של הבעלים'),'marked sites only, in the owner order, with the owner description');
 await db.prepare("UPDATE websites SET data=json_remove(data,'$.pr_featured','$.pr_order','$.pr_description')").run();

 ({status,html}=await page('/pr/start'));ok(status===200&&html.includes('data-value="morning"')&&html.includes('data-value="א׳"')&&html.includes('noindex'),'the form page: day and hour chips, kept out of search');

 // One interview, two sites.
 const interview={business_name:'מרפאת השיניים של ד״ר לוי',contact_name:'דנה לוי',phone:'050-123 4567',link:'dr-levi.example',days:['א׳','ג׳','ש׳'],hours:['morning','late'],topic:'השתלות שיניים'};
 for(const [bad,why] of [[{...interview,phone:'12'},'טלפון'],[{...interview,days:[]},'יום'],[{...interview,hours:[]},'שעות'],[{...interview,business_name:''},'העסק'],[{...interview,link:'not a link'},'קישור']]){
  const e=await call('dana','pr/cart','POST',{sites:['s-ynet'],interview:bad},400);ok(e.error.includes(why),'refused with a clear reason: '+e.error);}
 await call('dana','pr/cart','POST',{sites:[],interview},400);
 await call('dana','pr/cart','POST',{sites:['s-old'],interview},404);
 const added=await call('dana','pr/cart','POST',{sites:['s-ynet','s-globes','s-ynet'],interview},201);ok(added.added===2,'one line per site, duplicates ignored');
 let cart=(await call('dana','cart')).items;
 ok(cart.length===2&&cart.every(i=>i.content_type==='pr_interview'&&i.editorial===true&&i.interview_group===added.interview_group),'both lines share one interview');
 ok(cart.every(i=>i.editorial_price===49900),'499 ₪ interview and writing on every line');
 ok(cart.find(i=>i.website_id==='s-ynet').price===499900,'ynet line = 4,500 + 499');
 const iv=cart[0].interview;ok(iv.phone==='0501234567'&&iv.link==='https://dr-levi.example/'&&JSON.stringify(iv.days)==='["א׳","ג׳"]'&&JSON.stringify(iv.hours)==='["morning"]','interview details cleaned: phone digits, full link, only known days and hours');
 ok(cart[0].topic==='כתבת יח״צ: מרפאת השיניים של ד״ר לוי'&&cart[0].target_url==='https://dr-levi.example/','topic and link for the writer');
 // Editing a line cannot drop the interview or the writing.
 await call('dana','cart/'+cart[0].id,'PATCH',{editorial:false,quantity:1});
 cart=(await call('dana','cart')).items;ok(cart[0].editorial===true&&cart[0].interview?.business_name&&cart[0].editorial_price===49900,'a PR line keeps its interview and price after an edit');
 // A plain cart line cannot pretend to be a PR line without an interview id.
 await call('dana','cart','POST',{website_id:'s-mako',topic:'x',content_type:'pr_interview',interview},400);
 // Another customer cannot touch these lines.
 await call('eli','cart/'+cart[0].id,'PATCH',{editorial:false},403);

 // Checkout by bank transfer, then the payment arrives.
 const q=await call('dana','quote','POST',{});
 ok(q.total===Math.round((450000+350000+2*49900)*1.18),'quote: publications + 2 × 499, with VAT');
 const order=await call('dana','checkout','POST',{idempotency:'pr-test-order-1',pricing_token:q.pricing_token,expected_total:q.total,payment:'invoice',accepted:true,invoice_name:'מרפאת השיניים של ד״ר לוי',phone:'0501234567'},201);
 const articles=(await db.prepare("SELECT id,status,data FROM articles WHERE order_id=?").bind(order.id).all()).results;
 ok(articles.length===2&&articles.every(a=>JSON.parse(a.data).interview_group===added.interview_group&&a.status==='draft'),'two articles, one interview');
 // Before payment there is nothing to schedule.
 await call('owner','articles/'+articles[0].id+'/interview-done','POST',{},409);
 await db.prepare("UPDATE orders SET paid=1,status='paid' WHERE id=?").bind(order.id).run();
 const list=await call('owner','admin/content?view=writing&status=all');
 const rows=(list.rows||list.items||list.articles||[]).filter(r=>r.order_id===order.id);
 ok(rows.length===2&&rows.every(r=>r.stage==='awaiting_interview'&&Number(r.needs_action)===1&&Number(r.interview_count)===2),'admin writing list: "ראיון לתיאום", needs action, one interview for 2 articles');
 ok(JSON.parse(rows[0].interview).contact_name==='דנה לוי','the interview details reach the admin');
 // The customer sees their own interview details, never another customer's.
 const mine=await call('dana','articles/'+articles[0].id);ok((mine.article||mine).interview?.business_name==='מרפאת השיניים של ד״ר לוי','the customer sees the interview details of the article');
 await call('eli','articles/'+articles[0].id,'GET',undefined,403);
 // The interview happened: every article of it moves to writing together, once.
 await call('dana','articles/'+articles[0].id+'/interview-done','POST',{},403);
 const done=await call('owner','articles/'+articles[1].id+'/interview-done','POST',{});ok(done.moved===2,'both articles moved to writing');
 const after=(await db.prepare("SELECT status,data FROM articles WHERE order_id=?").bind(order.id).all()).results;
 ok(after.every(a=>a.status==='writing'&&JSON.parse(a.data).writing_requested_at&&JSON.parse(a.data).interview_done_at),'status writing, writing request and interview time recorded');
 await call('owner','articles/'+articles[0].id+'/interview-done','POST',{},409);
 const rows2=((await call('owner','admin/content?view=writing&status=all')).rows||[]).filter(r=>r.order_id===order.id);
 ok(rows2.every(r=>r.stage==='writing_new'),'the normal writing flow takes over');
 console.log('PR PAGE PASSED:',checks,'checks: live sites, no private data, price with interview, picture and sample link, owner sites later, form page, interview validation, one interview for several sites, PR line kept on edit, checkout, admin interview card, interview done once for all articles. Fictional data, local only.');
}finally{await mf.dispose();}
