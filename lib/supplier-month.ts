import {env} from 'cloudflare:workers';
import {monthlySupplierArticle} from './supplier-inventory';
import {publicationPeriod} from './publication-period';
import {all,one,stmt,db,parse,now,uid,assert,audit,hash} from './server';
import {queueMail,sendQueuedMail} from './mail';
import {type Row,money} from './shared';

// Manual suppliers on monthly billing get one email after each month closes:
// the articles in that month's payment and a private link to upload an
// invoice. No account is needed. Package (stock) sites are already paid for.
const prevMonth=(month:string)=>{const [y,m]=month.split('-').map(Number);return m===1?`${y-1}-12`:`${y}-${String(m-1).padStart(2,'0')}`;};

async function monthArticles(supplierId:string,month:string){
 return (await all(`SELECT a.id,a.title,a.published_url,a.data,w.name AS site_name FROM articles a JOIN orders o ON o.id=a.order_id JOIN websites w ON w.id=a.website_id WHERE ${monthlySupplierArticle} AND a.status='published' AND COALESCE(json_extract(o.data,'$.demo'),0)=0 AND COALESCE(json_extract(a.data,'$.publication_refunded'),0)=0 AND json_extract(a.data,'$.supplier_id')=? AND COALESCE(json_extract(a.data,'$.published_month'),substr(a.updated,1,7))=? ORDER BY a.updated,a.id`,supplierId,month)).map(a=>{const d=JSON.parse(a.data||'{}');return {id:a.id,title:a.title||d.topic||'',url:a.published_url||'',site_name:a.site_name,date:String(d.published_at||'').slice(0,10),cost_cents:Number.isSafeInteger(d.cost_cents)?d.cost_cents:null};});
}

// Creates (or re-sends) the invoice request for one manual supplier and month.
export async function sendSupplierMonth(origin:string,supplierId:string,month:string,actorId='system',resend=false){
 const supplier=parse(await one("SELECT * FROM records WHERE id=? AND kind='supplier'",supplierId));assert(supplier,'הספק לא נמצא',404);
 assert(!supplier.account_user_id,'לספק עם חשבון נשלחת בקשת חשבונית מתוך החשבון שלו',409);
 assert(/^\d{4}-(0[1-9]|1[0-2])$/.test(month)&&month<publicationPeriod().month,'אפשר לשלוח רק עבור חודש שהסתיים',409);
 const rows=await monthArticles(supplierId,month);assert(rows.length,'אין כתבות חודשיות שפורסמו בחודש הזה',409);
 assert(!rows.some(r=>r.cost_cents===null),'לחלק מהכתבות חסרה עלות. השלימו עלות לפני השליחה.',409);
 const key=supplierId+':'+month+':0',id='supplier-month:'+key,net=rows.reduce((s,r)=>s+Number(r.cost_cents),0);
 const existing=await one('SELECT id FROM records WHERE id=?',id);if(existing&&!resend)return {sent:false,id};
 const token=uid()+uid(),stamp=now(),expires=new Date(Date.now()+120*86400000).toISOString();
 const record={settlement_key:key,supplier_id:supplierId,month,count:rows.length,net,email:supplier.email,sent_at:stamp};
 await db().batch([
  stmt("UPDATE tokens SET used=1 WHERE kind='supplier_invoice' AND resource=?",key),
  stmt("INSERT INTO tokens(id,hash,kind,user_id,resource,expires,used) VALUES (?,?,'supplier_invoice',?,?,?,0)",uid(),await hash(token),actorId,key,expires),
  stmt("INSERT INTO records(id,kind,user_id,data,created,updated) VALUES (?,'supplier_month',?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,updated=excluded.updated",id,actorId,JSON.stringify(record),stamp,stamp),
 ]);
 const mailId='email:supplier-month:'+key+(resend?':'+stamp:'');
 await queueMail(mailId,actorId,{to:supplier.email,subject:'סיכום פרסומים לחודש '+month+' ובקשת חשבונית',text:'שלום '+(supplier.contact||supplier.name)+',\nבחודש '+month+' פורסמו אצלכם '+rows.length+' כתבות. הסכום לתשלום לפני מע״מ: '+money(net)+'.\n\n'+rows.map((r,i)=>(i+1)+'. '+r.site_name+' · '+r.title+(r.url?' · '+r.url:'')+' · '+money(Number(r.cost_cents))).join('\n')+'\n\nכדי שנעביר את התשלום, צרפו חשבונית על הסכום בקישור שלמטה. אין צורך בהרשמה.',button:{label:'הוספת חשבונית',url:origin+'/supplier-invoice/'+token}});
 if(actorId!=='system')await audit({id:actorId},id,'נשלחה לספק בקשת חשבונית חודשית',{month,count:rows.length,net});
 return {sent:true,id};
}

// Runs with the month-close job. Only the month that just ended, so the first
// run does not email suppliers about their whole history.
export async function closeManualSupplierMonths(origin:string,at=new Date()){
 const month=prevMonth(publicationPeriod(at).month);let sent=0;
 const suppliers=await all(`SELECT DISTINCT json_extract(a.data,'$.supplier_id') AS id FROM articles a JOIN records r ON r.id=json_extract(a.data,'$.supplier_id') AND r.kind='supplier' WHERE COALESCE(json_extract(r.data,'$.account_user_id'),'')='' AND a.status='published' AND ${monthlySupplierArticle} AND COALESCE(json_extract(a.data,'$.published_month'),substr(a.updated,1,7))=?`,month);
 for(const s of suppliers){try{const r=await sendSupplierMonth(origin,s.id,month);if(r.sent)sent++;}catch{}}
 for(const j of await all("SELECT id FROM jobs WHERE kind='email' AND id LIKE 'email:supplier-month:%' AND status IN ('requested','blocked','failed') ORDER BY created LIMIT 10"))await sendQueuedMail(j.id);
 return {month,sent};
}

async function tokenKey(token:string){const t=await one("SELECT * FROM tokens WHERE hash=? AND kind='supplier_invoice'",await hash(token));assert(t&&!t.used&&Date.parse(t.expires)>Date.now(),'הקישור אינו תקף. בקשו מאיתנו קישור חדש.',403);return t;}
const invoiceRow=async(key:string)=>{const r=await one('SELECT data FROM records WHERE id=?','supplier-invoice:'+key);return r?JSON.parse(r.data):null;};
const paidRow=async(key:string)=>{const r=await one("SELECT data FROM records WHERE kind='supplier_payment' AND json_extract(data,'$.settlement_key')=?",key);return r?JSON.parse(r.data):null;};

// Public page behind the emailed link: month summary and invoice upload.
export async function supplierInvoiceRoute(r:Request,token:string,method:string){
 const t=await tokenKey(token),key=String(t.resource),parts=key.split(':');parts.pop();const month=String(parts.pop()),supplierId=parts.join(':');
 const supplier=parse(await one("SELECT * FROM records WHERE id=? AND kind='supplier'",supplierId));assert(supplier,'הספק לא נמצא',404);
 const rows=await monthArticles(supplierId,month),net=rows.reduce((s,a)=>s+Number(a.cost_cents||0),0),paid=await paidRow(key);
 if(method==='GET')return {recipient:{name:supplier.name,contact:supplier.contact||''},month,articles:rows.map(a=>({title:a.title,url:a.url,site_name:a.site_name,date:a.date,fee:a.cost_cents})),net,invoice:await invoiceRow(key),paid:paid?{paid_on:paid.paid_on||'',method:paid.payment_method||''}:null};
 assert(method==='POST','פעולה לא נתמכת',405);assert(!paid,'התשלום כבר בוצע, ולא ניתן להחליף את החשבונית',409);
 const form=await r.formData(),f=form.get('file');assert(f instanceof File,'לא נבחר קובץ');assert(f.size>0&&f.size<=10*1024*1024,'מותר קובץ PDF עד 10MB');
 const bytes=new Uint8Array(await f.arrayBuffer());assert(new TextDecoder().decode(bytes.slice(0,5))==='%PDF-','יש לצרף קובץ PDF');
 const number=String(form.get('number')||'').trim().slice(0,100);assert(number,'יש להזין מספר חשבונית');
 const vat=Math.round(Number(form.get('vat_ils')||0)*100);assert(Number.isSafeInteger(vat)&&vat>=0&&vat<=net,'סכום המע״מ אינו תקין');
 const fileId=uid(),storeKey='supplier-invoices/'+fileId,stamp=now(),prev=await invoiceRow(key);
 await (env as any).BUCKET.put(storeKey,bytes,{httpMetadata:{contentType:'application/pdf'}});
 const data={settlement_key:key,supplier_id:supplierId,month,file_id:fileId,number,vat,net,total:net+vat,uploaded_at:stamp,history:[...(prev?.history||[]),...(prev?[{file_id:prev.file_id,number:prev.number,uploaded_at:prev.uploaded_at}]:[])]};
 await db().batch([
  stmt('INSERT INTO files(id,user_id,name,type,size,key,created) VALUES (?,?,?,?,?,?,?)',fileId,'supplier:'+supplierId,String(f.name||'invoice.pdf').slice(0,200),'application/pdf',f.size,storeKey,stamp),
  stmt("INSERT INTO records(id,kind,user_id,data,created,updated) VALUES (?,'supplier_invoice',?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,updated=excluded.updated",'supplier-invoice:'+key,'supplier:'+supplierId,JSON.stringify(data),stamp,stamp),
  stmt('INSERT INTO activity(id,user_id,resource,action,data,created) VALUES (?,?,?,?,?,?)',uid(),'supplier:'+supplierId,'supplier-invoice:'+key,'הספק צירף חשבונית',JSON.stringify({number,month}),stamp),
 ]);
 return {ok:true,invoice:data};
}

export async function supplierInvoiceFile(key:string){
 const inv=await invoiceRow(key);assert(inv,'טרם צורפה חשבונית',404);
 const f=await one('SELECT * FROM files WHERE id=?',inv.file_id);assert(f,'הקובץ לא נמצא',404);
 const blob=await (env as any).BUCKET?.get(f.key);assert(blob,'המסמך אינו זמין',404);
 return new Response(blob.body,{headers:{'Content-Type':'application/pdf','Content-Disposition':'inline; filename=invoice.pdf','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
}
export async function manualSupplierInvoices(){return new Map((await all("SELECT data FROM records WHERE kind='supplier_invoice'")).map(r=>{const d=JSON.parse(r.data);return [d.settlement_key,d];}));}
export async function manualSupplierMonths(){return new Map((await all("SELECT data FROM records WHERE kind='supplier_month'")).map(r=>{const d=JSON.parse(r.data);return [d.settlement_key,d];}));}
