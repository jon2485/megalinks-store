import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {realpathSync,writeFileSync,mkdirSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {createAdminFixture} from './admin-glass.mjs';
const require=createRequire(realpathSync('node_modules/wrangler')+'/package.json'),{build}=require('esbuild');
mkdirSync('.sites-runtime',{recursive:true});
const compiled=await build({stdin:{contents:"export * from './lib/admin-order-buckets';export * from './lib/admin-date-range';export * from './lib/admin-month-report';export * from './lib/admin-report-workbook';export {unzipSync,strFromU8} from 'fflate';",resolveDir:process.cwd(),loader:'ts'},bundle:true,platform:'node',format:'esm',write:false});
writeFileSync('.sites-runtime/admin-report-domain.mjs',compiled.outputFiles[0].text);
const {adminOrderBucket,buildMonthReport,israelMidnight,validReportDay,monthReportWorkbook,unzipSync,strFromU8}=await import(pathToFileURL(realpathSync('.sites-runtime/admin-report-domain.mjs')));
for(const changes of [{},{purchase_closed_at:'2026-10-02'},{monthly_closed:1},{payment_report_status:'pending'},{payment_report_status:'rejected'},{purchase_closed_at:'x',monthly_closed:1,payment_report_status:'pending'}])assert.equal(adminOrderBucket({payment:'monthly',paid:0,...changes}),'monthly');
for(const changes of [{paid:1},{settled:1},{payment_settled:1}])assert.equal(adminOrderBucket({payment:'monthly',...changes}),'closed');
assert.equal(adminOrderBucket({on_account:true,payment:'bank_transfer'}),'monthly');assert.equal(adminOrderBucket({billing_month:'2026-10',payment:'invoice'}),'monthly');
assert.equal(adminOrderBucket({payment:'invoice',paid:0,payment_report_status:'pending'}),'process');assert.equal(adminOrderBucket({payment:'credits',paid:1,status:'cancelled'}),'archive');assert.equal(adminOrderBucket({demo:true,paid:1}),'archive');
assert.equal(israelMidnight('2026-07-01'),'2026-06-30T21:00:00.000Z');assert.equal(israelMidnight('2026-12-01'),'2026-11-30T22:00:00.000Z');
assert(validReportDay('2024-02-29'));for(const v of ['2026-02-29','2026-02-31','2026-13-01','garbage','2026-10-1'])assert(!validReportDay(v));
const order={id:'cost',number:'#COST',user_id:'u',paid:1,payment:'card',subtotal:10000,discount:0,total:11800,vat:1800};
assert.equal(buildMonthReport([order],[{order_id:'cost',cost_cents:0}]).summary.profit_net,null,'legacy zero is missing, never silently free');
assert.equal(buildMonthReport([order],[{order_id:'cost',cost_cents:0,cost_recorded:true}]).summary.profit_net,10000);
assert.equal(buildMonthReport([order],[{order_id:'cost',cost_cents:4000,editorial_price:1000}]).summary.profit_net,null,'missing paid writing cost is flagged');
assert.equal(buildMonthReport([order],[{order_id:'cost',cost_cents:4000,editorial_price:1000,writing_cost_cents:500}]).summary.profit_net,5500);
assert.equal(buildMonthReport([{...order,paid:0}],[{order_id:'cost',cost_cents:4000}]).summary.net,0);
const f=await createAdminFixture();
const request=async(path,method='GET',body,expected=200)=>{const r=await f.request('/api/'+path,{method,body:body===undefined?undefined:JSON.stringify(body),headers:{'Content-Type':'application/json'}});const j=await r.json();assert.equal(r.status,expected,JSON.stringify(j));return j;};
const stamp='2026-10-10T09:00:00.000Z';
async function seed(id,{user='buyer',payment='monthly',paid=0,data={},created=stamp,total=11800,net=10000,status='pending',cost=6000,article=true}={}){
 await f.db.prepare('INSERT INTO orders(id,user_id,number,status,subtotal,discount,vat,total,payment,paid,data,idempotency,created,updated) VALUES(?,?,?,?,?,0,?,?,?,?,?,?,?,?)').bind(id,user,'#TEST-'+id,status,net,total-net,total,payment,paid,JSON.stringify({vat_percent:18,...data}),id,created,stamp).run();
 if(article)await f.db.prepare('INSERT INTO articles(id,order_id,user_id,website_id,status,title,content,data,updated) VALUES(?,?,?,?,?,?,?,?,?)').bind('article-'+id,id,user,'site','writing','Report test','',JSON.stringify({cost_cents:cost,price_cents:net,editorial_price:0}),stamp).run();
}
try{
 for(const path of ['admin/orders','admin/orders?export=1','admin/month-close?from=2026-10-01&to=2026-10-31','admin/month-close?from=2026-10-01&to=2026-10-31&export=1'])for(const who of [null,'buyer','supplier']){const r=await f.mf.dispatchFetch('http://admin.test/api/'+path,{headers:who?{'oai-authenticated-user-id':who,'oai-authenticated-user-email':who+'@example.test'}:{}});assert.equal(r.status,who?403:401,path);}
 for(const [id,data] of [['monthly-open',{}],['monthly-lock',{purchase_closed_at:stamp}],['monthly-pdf',{}],['monthly-reported',{}],['monthly-rejected',{}]]){
  await seed(id,{data});await f.db.prepare('INSERT INTO monthly_charges(order_id,user_id,month,amount,demo,settled) VALUES(?,?,?,?,0,0)').bind(id,'buyer','2026-10',11800).run();
 }
 await f.db.prepare('INSERT INTO records(id,kind,user_id,data,created,updated) VALUES(?,?,?,?,?,?)').bind('monthly:2026-10:buyer:0','monthly_statement','buyer','{}',stamp,stamp).run();
 for(const [id,status] of [['monthly-reported','pending'],['monthly-rejected','rejected']])await f.db.prepare('INSERT INTO records(id,kind,user_id,data,created,updated) VALUES(?,?,?,?,?,?)').bind('payment-report:'+id,'customer_payment_report','buyer',JSON.stringify({order_id:id,status,reported_at:stamp,amount_cents:11800,reference:'TEST-REFERENCE',payment_method:'bank_transfer'}),stamp,stamp).run();
 await seed('monthly-paid',{paid:1,data:{payment_date:'2026-10-10'},status:'in_progress'});await seed('process',{payment:'bank_transfer'});await seed('demo',{paid:1,payment:'card',data:{demo:true}});await seed('cancelled',{paid:1,payment:'card',status:'cancelled'});
 const monthly=await request('admin/orders?bucket=monthly&q=TEST-');assert.equal(monthly.total,5);assert(monthly.orders.every(o=>o.bucket==='monthly'&&!o.paid));assert(monthly.orders.some(o=>o.id==='monthly-pdf'&&o.monthly_closed));assert.equal(monthly.orders.find(o=>o.id==='monthly-reported').payment_report.reference,'TEST-REFERENCE');
 const closed=await request('admin/orders?bucket=closed&q=TEST-');assert.deepEqual(closed.orders.map(o=>o.id),['monthly-paid']);
 const process=await request('admin/orders?bucket=process&q=TEST-');assert.deepEqual(process.orders.map(o=>o.id),['process']);
 assert.equal((await request('admin/orders?bucket=archive&q=TEST-')).total,2);
 await request('admin/orders?bucket=toString','GET',undefined,400);await request('admin/orders?month=2026-13','GET',undefined,400);
 // Financial closure, not purchase closure, moves the exact monthly order.
 await f.db.prepare("UPDATE orders SET paid=1,data=json_set(data,'$.payment_date','2026-10-10') WHERE id='monthly-reported'").run();
 assert(!(await request('admin/orders?bucket=monthly&q=TEST-')).orders.some(o=>o.id==='monthly-reported'));assert((await request('admin/orders?bucket=closed&q=TEST-')).orders.some(o=>o.id==='monthly-reported'));
 // Different original order dates, same confirmed payment period; clients aggregate once.
 await seed('R1001',{payment:'card',paid:1,created:'2026-09-01T09:00:00Z',data:{payment_date:'2026-10-11'},cost:4000});
 await seed('R1002',{payment:'credits',paid:1,created:'2026-09-02T09:00:00Z',data:{payment_date:'2026-10-11'},total:23600,net:20000,cost:10000});
 await seed('R1003',{user:'noa',payment:'card',paid:1,data:{payment_date:'2026-10-11'},total:5900,net:5000,cost:1000});
 const report=await request('admin/month-close?from=2026-10-11&to=2026-10-11');assert.equal(report.orders.length,3);assert.equal(report.clients.length,2);assert.deepEqual({...report.summary},{orders:3,paid_orders:3,net:35000,vat:6300,total:41300,cost_known:15000,cost_missing:0,cost_net:15000,profit_net:20000});
 const client=report.clients.find(c=>c.user_id==='buyer');assert.equal(client.numbers.length,2);assert.equal(client.paid_net,30000);assert.equal(client.profit_net,16000);
 await f.db.prepare("UPDATE websites SET data=json_set(data,'$.cost_cents',999999) WHERE id='site'").run();assert.equal((await request('admin/month-close?from=2026-10-11&to=2026-10-11')).summary.cost_net,15000,'catalog changes cannot rewrite purchase costs');
 assert.equal((await request('admin/month-close?from=2026-09-01&to=2026-09-02&basis=order')).orders.length,2);
 assert.equal((await request('admin/month-close?from=2026-09-01&to=2026-09-02')).orders.length,0);
 await seed('missing-date',{payment:'card',paid:1});assert((await request('admin/orders?bucket=closed&month=unknown')).orders.some(o=>o.id==='missing-date'));assert((await request('admin/month-close?from=2026-10-11&to=2026-10-11')).missing_payment_dates>0);
 await seed('missing-cost',{payment:'card',paid:1,data:{payment_date:'2026-10-12'},cost:0});const missing=await request('admin/month-close?from=2026-10-12&to=2026-10-12');assert.equal(missing.summary.profit_net,null);assert.equal(missing.summary.cost_net,null);assert.equal(missing.summary.cost_missing,1);
 await seed('refunded',{payment:'card',paid:1,data:{payment_date:'2026-10-13',paid_refund_total:2360},total:23600,net:20000,cost:7000});const refund=await request('admin/month-close?from=2026-10-13&to=2026-10-13');assert.equal(refund.summary.net,18000);assert.equal(refund.summary.vat,3240);assert.equal(refund.summary.cost_net,7000);assert.equal(refund.summary.profit_net,11000);
 await seed('boundary-before',{payment:'card',paid:1,data:{payment_date:'2026-07-31T20:59:59.999Z'}});await seed('boundary-after',{payment:'card',paid:1,data:{payment_date:'2026-07-31T21:00:00.000Z'}});assert.deepEqual((await request('admin/month-close?from=2026-08-01&to=2026-08-01')).orders.map(o=>o.id),['boundary-after']);
 await request('admin/month-close?from=2026-02-31&to=2026-03-01','GET',undefined,400);await request('admin/month-close?from=2026-10-12&to=2026-10-11','GET',undefined,400);await request('admin/month-close?from=2026-10-01&to=2026-10-31&basis=updated','GET',undefined,400);
 // An export is uncapped and shares every committed list filter, including literal query.
 const batch=[];for(let i=0;i<1005;i++)batch.push(f.db.prepare('INSERT INTO orders(id,user_id,number,status,subtotal,discount,vat,total,payment,paid,data,idempotency,created,updated) VALUES(?,?,?,?,?,0,?,?,?,?,?,?,?,?)').bind('bulk-'+i,'buyer','#EXPORT-'+i,'pending',10000,1800,11800,'invoice',0,'{}','bulk-'+i,stamp,stamp));for(let i=0;i<batch.length;i+=100)await f.db.batch(batch.slice(i,i+100));
 const bulk=await request('admin/orders?bucket=process&month=2026-10&q=EXPORT-');assert.equal(bulk.total,1005);assert.equal(bulk.orders.length,20);
 assert.equal((await request('admin/orders?bucket=process&month=2026-10&q=EXPORT-&page=999')).page,51);
 const exportResponse=await f.request('/api/admin/orders?bucket=process&month=2026-10&q=EXPORT-&export=1');assert.equal(exportResponse.status,200);assert(exportResponse.headers.get('Cache-Control').includes('no-store'));
 const exported=unzipSync(new Uint8Array(await exportResponse.arrayBuffer())),orderSheet=strFromU8(exported['xl/worksheets/sheet1.xml']);assert.equal((orderSheet.match(/<row /g)||[]).length,1006);assert(!orderSheet.includes('#TEST-'));
 const workbook=await f.request('/api/admin/month-close?from=2026-10-11&to=2026-10-11&export=1');assert.equal(workbook.status,200);const files=unzipSync(new Uint8Array(await workbook.arrayBuffer())),sheet=strFromU8(files['xl/worksheets/sheet1.xml']);assert(sheet.includes('rightToLeft="1"'));assert(sheet.includes('state="frozen"'));assert(sheet.includes('width="38"'));assert.equal((sheet.match(/#TEST-R1001/g)||[]).length,1);assert(sheet.includes('<v>350</v>')&&sheet.includes('<v>150</v>')&&sheet.includes('<v>200</v>'),'Excel totals match web cents exactly');assert(sheet.includes('s="4"'),'styled total row');assert(!sheet.includes('<f>'),'no user formulas');
 const attack=monthReportWorkbook({...report,clients:[{...client,name:'=1+1'}]});assert(strFromU8(unzipSync(attack)['xl/worksheets/sheet1.xml']).includes('=1+1'));
 await seed('legacy-settled',{payment:'monthly'});await f.db.prepare('INSERT INTO monthly_charges(order_id,user_id,month,amount,demo,settled) VALUES(?,?,?,?,0,1)').bind('legacy-settled','buyer','2026-10',11800).run();await f.db.prepare('INSERT INTO records(id,kind,user_id,data,created,updated) VALUES(?,?,?,?,?,?)').bind('legacy-payment','monthly_payment','buyer',JSON.stringify({order_ids:['legacy-settled'],payment_date:'2026-10-14',payment_method:'bank_transfer'}),stamp,stamp).run();const settled=(await request('admin/month-close?from=2026-10-14&to=2026-10-14')).orders[0];assert.equal(settled.id,'legacy-settled');assert.equal(settled.payment_label,'העברה בנקאית');
 const page=await f.request('/admin-month-close');assert.equal(page.status,200);assert(page.headers.get('x-robots-tag')?.includes('noindex'));
 console.log('ADMIN ORDER/REPORT PASS: exclusive monthly/closed/process SQL and domain classification; real paid transition; auth on JSON/XLSX; 1,005-row filtered export; cost snapshots/missing costs/writing/refunds; Israel boundaries; payment-vs-order dates; grouped client XLSX and exact totals; private report route.');
}finally{await f.mf.dispose();}
