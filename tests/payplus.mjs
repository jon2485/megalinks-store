// PayPlus card payments (owner 27.11.2026): link creation, callback signature, the second look-up at PayPlus, and
// the generic webhook path staying as it was. No network: PayPlus is a fake fetch here.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {realpathSync,mkdirSync,writeFileSync} from 'node:fs';
import {createHmac} from 'node:crypto';
const require=createRequire(realpathSync('node_modules/wrangler')+'/package.json');
mkdirSync('.sites-runtime/payplus',{recursive:true});
writeFileSync('.sites-runtime/payplus/workers.mjs','export const env=globalThis.__ppEnv;');
writeFileSync('.sites-runtime/payplus/server.mjs',`export class ApiError extends Error{constructor(status,message){super(message);this.status=status;}}
export const assert=(ok,message,status=400)=>{if(!ok)throw new ApiError(status,message);};
export const externalFetch=(...a)=>globalThis.__ppFetch(...a);
export const externalUrl=v=>{const u=new URL(String(v));if(u.protocol!=='https:')throw new ApiError(400,'bad url');return u;};
export const encrypt=async v=>v;`);
await require('esbuild').build({entryPoints:['lib/payment-gateway.ts'],outfile:'.sites-runtime/payplus/gateway.mjs',bundle:true,platform:'node',format:'esm',
 plugins:[{name:'stubs',setup(b){b.onResolve({filter:/^cloudflare:workers$/},()=>({path:realpathSync('.sites-runtime/payplus/workers.mjs')}));b.onResolve({filter:/^\.\/server$/},()=>({path:realpathSync('.sites-runtime/payplus/server.mjs')}));b.onResolve({filter:/^\.\/resend$/},()=>({path:'resend',namespace:'stub'}));b.onLoad({filter:/.*/,namespace:'stub'},()=>({contents:'export const RESEND_URL="";export const RESEND_TEST_FROM="";',loader:'js'}));}}]});
globalThis.__ppEnv={PAYPLUS_API_KEY:'test-api',PAYPLUS_SECRET_KEY:'test-secret',PAYPLUS_PAGE_UID:'page-123'};
const calls=[];let ipnAnswer;
globalThis.__ppFetch=async(url,init)=>{calls.push({url,init});
 if(url.endsWith('PaymentPages/generateLink'))return new Response(JSON.stringify({results:{status:'success',code:0},data:{page_request_uid:'req-1',payment_page_link:'https://payments.payplus.co.il/abc'}}),{status:200});
 if(url.endsWith('PaymentPages/ipn'))return new Response(JSON.stringify(ipnAnswer),{status:200});
 if(url==='https://hook.example.test/pay')return new Response(JSON.stringify({payment_url:'https://pay.example.test/x'}),{status:200});
 return new Response('{}',{status:404});};
const g=await import('../.sites-runtime/payplus/gateway.mjs');

// readiness
assert.equal(g.cardReady({enabled:true,provider:'payplus'}),true);
assert.equal(g.cardReady({enabled:false,provider:'payplus'}),false);
assert.equal(g.cardReady({enabled:true,url:'https://hook.example.test/pay',secret:'s'}),true);
assert.equal(g.cardReady({enabled:true,provider:'webhook'}),false);

// link: test environment, shekels, no PayPlus invoice, our callback and reference
const order={order_id:'order-1',amount_cents:12345,return_url:'https://site.test/order-confirmed/order-1',cancel_url:'https://site.test/wallet',callback_url:'https://site.test/api/payment-callback'};
const link=await g.gatewayPaymentUrl({provider:'payplus',enabled:true},'job',order,{name:'לקוח בדיקה',email:'buyer@example.test'});
assert.equal(link,'https://payments.payplus.co.il/abc');
let sent=calls.at(-1);assert.equal(sent.url,'https://restapidev.payplus.co.il/api/v1.0/PaymentPages/generateLink');
assert.equal(sent.init.headers['api-key'],'test-api');assert.equal(sent.init.headers['secret-key'],'test-secret');
let body=JSON.parse(sent.init.body);
assert.equal(body.amount,123.45);assert.equal(body.currency_code,'ILS');assert.equal(body.payment_page_uid,'page-123');assert.equal(body.initial_invoice,false);
assert.equal(body.more_info,'order-1');assert.equal(body.refURL_callback,'https://site.test/api/payplus/callback');assert.equal(body.customer.email,'buyer@example.test');
// live keys go to the live address
globalThis.__ppEnv.PAYPLUS_ENV='production';await g.gatewayPaymentUrl({provider:'payplus',enabled:true},'job',order,{});
assert.equal(calls.at(-1).url,'https://restapi.payplus.co.il/api/v1.0/PaymentPages/generateLink');assert.equal(JSON.parse(calls.at(-1).init.body).customer,undefined);
delete globalThis.__ppEnv.PAYPLUS_ENV;
// the original webhook is unchanged
assert.equal(await g.gatewayPaymentUrl({enabled:true,url:'https://hook.example.test/pay',secret:'s'},'job',order),'https://pay.example.test/x');
assert.equal(calls.at(-1).init.headers.Authorization,'Bearer s');

// callback: signature, charge only, second look-up must agree
const sign=raw=>createHmac('sha256','test-secret').update(raw).digest('base64');
const cb=(payload,{hash,ua='PayPlus'}={})=>{const raw=JSON.stringify(payload);return new Request('https://site.test/api/payplus/callback',{method:'POST',body:raw,headers:{'user-agent':ua,hash:hash??sign(raw)}});};
const charge={transaction_type:'Charge',transaction:{uid:'tx-0001-abcd',status_code:'000',amount:123.45,currency:'ILS',more_info:'order-1'}};
ipnAnswer={results:{status:'success'},data:{transaction:{uid:'tx-0001-abcd',status_code:'000',amount:123.45,currency:'ILS'}}};
const event=await g.payplusCallbackEvent(cb(charge));
assert.deepEqual(event,{status:'paid',currency:'ILS',event_id:'payplus:tx-0001-abcd',amount_cents:12345,order_id:'order-1'});
assert.equal(JSON.parse(calls.at(-1).init.body).transaction_uid,'tx-0001-abcd');
// a top-up reference becomes topup_id
const topup=await g.payplusCallbackEvent(cb({...charge,transaction:{...charge.transaction,more_info:'topup:u1:req12345'}}));assert.equal(topup.topup_id,'topup:u1:req12345');
const fails=async(req,status)=>{await assert.rejects(()=>g.payplusCallbackEvent(req),e=>e.status===status);};
await fails(cb(charge,{hash:sign('other')}),403);                  // wrong signature
await fails(cb(charge,{ua:'curl/8'}),403);                         // not from PayPlus
ipnAnswer={data:{transaction:{uid:'tx-0001-abcd',status_code:'000',amount:1,currency:'ILS'}}};
await fails(cb(charge),409);                                       // PayPlus says another amount
ipnAnswer={data:{transaction:{uid:'tx-0001-abcd',status_code:'006',amount:123.45,currency:'ILS'}}};
await fails(cb(charge),409);                                       // PayPlus says not approved
assert.equal(await g.payplusCallbackEvent(cb({...charge,transaction_type:'Refund'})),null); // nothing to do
assert.equal(await g.payplusCallbackEvent(cb({...charge,transaction:{...charge.transaction,status_code:'006'}})),null);
// no keys: refused
for(const k of Object.keys(globalThis.__ppEnv))delete globalThis.__ppEnv[k];await fails(cb(charge),403);assert.equal(g.cardReady({enabled:true,provider:'payplus'}),false);
console.log('PAYPLUS PASS: test/live address, shekel amount, no PayPlus invoice, callback signature + second look-up, refunds ignored, webhook unchanged');
