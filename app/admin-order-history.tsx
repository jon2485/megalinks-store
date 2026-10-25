'use client';
import Link from 'next/link';
import React,{useEffect,useRef,useState} from 'react';
import {ChevronDown,ChevronLeft,ChevronRight,Search,Download,X,CalendarDays,Check,ExternalLink} from 'lucide-react';
import {useData} from '@/lib/client';
import {adminViewState,saveAdminViewState} from '@/lib/admin-view-state';
import {adminOrderBuckets,paymentConfirmed,type AdminOrderBucket} from '@/lib/admin-order-buckets';
import {money,type Row} from '@/lib/shared';
import {orderCancellationLabel} from '@/lib/order-finance';
import {historyMonthLabel} from '@/lib/order-history';
import type {Ctx} from './workspace';
import {CustomerOrderDetail,orderDate} from './customer-order-screen';
import {AdminCustomerOrderLink} from './admin-customer-order-link';
import {PaymentOrderActions} from './payment-review';
import {downloadAdminWorkbook} from './admin-export';
const choices:AdminOrderBucket[]=['monthly','closed','process'];
const initial={bucket:'monthly' as AdminOrderBucket,month:'',q:'',expanded:'',page:1,scroll:0};
const monthLabel=(m:string)=>m==='unknown'?'תאריך לא תועד':historyMonthLabel(m);
function reportLabel(o:Row){return o.payment_report?.status==='pending'?'נשלח דיווח תשלום':o.payment_report?.status==='rejected'?'דיווח התשלום נדחה':o.payment_report?.status==='approved'?'דיווח התשלום אושר':paymentConfirmed(o)?'שולם ואושר':'טרם נשלח דיווח';}
export default function AdminOrderHistory({ctx,openOrder,initialUnpaid=false}:{ctx:Ctx;openOrder:(o:Row)=>void;initialUnpaid?:boolean}){
 const memoryKey=initialUnpaid?'orders-unpaid':'orders';
 const [saved,setSaved]=useState<typeof initial>(()=>({...initial,...adminViewState(memoryKey,{...initial,bucket:initialUnpaid?'process' as const:'monthly' as const})})),[draft,setDraft]=useState(saved.q),[exporting,setExporting]=useState(false),[error,setError]=useState('');
 const searchInput=useRef<HTMLInputElement>(null),restore=useRef(saved.scroll),latest=useRef(saved),exportLock=useRef(false);
 const params=new URLSearchParams({bucket:saved.bucket,month:saved.month,q:saved.q,page:String(saved.page)}),state=useData('admin/orders?'+params,ctx.revision,true,15000);
 const f=state.data?.filters,current=!!f&&f.bucket===saved.bucket&&f.month===saved.month&&f.q===saved.q&&state.data.requested_page===saved.page,rows:Row[]=current?state.data.orders:[];
 useEffect(()=>{latest.current=saved;saveAdminViewState(memoryKey,saved);},[memoryKey,saved]);
 useEffect(()=>{const remember=()=>saveAdminViewState(memoryKey,{...latest.current,scroll:window.scrollY});window.addEventListener('scroll',remember,{passive:true});return()=>window.removeEventListener('scroll',remember);},[memoryKey]);
 const restorePosition=()=>{if(restore.current){window.scrollTo(0,restore.current);restore.current=0;}};
 useEffect(()=>{if(current&&!saved.expanded)restorePosition();},[current,state.data,saved.expanded]);
 const commit=(change:Partial<typeof initial>)=>{setError('');setSaved(s=>({...s,...change,page:change.page??1,expanded:'',scroll:0}));};
 const go=(event:React.MouseEvent<HTMLAnchorElement>,page:string)=>{if(event.button||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;event.preventDefault();saveAdminViewState(memoryKey,{...saved,scroll:window.scrollY});ctx.go(page);};
 const exportOrders=async()=>{if(exportLock.current)return;exportLock.current=true;setExporting(true);setError('');try{const query=new URLSearchParams({bucket:saved.bucket,month:saved.month,q:saved.q,export:'1'});await downloadAdminWorkbook('admin/orders?'+query,'orders-'+saved.bucket+'-'+(saved.month||'all')+'.xlsx');}catch(e){setError((e as Error).message);}finally{setExporting(false);exportLock.current=false;}};
 return <section className="admin-guide guide-orders" dir="rtl">
  <header className="guide-heading"><div><h1>הזמנות</h1><p>הזמנות, תשלומים וכל הפרטים במקום אחד</p></div><Link prefetch={false} className="guide-month-link" href="/admin-month-close" onClick={e=>go(e,'admin-month-close')}><CalendarDays size={27}/><span><strong>סגירת חודש</strong><small>סיכומים ודוחות</small></span><ChevronLeft size={20}/></Link></header>
  <div className="guide-order-choices" role="group" aria-label="סוג ההזמנות">{choices.map(bucket=><button type="button" key={bucket} aria-pressed={saved.bucket===bucket} onClick={()=>commit({bucket,month:''})}><span className="guide-choice-indicator" aria-hidden="true">{saved.bucket===bucket&&<Check size={16}/>}</span><span>{adminOrderBuckets[bucket]}</span>{state.data?.counts&&<bdi>{state.data.counts[bucket]||0}</bdi>}</button>)}</div>
  <form noValidate className="guide-filter-form" role="search" onSubmit={e=>{e.preventDefault();commit({q:draft.trim()});}}><label className="guide-select-label"><span>{saved.bucket==='closed'?'חודש התשלום':'חודש ההזמנה'}</span><select value={saved.month} onChange={e=>commit({month:e.target.value})}><option value="">כל החודשים</option>{(state.data?.months||[]).map((month:string)=><option key={month} value={month}>{monthLabel(month)}</option>)}</select></label><label className="guide-search"><Search size={18} aria-hidden="true"/><input ref={searchInput} type="search" maxLength={120} aria-label="חיפוש הזמנה, לקוח או אתר" placeholder="חיפוש הזמנה, לקוח או אתר" value={draft} onChange={e=>setDraft(e.target.value)}/>{draft&&<button type="button" aria-label="ניקוי חיפוש הזמנות" onClick={()=>{setDraft('');commit({q:''});searchInput.current?.focus();}}><X size={18}/></button>}</label><button type="submit" className="guide-button">חיפוש</button><button type="button" className="guide-button" disabled={exporting||!current} onClick={exportOrders}><Download size={18}/>{exporting?'מייצא…':'ייצוא הסינון לאקסל'}</button></form>
  <p className="guide-hint">{saved.bucket==='monthly'?'כל הזמנה חודשית שטרם שולמה מופיעה כאן בלבד, גם לאחר סגירת רכישות או דיווח תשלום.':saved.bucket==='closed'?'רק הזמנות שהתשלום שלהן התקבל ואושר. הסינון לפי חודש התשלום.':saved.bucket==='process'?'הזמנות רגילות שממתינות להשלמת תשלום או לאישורו.':''}</p>
  {(error||state.error)&&<div className="guide-error" role="alert"><p>{error||state.error}</p><button type="button" className="guide-button" onClick={ctx.refresh}>ניסיון נוסף</button></div>}
  <h2 className="guide-section-title">{adminOrderBuckets[saved.bucket]}{saved.month&&<> · {monthLabel(saved.month)}</>}</h2>
  {!current&&!state.error?<p className="guide-empty" role="status">טוען הזמנות…</p>:current&&!rows.length?<p className="guide-empty">אין הזמנות שתואמות לסינון שנבחר.</p>:<div className="guide-order-list" aria-busy={state.loading}>{rows.map(o=>{const open=saved.expanded===o.id,paid=paymentConfirmed(o),report=o.payment_report;return <article className="guide-order-card" key={o.id}>
   <button type="button" className="guide-order-toggle" aria-expanded={open} aria-controls={'admin-history-'+o.id} onClick={()=>setSaved(s=>({...s,expanded:open?'':o.id}))}><span className="guide-order-identity"><bdi>{o.number}</bdi><strong>{o.user_name||o.name}</strong><time dateTime={o.created}>{orderDate(o.created)}</time></span><span className={'guide-status '+(saved.bucket==='archive'?'is-muted':paid?'is-success':report?.status==='pending'?'is-warning':'is-muted')}>{saved.bucket==='archive'?(o.demo?'הדגמה':'בוטלה'):reportLabel(o)}</span><ChevronDown size={20} className={open?'is-expanded':''}/></button>
   <dl className="guide-order-facts"><div><dt>אמצעי תשלום</dt><dd>{o.payment_label}</dd></div><div><dt>סכום ההזמנה כולל מע״מ</dt><dd><bdi>{money(o.amounts.total)}</bdi></dd></div></dl>
   {orderCancellationLabel(o)&&<p className="guide-hint">{orderCancellationLabel(o)}</p>}
   {saved.bucket==='monthly'&&(o.purchase_closed||o.monthly_closed)&&<p className="guide-hint">נסגרה לרכישות נוספות · התשלום טרם אושר</p>}
   {open&&<div id={'admin-history-'+o.id} className="guide-order-expanded">
    {report&&<section className="guide-payment-report" aria-label="פרטי דיווח התשלום"><h3>פרטי הדיווח</h3><dl><div><dt>דווח ב־</dt><dd>{report.reported_at?orderDate(report.reported_at):'לא תועד'}</dd></div><div><dt>תאריך התשלום שדווח</dt><dd>{orderDate(report.payment_date)}</dd></div><div><dt>אופן התשלום שדווח</dt><dd>{report.payment_method==='card'?'אשראי':'העברה בנקאית'}</dd></div><div><dt>סכום שדווח</dt><dd><bdi>{money(report.amount_cents)}</bdi></dd></div><div><dt>אסמכתא</dt><dd><bdi>{report.reference||'לא נמסרה'}</bdi></dd></div></dl>{report.proof_file_id&&<a className="guide-proof-link" href={'/api/files/'+encodeURIComponent(report.proof_file_id)} target="_blank" rel="noopener noreferrer">צפייה באסמכתא<ExternalLink size={16}/></a>}{report.note&&<p>{report.note}</p>}{report.status==='pending'&&<p className="guide-report-pending">ממתין לאישור מנהל</p>}</section>}
    <CustomerOrderDetail ctx={ctx} order={o} onReady={restorePosition}/>
    {!paid&&saved.bucket!=='archive'&&<PaymentOrderActions ctx={ctx} order={o}/>}
   </div>}
   <div className="guide-order-card-actions"><button className={'guide-button '+(report?.status==='pending'?'is-primary':'')} type="button" onClick={()=>{saveAdminViewState(memoryKey,{...saved,scroll:window.scrollY});openOrder(o);}}>{report?.status==='pending'?'בדיקת דיווח התשלום':'פתיחת ההזמנה'}<ChevronLeft size={18}/></button></div>
  </article>;})}</div>}
  {current&&state.data.total>0&&<footer className="guide-pagination"><span role="status">{(state.data.page-1)*20+1}–{Math.min(state.data.page*20,state.data.total)} מתוך {state.data.total}</span>{state.data.total>20&&<nav aria-label="עמודי הזמנות"><button type="button" className="guide-button" disabled={state.data.page<=1||state.loading} onClick={()=>commit({page:state.data.page-1})}><ChevronRight size={17}/>הקודם</button><span>{state.data.page}</span><button type="button" className="guide-button" disabled={state.data.page*20>=state.data.total||state.loading} onClick={()=>commit({page:state.data.page+1})}>הבא<ChevronLeft size={17}/></button></nav>}</footer>}
  <p className="guide-hint">הייצוא כולל את כל ההזמנות שתואמות לחודש, לסוג ולחיפוש שנבחרו, בכל העמודים.</p>
  <details className="guide-secondary"><summary>כלים נוספים וארכיון</summary><button type="button" className="guide-button" aria-pressed={saved.bucket==='archive'} onClick={()=>commit({bucket:'archive',month:''})}>ביטולים והדגמות</button><AdminCustomerOrderLink ctx={ctx}/></details>
 </section>;
}
