// Trash for abandoned orders (23.11.2026). Run after `pnpm build`: node tests/order-trash.mjs
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {readFileSync,realpathSync,readdirSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(realpathSync('node_modules/wrangler')+'/package.json'),{Miniflare}=require('miniflare');
const mf=new Miniflare({modules:[{type:'ESModule',path:'dist/server/index.js'},...readdirSync('dist/server',{recursive:true}).filter(p=>/\.(m?js)$/.test(p)&&p!=='index.js').map(p=>({type:'ESModule',path:'dist/server/'+p}))],compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],r2Buckets:['BUCKET'],bindings:{SETTINGS_ENCRYPTION_KEY:randomBytes(32).toString('base64'),POSTFLOW_OWNER_EMAIL:'owner@example.test'},assets:{directory:'dist/client',binding:'ASSETS',routerConfig:{has_user_worker:true,invoke_user_worker_ahead_of_assets:true}},cf:false});
let checks=0;const check=(v,m)=>{assert(v,m);checks++;};
async function req(path,method='GET',body,user='owner',expected=200){const res=await mf.dispatchFetch('https://postflow.test/api/'+path,{method,headers:{'Content-Type':'application/json','oai-authenticated-user-id':user,'oai-authenticated-user-email':user+'@example.test'},body:body===undefined?undefined:JSON.stringify(body)});const text=await res.text();let data;try{data=JSON.parse(text);}catch{data={text};}assert.equal(res.status,expected,path+' '+method+' '+text.slice(0,300));checks++;return data;}
try{
 const d=await mf.getD1Database('DB');for(const m of readdirSync('drizzle').filter(x=>x.endsWith('.sql')).sort())for(const part of readFileSync('drizzle/'+m,'utf8').split('--> statement-breakpoint').map(x=>x.trim()).filter(Boolean))await d.prepare(part).run();
 for(const user of ['owner','client','other'])await req('me','GET',undefined,user);
 const site=(await req('admin/websites','POST',{name:'Trash test',url:'https://trash.example.com',category:'general',price_ils:220,cost_ils:100})).id;
 await req('admin/credit-accounts','PATCH',{user_id:'client',enabled:true,limit_ils:10000});
 const purchase=async(payment,user='client')=>{await req('cart','POST',{website_id:site,topic:randomUUID()},user,201);const q=await req('quote','POST',{},user);const order=await req('checkout','POST',{payment,phone:'0500000000',invoice_name:'Client',accepted:true,idempotency:randomUUID(),pricing_token:q.pricing_token,expected_total:q.total},user,201);return {...order,total:q.total};};
 const age=(id,days)=>d.prepare('UPDATE orders SET created=? WHERE id=?').bind(new Date(Date.now()-days*864e5).toISOString(),id).run();
 // Fixtures: 3 abandoned, 1 fresh, 1 reported, 1 paid, 1 monthly, 1 abandoned with a cancel request.
 const a1=await purchase('invoice'),a2=await purchase('invoice'),a3=await purchase('invoice'),fresh=await purchase('invoice'),reported=await purchase('invoice'),paid=await purchase('invoice'),monthly=await purchase('monthly');
 await req('orders/'+reported.id+'/payment-report','POST',{confirmed_closure:true,payment_method:'bank_transfer',reference:'TRASH-REF-1',payment_date:new Date().toISOString().slice(0,10),amount_ils:reported.total/100,request_id:randomUUID()},'client');
 await req('orders/'+paid.id+'/paid','POST',{reference:'TRASH-PAID-1',payment_date:new Date().toISOString().slice(0,10),confirmed:true,expected_total:paid.total});
 for(const o of [a1,a2,a3,reported,paid,monthly])await age(o.id,20);await age(fresh.id,3);
 const listed=async(bucket,user)=>(await req('admin/orders?'+new URLSearchParams({bucket,page:'1',...(user?{user}:{})}))).orders.map(o=>o.id);
 const counts=async()=>(await req('admin/orders?bucket=all&page=1')).counts;
 const lanesBefore=await req('admin/control-center/updates?view=lanes');check(Number(lanesBefore.abandoned)===3,'lobby counter sees the three abandoned orders first: '+lanesBefore.abandoned);
 const invBefore=(await req('admin/invoices?status=all&all=1')).orders.map(o=>o.id);check(invBefore.includes(a1.id),'invoices list shows an unpaid order before');
 const alertsBefore=(await req('payment-alerts')).orders.map(o=>o.id);check(alertsBefore.includes(a1.id),'payment alerts show it before');
 const meBefore=await req('me','GET',undefined,'client');
 const before=await counts();check(before.abandoned===3,'three abandoned orders before: '+before.abandoned);check(Number(before.trash||0)===0,'trash empty at start');

 // Eligibility is checked on the server.
 for(const o of [fresh,reported,paid,monthly]){const out=await req('admin/orders/trash','POST',{ids:[o.id]},'owner',409);check(/נזנחה/.test(out.error||out.message||JSON.stringify(out)),'refusal explains the rule');}
 await req('admin/orders/trash','POST',{ids:[a1.id,fresh.id]},'owner',409);
 check((await listed('awaiting')).includes(a1.id),'a refused mixed request moves nothing');
 await req('admin/orders/trash','POST',{ids:[a1.id]},'client',403);
 await req('admin/orders/trash','GET',undefined,'owner',405);

 // One order.
 const one=await req('admin/orders/trash','POST',{ids:[a1.id]});check(one.trashed===1&&one.orders[0].id===a1.id,'single order moved');
 await req('admin/orders/trash','POST',{ids:[a1.id]},'owner',409);

 // Bulk: the count shown must still be true, then one request moves them all.
 await req('admin/orders/trash','POST',{all_abandoned:true,expected:5},'owner',409);
 const bulk=await req('admin/orders/trash','POST',{all_abandoned:true,expected:2});check(bulk.trashed===2,'bulk moved the two other abandoned orders');
 await req('admin/orders/trash','POST',{all_abandoned:true,expected:0},'owner',409);

 // Hidden from every admin list and count except the trash.
 const trashed=[a1.id,a2.id,a3.id];
 for(const bucket of ['all','active','attention','awaiting','abandoned','to_pay','process','cancel','reports'])check(!(await listed(bucket)).some(id=>trashed.includes(id)),'hidden from bucket '+bucket);
 check(!(await listed('all','client')).some(id=>trashed.includes(id)),'hidden from the customer file (admin)');
 const after=await counts();check(after.abandoned===0&&after.trash===3&&after.all===before.all-3&&after.awaiting===before.awaiting-3,'counts: '+JSON.stringify({before,after}));
 check((await listed('trash')).length===3&&(await listed('trash')).every(id=>trashed.includes(id)),'the trash lists exactly the trashed orders');
 const search=await req('admin/orders?bucket=all&page=1&q='+encodeURIComponent((await req('orders/'+a2.id)).order.number));check(search.total===0,'search does not find a trashed order');
 const lanes=await req('admin/control-center/updates?view=lanes');check(Number(lanes.abandoned||0)===0,'lobby "abandoned" counter leaves the trash out');
 const all=(await req('orders?scope=all')).orders.map(o=>o.id);check(!all.some(id=>trashed.includes(id)),'admin all-orders list leaves the trash out');
 const alerts=(await req('payment-alerts')).orders.map(o=>o.id);check(!alerts.some(id=>trashed.includes(id)),'payment alerts leave the trash out');
 const invoices=await req('admin/invoices?status=all&all=1');check(Array.isArray(invoices.orders)&&!invoices.orders.some(o=>trashed.includes(o.id)),'invoices list leaves the trash out');

 // The admin can still open it (read-only) and sees why.
 const opened=await req('orders/'+a2.id);check(!!opened.order.trashed_at&&opened.order.trashed_by==='owner','admin sees the trash mark');
 await req('orders/'+a2.id+'/paid','POST',{reference:'TRASH-PAID-2',payment_date:new Date().toISOString().slice(0,10),confirmed:true,expected_total:a2.total},'owner',409);

 // Gone for the customer.
 const mine=(await req('orders','GET',undefined,'client')).orders.map(o=>o.id);check(!mine.some(id=>trashed.includes(id)),'customer list leaves the trash out');
 const me=await req('me','GET',undefined,'client');check(me.counts.orders===mine.length&&me.counts.orders===meBefore.counts.orders-3,'customer order counter drops by three');
 await req('orders/'+a2.id,'GET',undefined,'client',404);
 await req('orders/'+a2.id+'/payment-report','GET',undefined,'client',404);
 await req('orders/'+a2.id+'/payment-report','POST',{confirmed_closure:true,payment_method:'bank_transfer',reference:'TRASH-REF-2',payment_date:new Date().toISOString().slice(0,10),amount_ils:a2.total/100,request_id:randomUUID()},'client',404);
 await req('orders/'+a2.id+'/payment-link','POST',{},'client',404);
 await req('orders/'+a2.id+'/statement.pdf','GET',undefined,'client',404);
 const arts=(await req('articles','GET',undefined,'client')).articles;check(!arts.some(a=>trashed.includes(a.order_id)),'customer articles of a trashed order are hidden');

 // Audit log.
 const logged=(await d.prepare("SELECT resource,action FROM activity WHERE action='הועברה לפח'").all()).results;check(logged.length===3&&trashed.every(id=>logged.some(l=>l.resource===id)),'one audit line per trashed order');

 // Restore brings it back exactly.
 await req('admin/orders/restore','POST',{id:fresh.id},'owner',409);
 await req('admin/orders/restore','POST',{id:a2.id},'client',403);
 const back=await req('admin/orders/restore','POST',{id:a2.id});check(back.restored===1,'restored');
 await req('admin/orders/restore','POST',{id:a2.id},'owner',409);
 check((await listed('abandoned')).includes(a2.id)&&!(await listed('trash')).includes(a2.id),'back in the abandoned list, out of the trash');
 check((await req('orders','GET',undefined,'client')).orders.some(o=>o.id===a2.id),'back for the customer');
 await req('orders/'+a2.id,'GET',undefined,'client');
 const raw=(await d.prepare('SELECT data FROM orders WHERE id=?').bind(a2.id).first()).data;check(!('trashed_at' in JSON.parse(raw))&&!('trashed_by' in JSON.parse(raw)),'restore removes the mark');
 check((await d.prepare("SELECT COUNT(*) AS n FROM activity WHERE action='שוחזרה מהפח' AND resource=?").bind(a2.id).first()).n===1,'restore is logged');
 const final=await counts();check(final.trash===2&&final.abandoned===1,'counts after restore');
 // A split order (part balance, part card) reserves balance. In the trash the reservation is released; restore
 // needs that money to still be free.
 await d.prepare('UPDATE users SET credits=10000 WHERE id=?').bind('client').run();
 // (the card side needs a payment provider, so the split is written straight to the local test database)
 const split=await purchase('invoice');await age(split.id,20);
 await d.prepare("UPDATE orders SET payment='credits_card',status='pending',data=json_set(data,'$.wallet_amount',5000,'$.card_amount',total-5000) WHERE id=?").bind(split.id).run();
 const wallet=JSON.parse((await d.prepare('SELECT data FROM orders WHERE id=?').bind(split.id).first()).data).wallet_amount;
 check(wallet>0,'split order reserves part of the balance: '+wallet);
 const avail=async()=>(await req('me','GET',undefined,'client')).user.credits_available;
 const held=await avail();await req('admin/orders/trash','POST',{ids:[split.id]});
 check(await avail()===held+wallet,'trash releases the reservation');
 await d.prepare('UPDATE users SET credits=credits-? WHERE id=?').bind(10000-wallet+1,'client').run();
 await req('admin/orders/restore','POST',{id:split.id},'owner',409);
 await d.prepare('UPDATE users SET credits=10000 WHERE id=?').bind('client').run();
 await req('admin/orders/restore','POST',{id:split.id});check(await avail()===10000-wallet,'restore reserves it again');
 // Nothing is ever deleted.
 check((await d.prepare('SELECT COUNT(*) AS n FROM orders WHERE id IN (?,?,?)').bind(...trashed).first()).n===3,'orders still exist');
 console.log('ORDER TRASH PASSED: '+checks+' checks: eligibility re-checked on the server, single and bulk (one request), hidden from admin lists/counts/search/lobby/alerts/invoices and from the customer (list, counter, order, payment report, payment link, statement, articles), read-only for the admin, audit lines, restore, split-order balance released and re-checked.');
}finally{await mf.dispose();}
