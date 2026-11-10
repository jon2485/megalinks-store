import assert from 'node:assert/strict';
import {readFileSync,readdirSync,realpathSync} from 'node:fs';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
const require=createRequire(realpathSync('node_modules/wrangler')+'/package.json');
const {build}=require('esbuild');
const bundled=await build({entryPoints:['lib/publication-date.ts'],bundle:true,write:false,format:'esm',platform:'node'});
const dates=await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text).toString('base64'));
assert.equal(dates.israelDayStart('2026-11-01'),'2026-10-31T22:00:00.000Z');
assert.equal(dates.israelDayStart('2026-07-01'),'2026-06-30T21:00:00.000Z');
assert.equal(dates.israelDay('2026-10-31T22:00:00Z'),'2026-11-01');
assert.equal(dates.displayPublicationDay('2026-10-31T22:00:00Z'),'01.11.2026');
assert(!dates.validPublicationDay('2026-02-29'));assert(dates.validPublicationDay('2028-02-29'));
assert.throws(()=>dates.normalizeRequestedPublication('2026-10-21','2026-10-22'));
assert.equal(dates.normalizeRequestedPublication('2026-11-01','2026-10-22'),'2026-10-31T22:00:00.000Z');
const {Miniflare,createFetchMock}=require('miniflare'),fetchMock=createFetchMock();
fetchMock.disableNetConnect();fetchMock.get('https://example.com').intercept({path:'/',method:'GET'}).reply(200,'OK').persist();
const mf=new Miniflare({modules:[{type:'ESModule',path:'dist/server/index.js'},...readdirSync('dist/server',{recursive:true}).filter(p=>/\.(m?js)$/.test(p)&&p!=='index.js').map(p=>({type:'ESModule',path:'dist/server/'+p}))],compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],r2Buckets:['BUCKET'],bindings:{POSTFLOW_OWNER_EMAIL:'owner@example.test',POSTFLOW_AUTOMATION_KEY:'isolated-test-key'},assets:{directory:'dist/client',binding:'ASSETS',routerConfig:{has_user_worker:true,invoke_user_worker_ahead_of_assets:true}},fetchMock,cf:false});
let checks=8;
async function req(path,method='GET',body,user='owner',expected=200,key){const headers={'Content-Type':'application/json'};if(user){headers['oai-authenticated-user-id']=user;headers['oai-authenticated-user-email']=user+'@example.test';}if(key)headers.authorization='Bearer '+key;const res=await mf.dispatchFetch('https://schedule.test/api/'+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});const raw=await res.text();assert.equal(res.status,expected,path+' '+raw.slice(0,400));checks++;return JSON.parse(raw);}
try{
 const db=await mf.getD1Database('DB');for(const f of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())for(const sql of readFileSync('drizzle/'+f,'utf8').split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean))await db.prepare(sql).run();
 for(const user of ['owner','client','other'])await req('me','GET',undefined,user);
 const site=(await req('admin/websites','POST',{name:'ישראל היום',url:'https://israelhayom.co.il',category:'general',price_ils:220,cost_ils:100})).id;
 await req('admin/credit-accounts','PATCH',{user_id:'client',enabled:true,limit_ils:10000});
 const future='2099-11-01';
 async function purchase(editorial=false){await req('cart','POST',{website_id:site,topic:'איך בוחרים אתר לפרסום',editorial,editorial_words:400},'client',201);const q=await req('quote','POST',{},'client');const o=await req('checkout','POST',{payment:'invoice',phone:'0500000000',invoice_name:'Client',accepted:true,idempotency:randomUUID(),pricing_token:q.pricing_token,expected_total:q.total},'client',201);await req('orders/'+o.id+'/paid','POST',{reference:'test-'+o.id,confirmed:true,payment_date:dates.israelDay()});return (await req('orders/'+o.id,'GET',undefined,'client')).articles.at(-1);}
 const load=async a=>(await req('articles/'+a.id,'GET',undefined,'client')).article;
 const content='<p>מדריך מקצועי לבחירת אתר לפרסום. <a href="https://example.com/">לפרטים נוספים</a></p>';
 const jobs=async id=>(await db.prepare('SELECT COUNT(*) n FROM jobs WHERE id=?').bind('publication:'+id).first()).n;
 const stageOf=async id=>(await req('admin/content?view=articles&q=')).articles.find(x=>x.id===id)?.stage;
 // A future day no longer holds the submission: it goes to the manager's approval queue right away.
 async function submit(a){await req('articles/'+a.id,'PATCH',{version:a.version,title:'מדריך לפרסום',content,content_format:'html',scheduled:future},'client');a=await load(a);const result=await req('articles/'+a.id+'/status','POST',{version:a.version,status:'admin_review'},'client');assert.equal(result.status,'admin_review');return load(a);}
 let a=await submit(await purchase());
 assert.equal(a.status,'admin_review');assert.equal(a.scheduled,dates.israelDayStart(future));
 assert.equal(await stageOf(a.id),'admin_review','a scheduled submission is listed for approval');
 // The manager may approve early. The supplier gets it at 07:00 Israel time on the chosen day, not now.
 const approved=await req('articles/'+a.id+'/status','POST',{version:a.version,status:'approved'});a=await load(a);
 assert.equal(a.status,'approved');assert.equal(approved.dispatch_at,'2099-11-01T05:00:00.000Z');assert.equal(a.dispatch_at,'2099-11-01T05:00:00.000Z');
 assert.equal(await jobs(a.id),0,'no supplier dispatch before the chosen day');
 assert.equal(await stageOf(a.id),'dispatch_scheduled','approved and waiting for its day, not a failed delivery');
 await req('articles/'+a.id+'/supplier-link','POST',{},'owner',409);
 await req('articles/'+a.id+'/dispatch','POST',{},'owner',409);
 const run=(key='isolated-test-key',expected=200)=>req('maintenance/scheduled-articles','POST',{},null,expected,key);
 await run('wrong',403);let tick=await run();assert.equal(tick.dispatched,0);assert.equal(tick.released,0);
 // An admin fix after approval keeps it approved and waiting for the day.
 await req('articles/'+a.id,'PATCH',{version:a.version,title:a.title,content:content+'<p>תיקון של המנהל.</p>',content_format:'html'});a=await load(a);
 assert.equal(a.status,'approved');assert.equal(a.dispatch_at,'2099-11-01T05:00:00.000Z');
 // Three more approved early: a cancellation request, an unpaid order and a cancelled order must not be sent.
 const held=[];for(let i=0;i<3;i++){let x=await submit(await purchase());await req('articles/'+x.id+'/status','POST',{version:x.version,status:'approved'});held.push(await load(x));}
 await db.prepare("UPDATE articles SET data=json_set(data,'$.cancel_pending',1) WHERE id=?").bind(held[0].id).run();
 await db.prepare("UPDATE orders SET paid=0,data=json_set(data,'$.on_account',0,'$.payment_settled',0) WHERE id=?").bind(held[1].order_id).run();
 await db.prepare("UPDATE orders SET status='cancelled' WHERE id=?").bind(held[2].order_id).run();
 // The chosen day arrives (07:00 has passed).
 const past='2000-01-01T00:00:00.000Z';
 for(const row of [a,...held])await db.prepare("UPDATE articles SET data=json_set(data,'$.scheduled',?,'$.dispatch_at',?) WHERE id=?").bind(past,past,row.id).run();
 tick=await run();assert.equal(tick.dispatched,1,'only the clear article is sent on its day');
 assert.equal(await jobs(a.id),1);assert(['approved','sent'].includes((await load(a)).status));
 for(const row of held)assert.equal(await jobs(row.id),0,'held, unpaid and cancelled orders are not sent');
 assert.equal((await run()).dispatched,0,'each article is sent once');
 // Approving after the day has passed sends right away.
 let late=await submit(await purchase());await db.prepare("UPDATE articles SET data=json_set(data,'$.scheduled',?) WHERE id=?").bind(past,late.id).run();late=await load(late);
 const lateResult=await req('articles/'+late.id+'/status','POST',{version:late.version,status:'approved'});assert.equal(lateResult.dispatch_at,'');assert.equal(await jobs(late.id),1);
 // Older articles still waiting as 'scheduled' move to the approval queue right away, whatever the date.
 let legacy=await submit(await purchase());await db.prepare("UPDATE articles SET status='scheduled',data=json_set(data,'$.scheduled',?) WHERE id=?").bind(dates.israelDayStart(future),legacy.id).run();
 tick=await run();assert.equal(tick.released,1);assert.equal((await load(legacy)).status,'admin_review');
 assert.equal((await db.prepare("SELECT COUNT(*) n FROM activity WHERE resource=? AND user_id='system:schedule'").bind(legacy.id).first()).n,1);
 // A completed writing service published without customer review: approved now, sent on the day.
 let w=await purchase(true);await req('articles/'+w.id,'PATCH',{version:w.version,title:'מדריך לפרסום',content:'',scheduled:future,brief:{topic:'מדריך לפרסום',target_url:'https://example.com/',anchor:'לפרטים נוספים',publish_without_review:true}},'client');w=await load(w);await req('articles/'+w.id+'/writing-request','POST',{version:w.version},'client');w=(await req('articles/'+w.id)).article;await req('articles/'+w.id,'PATCH',{version:w.version,title:'מדריך לפרסום',content,content_format:'html'});w=(await req('articles/'+w.id)).article;
 assert.equal((await req('articles/'+w.id+'/writing-complete','POST',{version:w.version,action:'publish'})).status,'approved');
 w=(await req('articles/'+w.id)).article;assert.equal(w.dispatch_at,'2099-11-01T05:00:00.000Z');assert.equal(await jobs(w.id),0);
 console.log('PUBLICATION SCHEDULING PASS:',checks,'requests/date checks; future submissions go to approval, early approval waits for 07:00 on the day, one dispatch per article, held/unpaid/cancelled excluded, late approval sends now, legacy scheduled released, admin fix keeps approval, writing route. No real messages sent.');
}finally{await mf.dispose();await fetchMock.close();}
