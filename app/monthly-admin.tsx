'use client';
import React,{useState} from 'react';
import {CalendarDays,SlidersHorizontal} from 'lucide-react';
import {useData} from '@/lib/client';
import {exportSpreadsheet} from '@/lib/office';
import type {Row} from '@/lib/shared';
import {historyMonthLabel} from '@/lib/order-history';
import {effectiveOrderTotal,orderCancellation} from '@/lib/order-finance';
import {paymentConfirmed} from '@/lib/admin-order-buckets';
import {MonthlyOrderActions,CloseMonthlyOrder,ReceiveMonthlyPayment} from './monthly-order-actions';
import {orderMoney,orderNumber} from './order-presentation';
import {OrderPanel} from './admin-order-panel';
import {OrderAction,OrderExport,OrderFilter,OrderFilters,OrderPager,OrderPublication,OrderRecord,OrderSearch,OrderSites,OrderSummary,OrderViews} from './order-list-parts';
import type {Ctx} from './workspace';
import {OrdersAreaHead} from './orders-area-head';

export function monthlyStatus(order:Row){return orderCancellation(order)==='full'?'cancelled':paymentConfirmed(order)?'paid':order.purchase_closed_at||order.monthly_closed||order.payment_report_status==='pending'?'closed':'open';}
const labels:Record<string,string>={open:'פתוחה לרכישות',closed:'נסגרה לתשלום',paid:'שולמה',cancelled:'בוטלה'},tones:Record<string,string>={open:'month',closed:'report',paid:'ok',cancelled:'cancelled'};
const notes:Record<string,string>={open:'אפשר להוסיף רכישות',closed:'ממתינה לתשלום',paid:'',cancelled:''};
const accounts=(n:number)=>n===1?'חשבון אחד':n===2?'שני חשבונות':n+' חשבונות';
export function MonthlyView({ctx,initialFilter='all',realOnly=false}:{ctx:Ctx;initialFilter?:string;realOnly?:boolean}){
 const state=useData('monthly?view=orders',ctx.revision,true,15000),[month,setMonth]=useState('all'),[search,setSearch]=useState(''),[filter,setFilter]=useState(initialFilter==='all'||initialFilter==='open'?'unpaid':initialFilter),[open,setOpen]=useState(''),[page,setPage]=useState(1);
 const all:Row[]=state.data?.order_rows||[],term=search.trim().toLocaleLowerCase(),months=[...new Set(all.map(o=>o.month||o.billing_month))].sort().reverse();
 const scoped=all.filter(o=>(!realOnly||!o.demo)&&(month==='all'||(o.month||o.billing_month)===month)&&(!term||[o.number,o.user_name,o.name,o.email,o.site_search].some(v=>String(v||'').toLocaleLowerCase().includes(term))));
 const rows=scoped.filter(o=>filter==='all'||filter==='unpaid'&&!paymentConfirmed(o)&&monthlyStatus(o)!=='cancelled'||monthlyStatus(o)===filter),shown=Math.min(page,Math.max(1,Math.ceil(rows.length/30)));
 const real=scoped.filter(o=>!o.demo),sum=(status:string)=>real.filter(o=>monthlyStatus(o)===status).reduce((n,o)=>n+effectiveOrderTotal(o),0),count=(status:string)=>real.filter(o=>monthlyStatus(o)===status).length,unpaid=scoped.filter(o=>!paymentConfirmed(o)&&monthlyStatus(o)!=='cancelled').length;
 const view=(v:string)=>{setFilter(v);setPage(1);setOpen('');};
 const exportRows=()=>exportSpreadsheet('monthly-'+(month==='all'?'all':month)+'.xlsx',[['הזמנה','לקוח','דוא״ל','חודש','פריטים','סכום כולל מע״מ','מצב'],...rows.map(o=>[orderNumber(o),o.user_name||o.name,o.email||'',historyMonthLabel(o.month||o.billing_month),Number(o.article_count||0),effectiveOrderTotal(o)/100,(o.demo?'הדגמה · ':'')+labels[monthlyStatus(o)]])]);
 const dialog=(o:Row,closing:boolean)=>ctx.open({kind:'admin-finance',title:closing?'סגירת חודש':'דיווח על קבלת תשלום',render:(close:()=>void)=>closing?<CloseMonthlyOrder ctx={ctx} order={o} close={close}/>:<ReceiveMonthlyPayment ctx={ctx} order={o} close={close}/>});
 return <section className="orders-match-screen om-finance sv2 sv2-orders sv2-fin" dir="rtl"><OrdersAreaHead ctx={ctx} current="admin-monthly" title="חשבונות חודשיים" sub="הזמנה חודשית אחת לכל לקוח." action={<div className="om-top-actions"><OrderExport run={exportRows} disabled={!rows.length}/></div>}/><div className="orders-reference-panel">
  <OrderSummary items={[['פתוח לרכישות',<bdi key="o">{orderMoney(sum('open'))}</bdi>,count('open')?'month':undefined,accounts(count('open'))],['נסגר, ממתין לתשלום',<bdi key="c">{orderMoney(sum('closed'))}</bdi>,count('closed')?'report':undefined,accounts(count('closed'))],['שולם',<bdi key="p">{orderMoney(sum('paid'))}</bdi>,count('paid')?'ok':undefined,accounts(count('paid'))]]}/>
  <div className="orders-reference-toolbar om-toolbar"><OrderSearch label="חיפוש לקוח, מספר הזמנה או אתר" value={search} onChange={v=>{setSearch(v);setPage(1);}}/><OrderFilters active={(month!=='all'?1:0)+(['open','closed','cancelled'].includes(filter)?1:0)}><OrderFilter label="חודש החשבון" icon={<CalendarDays size={20}/>} value={month} onChange={v=>{setMonth(v);setPage(1);}} options={{all:'כל החודשים',...Object.fromEntries(months.map(m=>[m,historyMonthLabel(m)]))}}/><OrderFilter label="סינון לפי מצב" icon={<SlidersHorizontal size={20}/>} value={['open','closed','cancelled'].includes(filter)?filter:'any'} onChange={v=>view(v==='any'?'all':v)} options={{any:'כל המצבים',open:'פתוחות לרכישות',closed:'נסגרו לתשלום',cancelled:'בוטלו'}}/></OrderFilters></div>
  <OrderViews label="איזה חשבונות להציג" value={filter} onChange={view} views={[['unpaid','טרם שולמו',unpaid],['paid','שולמו'],['all','הכול']]}/>
  {!state.data&&!state.error?<div className="orders-reference-loading" role="status">טוען חשבונות…</div>:state.error&&!rows.length?<div className="orders-reference-error" role="alert"><p>{state.error}</p><button type="button" onClick={ctx.refresh}>ניסיון נוסף</button></div>:!rows.length?<div className="orders-reference-empty"><h3>אין חשבונות בתצוגה הזו</h3><p>אפשר לשנות את החודש או את המצב, או לנקות את החיפוש.</p></div>:<>
   <div className="om-head" aria-hidden="true"><span>הזמנה</span><span>לקוח</span><span>אתרים</span><span>מצב החשבון</span><span>פרסום</span><span>סכום</span><span/><span/></div>
   <div className="om-list" aria-label="רשימת החשבונות החודשיים">{rows.slice((shown-1)*30,shown*30).map(o=>{const status=monthlyStatus(o),isOpen=open===o.id,live=!o.demo,monthName=historyMonthLabel(o.month||o.billing_month);return <OrderRecord key={o.id} id={o.id} tone={tones[status]} label={orderNumber(o)} open={isOpen} onToggle={()=>setOpen(isOpen?'':o.id)} panel={<OrderPanel ctx={ctx} order={o} manage={()=>ctx.go('admin-order/'+o.id)} actions={merged=><MonthlyOrderActions ctx={ctx} order={{...o,...merged}}/>}/>}>
     <div className="om-id"><strong><bdi>{orderNumber(o)}</bdi></strong><time>{monthName}</time></div>
     <div className="om-who"><b>{o.user_name||o.name}</b><span className="is-monthly">{o.demo?'הדגמה':'הזמנה חודשית'}</span></div>
     <OrderSites order={o}/>
     <div className="om-pay"><span className={'om-pill is-'+tones[status]}>{labels[status]}</span>{notes[status]&&<small>{notes[status]}</small>}</div>
     <div className="om-pub"><OrderPublication o={o}/></div>
     <div className="om-amount"><bdi>{orderMoney(effectiveOrderTotal(o))}</bdi></div>
     {live&&status==='open'?<OrderAction primary label="סגירת חודש" onClick={()=>dialog(o,true)}/>:live&&status==='closed'?<OrderAction primary label="דיווח קבלת תשלום" onClick={()=>dialog(o,false)}/>:<OrderAction label="ניהול הזמנה" href={'/admin-order/'+o.id} onClick={()=>ctx.go('admin-order/'+o.id)}/>}
    </OrderRecord>;})}</div>
  </>}
  <OrderPager total={rows.length} page={shown} size={30} onChange={setPage}/>{all.length===1000&&<p className="om-note">מוצגות עד 1,000 ההזמנות האחרונות. לפירוט ישן יותר ניתן לפתוח את תיק הלקוח.</p>}
 </div></section>;
}
