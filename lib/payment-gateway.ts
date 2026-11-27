import type {Row} from './shared';
import {ApiError,assert,externalFetch,externalUrl} from './server';
import {payplusEnvironment} from './integration-security';

// Card payments go to one of two providers (owner 27.11.2026):
//  - 'webhook' (the original generic connection): we POST create_payment to the saved URL with a Bearer secret and the
//    provider calls /api/payment-callback signed with that secret.
//  - 'payplus': PayPlus hosted payment page. The keys live only in Railway variables, one set per environment
//    (PAYPLUS_API_KEY, PAYPLUS_SECRET_KEY, PAYPLUS_PAGE_UID, and PAYPLUS_ENV=production for live keys; anything else
//    is the PayPlus test environment). PayPlus calls /api/payplus/callback; the callback is checked (signature) and the
//    transaction is checked again with PayPlus before anything is marked paid. Invoices stay with Green Invoice, so
//    PayPlus's own document is turned off on every link (initial_invoice:false).

export const payplusBase=(production:boolean)=>production?'https://restapi.payplus.co.il/api/v1.0/':'https://restapidev.payplus.co.il/api/v1.0/';
export const payplusConfigured=()=>{const p=payplusEnvironment();return !!(p.api_key&&p.secret_key&&p.page_uid);};
/** Card payment is available: the connection is on and its provider has what it needs. */
export const cardReady=(c:Row|null|undefined)=>!!(c?.enabled&&(c.provider==='payplus'?payplusConfigured():(c.url&&c.secret)));
const payplusHeaders=()=>{const p=payplusEnvironment();return {'api-key':p.api_key,'secret-key':p.secret_key,'Content-Type':'application/json'};};

/** The generic create_payment body every caller already builds; `payer` is who pays (shown on the PayPlus page). */
export type PaymentRequest={order_id:string;amount_cents:number;return_url:string;cancel_url:string;callback_url:string;purpose?:string;[k:string]:unknown};
export type Payer={name?:string;email?:string;phone?:string};

/** Asks the provider for a payment page and returns its address. Throws a clear Hebrew error otherwise. */
export async function gatewayPaymentUrl(c:Row,idempotency:string,body:PaymentRequest,payer:Payer={}):Promise<string>{
 if(c.provider!=='payplus'){
  const res=await externalFetch(c.url,{method:'POST',headers:{Authorization:'Bearer '+c.secret,'Content-Type':'application/json','Idempotency-Key':idempotency},body:JSON.stringify(body)});
  assert(res.ok,'ספק הסליקה דחה את הבקשה',502);
  const payload=await res.json() as Row;return externalUrl(payload.payment_url).href;
 }
 const p=payplusEnvironment();assert(payplusConfigured(),'חיבור PayPlus חסר מפתחות ב-Railway',503);
 assert(Number.isSafeInteger(body.amount_cents)&&body.amount_cents>0,'סכום אינו תקין');
 const email=String(payer.email||'').trim(),name=String(payer.name||'').trim().slice(0,100)||email;
 const request:Row={payment_page_uid:p.page_uid,charge_method:1,amount:body.amount_cents/100,currency_code:'ILS',language_code:'he',
  sendEmailApproval:false,sendEmailFailure:false,initial_invoice:false,create_token:false,
  refURL_success:body.return_url,refURL_failure:body.cancel_url,refURL_cancel:body.cancel_url,
  refURL_callback:new URL('/api/payplus/callback',body.callback_url).href,
  more_info:body.order_id,more_info_1:body.purpose||'order'};
 if(email)request.customer={customer_name:name,email,...(payer.phone?{phone:String(payer.phone).slice(0,30)}:{})};
 const res=await externalFetch(payplusBase(p.production)+'PaymentPages/generateLink',{method:'POST',headers:payplusHeaders(),body:JSON.stringify(request)});
 const payload=await res.json().catch(()=>({})) as Row;
 assert(res.ok&&payload?.data?.payment_page_link,'PayPlus לא החזיר דף תשלום. בדקו את המפתחות ואת מזהה דף התשלום',502);
 const url=externalUrl(payload.data.payment_page_link);assert(/(^|\.)payplus\.co\.il$/.test(url.hostname),'PayPlus החזיר כתובת לא צפויה',502);
 return url.href;
}

/** "בדיקת חיבור": PayPlus makes a ₪1 page in the current environment. Nothing is charged until someone pays it. */
export async function testPayplus(origin:string){
 const url=await gatewayPaymentUrl({provider:'payplus'},'test',{order_id:'connection-test',purpose:'test',amount_cents:100,return_url:origin+'/',cancel_url:origin+'/',callback_url:origin+'/'});
 return {ok:true,environment:payplusEnvironment().production?'production':'test',host:new URL(url).host};
}

async function hmacBase64(secret:string,message:string){
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const bytes=new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(message)));let s='';for(const b of bytes)s+=String.fromCharCode(b);return btoa(s);
}
const sameText=(a:string,b:string)=>{if(!a||a.length!==b.length)return false;let d=0;for(let i=0;i<a.length;i++)d|=a.charCodeAt(i)^b.charCodeAt(i);return d===0;};
const money=(v:unknown)=>{const n=Number(v);return Number.isFinite(n)?Math.round(n*100):NaN;};
// The IPN answer's layout is not documented; find the transaction object in it (the one with this uid, else the first
// object that carries a status_code).
function findTransaction(x:unknown,uid:string,depth=0):Row|null{
 if(!x||typeof x!=='object'||depth>6)return null;
 const o=x as Row;if(o.status_code!==undefined&&(o.uid===uid||o.transaction_uid===uid))return o;
 for(const v of Object.values(o)){const hit=findTransaction(v,uid,depth+1);if(hit)return hit;}
 return depth===0?findAny(o):null;
}
function findAny(x:unknown,depth=0):Row|null{if(!x||typeof x!=='object'||depth>6)return null;const o=x as Row;if(o.status_code!==undefined&&o.amount!==undefined)return o;for(const v of Object.values(o)){const hit=findAny(v,depth+1);if(hit)return hit;}return null;}

/**
 * A PayPlus callback, checked twice: the `hash` header (HMAC-SHA256 of the body with the secret key, base64) and a
 * fresh look-up of the same transaction at PayPlus. Returns the event in the generic shape the payment code already
 * uses, or null for a callback that is not a successful charge (nothing to do).
 */
export async function payplusCallbackEvent(r:Request):Promise<Row|null>{
 const raw=await r.text();assert(raw.length<200000,'הבקשה גדולה מדי',413);
 const p=payplusEnvironment();assert(p.secret_key&&p.api_key,'החיבור אינו פעיל',403);
 assert((r.headers.get('user-agent')||'').trim()==='PayPlus','בקשה לא מזוהה',403);
 let body:Row;try{body=JSON.parse(raw);}catch{throw new ApiError(400,'JSON לא תקין');}
 const sent=(r.headers.get('hash')||'').trim();
 // PayPlus's sample signs JSON.stringify(body); accept the raw body too. Both need the secret key.
 assert(sentDigest(sent,[await hmacBase64(p.secret_key,raw),await hmacBase64(p.secret_key,JSON.stringify(body))]),'חתימת תשלום לא תקינה',403);
 const t:Row=body.transaction||{};
 if(String(body.transaction_type||'').toLowerCase()!=='charge'||String(t.status_code)!=='000')return null;
 const uid=String(t.uid||'');assert(/^[\w-]{8,80}$/.test(uid),'אירוע התשלום אינו תקין');
 const check=await externalFetch(payplusBase(p.production)+'PaymentPages/ipn',{method:'POST',headers:payplusHeaders(),body:JSON.stringify({transaction_uid:uid})});
 const answer=await check.json().catch(()=>null);
 const found=check.ok?findTransaction(answer,uid):null;
 assert(found&&String(found.status_code)==='000'&&money(found.amount)===money(t.amount)&&String(found.currency||t.currency||'ILS')==='ILS','העסקה לא אומתה מול PayPlus',409);
 const reference=String(t.more_info||'').slice(0,200),amount_cents=money(t.amount);
 assert(reference&&Number.isSafeInteger(amount_cents)&&amount_cents>0,'אירוע התשלום אינו תקין');
 return {status:'paid',currency:'ILS',event_id:'payplus:'+uid,amount_cents,...(reference.startsWith('topup:')?{topup_id:reference}:{order_id:reference})};
}
const sentDigest=(sent:string,options:string[])=>options.some(o=>sameText(sent,o));
