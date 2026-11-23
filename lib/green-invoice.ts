// Green Invoice (morning) API (owner 23.11.2026: "חיבור לחשבונית ירוקה").
// Auth: OAuth 2.0 client credentials (API key id + secret from the morning account → a 1-hour access token); older
// accounts still answer the legacy /account/token call, so that is tried when the new identity server refuses.
// Documents: POST /v1/documents. Type 320 = חשבונית מס/קבלה. Payment type 3 = credit card, 4 = bank transfer.
import {externalFetch,assert} from './server';
import type {Row} from './shared';

export const GI_DOC_TAX_INVOICE_RECEIPT=320;
export const GI_PAYMENT={card:3,bank:4} as const;
type Env='live'|'sandbox';
const API:Record<Env,string>={live:'https://api.greeninvoice.co.il/api/v1',sandbox:'https://sandbox.d.greeninvoice.co.il/api/v1'};
const IDP:Record<Env,string>={live:'https://api.morning.co/idp/v1/oauth/token',sandbox:'https://api.sandbox.morning.dev/idp/v1/oauth/token'};
export const giEnvironment=(c:Row):Env=>c.environment==='sandbox'?'sandbox':'live';

// The token lives in the worker's memory only (never stored), refreshed a minute before it ends.
let cached:{key:string;token:string;until:number}|null=null;
export function resetGreenInvoiceToken(){cached=null;}

async function readJson(res:Response){try{return await res.json() as Row;}catch{return {} as Row;}}
const errorText=(body:Row,status:number)=>String(body?.errorMessage||body?.message||body?.error_description||body?.error||('HTTP '+status)).slice(0,300);

export async function greenInvoiceToken(c:Row):Promise<string>{
 const env=giEnvironment(c),id=String(c.username||'').trim(),secret=String(c.secret||'').trim();
 assert(id&&secret,'חסרים מזהה וסוד של מפתח ה-API של חשבונית ירוקה',503);
 const key=env+':'+id;if(cached&&cached.key===key&&Date.now()<cached.until)return cached.token;
 let res=await externalFetch(IDP[env],{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({grant_type:'client_credentials',client_id:id,client_secret:secret})});
 let body=await readJson(res),token=String(body.accessToken||body.access_token||'');let until=Number(body.expiresAt)*1000;
 if(!res.ok||!token){
  const legacy=await externalFetch(API[env]+'/account/token',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,secret})});
  const lb=await readJson(legacy);if(legacy.ok&&lb.token){token=String(lb.token);until=Number(lb.expires)*1000;res=legacy;body=lb;}
 }
 assert(token,'חשבונית ירוקה דחתה את מפתח ה-API: '+errorText(body,res.status),502);
 if(!Number.isFinite(until)||until<Date.now())until=Date.now()+55*60*1000;
 cached={key,token,until:until-60*1000};return token;
}

export type GiDocumentInput={description:string;client:{name:string;taxId?:string};lines:{description:string;amount_cents:number}[];payment:{type:number;amount_cents:number;date:string;reference?:string};remarks?:string};
export type GiCreated={id:string;number:string;url:string};

// Prices are what the customer paid, VAT included (income vatType 1), so the document total always equals the money
// received. The client is not added to the morning address book, and morning does not e-mail the document: we send it,
// so Staging's test inbox still holds every message.
export function documentBody(input:GiDocumentInput):Row{
 const money=(c:number)=>Math.round(c)/100;
 return {
  type:GI_DOC_TAX_INVOICE_RECEIPT,lang:'he',currency:'ILS',vatType:0,signed:true,rounding:false,attachment:false,
  description:input.description.slice(0,200),...(input.remarks?{remarks:input.remarks.slice(0,1000)}:{}),
  client:{name:input.client.name.slice(0,200)||'לקוח',...(input.client.taxId?{taxId:input.client.taxId}:{}),add:false},
  income:input.lines.map(l=>({description:l.description.slice(0,200),quantity:1,price:money(l.amount_cents),currency:'ILS',vatType:1})),
  payment:[{type:input.payment.type,price:money(input.payment.amount_cents),currency:'ILS',date:input.payment.date,...(input.payment.reference?{transactionId:input.payment.reference.slice(0,100)}:{})}],
 };
}

export async function createGreenInvoiceDocument(c:Row,input:GiDocumentInput,idempotency:string):Promise<GiCreated>{
 const lineSum=input.lines.reduce((s,l)=>s+l.amount_cents,0);
 assert(lineSum===input.payment.amount_cents&&lineSum>0,'סכום החשבונית אינו תואם לתשלום',409);
 const token=await greenInvoiceToken(c);
 const res=await externalFetch(API[giEnvironment(c)]+'/documents',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json','Idempotency-Key':idempotency},body:JSON.stringify(documentBody(input))});
 const body=await readJson(res);
 if(res.status===401)resetGreenInvoiceToken();
 assert(res.ok&&body.id,'חשבונית ירוקה לא הפיקה את המסמך: '+errorText(body,res.status),502);
 const url=String(body.url?.he||body.url?.origin||'');
 return {id:String(body.id),number:String(body.number??''),url};
}

// The signed PDF of a created document (its link from the create response). Only https links of morning's hosts.
const pdfHost=(u:URL)=>u.protocol==='https:'&&/(^|\.)(greeninvoice\.co\.il|morning\.co|morning\.dev|amazonaws\.com|cloudfront\.net)$/.test(u.hostname);
export async function greenInvoicePdf(url:string):Promise<Uint8Array|null>{
 let u:URL;try{u=new URL(url);}catch{return null;}
 // The link may redirect to the file's storage; up to two hops, each one checked like the first.
 let res:Response|null=null;
 for(let hop=0;hop<3;hop++){
  if(!pdfHost(u))return null;
  try{res=await fetch(u.href,{redirect:'manual',signal:AbortSignal.timeout(30000)});}catch{return null;}
  if(res.status>=300&&res.status<400){const next=res.headers.get('location');if(!next)return null;try{u=new URL(next,u);}catch{return null;}res=null;continue;}
  break;
 }
 if(!res||!res.ok)return null;
 const bytes=new Uint8Array(await res.arrayBuffer());
 return bytes.length>4&&bytes.length<=15*1024*1024&&new TextDecoder().decode(bytes.slice(0,4))==='%PDF'?bytes:null;
}

// "ח.פ / ת.ז": digits only, 5-9 of them (company, dealer or personal number). Anything else is left out of the document.
export function cleanTaxId(v:unknown){const d=String(v||'').replace(/[\s-]/g,'');return /^\d{5,9}$/.test(d)?d:'';}
