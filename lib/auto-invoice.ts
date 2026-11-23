// Automatic documents from Green Invoice (owner 23.11.2026):
// - an order paid by card: a חשבונית מס/קבלה at once, for the amount charged (with balance+card, only the card part:
//   the balance was already invoiced when it was loaded);
// - an order paid by bank transfer: when the admin approves the payment;
// - a balance top-up (card or approved transfer): a חשבונית מס/קבלה for the amount loaded. A purchase from the balance
//   gets no further document; the profit is counted at the purchase, inside the system only.
// The document carries the company or customer name and the ח.פ / ת.ז when the customer gave one.
// Each payment has one job (`greeninvoice:<payment event>`), so a retried callback or a second click never issues twice.
// A failure never blocks the payment: the job keeps the reason and the admin can issue it again from the order.
import {env} from 'cloudflare:workers';
import {one,all,stmt,now,uid,connection,audit} from './server';
import type {Row} from './shared';
import {createGreenInvoiceDocument,greenInvoicePdf,cleanTaxId,GI_PAYMENT,type GiDocumentInput} from './green-invoice';
import {queueMail} from './mail';

export type InvoiceSpec={kind:'order'|'topup';target:string;user_id:string;method:'card'|'bank';amount_cents:number;reference?:string;split?:boolean};
const israelDay=(d=new Date())=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jerusalem',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
const shekel=(c:number)=>'₪'+(c/100).toLocaleString('he-IL',{minimumFractionDigits:2,maximumFractionDigits:2});

export async function invoicesReady(){const c=await connection('invoices');return {c,ready:!!(c.enabled&&c.username&&c.secret)};}

async function documentInput(spec:InvoiceSpec):Promise<{input:GiDocumentInput;email:string;demo:boolean;label:string}|null>{
 const payment={type:GI_PAYMENT[spec.method],amount_cents:spec.amount_cents,date:israelDay(),...(spec.reference?{reference:spec.reference}:{})};
 if(spec.kind==='order'){
  const o=await one('SELECT o.id,o.number,o.data,u.email,u.name AS user_name,u.company AS user_company FROM orders o JOIN users u ON u.id=o.user_id WHERE o.id=?',spec.target);if(!o)return null;
  const d=JSON.parse(o.data||'{}');
  const sites=(await all("SELECT DISTINCT w.name FROM articles a JOIN websites w ON w.id=a.website_id WHERE a.order_id=? AND a.status<>'cancelled' ORDER BY w.name",o.id)).map((r:Row)=>String(r.name));
  const what='הזמנה '+o.number+': פרסום כתבות'+(sites.length?' באתרים '+sites.join(', '):'');
  return {demo:!!d.demo,email:String(o.email||''),label:'הזמנה '+o.number,input:{
   description:'הזמנה '+o.number,
   client:{name:String(d.invoice_name||d.company||o.user_company||d.name||o.user_name||''),taxId:cleanTaxId(d.company_id)},
   lines:[{description:spec.split?'השלמת תשלום באשראי ל'+what+' (יתר הסכום שולם מהיתרה)':what,amount_cents:spec.amount_cents}],
   payment}};
 }
 const r=await one("SELECT r.id,r.data,u.email,u.name,u.company FROM records r JOIN users u ON u.id=r.user_id WHERE r.id=? AND r.kind='wallet_topup'",spec.target);if(!r)return null;
 const last=await one("SELECT json_extract(data,'$.company_id') AS company_id FROM orders WHERE user_id=? AND COALESCE(json_extract(data,'$.company_id'),'')<>'' ORDER BY created DESC LIMIT 1",spec.user_id);
 return {demo:false,email:String(r.email||''),label:'הטענת יתרה',input:{
  description:'הטענת יתרה',client:{name:String(r.company||r.name||''),taxId:cleanTaxId(last?.company_id)},
  lines:[{description:'הטענת יתרה לחשבון Mega Links',amount_cents:spec.amount_cents}],payment}};
}

export async function issueInvoice(jobId:string,spec:InvoiceSpec,origin=''):Promise<Row>{
 if(!(spec.amount_cents>0))return {status:'skipped'};
 const {c,ready}=await invoicesReady();if(!ready)return {status:'off'};
 await stmt("INSERT OR IGNORE INTO jobs(id,user_id,kind,status,data,created,updated) VALUES (?,?,'green_invoice','requested',?,?,?)",jobId,spec.user_id,JSON.stringify({...spec,origin}),now(),now()).run();
 const claim=await stmt("UPDATE jobs SET status='writing',updated=? WHERE id=? AND status IN ('requested','failed')",now(),jobId).run();
 if(!claim.meta.changes)return {status:(await one('SELECT status FROM jobs WHERE id=?',jobId))?.status||'writing'};
 try{
  const built=await documentInput(spec);if(!built)throw new Error(spec.kind==='order'?'ההזמנה לא נמצאה':'בקשת ההטענה לא נמצאה');
  if(built.demo){await stmt("UPDATE jobs SET status='demo',updated=? WHERE id=?",now(),jobId).run();return {status:'demo'};}
  const doc=await createGreenInvoiceDocument(c,built.input,jobId);
  // Keep a copy of the signed PDF with the order, like a document the admin attaches by hand.
  let fileId='';const pdf=doc.url?await greenInvoicePdf(doc.url).catch(()=>null):null;
  if(pdf&&(env as any).BUCKET){fileId=uid();const key='green-invoice/'+fileId;await (env as any).BUCKET.put(key,pdf,{httpMetadata:{contentType:'application/pdf'}});
   await stmt('INSERT INTO files(id,user_id,name,type,size,key,created) VALUES (?,?,?,?,?,?,?)',fileId,spec.user_id,'חשבונית-מס-קבלה-'+(doc.number||doc.id)+'.pdf','application/pdf',pdf.length,key,now()).run();}
  const stamp=now(),info={green_invoice_id:doc.id,green_invoice_number:doc.number,green_invoice_url:doc.url,green_invoice_at:stamp};
  if(spec.kind==='order')await stmt(`UPDATE orders SET data=json_set(data,'$.green_invoice',json(?)${fileId?",'$.invoice_file_id',CASE WHEN COALESCE(json_extract(data,'$.invoice_file_id'),'')='' THEN ? ELSE json_extract(data,'$.invoice_file_id') END,'$.invoice_attached_at',CASE WHEN COALESCE(json_extract(data,'$.invoice_file_id'),'')='' THEN ? ELSE json_extract(data,'$.invoice_attached_at') END,'$.invoice_document_type',CASE WHEN COALESCE(json_extract(data,'$.invoice_file_id'),'')='' THEN 'invoice_receipt' ELSE json_extract(data,'$.invoice_document_type') END,'$.invoice_document_number',CASE WHEN COALESCE(json_extract(data,'$.invoice_file_id'),'')='' THEN ? ELSE json_extract(data,'$.invoice_document_number') END":''}),updated=? WHERE id=?`,...[JSON.stringify(info),...(fileId?[fileId,stamp,doc.number]:[]),stamp,spec.target]).run();
  else await stmt("UPDATE records SET data=json_set(data,'$.green_invoice',json(?),'$.invoice_file_id',?),updated=? WHERE id=?",JSON.stringify(info),fileId||null,stamp,spec.target).run();
  await stmt("UPDATE jobs SET status='succeeded',data=json_set(data,'$.document',json(?),'$.file_id',?),updated=? WHERE id=?",JSON.stringify(info),fileId||null,stamp,jobId).run();
  await audit({id:spec.user_id},spec.target,'חשבונית מס/קבלה הופקה בחשבונית ירוקה',{number:doc.number,amount:spec.amount_cents,method:spec.method});
  if(built.email){try{await queueMail('email:green-invoice:'+jobId,spec.user_id,{to:built.email,subject:'חשבונית מס/קבלה מס׳ '+(doc.number||'')+' · '+built.label,
   text:'תודה על התשלום.\nמצורפת חשבונית מס/קבלה על סך '+shekel(spec.amount_cents)+' ('+built.label+').',
   ...(fileId?{attach_file_id:fileId}:{}),button:{label:spec.kind==='order'?'להזמנות שלי':'ליתרה שלי',url:(origin||'')+(spec.kind==='order'?'/purchased/orders':'/wallet')},origin});}catch{/* the document exists; the mail can be resent from the jobs log */}}
  return {status:'succeeded',...info};
 }catch(e){
  const reason=String((e as Error)?.message||e).slice(0,500);
  await stmt("UPDATE jobs SET status='failed',data=json_set(data,'$.error',?),updated=? WHERE id=?",reason,now(),jobId).run();
  return {status:'failed',error:reason};
 }
}

// Never let a document problem fail the payment that triggered it.
export async function issueInvoiceSafely(jobId:string,spec:InvoiceSpec,origin=''){try{return await issueInvoice(jobId,spec,origin);}catch(e){return {status:'failed',error:String((e as Error)?.message||e)};}}

// The documents of one order or top-up, for the admin (one query).
export async function invoiceJobs(target:string){return (await all("SELECT id,status,data,updated FROM jobs WHERE kind='green_invoice' AND json_extract(data,'$.target')=? ORDER BY created",target)).map((j:Row)=>{const d=JSON.parse(j.data||'{}');return {id:j.id,status:j.status,updated:j.updated,amount_cents:d.amount_cents,method:d.method,error:d.error||'',number:d.document?.green_invoice_number||'',url:d.document?.green_invoice_url||'',file_id:d.file_id||''};});}

// Admin: issue again after a failure (the same job, so never twice).
export async function retryInvoice(jobId:string,origin:string){const j=await one("SELECT * FROM jobs WHERE id=? AND kind='green_invoice'",jobId);if(!j)return {status:'missing'};const d=JSON.parse(j.data||'{}');return issueInvoiceSafely(jobId,{kind:d.kind,target:d.target,user_id:d.user_id,method:d.method,amount_cents:d.amount_cents,reference:d.reference,split:d.split},origin||d.origin||'');}
