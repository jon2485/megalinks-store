'use client';
import React,{useRef,useState} from 'react';
import {CalendarDays} from 'lucide-react';
import {useData} from '@/lib/client';
import type {Row} from '@/lib/shared';
import {israelDate} from '@/lib/admin-order-buckets';
import {validReportDay} from '@/lib/admin-date-range';
import {historyMonthLabel} from '@/lib/order-history';
import {adminViewState,saveAdminViewState} from '@/lib/admin-view-state';
import type {Ctx} from './workspace';
import {orderDate} from './customer-order-screen';
import {orderMoney,orderNumber} from './order-presentation';
import {downloadAdminWorkbook} from './admin-export';
import {OrderPanel} from './admin-order-panel';
import {OrdersAreaHead} from './orders-area-head';
import {orderPaymentState} from './admin-order-history';
import {OrderAction,OrderExport,OrderFilter,OrderPager,OrderRecord,OrderSites,OrderSummary,OrderViews,recentMonths} from './order-list-parts';
function monthRange(back=0){const today=israelDate(new Date().toISOString()),first=new Date(Date.UTC(Number(today.slice(0,4)),Number(today.slice(5,7))-1-back,1,12)),month=first.toISOString().slice(0,7),end=new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth()+1,0,12)).toISOString().slice(0,10);return {from:month+'-01',to:end,basis:'payment'};}
const defaultRange=()=>monthRange();
const rangeOf=(month:string)=>{const end=new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5)),0,12)).toISOString().slice(0,10);return {from:month+'-01',to:end,basis:'payment'};};
export default function AdminMonthClose({ctx}:{ctx:Ctx}){
 const [applied,setApplied]=useState(()=>({...adminViewState('month-close',defaultRange()),basis:'payment'})),[draft,setDraft]=useState(applied),[error,setError]=useState(''),[rangeError,setRangeError]=useState(false),[page,setPage]=useState(1),[open,setOpen]=useState(''),[view,setView]=useState('all'),fromInput=useRef<HTMLInputElement>(null),toInput=useRef<HTMLInputElement>(null);
 const params=new URLSearchParams(applied),state=useData('admin/month-close?'+params,ctx.revision),data=state.data,current=!!data&&data.from===applied.from&&data.to===applied.to&&data.basis===applied.basis;
 const summary=current?data.summary:null,allOrders:Row[]=current?data.orders:[],missingCost=allOrders.filter(o=>o.cost_net===null).length,orders=view==='missing'?allOrders.filter(o=>o.cost_net===null):allOrders,maxPage=Math.max(1,Math.ceil(orders.length/20)),shownPage=Math.min(page,maxPage);
 const apply=(range:typeof draft)=>{setRangeError(false);setError('');setOpen('');setPage(1);setView('all');setDraft(range);setApplied({...range});saveAdminViewState('month-close',{...range});};
 const show=()=>{if(!validReportDay(draft.from)||!validReportDay(draft.to)||draft.from>draft.to){setRangeError(true);(!validReportDay(draft.from)?fromInput:toInput).current?.focus();setError('יש לבחור טווח תקין: תאריך הסיום לא יכול להיות לפני תאריך ההתחלה.');return;}apply(draft);};
 const exportReport=()=>downloadAdminWorkbook('admin/month-close?'+new URLSearchParams({...applied,export:'1'}),'month-close-'+applied.from+'-'+applied.to+'.xlsx');
 const thisMonth=monthRange(0),lastMonth=monthRange(1),selected=applied.from===thisMonth.from&&applied.to===thisMonth.to?'this':applied.from===lastMonth.from&&applied.to===lastMonth.to?'last':'other',months=recentMonths(),fullMonth=months.find(m=>rangeOf(m).from===applied.from&&rangeOf(m).to===applied.to);
 return <section className="orders-match-screen om-finance sv2 sv2-orders sv2-fin" dir="rtl"><OrdersAreaHead ctx={ctx} current="admin-month-close" title="סגירת חודש" sub="תשלומים שאושרו סופית בתקופה שנבחרה." action={<div className="om-top-actions"><OrderExport run={exportReport} disabled={!current}/></div>}/><div className="orders-reference-panel">
  <div className="om-period"><OrderViews label="בחירת תקופה" value={selected} onChange={v=>apply(v==='this'?thisMonth:lastMonth)} views={[['this','החודש'],['last','החודש הקודם']]}/><OrderFilter label="בחירת חודש" icon={<CalendarDays size={20}/>} value={fullMonth||'custom'} onChange={v=>{if(v!=='custom')apply(rangeOf(v));}} options={{custom:'טווח מותאם',...Object.fromEntries(months.map(m=>[m,historyMonthLabel(m)]))}}/></div>
  <details className="om-range" open={rangeError||undefined}><summary>טווח תאריכים אחר</summary><form noValidate onSubmit={e=>{e.preventDefault();show();}}><label><span>מתאריך</span><input ref={fromInput} aria-invalid={rangeError} aria-describedby={rangeError?"month-range-error":undefined} type="date" value={draft.from} onChange={e=>setDraft(d=>({...d,from:e.target.value}))}/></label><label><span>עד תאריך</span><input ref={toInput} aria-invalid={rangeError} aria-describedby={rangeError?"month-range-error":undefined} type="date" value={draft.to} onChange={e=>setDraft(d=>({...d,to:e.target.value}))}/></label><button type="submit" className="om-btn is-primary">הצגת סיכום</button></form></details>
  {(error||state.error)&&<div className="orders-reference-error" role="alert"><p id="month-range-error">{error||state.error}</p>{state.error&&<button type="button" onClick={ctx.refresh}>ניסיון נוסף</button>}</div>}
  {!current&&!state.error?<div className="orders-reference-loading" role="status">טוען סיכום…</div>:summary&&<>
   <OrderSummary items={[['הכנסות כולל מע״מ',<bdi key="t">{orderMoney(summary.total)}</bdi>,'strong'],['הכנסות לפני מע״מ',<bdi key="n">{orderMoney(summary.net)}</bdi>],['מע״מ',<bdi key="v">{orderMoney(summary.vat)}</bdi>],['עלויות לפני מע״מ',<bdi key="c">{orderMoney(summary.cost_net??summary.cost_known)}</bdi>,summary.cost_net===null?'report':undefined,summary.cost_net===null?'חלקי, חסרות עלויות':undefined],['רווח לפני מס',summary.profit_net===null?'לא הושלם':<bdi key="p">{orderMoney(summary.profit_net)}</bdi>,summary.profit_net===null?'report':'ok']]}/>
   <p className="om-note"><bdi>{orderDate(applied.from)} – {orderDate(applied.to)}</bdi> · לפי מועד אישור התשלום הסופי בשעון ישראל. לא כולל הוצאות עסקיות שלא תועדו.{data.missing_payment_dates>0&&<> {data.missing_payment_dates} הזמנות ללא מועד אישור מתועד אינן משויכות לטווח.</>}</p>
   <OrderViews label="איזה הזמנות להציג" value={view} onChange={v=>{setView(v);setPage(1);setOpen('');}} views={[['all','כל ההזמנות',allOrders.length],['missing','חסרה עלות',missingCost]]}/>
   {!orders.length?<div className="orders-reference-empty"><h3>אין הזמנות בתצוגה הזו</h3><p>לא נמצאו הזמנות ששולמו ואושרו בטווח שנבחר.</p></div>:<>
    <div className="om-head" aria-hidden="true"><span>הזמנה</span><span>לקוח</span><span>אתרים</span><span>תשלום</span><span>עלות ורווח</span><span>הכנסה נטו</span><span/><span/></div>
    <div className="om-list" aria-label="הזמנות בתקופה">{orders.slice((shownPage-1)*20,shownPage*20).map(o=>{const isOpen=open===o.id,pay=orderPaymentState(o);return <OrderRecord key={o.id} id={o.id} tone={pay.tone} label={orderNumber(o)} open={isOpen} onToggle={()=>setOpen(isOpen?'':o.id)} panel={<OrderPanel ctx={ctx} order={o} profit manage={()=>ctx.go('admin-order/'+o.id)}/>}>
      <div className="om-id"><strong><bdi>{orderNumber(o)}</bdi></strong><time>{orderDate(o.paid_date||o.paid_at)}</time></div>
      <div className="om-who"><b>{o.user_name||o.name}</b><span>{o.on_account||o.payment==='monthly'||o.billing_month?<span className="is-monthly">הזמנה חודשית</span>:'הזמנה רגילה'}</span></div>
      <OrderSites order={o}/>
      <div className="om-pay"><span className={'om-pill is-'+pay.tone}>{pay.label}</span>{pay.note&&<small>{pay.note}</small>}</div>
      <div className="om-pub om-profit-cell">{o.cost_net===null?<span className="om-pill is-report">חסרה עלות</span>:<><small>עלות <bdi>{orderMoney(o.cost_net)}</bdi></small><b className={Number(o.profit_net)<0?'is-loss':undefined}>רווח <bdi>{o.profit_net===null?'—':orderMoney(o.profit_net)}</bdi></b></>}</div>
      <div className="om-amount"><bdi>{orderMoney(o.income_net)}</bdi></div>
      <OrderAction label="ניהול הזמנה" href={'/admin-order/'+o.id} onClick={()=>ctx.go('admin-order/'+o.id)}/>
     </OrderRecord>;})}</div>
    <OrderPager page={shownPage} total={orders.length} size={20} onChange={value=>{setOpen('');setPage(value);}}/>
   </>}
  </>}
 </div></section>;
}
