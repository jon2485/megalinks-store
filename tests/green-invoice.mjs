// Green Invoice (owner 23.11.2026): a חשבונית מס/קבלה at once for a card payment (only the card part of a split), when the
// admin approves a bank transfer, and when a top-up is paid. A purchase from the balance gets none. Outgoing calls go to
// local stubs, never to morning. Fictional data only.
import assert from 'node:assert/strict';
import {createHmac,randomBytes,randomUUID} from 'node:crypto';
import {readFileSync,realpathSync,readdirSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(realpathSync('node_modules/wrangler')+'/package.json');
const {Miniflare}=require('miniflare');
const secret=randomBytes(32).toString('base64');
const tokens=[],docs=[];let docNumber=1000,failNext=0,paymentRequest;
const PDF=new TextEncoder().encode('%PDF-1.4 test document');
const mf=new Miniflare({outboundService:async request=>{const url=new URL(request.url);
  if(url.hostname==='payments.example.test'){paymentRequest=await request.json();return Response.json({payment_url:'https://payments.example.test/checkout'});}
  if(url.hostname==='api.sandbox.morning.dev'&&url.pathname==='/idp/v1/oauth/token'){const b=await request.json();tokens.push(b);return b.client_secret==='gi-secret'?Response.json({accessToken:'tok-1',expiresAt:Math.floor(Date.now()/1000)+3600}):Response.json({error:'invalid_client'},{status:401});}
  if(url.hostname==='sandbox.d.greeninvoice.co.il'&&url.pathname==='/api/v1/account/token')return Response.json({errorMessage:'bad'},{status:401});
  if(url.hostname==='sandbox.d.greeninvoice.co.il'&&url.pathname==='/api/v1/documents'){const b=await request.json();docs.push({body:b,auth:request.headers.get('authorization'),key:request.headers.get('idempotency-key')});
   if(failNext){failNext--;return Response.json({errorMessage:'שירות לא זמין'},{status:503});}
   const n=++docNumber;return Response.json({id:'doc-'+n,number:n,url:{he:'https://sandbox.d.greeninvoice.co.il/files/doc-'+n+'.pdf',origin:'https://sandbox.d.greeninvoice.co.il/files/doc-'+n+'.pdf'}});}
  if(url.hostname==='sandbox.d.greeninvoice.co.il'&&url.pathname.startsWith('/files/'))return new Response(PDF,{headers:{'Content-Type':'application/pdf'}});
  return new Response('reachable',{status:200});},
 modules:[{type:'ESModule',path:'dist/server/index.js'},...readdirSync('dist/server',{recursive:true}).filter(p=>/\.(m?js)$/.test(p)&&p!=='index.js').map(p=>({type:'ESModule',path:'dist/server/'+p}))],compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],r2Buckets:['BUCKET'],bindings:{SETTINGS_ENCRYPTION_KEY:secret,POSTFLOW_OWNER_EMAIL:'owner@example.test'},assets:{directory:'dist/client',binding:'ASSETS',routerConfig:{has_user_worker:true,invoke_user_worker_ahead_of_assets:true}},cf:false});
let checks=0;const check=(c,m)=>{assert(c,m);checks++;};
async function req(path,method='GET',body,user='owner',expected=200){if(path==='checkout'&&body)body={invoice_name:'חברת בדיקה בע״מ',...body};const headers={};if(user){headers['oai-authenticated-user-id']=user;headers['oai-authenticated-user-email']=user+'@example.test';}if(body!==undefined)headers['Content-Type']='application/json';const res=await mf.dispatchFetch('https://postflow.test/api/'+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});const ct=res.headers.get('Content-Type')||'';const out=ct.includes('json')?await res.json():new Uint8Array(await res.arrayBuffer());assert.equal(res.status,expected,`${method} ${path}: ${ct.includes('json')?JSON.stringify(out):''}`);checks++;return out;}
const gatewaySecret='gi-test-gateway';
const callback=async body=>{const raw=JSON.stringify(body);const res=await mf.dispatchFetch('https://postflow.test/api/payment-callback',{method:'POST',headers:{'Content-Type':'application/json','x-postflow-signature':createHmac('sha256',gatewaySecret).update(raw).digest('hex')},body:raw});assert.equal(res.status,200,await res.text());};
try{
 const db=await mf.getD1Database('DB');for(const m of readdirSync('drizzle').filter(x=>x.endsWith('.sql')).sort())for(const part of readFileSync('drizzle/'+m,'utf8').split('--> statement-breakpoint').map(x=>x.trim()).filter(Boolean))await db.prepare(part).run();
 for(const u of ['owner','buyer','banker','topper'])await req('me','GET',undefined,u);
 const site=(await req('admin/websites','POST',{name:'אתר בדיקה',url:'https://gi-site.example.com',category:'general',price_ils:200,cost_ils:100,procurement_verified:true})).id;
 await req('admin/integration/payments','PATCH',{enabled:true,url:'https://payments.example.test/create',secret:gatewaySecret});
 const prepare=async(user,payment,extra={})=>{await req('cart','POST',{website_id:site,topic:'נושא '+randomUUID().slice(0,6)},user,201);const q=await req('quote','POST',{},user);return {payment,phone:'0500000000',accepted:true,idempotency:randomUUID(),expected_total:q.total,pricing_token:q.pricing_token,...extra};};

 // Not connected yet: a card payment works and no document is attempted.
 let o0=await req('checkout','POST',await prepare('buyer','card'),'buyer',201);await req('orders/'+o0.id+'/payment-link','POST',{},'buyer');
 await callback({order_id:o0.id,status:'paid',currency:'ILS',event_id:'ev-off',amount_cents:paymentRequest.amount_cents});
 check(docs.length===0&&tokens.length===0,'no Green Invoice call while the connection is off');

 // Settings: id + secret, sandbox; the secret never comes back; enabling needs the id.
 await req('admin/integration/invoices','PATCH',{enabled:true,secret:'gi-secret',secret_storage:'encrypted_server',environment:'sandbox'},'owner',400);
 await req('admin/integration/invoices','PATCH',{enabled:true,username:'gi-id',secret:'gi-secret',secret_storage:'encrypted_server',environment:'sandbox'});
 const settings=await req('admin/settings');check(!JSON.stringify(settings).includes('gi-secret')&&settings.connections.invoices.environment==='sandbox'&&settings.connections.invoices.username==='gi-id','saved without exposing the secret');
 await req('admin/integration/invoices/test','POST',{});check(tokens.at(-1).grant_type==='client_credentials'&&tokens.at(-1).client_id==='gi-id','the test asks morning for a token with the API key');
 await req('admin/integration/invoices','PATCH',{secret:'wrong',secret_storage:'encrypted_server'});await req('admin/integration/invoices/test','POST',{},'owner',502);
 await req('admin/integration/invoices','PATCH',{secret:'gi-secret',secret_storage:'encrypted_server'});

 // 1) Card order: one document at once, for the amount charged, with the company name and ח.פ.
 const p1=await prepare('buyer','card',{company_id:'51-555 1234'});const o1=await req('checkout','POST',p1,'buyer',201);await req('orders/'+o1.id+'/payment-link','POST',{},'buyer');const charged=paymentRequest.amount_cents;
 await callback({order_id:o1.id,status:'paid',currency:'ILS',event_id:'ev-card-1',amount_cents:charged});
 check(docs.length===1,'one document for the card payment');let d=docs.at(-1).body;
 check(d.type===320&&d.lang==='he'&&d.currency==='ILS'&&d.attachment===false,'a Hebrew tax invoice-receipt in shekels, not e-mailed by morning');
 check(d.client.name==='חברת בדיקה בע״מ'&&d.client.taxId==='515551234'&&d.client.add===false&&!d.client.emails,'invoice name and the ח.פ, not added to morning\'s address book');
 check(d.payment.length===1&&d.payment[0].type===3&&Math.round(d.payment[0].price*100)===charged,'paid by credit card, the amount charged');
 check(d.income.every(l=>l.vatType===1)&&Math.round(d.income.reduce((s,l)=>s+l.price,0)*100)===charged&&d.income[0].description.includes('אתר בדיקה'),'one line with VAT included, the sites named, total = payment');
 check(docs.at(-1).auth==='Bearer tok-1'&&docs.at(-1).key==='greeninvoice:payment:ev-card-1','token and one idempotency key per payment');
 let order=(await req('orders/'+o1.id,'GET',undefined,'buyer')).order;check(order.invoice_file_id&&order.invoice_document_number==='1001'&&order.invoice_document_type==='invoice_receipt','the order holds the document like an attached one');
 const pdf=await req('orders/'+o1.id+'/invoice','GET',undefined,'buyer');check(new TextDecoder().decode(pdf.slice(0,4))==='%PDF','the customer downloads the signed PDF');
 const mail=await db.prepare("SELECT data FROM jobs WHERE id=?").bind('email:green-invoice:greeninvoice:payment:ev-card-1').first();check(mail&&JSON.parse(mail.data).attach_file_id===order.invoice_file_id&&JSON.parse(mail.data).to==='buyer@example.test','we e-mail the document to the customer');
 await callback({order_id:o1.id,status:'paid',currency:'ILS',event_id:'ev-card-1',amount_cents:charged});check(docs.length===1,'a repeated callback issues nothing more');

 // 2) A failure never blocks the payment; the admin issues it again, once.
 failNext=1;const o2=await req('checkout','POST',await prepare('buyer','card'),'buyer',201);await req('orders/'+o2.id+'/payment-link','POST',{},'buyer');
 await callback({order_id:o2.id,status:'paid',currency:'ILS',event_id:'ev-card-2',amount_cents:paymentRequest.amount_cents});
 check((await req('orders/'+o2.id,'GET',undefined,'buyer')).order.paid,'the order is paid even though the document failed');
 let jobs=(await req('admin/green-invoice?target='+o2.id)).jobs;check(jobs.length===1&&jobs[0].status==='failed'&&jobs[0].error.includes('שירות לא זמין'),'the admin sees the failure and its reason');
 await req('admin/green-invoice?target='+o2.id,'GET',undefined,'buyer',403);
 await req('admin/green-invoice/'+encodeURIComponent(jobs[0].id)+'/retry','POST',{});jobs=(await req('admin/green-invoice?target='+o2.id)).jobs;check(jobs[0].status==='succeeded'&&jobs[0].number==='1002','issued on retry');
 const before=docs.length;await req('admin/green-invoice/'+encodeURIComponent(jobs[0].id)+'/retry','POST',{});check(docs.length===before,'retrying a finished document issues nothing');

 // 3) Bank transfer: the document comes when the admin approves the payment.
 const o3=await req('checkout','POST',await prepare('banker','invoice'),'banker',201);const total=(await req('orders/'+o3.id,'GET',undefined,'banker')).order.total;const n3=docs.length;
 const report={confirmed_closure:true,payment_method:'bank_transfer',reference:'BANK-GI-1',payment_date:new Date().toISOString().slice(0,10),amount_ils:total/100,request_id:randomUUID()};
 await req('orders/'+o3.id+'/payment-report','POST',report,'banker');check(docs.length===n3,'no document while the transfer waits for approval');
 await req('admin/payment-reports/'+o3.id,'POST',{decision:'approve',confirmed:true,request_id:report.request_id});
 d=docs.at(-1).body;check(docs.length===n3+1&&d.payment[0].type===4&&Math.round(d.payment[0].price*100)===total&&d.payment[0].transactionId==='BANK-GI-1','approved transfer: a document paid by bank transfer, with the reference');
 check(!d.client.taxId,'no ח.פ given: none on the document');

 // 4) Top-ups: by card when the gateway confirms, by transfer when the admin approves. A purchase from the balance: nothing.
 const n4=docs.length;const t1=await req('wallet-topups','POST',{payment_method:'card',amount_cents:50000,request_id:'gi-topup-card-1'},'topper',201);
 await callback({topup_id:t1.id,status:'paid',currency:'ILS',event_id:'ev-topup-1',amount_cents:50000});
 d=docs.at(-1).body;check(docs.length===n4+1&&d.payment[0].type===3&&d.payment[0].price===500&&d.income[0].description.includes('הטענת יתרה'),'card top-up: one document for the amount loaded');
 await req('wallet-topups','POST',{amount_cents:30000,reference:'TOPUP-BANK-1',request_id:'gi-topup-bank-1',payment_date:new Date().toISOString().slice(0,10)},'topper',201);
 check(docs.length===n4+1,'a transfer top-up waits for approval');
 await req('wallet-topups/topup:topper:gi-topup-bank-1/approve','POST',{confirmed:true});
 d=docs.at(-1).body;check(docs.length===n4+2&&d.payment[0].type===4&&d.payment[0].price===300,'approved transfer top-up: a document for the amount loaded');
 const n5=docs.length;await req('checkout','POST',await prepare('topper','credits'),'topper',201);check(docs.length===n5,'a purchase from the balance gets no document');

 // A bad ח.פ is left out instead of failing the document.
 const o6=await req('checkout','POST',await prepare('buyer','card',{company_id:'abc12'}),'buyer',201);await req('orders/'+o6.id+'/payment-link','POST',{},'buyer');
 await callback({order_id:o6.id,status:'paid',currency:'ILS',event_id:'ev-card-6',amount_cents:paymentRequest.amount_cents});check(!docs.at(-1).body.client.taxId,'an invalid number is not sent');
 console.log('PASS green invoice documents:',checks,'checks');
}finally{await mf.dispose();}
