import assert from 'node:assert/strict';
import {createHmac,randomBytes} from 'node:crypto';
import { readFileSync, realpathSync,readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
const require=createRequire(realpathSync('node_modules/wrangler')+'/package.json');
const {Miniflare}=require('miniflare');
const secret=randomBytes(32).toString('base64');
let paymentRequest;
const mf=new Miniflare({outboundService:async request=>{const url=new URL(request.url);if(url.hostname==='payments.example.test'){paymentRequest=await request.json();return Response.json({payment_url:'https://payments.example.test/checkout'});}return new Response('reachable',{status:200});},modules:[{type:'ESModule',path:'dist/server/index.js'},...readdirSync('dist/server',{recursive:true}).filter(p=>/\.(m?js)$/.test(p)&&p!=='index.js').map(p=>({type:'ESModule',path:'dist/server/'+p}))],compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],r2Buckets:['BUCKET'],bindings:{SETTINGS_ENCRYPTION_KEY:secret,POSTFLOW_OWNER_EMAIL:'owner@example.test'},assets:{directory:'dist/client',binding:'ASSETS',routerConfig:{has_user_worker:true,invoke_user_worker_ahead_of_assets:true}},cf:false});
let checks=0;const check=(test,msg)=>{assert(test,msg);checks++};
async function req(path,method='GET',body,user='owner',expected=200){if(path==='checkout'&&body)body={invoice_name:'בדיקת חשבונית',...body};const headers={};if(user){headers['oai-authenticated-user-id']=user;headers['oai-authenticated-user-email']=user+'@example.test';}if(body!==undefined)headers['Content-Type']='application/json';const res=await mf.dispatchFetch('https://postflow.test/api/'+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});const contentType=res.headers.get('Content-Type')||'';const out=contentType.includes('json')?await res.json():await res.arrayBuffer();assert.equal(res.status,expected,`${method} ${path}: ${JSON.stringify(out)}`);checks++;return out;}

// A signed provider callback for money that cannot be applied to its order is recorded once for the admin,
// never credited and never dropped. Fictional data only; the payment provider is a local stub.
try{
const database=await mf.getD1Database('DB');for(const migration of readdirSync('drizzle').filter(x=>x.endsWith('.sql')).sort())for(const part of readFileSync('drizzle/'+migration,'utf8').split('--> statement-breakpoint').map(x=>x.trim()).filter(Boolean))await database.prepare(part).run();
const sql=async(text,...args)=>(await database.prepare(text).bind(...args).all()).results;
const snapshot=async()=>JSON.stringify({ledger:await sql('SELECT id,user_id,amount,reason,reference FROM ledger ORDER BY id'),credits:await sql('SELECT id,credits FROM users ORDER BY id'),orders:await sql('SELECT id,paid,status,total,data,updated FROM orders ORDER BY id'),applied:await sql("SELECT id FROM records WHERE kind IN ('payment_event','payment_completion') ORDER BY id")});
const unapplied=()=>sql("SELECT id,user_id,data FROM records WHERE kind='payment_unapplied' ORDER BY created,id");
const auditLines=text=>sql('SELECT resource,action,data FROM activity WHERE action LIKE ?','%'+text+'%');
for(const u of ['owner','buyer','other'])await req('me','GET',undefined,u);
const site=(await req('admin/websites','POST',{name:'card-site',url:'https://card-site.example.com',category:'general',price_ils:220,cost_ils:100,procurement_verified:true})).id;
const gatewaySecret='unapplied-test-secret';await req('admin/integration/payments','PATCH',{enabled:true,url:'https://payments.example.test/create',secret:gatewaySecret});
const buy=async(user,topics,payment='card')=>{for(const topic of topics)await req('cart','POST',{website_id:site,topic},user,201);const q=await req('quote','POST',{},user);return req('checkout','POST',{payment,phone:'0500000000',accepted:true,idempotency:crypto.randomUUID(),expected_total:q.total,pricing_token:q.pricing_token},user,201);};
const callback=async(body,expected=200,valid=true)=>{const raw=JSON.stringify(body),res=await mf.dispatchFetch('https://postflow.test/api/payment-callback',{method:'POST',headers:{'Content-Type':'application/json','x-postflow-signature':valid?createHmac('sha256',gatewaySecret).update(raw).digest('hex'):'bad'},body:raw});const out=await res.json();assert.equal(res.status,expected,JSON.stringify(out));checks++;return out;};
const paid={status:'paid',currency:'ILS'};

// 1. The normal path is unchanged: one signed event with the right amount settles the order, and its repeat is a duplicate.
const order=await buy('buyer',['normal payment']);check(order.payment_required&&order.card_amount===25960,'card order asks for the full amount');
await req('orders/'+order.id+'/payment-link','POST',{},'buyer');check(paymentRequest.amount_cents===25960,'the link asks for the order total');
const first={...paid,order_id:order.id,event_id:'link-one',amount_cents:25960};
check(JSON.stringify(await callback(first))==='{"ok":true}','a normal payment answers ok only');
check((await req('orders/'+order.id,'GET',undefined,'buyer')).order.paid===1,'the normal payment settles the order');
check((await auditLines('תשלום אומת באמצעות הספק')).length===1&&(await unapplied()).length===0,'the normal payment writes the usual audit line and no unapplied record');
check((await callback(first)).duplicate===true&&(await unapplied()).length===0,'a repeat of the applied event is a duplicate and records nothing');
check((await req('me')).counts.payments===0,'nothing waits for the admin after a normal payment');

// 2. A second link of the same order is paid too: recorded once, nothing credited, the order untouched, 200 unapplied.
const before=await snapshot();
const second={...paid,order_id:order.id,event_id:'link-two',amount_cents:25960};
const answer=await callback(second);check(answer.ok===true&&answer.unapplied===true,'a new payment on a paid order answers 200 unapplied');
check(await snapshot()===before,'no ledger line, no credit change, no order change, no payment record');
let rows=await unapplied();check(rows.length===1&&rows[0].id==='payment-unapplied:link-two'&&rows[0].user_id==='buyer','one record, keyed by the provider event id');
const stored=JSON.parse(rows[0].data);check(stored.order_id===order.id&&stored.order_number===(await req('orders/'+order.id)).order.number&&stored.user_id==='buyer'&&stored.amount_cents===25960&&stored.event_id==='link-two'&&stored.reason==='order_already_paid'&&stored.status==='open','the record holds order, customer, amount, event and reason');
let lines=await auditLines('על הזמנה שכבר שולמה');check(lines.length===1&&lines[0].action==='התקבל תשלום בכרטיס על הזמנה שכבר שולמה. הסכום לא זוכה, נדרש טיפול'&&lines[0].resource!==order.id,'accurate audit line, not attached to the order');
check((await auditLines('תשלום אומת באמצעות הספק')).length===1,'the unapplied payment is not reported as a verified payment');

// 3. The same event again: nothing new at all.
const again=await callback(second);check(again.ok===true&&again.duplicate===true&&!again.unapplied,'a repeat of the unapplied event answers duplicate');
check((await unapplied()).length===1&&(await auditLines('על הזמנה שכבר שולמה')).length===1&&await snapshot()===before,'the repeat writes no record, no audit line and moves no money');
await callback({...second,event_id:'link-two-forged'},403,false);check((await unapplied()).length===1,'an unsigned callback records nothing');

// 4. The admin sees it; the customer sees nothing.
check((await req('me')).counts.payments===1&&(await req('me','GET',undefined,'buyer')).counts.payments===0,'the admin bell counts it, the customer bell does not');
let list=await req('admin/unapplied-payments');check(list.count===1&&list.payments[0].user_name&&list.payments[0].number&&list.payments[0].amount_cents===25960&&list.payments[0].created&&list.payments[0].reason_label==='ההזמנה כבר שולמה','the admin list shows customer, order number, amount, date and reason');
let tasks=(await req('admin/control-center/updates?view=tasks')).tasks;check(tasks.unapplied?.total===1&&tasks.unapplied.lane==='urgent'&&tasks.unapplied.rows[0].page==='admin-order/'+order.id&&tasks.unapplied.rows[0].amount===25960,'the lobby lists it under urgent work');
const countBefore=(await req('admin/control-center')).attention_counts.admin;check(countBefore>=1,'the lobby badge counts it');
await req('admin/control-center/updates','POST',{id:tasks.unapplied.rows[0].id,version:tasks.unapplied.rows[0].version},'owner',409);check((await req('admin/control-center/updates?view=tasks')).tasks.unapplied?.total===1,'it cannot be dismissed without a note');
await req('admin/unapplied-payments','GET',undefined,'buyer',403);await req('admin/unapplied-payments/handle','POST',{id:rows[0].id,note:'not allowed'},'buyer',403);
await req('records/payment_unapplied','GET',undefined,'buyer',400);await req('records/payment_unapplied','GET',undefined,'owner',400);
const seen=JSON.stringify([await req('orders/'+order.id,'GET',undefined,'buyer'),await req('orders','GET',undefined,'buyer'),await req('credits','GET',undefined,'buyer'),await req('me','GET',undefined,'buyer')]);
check(!seen.includes('link-two')&&!seen.includes('unapplied')&&!seen.includes('לא זוכה'),'nothing about the unapplied payment reaches the customer');
check((await req('orders/'+order.id,'GET',undefined,'other',403)).error,'another customer cannot open the order at all');

// 5. Marking it handled needs a note, is audited, happens once, and moves no money.
await req('admin/unapplied-payments/handle','POST',{id:rows[0].id,note:' '},'owner',400);await req('admin/unapplied-payments/handle','POST',{id:'payment-unapplied:missing',note:'checked'},'owner',404);
await req('admin/unapplied-payments/handle','POST',{id:rows[0].id,note:'הוחזר ללקוח בכרטיס'});
rows=await unapplied();const closed=JSON.parse(rows[0].data);check(closed.status==='handled'&&closed.note==='הוחזר ללקוח בכרטיס'&&closed.handled_by==='owner'&&closed.handled_at,'handled with the note and who closed it');
lines=await auditLines('סומן כטופל');check(lines.some(l=>l.resource===rows[0].id&&JSON.parse(l.data).note==='הוחזר ללקוח בכרטיס'),'marking handled is audited with the note');
await req('admin/unapplied-payments/handle','POST',{id:rows[0].id,note:'שוב'},'owner',409);
check((await req('admin/unapplied-payments')).count===0&&(await req('me')).counts.payments===0&&!(await req('admin/control-center/updates?view=tasks')).tasks.unapplied,'handled items leave the list, the bell and the lobby');
check(await snapshot()===before,'marking handled moves no money');
check((await callback(second)).duplicate===true&&JSON.parse((await unapplied())[0].data).status==='handled','a late repeat of a handled event does not reopen it');

// 6. An old link paid after the order was settled from the wallet alone (the card part dropped to zero).
await req('credits','POST',{user_id:'other',amount:300,reason:'test',reference:'unapplied-wallet'});
const split=await buy('other',['split a','split b'],'credits');check(split.wallet_amount===30000&&split.card_amount===21920,'wallet and card order');
await req('orders/'+split.id+'/payment-link','POST',{},'other');check(paymentRequest.amount_cents===21920,'the link asks for the card part');
const item=(await req('orders/'+split.id,'GET',undefined,'other')).articles[0];await req('admin/customer-account/other/refund','POST',{article_id:item.id,version:item.version,mode:'full'});
check((await req('orders/'+split.id,'GET',undefined,'other')).order.paid===1&&(await req('credits','GET',undefined,'other')).balance===4040,'the wallet part alone settles what is left');
const walletBefore=await snapshot();
check((await callback({...paid,order_id:split.id,event_id:'old-link',amount_cents:21920})).unapplied===true,'the old link paid later is recorded, not applied');
check(await snapshot()===walletBefore&&(await req('credits','GET',undefined,'other')).balance===4040,'the wallet and the ledger do not move');
list=await req('admin/unapplied-payments');check(list.count===1&&list.payments[0].event_id==='old-link'&&list.payments[0].amount_cents===21920&&list.payments[0].reason==='order_already_paid','the admin sees the old link payment');

// 7. A wrong amount on an unpaid order is still refused with 409, and is recorded for the admin.
const open=await buy('buyer',['amount mismatch']);await req('orders/'+open.id+'/payment-link','POST',{},'buyer');
const mismatchBefore=await snapshot();
await callback({...paid,order_id:open.id,event_id:'wrong-amount',amount_cents:40000},409);await callback({...paid,order_id:open.id,event_id:'wrong-amount',amount_cents:40000},409);
check(await snapshot()===mismatchBefore&&(await req('orders/'+open.id,'GET',undefined,'buyer')).order.paid===0,'a wrong amount applies nothing and the order stays unpaid');
rows=(await unapplied()).filter(r=>r.id==='payment-unapplied:wrong-amount');check(rows.length===1&&JSON.parse(rows[0].data).reason==='amount_mismatch'&&JSON.parse(rows[0].data).amount_cents===40000,'the wrong amount is recorded once');
check((await auditLines('בסכום שאינו תואם להזמנה')).length===1&&(await req('admin/unapplied-payments')).count===2,'one audit line, and it waits for the admin');
// The right amount still settles the order as before.
check(JSON.stringify(await callback({...paid,order_id:open.id,event_id:'right-amount',amount_cents:25960}))==='{"ok":true}'&&(await req('orders/'+open.id,'GET',undefined,'buyer')).order.paid===1,'the right amount settles the order as before');

// 8. A paid link of a cancelled order: still 409, and recorded.
const gone=await buy('buyer',['cancelled order']);await req('orders/'+gone.id+'/payment-link','POST',{},'buyer');await req('orders/'+gone.id+'/cancel','POST',{reason:'cancelled by the admin'});
const goneBefore=await snapshot();
await callback({...paid,order_id:gone.id,event_id:'cancelled-link',amount_cents:25960},409);
rows=(await unapplied()).filter(r=>r.id==='payment-unapplied:cancelled-link');check(rows.length===1&&JSON.parse(rows[0].data).reason==='order_not_payable'&&await snapshot()===goneBefore,'a charge on a cancelled order is recorded and nothing is applied');
await callback({...paid,order_id:'no-such-order',event_id:'no-order',amount_cents:100},409);check(!(await unapplied()).some(r=>r.id==='payment-unapplied:no-order'),'an unknown order has nothing to attach to and stays a plain refusal');
// A provider retry of the event that paid an order, after that order was cancelled, is not a new charge.
await database.prepare("UPDATE orders SET status='cancelled' WHERE id=?").bind(open.id).run();await callback({...paid,order_id:open.id,event_id:'right-amount',amount_cents:25960},409);
check(!(await unapplied()).some(r=>r.id==='payment-unapplied:right-amount'),'a retry of an applied event is never recorded as unapplied');
console.log('PASS unapplied card payments:',checks,'checks');
}finally{await mf.dispose();}
