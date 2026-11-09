import {all,one,stmt,parse,now,assert,audit} from './server';
import type {Row} from './shared';
import {money} from './shared';
import {supplierSettlements,supplierKind,supplierBillingType} from './admin-suppliers';
import {siteStock,stockState,STOCK_LOW} from './supplier-stock';
import {publicationPeriod} from './publication-period';
import {queueMail} from './mail';
import {sendSupplierMonth} from './supplier-month';
import {supplierPaymentMethods} from './supplier-presentation';

// A supplier's billing seen as orders: every month with publications is one
// order (monthly billing), and every stock package bought is one order.
const monthCode=(m:string)=>'SUP-'+m.slice(5,7)+m.slice(2,4);
const nextMonthFirst=(m:string)=>{const [y,n]=m.split('-').map(Number);return n===12?`${y+1}-01-01`:`${y}-${String(n+1).padStart(2,'0')}-01`;};
const monthEnd=(m:string)=>{const [y,n]=m.split('-').map(Number);return new Date(Date.UTC(y,n,0)).toISOString().slice(0,10);};

async function supplierRow(id:string){const s=parse(await one("SELECT r.*,p.user_id AS account_user_id FROM records r LEFT JOIN seller_profiles p ON p.supplier_id=r.id WHERE r.id=? AND r.kind='supplier'",id));assert(s,'הספק לא נמצא',404);return {...s,kind:supplierKind(s)};}

async function settlementRows(supplierId:string){
 const rows:Row[]=[];for(let page=1;page<50;page++){const r:Row=await supplierSettlements(new URLSearchParams({supplier:supplierId,pay:'all',page:String(page)}));rows.push(...r.rows);if(page*Number(r.size||20)>=Number(r.total))break;}
 return rows;
}

// open: the month is still running · awaiting: closed, no invoice yet ·
// invoice: an invoice arrived (or is approved) · paid.
function orderStatus(g:Row,current:string){
 if(g.stage)return g.stage;
 if(g.month>=current)return 'open';
 if(g.status==='paid')return 'paid';
 if(g.source==='statement'?['invoice_review','approved'].includes(g.status):!!g.manual_invoice)return 'invoice';
 return 'awaiting';
}
function invoiceOf(g:Row){
 if(g.source==='statement')return g.invoice_file_id?{number:g.invoice_number||'חשבונית',url:'/api/selling/invoice?'+new URLSearchParams({id:g.statement_id}),at:g.invoice_submitted_at||''}:null;
 return g.manual_invoice?{number:g.manual_invoice.number,url:'/api/admin/supplier-invoice-file?'+new URLSearchParams({key:g.id}),at:g.manual_invoice.uploaded_at}:null;
}
function orderSummary(g:Row,current:string){
 const status=orderStatus(g,current),total=g.source==='statement'?(g.total??g.net):g.net;
 return {key:g.id,month:g.month,code:monthCode(g.month),count:g.count,net:g.net,total,status,raw_status:g.status,source:g.source,invoice:invoiceOf(g),request_on:nextMonthFirst(g.month),paid_on:g.source==='statement'?(g.paid_at||''):(g.payment?.paid_on||g.payment?.paid_at||''),sites:new Set((g.articles||[]).map((a:Row)=>a.website_url)).size,missing_cost:g.net==null};
}

async function stockPackages(supplierId:string){
 const sites=await all("SELECT id FROM websites WHERE json_extract(data,'$.supplier_id')=? AND json_extract(data,'$.stock_total') IS NOT NULL ORDER BY name",supplierId);
 const out:Row[]=[];let total=0,used=0;
 for(const w of sites){
  const st:Row=await siteStock(w.id);total+=Number(st.total||0);used+=Number(st.used||0);
  for(const p of st.packages){
   const inP=st.slots.filter((s:Row)=>s.place?.package===p.number),qty=Number(p.end)-Number(p.start)+1,u=inP.length,prev=st.packages.find((x:Row)=>x.number===p.number-1),prevUsed=prev?st.slots.filter((s:Row)=>s.place?.package===prev.number).length:0,prevDone=!prev||prevUsed>=Number(prev.end)-Number(prev.start)+1;
   const status=u>=qty?'done':u===0&&!prevDone?'queued':qty-u<=STOCK_LOW?'low':'active';
   out.push({site_id:w.id,site_name:st.site.name,number:p.number,id:p.id,opening:!!p.opening,quantity:qty,used:u,left:qty-u,published:inP.filter((s:Row)=>s.status==='published').length,created:p.created||'',paid_on:p.paid_on||'',method:p.method||'',total_cents:p.total_cents??null,unit_cents:p.unit_cents??null,status,paid:!!p.paid_on,code:p.opening?'מלאי קודם':'STK-'+String(p.id).replace('stock-package:','').slice(0,4).toUpperCase()});
  }
 }
 out.sort((a,b)=>String(b.created||'0').localeCompare(String(a.created||'0'))||a.site_name.localeCompare(b.site_name,'he')||b.number-a.number);
 return {sites:sites.length,total,used,left:Math.max(0,total-used),packages:out};
}

export async function supplierBilling(supplierId:string){
 const supplier=await supplierRow(supplierId),current=publicationPeriod().month,year=current.slice(0,4);
 const rows=(await settlementRows(supplierId)).filter(g=>!g.demo).sort((a,b)=>b.month.localeCompare(a.month));
 const orders=rows.map(g=>orderSummary(g,current));
 const due=orders.filter(o=>o.status==='invoice'),open=orders.find(o=>o.status==='open'),paid=orders.filter(o=>o.status==='paid'&&String(o.paid_on||o.month).startsWith(year));
 const stock=await stockPackages(supplierId);
 const stockSites=await all("SELECT id,name,json_extract(data,'$.stock_total') AS stock_total FROM websites WHERE json_extract(data,'$.supplier_id')=? ORDER BY name",supplierId);
 return {supplier:{id:supplier.id,name:supplier.name,email:supplier.email,kind:supplier.kind,account_user_id:supplier.account_user_id||'',billing:supplierBillingType(supplier,stockSites)},current,orders,summary:{due:{amount:due.reduce((n,o)=>n+Number(o.total||0),0),orders:due.length,first:due[due.length-1]||null},open:open?{count:open.count,month:open.month,closes:monthEnd(open.month)}:null,paid:{amount:paid.reduce((n,o)=>n+Number(o.total||0),0),count:paid.length}},stock,sites:stockSites};
}

export async function supplierOrder(key:string){
 const parts=key.split(':');parts.pop();const month=String(parts.pop()),supplierId=parts.join(':');
 const supplier=await supplierRow(supplierId),current=publicationPeriod().month;
 const g=(await settlementRows(supplierId)).find(r=>r.id===key);assert(g,'ההזמנה לא נמצאה',404);
 const ids=(g.articles||[]).map((a:Row)=>a.id);
 const extra=ids.length?await all(`SELECT a.id,o.number AS order_number,w.name AS site_name,json_extract(a.data,'$.published_at') AS published_at,COALESCE(NULLIF(a.title,''),json_extract(a.data,'$.topic'),'') AS title FROM articles a LEFT JOIN orders o ON o.id=a.order_id LEFT JOIN websites w ON w.id=a.website_id WHERE a.id IN (${ids.map(()=>'?').join(',')})`,...ids):[];
 const byId=new Map(extra.map(r=>[r.id,r]));
 const articles=(g.articles||[]).map((a:Row)=>({...a,...(byId.get(a.id)||{}),title:byId.get(a.id)?.title||a.title,date:byId.get(a.id)?.published_at||a.date})).sort((a:Row,b:Row)=>String(b.date||'').localeCompare(String(a.date||'')));
 const o=orderSummary(g,current),inv=invoiceOf(g),paidAt=o.paid_on;
 const steps=[
  {key:'closed',label:'הזמנה נסגרה',done:month<current,at:month<current?nextMonthFirst(month):''},
  {key:'request',label:'בקשת חשבונית נשלחה',done:g.source==='statement'?true:!!g.month_mail,at:g.source==='statement'?nextMonthFirst(month):g.month_mail?.sent_at||''},
  {key:'invoice',label:'התקבלה חשבונית',done:!!inv&&g.status!=='rejected',at:inv?.at||''},
  {key:'paid',label:'תשלום',done:o.status==='paid',at:paidAt},
 ];
 if(month>=current)steps[1].done=false;
 const history=[...(month<current?[{at:nextMonthFirst(month),title:'ההזמנה נסגרה',by:'מערכת'}]:[]),...(g.month_mail?[{at:g.month_mail.sent_at,title:'בקשת חשבונית נשלחה',by:'מייל לספק'}]:[]),...(inv?[{at:inv.at,title:'התקבלה חשבונית '+inv.number,by:'הספק'}]:[]),...(g.history||[]).map((h:Row)=>({at:h.date,title:h.title,by:h.actor||''})),...(o.status==='paid'&&g.source!=='statement'?[{at:paidAt,title:'תועד תשלום',by:supplierPaymentMethods[g.payment?.payment_method]||''}]:[])].filter(h=>h.at).sort((a,b)=>String(a.at).localeCompare(String(b.at)));
 return {supplier:{id:supplier.id,name:supplier.name,email:supplier.email,kind:supplier.kind,account_user_id:supplier.account_user_id||''},order:{...o,articles,steps,history,vat:g.source==='statement'?g.vat??null:g.manual_invoice?.vat??null},row:{...g,articles:undefined}};
}

export async function supplierPackage(siteId:string,number:number){
 const st:Row=await siteStock(siteId),p=st.packages.find((x:Row)=>x.number===number);assert(p,'החבילה לא נמצאה',404);
 const qty=Number(p.end)-Number(p.start)+1,slots=st.slots.filter((s:Row)=>s.place?.package===number).map((s:Row)=>({...s,position:s.place.position}));
 slots.sort((a:Row,b:Row)=>(a.status==='published'?1:0)-(b.status==='published'?1:0)||b.position-a.position);
 const releases=st.releases.filter((r:Row)=>Number(r.sequence)>=Number(p.start)&&Number(r.sequence)<=Number(p.end)).map((r:Row)=>({...r,position:Number(r.sequence)-Number(p.start)+1}));
 const prev=st.packages.find((x:Row)=>x.number===number-1),u=slots.length,status=u>=qty?'done':qty-u<=STOCK_LOW?'low':'active';
 const actor=p.user_id?await one('SELECT name FROM users WHERE id=?',p.user_id):null;
 return {site:st.site,methods:st.methods,stock:{total:st.total,used:st.used},package:{...p,quantity:qty,used:u,left:qty-u,published:slots.filter((s:Row)=>s.status==='published').length,waiting:slots.filter((s:Row)=>s.status==='sent').length,status,prev_number:prev?.number||null,actor:p.actor_name||actor?.name||'',slots,releases,state:stockState(Number(st.total),Number(st.used))}};
}

export async function sendOrderSummary(origin:string,key:string,actor:Row){
 const d=await supplierOrder(key);assert(d.order.status!=='open','ההזמנה עדיין פתוחה. אפשר לשלוח פירוט אחרי שהחודש נסגר.',409);
 if(!d.supplier.account_user_id&&d.order.source!=='statement')return sendSupplierMonth(origin,d.supplier.id,d.order.month,actor.id,true);
 const user=d.supplier.account_user_id?await one('SELECT email FROM users WHERE id=?',d.supplier.account_user_id):null,to=user?.email||d.supplier.email;assert(to,'לספק אין מייל',409);
 await queueMail('email:supplier-order:'+key+':'+now(),actor.id,{to,subject:'פירוט פרסומים לחודש '+d.order.month,text:'פורסמו '+d.order.count+' כתבות. סכום לפני מע״מ: '+money(Number(d.order.net||0))+'.\n\n'+d.order.articles.map((a:Row,i:number)=>(i+1)+'. '+(a.site_name||'')+' · '+(a.title||'')+(a.url?' · '+a.url:'')).join('\n'),button:{label:'צפייה בפירוט באזור שלכם',url:origin+'/purchased/selling'}});
 await audit(actor,key,'נשלח לספק פירוט הזמנה',{month:d.order.month});return {sent:true};
}

export async function sendPackageStatus(siteId:string,number:number,actor:Row){
 const d=await supplierPackage(siteId,number),w=parse(await one('SELECT * FROM websites WHERE id=?',siteId))!;
 const s=w.supplier_id?parse(await one("SELECT * FROM records WHERE id=? AND kind='supplier'",w.supplier_id)):null,to=String(w.supplier_email||s?.email||'');assert(to,'לספק אין מייל',409);
 const p=d.package;
 await queueMail('email:supplier-package:'+siteId+':'+number+':'+now(),actor.id,{to,subject:'מצב חבילת הפרסומים ב'+d.site.name,text:'חבילה '+p.number+' באתר '+d.site.name+': שומשו '+p.used+' מתוך '+p.quantity+', נותרו '+p.left+'.\nממתינות לפרסום: '+p.waiting+'.\n\n'+p.slots.map((x:Row)=>x.position+'. '+(x.title||'כתבה')+' · '+(x.status==='published'?'פורסמה':'ממתינה לפרסום')).join('\n')});
 await audit(actor,siteId,'נשלח לספק מצב חבילה',{number});return {sent:true};
}

export async function updatePackagePayment(actor:Row,siteId:string,number:number,b:Row){
 const d=await supplierPackage(siteId,number);assert(!d.package.opening,'למלאי הקודם לא נרשם תשלום. הוסיפו חבילה חדשה.',409);
 const r=await one('SELECT data FROM records WHERE id=?',d.package.id);assert(r,'החבילה לא נמצאה',404);
 const data=JSON.parse(r.data),qty=Number(data.quantity),paidOn=String(b.paid_on||'').slice(0,10),method=String(b.method||''),note=String(b.note||'').trim().slice(0,1000);
 assert(!paidOn||/^\d{4}-\d{2}-\d{2}$/.test(paidOn),'תאריך תשלום לא תקין');assert(!method||method in supplierPaymentMethods,'אמצעי תשלום לא תקין');
 const cents=(v:any)=>{if(v===''||v===null||v===undefined)return null;const n=Math.round(Number(v)*100);assert(Number.isSafeInteger(n)&&n>=0,'סכום לא תקין');return n;};
 let total=cents(b.total_ils),unit=cents(b.unit_ils);if(total===null&&unit!==null)total=unit*qty;if(unit===null&&total!==null)unit=Math.round(total/qty);
 const next={...data,paid_on:paidOn,method,note,...(total!==null?{total_cents:total,unit_cents:unit}:{})};
 await stmt('UPDATE records SET data=?,updated=? WHERE id=?',JSON.stringify(next),now(),d.package.id).run();
 await audit(actor,siteId,'עודכנו פרטי תשלום של חבילה',{number});return {ok:true};
}
