'use client';
import React,{useState} from 'react';
import {ChevronLeft} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {useData} from '@/lib/client';
import type {Row} from '@/lib/shared';
import {historyMonthLabel} from '@/lib/order-history';
import {effectiveOrderTotal,orderCancellation} from '@/lib/order-finance';
import {paymentConfirmed} from '@/lib/admin-order-buckets';
import {FinancePage,FinanceSearch,FinanceSelect,FinanceStatus,FinanceRecord,FinanceItems,FinancePages,FinanceEmpty} from './finance-records';
import {MonthlyOrderActions} from './monthly-order-actions';
import {orderMoney,orderNumber} from './order-presentation';
import type {Ctx} from './workspace';

export function monthlyStatus(order:Row){return orderCancellation(order)==='full'?'cancelled':paymentConfirmed(order)?'paid':order.purchase_closed_at||order.monthly_closed||order.payment_report_status==='pending'?'closed':'open';}
const labels:Record<string,string>={open:'פתוחה לרכישות',closed:'נסגרה לתשלום',paid:'סגורה · שולמה',cancelled:'בוטלה'};
function MonthlyOrderDetails({ctx,row}:{ctx:Ctx;row:Row}){
 const state=useData('orders/'+row.id,ctx.revision,true,15000),order=state.data?.order?{...row,...state.data.order}:null;
 if(!order)return <FinanceEmpty loading={state.loading} error={state.error} retry={ctx.refresh}/>;
 return <><FinanceEmptyError error={state.error} retry={ctx.refresh}/><FinanceItems order={order} items={state.data?.articles||[]} dates/><div className="finance-action-row"><Button variant="outline" onClick={()=>ctx.go('admin-order/'+order.id)}>לפרטי ההזמנה<ChevronLeft size={16}/></Button><MonthlyOrderActions ctx={ctx} order={order}/></div></>;
}
function FinanceEmptyError({error,retry}:{error:string;retry:()=>void}){return error?<FinanceEmpty error={error} retry={retry}/>:null;}
export function MonthlyView({ctx,initialFilter='all',realOnly=false}:{ctx:Ctx;initialFilter?:string;realOnly?:boolean}){
 const state=useData('monthly?view=orders',ctx.revision,true,15000),[month,setMonth]=useState('all'),[search,setSearch]=useState(''),[filter,setFilter]=useState(initialFilter==='open'?'unpaid':initialFilter),[open,setOpen]=useState(''),[page,setPage]=useState(1);
 const all:Row[]=state.data?.order_rows||[],term=search.trim().toLocaleLowerCase(),months=[...new Set(all.map(o=>o.month||o.billing_month))].sort().reverse(),rows=all.filter(o=>(!realOnly||!o.demo)&&(month==='all'||(o.month||o.billing_month)===month)&&(!term||[o.number,o.user_name,o.name,o.email,o.site_search].some(v=>String(v||'').toLocaleLowerCase().includes(term)))&&(filter==='all'||filter==='unpaid'&&!paymentConfirmed(o)&&monthlyStatus(o)!=='cancelled'||monthlyStatus(o)===filter)),shown=Math.min(page,Math.max(1,Math.ceil(rows.length/30)));
 return <FinancePage title="חשבונות חודשיים" description="הזמנה חודשית אחת לכל לקוח, עם פירוט האתרים שנוספו אליה." className="finance-monthly-page"><div className="finance-filters"><FinanceSearch value={search} onChange={v=>{setSearch(v);setPage(1);}}/><FinanceSelect label="חודש החשבון" value={month} onChange={v=>{setMonth(v);setPage(1);}} options={{all:'כל החודשים',...Object.fromEntries(months.map(m=>[m,historyMonthLabel(m)]))}}/><FinanceSelect label="סטטוס חשבון חודשי" value={filter} onChange={v=>{setFilter(v);setPage(1);}} options={{all:'כל הסטטוסים',unpaid:'טרם שולמו',open:'פתוחות לרכישות',closed:'נסגרו לתשלום',paid:'שולמו',cancelled:'בוטלו'}}/></div><div className="finance-list-heading" aria-hidden="true"><span>הזמנה</span><span>לקוח</span><span>חודש</span><span>פריטים</span><span>סכום כולל מע״מ</span><span>מצב</span><span/></div>{rows.length?rows.slice((shown-1)*30,shown*30).map(o=>{const status=monthlyStatus(o);return <FinanceRecord key={o.id} id={o.id} label={'פירוט חשבון חודשי '+orderNumber(o)} open={open===o.id} onToggle={()=>setOpen(open===o.id?'':o.id)} summary={<><span className="finance-record-number"><bdi>{orderNumber(o)}</bdi></span><span className="finance-record-name">{o.user_name||o.name}<small className="finance-phone-only">{historyMonthLabel(o.month||o.billing_month)}{o.demo?' · הדגמה':''}</small></span><span className="finance-record-date">{historyMonthLabel(o.month||o.billing_month)}</span><span className="finance-record-count">{o.article_count||0}</span><strong className="finance-record-amount"><bdi>{orderMoney(effectiveOrderTotal(o))}</bdi></strong><FinanceStatus tone={status==='paid'?'success':status==='cancelled'?'danger':'pending'}>{o.demo?'הדגמה · ':''}{labels[status]}</FinanceStatus></>}><MonthlyOrderDetails ctx={ctx} row={o}/></FinanceRecord>;}):<FinanceEmpty loading={state.loading} error={state.error} retry={ctx.refresh}>אין הזמנות חודשיות בתצוגה הזו.</FinanceEmpty>}{rows.length>0&&state.error&&<FinanceEmpty error={state.error} retry={ctx.refresh}/>}<FinancePages total={rows.length} page={shown} onChange={setPage}/>{all.length===1000&&<p className="finance-count-note">מוצגות עד 1,000 ההזמנות האחרונות. לפירוט ישן יותר ניתן לפתוח את תיק הלקוח.</p>}</FinancePage>;
}
