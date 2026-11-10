'use client';
import React,{useRef,useState} from 'react';
import {Check,ChevronLeft,Download,FileText,Loader2,LockKeyhole,Plus,ReceiptText,ShieldCheck,X} from 'lucide-react';
import {api,useData} from '@/lib/client';
import type {Row} from '@/lib/shared';
import {orderCancellation} from '@/lib/order-finance';
import {paymentConfirmed} from '@/lib/admin-order-buckets';
import {historyMonthLabel} from '@/lib/order-history';
import {orderPaymentState,OrderPub,orderPayPill} from './admin-order-history';
import {OrderPanel} from './admin-order-panel';
import {OrderPager,OrderViews,RecordPanel,orderSites,siteLabel} from './order-list-parts';
import {orderMoney} from './order-presentation';
import {downloadAdminWorkbook} from './admin-export';
import {CloseMonthlyOrder,ReceiveMonthlyPayment} from './monthly-order-actions';
import {downloadMonthlySummary} from './month-close-actions';
import {assignedPaymentMonth} from './payment-assignment';
import {ReportReview} from './payment-reports';
import {BankPaymentReview} from './payment-review';
import {isAwaitingPayment,isBankPayment,isCardPayment} from '@/lib/payment-state';
import {orderDate} from './customer-order-screen';
import OrderStatementAction from './order-statement-action';
import type {Ctx} from './workspace';
import './supplier-v2.css';
import './orders-v2.css';
import './orders-reference.css';
import './orders-modern.css';

// 10.11.2026 The customer file's orders in the orders-screen look: the same rows and open panel,
// with actions that belong to this customer (no "תיק לקוח", we are already in it).
// The panel runs in its complete mode: everything the full order page did is here, so nothing links to that page.
const views:[string,string][]=[['all','הכול'],['open_purchases','פתוחות'],['to_pay','לתשלום'],['closed','שולמו'],['archive','בוטלו והדגמות']];
const plain=(e:React.MouseEvent)=>e.button===0&&!e.metaKey&&!e.ctrlKey&&!e.shiftKey&&!e.altKey;
const siteName=(s:string)=>String(s||'').replace(/^https?:\/\//,'').replace(/^www\./,'');
const monthlyOrder=(o:Row)=>!!(o.on_account||o.payment==='monthly'||o.billing_month);
const statementPath=(o:Row)=>'admin/customer-account/'+encodeURIComponent(o.user_id)+'/order-statement/'+encodeURIComponent(o.id);
export const rowPay=(o:Row)=>{const pay=orderPaymentState(o);if(pay.tone!=='month')return pay;return o.purchase_closed_at||o.monthly_closed?{...pay,label:'נסגרה לתשלום'}:{...pay,label:'פתוחה לרכישות'};};

export default function CustomerFileOrders({ctx,id,name,newOrder}:{ctx:Ctx;id:string;name:string;newOrder:()=>void}){
 const [bucket,setBucket]=useState('all'),[page,setPage]=useState(1),[open,setOpen]=useState(''),[exporting,setExporting]=useState(false),[exported,setExported]=useState(false),[error,setError]=useState(''),lock=useRef(false);
 const params=new URLSearchParams({bucket,month:'',q:'',page:String(page),user:id});
 const state=useData('admin/orders?'+params,ctx.revision,true,15000),data=state.data;
 const current=!!data&&data.filters?.bucket===bucket&&data.filters?.user===id&&data.requested_page===page;
 const rows:Row[]=current?data.orders:[],counts:Row=data?.filters?.user===id?data.counts||{}:{},total=current?Number(data.total):0,size=Number(data?.page_size||20);
 const shownViews=views.filter(([key])=>key!=='archive'||Number(counts.archive)>0||bucket==='archive').map(([key,label])=>[key,label,Number(key==='all'?counts.all:counts[key])||0] as [string,string,number]);
 const exportOrders=async()=>{if(lock.current)return;lock.current=true;setExporting(true);setError('');try{await downloadAdminWorkbook('admin/orders?'+new URLSearchParams({bucket,month:'',q:'',user:id,export:'1'}),'orders-'+(name||'customer').replace(/[^\p{L}\p{N}]+/gu,'-')+'.xlsx');setExported(true);setTimeout(()=>setExported(false),2200);}catch(e){setError((e as Error).message);}finally{lock.current=false;setExporting(false);}};
 const cols={gridTemplateColumns:'118px minmax(0,1.3fr) minmax(0,1fr) 130px 120px 44px',gap:12};
 return <section className="orders-match-screen sv2 sv2-orders cfo" dir="rtl" aria-labelledby="cfo-title">
  <h2 id="cfo-title" className="om-hidden">ההזמנות של הלקוח</h2>
  <div className="cfo-bar">
   <OrderViews label="סינון ההזמנות של הלקוח" value={bucket} views={shownViews} onChange={v=>{setBucket(v);setPage(1);setOpen('');}}/>
   <div className="cfo-actions">
    <button type="button" className={'sv2-btn quiet'+(exported?' fx-done':'')} disabled={exporting||!current||!total} aria-busy={exporting||undefined} onClick={exportOrders}>{exporting?<Loader2 className="om-spin" size={16} aria-hidden="true"/>:exported?<Check size={16} aria-hidden="true"/>:<Download size={16} aria-hidden="true"/>}{exporting?'מכין קובץ…':exported?'הקובץ הורד':'ייצוא ההזמנות של הלקוח'}</button>
    <button type="button" className="sv2-btn primary" onClick={newOrder}><Plus size={17} aria-hidden="true"/>הזמנה חדשה עבור הלקוח</button>
   </div>
  </div>
  {(error||state.error)&&<div className="sv2-error" role="alert"><p>{error||state.error}</p><button type="button" className="sv2-btn quiet sm" onClick={ctx.refresh}>ניסיון נוסף</button></div>}
  <section className="sv2-card ofx-card cfo-card" style={{backdropFilter:'none',WebkitBackdropFilter:'none'}}>
   {!current&&!state.error?<div className="ofx-skel" role="status" aria-label="טוען הזמנות">{[0,1,2,3].map(i=><div key={i} className="ofx-skel-row"><i/><i/><i/><i/><i/></div>)}</div>
   :current&&!rows.length?<div className="sv2-empty"><h3>{bucket==='all'?'ללקוח עוד אין הזמנות':'אין הזמנות במצב הזה'}</h3><p>{bucket==='all'?'הזמנה חדשה עבור הלקוח תופיע כאן.':'אפשר לבחור מצב אחר או להציג את כל ההזמנות.'}</p>{bucket==='all'?<button type="button" className="sv2-btn tint" onClick={newOrder}>הזמנה חדשה עבור הלקוח</button>:<button type="button" className="sv2-btn tint" onClick={()=>{setBucket('all');setPage(1);}}>הצגת כל ההזמנות</button>}</div>
   :<>
    <div className="sv2-th" style={cols} aria-hidden="true"><span>הזמנה</span><span>אתרים</span><span>תשלום</span><span>פרסום</span><span>סכום</span><span/></div>
    <div className="om-list sv2-olist" aria-label="ההזמנות של הלקוח">{rows.map(o=>{const isOpen=open===o.id,pay=rowPay(o),sites=orderSites(o),cancelled=orderCancellation(o)==='full',num=String(o.number).replace(/^#/,''),toggle=()=>setOpen(isOpen?'':o.id),note=pay.note&&pay.note!==String(o.payment_label||'')&&pay.tone!=='month'?pay.note:'';
     return <article key={o.id} className={'om-order sv2-order is-tone-'+pay.tone+(cancelled?' is-cancelled':'')+(isOpen?' is-open':'')}>
      <div className="sv2-tr sv2-orow" style={cols} onClick={toggle}>
       <div className="sv2-ord"><b><bdi>#{num}</bdi></b><time dateTime={o.created}>{orderDate(o.created)}</time></div>
       <div className="sv2-favs"><small className="sv2-ml">אתרים</small>{sites.length>0&&<bdi className="sv2-site1" dir="ltr" title={sites.map((x:Row)=>siteLabel(x)).join(', ')}>{siteName(siteLabel(sites[0]))}</bdi>}{sites.length>1&&<span className="sv2-more" title={sites.slice(1).map((x:Row)=>siteLabel(x)).join(', ')}><bdi dir="ltr">+{sites.length-1}</bdi></span>}{!sites.length&&<span className="sv2-muted">אין פריטים</span>}</div>
       <div className="sv2-paycell"><small className="sv2-ml">תשלום</small><span className={'sv2-pill '+orderPayPill(pay.tone)} title={o.payment_label||undefined}><i/>{pay.label}</span>{note&&<small className="sv2-sub">{note}</small>}</div>
       <div className="sv2-pubcell"><small className="sv2-ml">פרסום</small><OrderPub o={o}/></div>
       <span className="sv2-num lg"><small className="sv2-ml">סכום</small>{cancelled?<span className="sv2-muted" title="ההזמנה בוטלה">—</span>:<bdi>{orderMoney(o.amounts.total)}</bdi>}</span>
       <div className="sv2-rowact" onClick={e=>e.stopPropagation()}>{isOpen?<button type="button" className="sv2-dots is-close" aria-label={'סגירת פירוט הזמנה '+num} aria-expanded={true} aria-controls={'cfo-'+o.id} onClick={toggle}><X size={16}/></button>:<button type="button" className="sv2-chevbtn" aria-label={'פירוט הזמנה '+num} aria-expanded={false} aria-controls={'cfo-'+o.id} onClick={toggle}><ChevronLeft className="ofx-chev" size={17} aria-hidden="true"/></button>}</div>
      </div>
      {isOpen&&<RecordPanel id={'cfo-'+o.id} title={<>הזמנה <bdi>#{num}</bdi></>} badge={<span className={'sv2-pill '+orderPayPill(pay.tone)}><i/>{pay.label}</span>} onClose={()=>setOpen('')}>
       <OrderPanel ctx={ctx} order={o} manage={()=>{}} profit complete
        section={full=><PaymentSection ctx={ctx} o={{...o,...full,user_email:o.user_email,user_name:o.user_name}}/>}
        actions={full=>{const m={...o,...full};return monthlyOrder(m)&&!m.purchase_closed_at&&!paymentConfirmed(m)?null:<OrderStatementAction ctx={ctx} order={m}/>;}}/>
      </RecordPanel>}
     </article>;})}</div>
   </>}
   {current&&total>0&&<OrderPager page={Number(data.page)||page} total={total} size={size} onChange={v=>{setPage(v);setOpen('');}}/>}
  </section>
 </section>;
}

/** Payment actions for this order: month close and sending to the customer, payment received, a report to check. */
function PaymentSection({ctx,o}:{ctx:Ctx;o:Row}){
 const [busy,setBusy]=useState(''),[error,setError]=useState('');
 if(paymentConfirmed(o)||orderCancellation(o)==='full'||o.demo)return null;
 const monthly=monthlyOrder(o),closed=!!(o.purchase_closed_at||o.monthly_closed),month=assignedPaymentMonth(o)||o.billing_month||String(o.created||'').slice(0,7);
 const review=async()=>{setBusy('review');setError('');try{const {report}=await api('orders/'+o.id+'/payment-report');if(!report)throw new Error('הדיווח כבר אינו ממתין לבדיקה. יש לרענן.');ctx.open({kind:'admin-finance',title:'דיווח תשלום לבדיקה',render:(close:()=>void)=><ReportReview ctx={ctx} report={report} close={close}/>});}catch(e){setError((e as Error).message);}finally{setBusy('');}};
 const download=async()=>{setBusy('pdf');setError('');try{if(o.monthly_closed&&!o.purchase_closed_at)await downloadMonthlySummary(o);else{const r=await api(statementPath(o));const {downloadStatementPdf}=await import('@/lib/statement-pdf');await downloadStatementPdf(r.summary);}}catch(e){setError((e as Error).message);}finally{setBusy('');}};
 const reportPending=o.payment_report?.status==='pending'||o.payment_report_status==='pending';
 const awaiting=!monthly&&isAwaitingPayment(o),bank=awaiting&&isBankPayment(o),card=awaiting&&isCardPayment(o);
 if(!monthly&&!reportPending&&!bank&&!card)return null;
 return <section className="sk-card cfo-pay"><header className="sk-head"><h3>תשלום</h3></header>
  <p className="om-note">{monthly?(closed?'ההזמנה נסגרה לרכישות והסיכום נשלח ללקוח. התשלום עוד לא אושר.':<>חודש שירות {historyMonthLabel(month)} · יחויב בסגירת החודש</>):reportPending?'הלקוח דיווח על תשלום. צריך לבדוק ולאשר.':bank?'ההזמנה ממתינה להעברה בנקאית. הכתבות ייפתחו לטיפול אחרי אימות קבלת התשלום.':'ההזמנה ממתינה לתשלום באשראי של הלקוח. הכתבות ייפתחו לטיפול אחרי שהתשלום יצליח.'}</p>
  <div className="cfo-pay-actions">
   {reportPending&&<button type="button" className="om-btn is-primary" disabled={!!busy} aria-busy={busy==='review'||undefined} onClick={review}>{busy==='review'?<Loader2 className="om-spin" size={16} aria-hidden="true"/>:<FileText size={16} aria-hidden="true"/>}בדיקת דיווח התשלום</button>}
   {bank&&<button type="button" className={'om-btn'+(reportPending?'':' is-primary')} onClick={()=>ctx.open({kind:'admin-finance',title:'אימות העברה בנקאית',render:(close:()=>void)=><BankPaymentReview ctx={ctx} order={o} close={close}/>})}><ShieldCheck size={16} aria-hidden="true"/>אימות קבלת התשלום</button>}
   {monthly&&(closed?<button type="button" className="om-btn" disabled={!!busy} aria-busy={busy==='pdf'||undefined} onClick={download}>{busy==='pdf'?<Loader2 className="om-spin" size={16} aria-hidden="true"/>:<Download size={16} aria-hidden="true"/>}{busy==='pdf'?'מפיק PDF…':'הורדת סיכום ההזמנה (PDF)'}</button>
    :<button type="button" className={'om-btn'+(reportPending?'':' is-primary')} onClick={()=>ctx.open({kind:'admin-finance',title:'סגירת חודש ושליחה ללקוח',render:(close:()=>void)=><CloseMonthlyOrder ctx={ctx} order={o} close={close}/>})}><LockKeyhole size={16} aria-hidden="true"/>סגירת חודש ושליחה ללקוח</button>)}
   {monthly&&<button type="button" className="om-btn" onClick={()=>ctx.open({kind:'admin-finance',title:'דיווח על קבלת תשלום',render:(close:()=>void)=><ReceiveMonthlyPayment ctx={ctx} order={o} close={close}/>})}><ReceiptText size={16} aria-hidden="true"/>דיווח על קבלת תשלום</button>}
  </div>
  {error&&<p className="om-note is-error" role="alert">{error}</p>}
 </section>;
}
