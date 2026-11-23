// Exchange suppliers (owner 23.11.2026, docs/exchange-suppliers-spec.md): one link back for each verified publication,
// my cost is what I pay for the site taken in return (₪50 until then, a month that ended keeps ₪50 and the difference
// goes to the month of the choice), the supplier never sees prices, balances start at 0. Fictional data only.
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {readFileSync,realpathSync,readdirSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(realpathSync('node_modules/wrangler')+'/package.json');
const {Miniflare}=require('miniflare');
const mf=new Miniflare({outboundService:async()=>new Response('ok'),modules:[{type:'ESModule',path:'dist/server/index.js'},...readdirSync('dist/server',{recursive:true}).filter(p=>/\.(m?js)$/.test(p)&&p!=='index.js').map(p=>({type:'ESModule',path:'dist/server/'+p}))],compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],r2Buckets:['BUCKET'],bindings:{SETTINGS_ENCRYPTION_KEY:randomBytes(32).toString('base64'),POSTFLOW_OWNER_EMAIL:'owner@example.test'},assets:{directory:'dist/client',binding:'ASSETS',routerConfig:{has_user_worker:true,invoke_user_worker_ahead_of_assets:true}},cf:false});
let checks=0;const check=(c,m)=>{assert(c,m);checks++;};
async function req(path,method='GET',body,user='owner',expected=200){const headers={};if(user){headers['oai-authenticated-user-id']=user;headers['oai-authenticated-user-email']=user+'@example.test';}if(body!==undefined)headers['Content-Type']='application/json';const res=await mf.dispatchFetch('https://postflow.test/api/'+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});const out=(res.headers.get('Content-Type')||'').includes('json')?await res.json():await res.text();assert.equal(res.status,expected,`${method} ${path}: ${JSON.stringify(out)}`);checks++;return out;}
try{
 const db=await mf.getD1Database('DB');for(const m of readdirSync('drizzle').filter(x=>x.endsWith('.sql')).sort())for(const part of readFileSync('drizzle/'+m,'utf8').split('--> statement-breakpoint').map(x=>x.trim()).filter(Boolean))await db.prepare(part).run();
 const run=(sql,...a)=>db.prepare(sql).bind(...a).run(),first=(sql,...a)=>db.prepare(sql).bind(...a).first();
 for(const u of ['owner','buyer','xsup','plain'])await req('me','GET',undefined,u);
 const stamp=new Date().toISOString();
 // The exchange supplier: a supplier card linked to the xsup account, with a site the sheet marked "החלפה".
 await run("INSERT INTO records(id,kind,user_id,data,created,updated) VALUES ('sup-x','supplier','owner',?,?,?)",JSON.stringify({name:'חדשות הצפון',email:'x@example.test'}),stamp,stamp);
 await run("INSERT INTO seller_profiles(user_id,supplier_id,created) VALUES ('xsup','sup-x',?)",stamp);
 const mk=async(name,url,cost)=>(await req('admin/websites','POST',{name,url,category:'general',price_ils:300,...(cost==null?{}:{cost_ils:cost}),procurement_verified:true,acknowledge:true})).id;
 const E=await mk('אתר הספק','https://north-news.example.com',0),T1=await mk('טק דיילי','https://tech-daily.example.com',80),T2=await mk('ספורט IL','https://sport-il.example.com',40),T3=await mk('בלי עלות','https://no-cost.example.com',null);
 await run("UPDATE websites SET data=json_set(data,'$.stock_mode','exchange','$.supplier_id','sup-x') WHERE id=?",E);
 // Sites open for exchanges: only with a known cost, never an exchange supplier's own site.
 await req('admin/exchanges/sites','POST',{website_id:T1,available:true});await req('admin/exchanges/sites','POST',{website_id:T2,available:true});
 await req('admin/exchanges/sites','POST',{website_id:T3,available:true},'owner',409);await req('admin/exchanges/sites','POST',{website_id:E,available:true},'owner',409);
 await req('admin/exchanges/sites','POST',{website_id:T1,available:true},'buyer',403);
 // A customer order at the exchange site, published before the feature started: it does not count (balances start at 0).
 await req('credits','POST',{user_id:'buyer',amount:5000,reason:'test',reference:'x-topup'});
 const buy=async(site,topic)=>{await req('cart','POST',{website_id:site,topic},'buyer',201);const q=await req('quote','POST',{},'buyer');const o=await req('checkout','POST',{invoice_name:'לקוח',payment:'credits',phone:'0500000000',accepted:true,idempotency:randomUUID(),expected_total:q.total,pricing_token:q.pricing_token},'buyer',201);return {order:o.id,article:(await first('SELECT id FROM articles WHERE order_id=?',o.id)).id};};
 const publish=(id,at=new Date().toISOString())=>run("UPDATE articles SET status='published',published_url='https://north-news.example.com/p',data=json_set(data,'$.published_at',?) WHERE id=?",at,id);
 const old=await buy(E,'ישנה');await publish(old.article,'2026-01-01T10:00:00.000Z');
 const before=await req('admin/exchanges?supplier=sup-x');check(before.is_exchange&&before.balance===0&&before.published===0,'an earlier publication does not open an exchange');
 // A new verified publication opens one exchange.
 const a1=await buy(E,'מזגנים');await publish(a1.article);
 let mine=await req('selling/exchanges',undefined,undefined,'xsup');check(mine.exchange_account&&mine.balance===1&&mine.published===1&&mine.taken===0,'one publication, one exchange to choose');
 check(!/cents|cost|price|booked|₪/.test(JSON.stringify(mine)),'the supplier never gets prices or costs');
 check(await first("SELECT id FROM jobs WHERE id LIKE 'email:exchange-earned:%'"),'the supplier gets a mail that an exchange was added');
 const sites=(await req('selling/exchanges/sites',undefined,undefined,'xsup')).sites;check(sites.map(s=>s.id).sort().join()===[T1,T2].sort().join(),'only approved sites with a cost, not its own');
 check(!/cents|cost|price/.test(JSON.stringify(sites)),'the site list has no prices');
 check((await req('selling/exchanges',undefined,undefined,'plain')).exchange_account===false,'an ordinary account is not an exchange supplier');
 await req('selling/exchanges/take','POST',{website_id:T1,request_id:'plain-req-1'},'plain',403);
 // My cost until a choice: the ₪50 default, as an estimate on the customer's order.
 let detail=await req('orders/'+a1.order);check(Number(detail.articles[0].exchange_booked_cents)===5000,'the source counts the ₪50 default until the supplier chooses');
 // Taking a site: a free paid order like a customer's, and my cost becomes what I pay for that site.
 await req('selling/exchanges/take','POST',{website_id:T3,request_id:'take-bad-site'},'xsup',409);
 const t1=await req('selling/exchanges/take','POST',{website_id:T1,request_id:'take-first-01'},'xsup',201);
 const order=await first('SELECT * FROM orders WHERE id=?',t1.order_id);check(order.payment==='exchange'&&order.total===0&&order.paid===1&&order.user_id==='xsup','an exchange order: paid, ₪0, the supplier is the customer');
 const again=await req('selling/exchanges/take','POST',{website_id:T1,request_id:'take-first-01'},'xsup',201);check(again.order_id===t1.order_id&&again.duplicate,'the same request twice makes one order');
 await req('selling/exchanges/take','POST',{website_id:T2,request_id:'take-no-balance'},'xsup',409);
 const seen=JSON.stringify(await req('orders/'+t1.order_id,undefined,undefined,'xsup'));check(!seen.includes('"cost_cents"')&&!seen.includes('8000'),'the supplier\'s own order shows no cost of the site');
 detail=await req('orders/'+a1.order);check(Number(detail.articles[0].exchange_booked_cents)===8000,'the source now costs what I pay for the site taken (₪80)');
 const target=await req('orders/'+t1.order_id);check(Number(target.articles[0].exchange_target)===1,'the article taken in return is marked, so its cost is not counted twice');
 mine=await req('selling/exchanges',undefined,undefined,'xsup');check(mine.balance===0&&mine.taken===1&&mine.exchanges[0].target_site==='טק דיילי','the pair shows what was taken');
 // Exchange orders never ask for a tax document.
 const missing=JSON.stringify(await req('admin/invoices?status=missing'));check(!missing.includes(t1.order_id),'no missing-invoice alert for an exchange order');
 // The exchange supplier is never paid for exchange publications.
 const sellerView=JSON.stringify(await req('selling',undefined,undefined,'xsup'));check(!sellerView.includes(a1.article),'the publication is not in the supplier\'s payments');
 // A choice after the source month ended: that month keeps ₪50, the difference goes to the month of the choice.
 const a2=await buy(E,'משכנתא');await publish(a2.article);await req('admin/exchanges?supplier=sup-x');
 await run("UPDATE exchanges SET source_month='2026-01' WHERE source_article_id=?",a2.article);
 const t2=await req('selling/exchanges/take','POST',{website_id:T2,request_id:'take-second-1'},'xsup',201);
 let x2=await first('SELECT * FROM exchanges WHERE source_article_id=?',a2.article);check(x2.booked_cents===5000,'the ended month keeps the ₪50 default');
 let adj=await first('SELECT SUM(amount_cents) AS s FROM exchange_adjustments WHERE exchange_id=?',x2.id);check(adj.s===-1000,'the difference (₪40 site, -₪10) is booked in the month of the choice');
 const month=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jerusalem',year:'numeric',month:'2-digit'}).format(new Date()).slice(0,7);
 const report=await req('admin/month-close?from='+month+'-01&to='+month+'-28');check(report.summary.exchange_adjustments===-1000,'the month report shows the exchange adjustments');
 // The supplier cancels the order taken in return before publication: the exchange is open again, the month back to ₪50.
 await run("UPDATE articles SET status='cancelled' WHERE order_id=?",t2.order_id);await req('admin/exchanges?supplier=sup-x');
 x2=await first('SELECT * FROM exchanges WHERE id=?',x2.id);adj=await first('SELECT SUM(amount_cents) AS s FROM exchange_adjustments WHERE exchange_id=?',x2.id);
 check(x2.status==='open'&&!x2.target_order_id&&adj.s===0,'cancelled before publication: the exchange is open again and the difference is reversed');
 // The customer article at the supplier is cancelled after the supplier already took a link: that is a debt. Here the
 // supplier still has a free exchange (from the cancelled order above), so it covers the debt at once: balance 0.
 await run("UPDATE articles SET status='cancelled' WHERE id=?",a1.article);let adm=await req('admin/exchanges?supplier=sup-x');
 const covered=adm.exchanges.find(r=>r.source_article_id===a2.article),gone=adm.exchanges.find(r=>r.source_article_id===a1.article);
 check(gone.status==='void'&&covered.status==='taken'&&covered.target_order_id===t1.order_id&&adm.balance===0,'a cancelled publication whose link was used moves the used link to the next free exchange');
 // Without a free exchange the debt stays (balance -1) until the next publication covers it.
 await run("UPDATE articles SET status='cancelled' WHERE id=?",a2.article);adm=await req('admin/exchanges?supplier=sup-x');
 check(adm.exchanges.find(r=>r.source_article_id===a2.article).status==='debt'&&adm.balance===-1,'no free exchange: a debt, balance -1');
 check((await req('selling/exchanges',undefined,undefined,'xsup')).balance===-1,'the supplier sees the same balance');
 const a3=await buy(E,'רואה חשבון');await publish(a3.article);adm=await req('admin/exchanges?supplier=sup-x');
 const x3=adm.exchanges.find(r=>r.source_article_id===a3.article);check(x3.status==='taken'&&x3.target_order_id===t1.order_id&&adm.balance===0,'the next publication covers the debt: it takes over the order already taken');
 // Manual correction by the admin, with a reason.
 await req('admin/exchanges/adjust','POST',{supplier_id:'sup-x',delta:1},'owner',400);await req('admin/exchanges/adjust','POST',{supplier_id:'sup-x',delta:1,note:'השלמה'},'buyer',403);
 await req('admin/exchanges/adjust','POST',{supplier_id:'sup-x',delta:1,note:'החלפה מהחודש הקודם'});check((await req('admin/exchanges?supplier=sup-x')).balance===1,'a manual exchange adds one');
 await req('admin/exchanges/adjust','POST',{supplier_id:'sup-x',delta:-1,note:'נוספה בטעות'});check((await req('admin/exchanges?supplier=sup-x')).balance===0,'a manual removal takes one away');
 // The default cost is a setting.
 await req('admin/exchanges/settings','PATCH',{default_ils:60});check((await req('admin/exchanges/settings')).default_cents===6000,'the default cost can be changed');
 await req('admin/exchanges','GET',undefined,'buyer',403);
 console.log('PASS exchange suppliers:',checks,'checks');
}finally{await mf.dispose();}
