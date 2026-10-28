'use client';
import React,{useRef,useState} from 'react';
import {ChevronLeft,Download} from 'lucide-react';
import {useData} from '@/lib/client';
import {money,type Row} from '@/lib/shared';
import {israelDate} from '@/lib/admin-order-buckets';
import {validReportDay} from '@/lib/admin-date-range';
import {adminViewState,saveAdminViewState} from '@/lib/admin-view-state';
import type {Ctx} from './workspace';
import {orderDate} from './customer-order-screen';
import {Button} from '@/components/ui/button';
import {FinancePage,FinanceRecord,FinanceFacts,FinanceFact,FinancePages,FinanceEmpty} from './finance-records';
import {orderMoney,orderNumber,orderTimestamp} from './order-presentation';
import {downloadAdminWorkbook} from './admin-export';
function defaultRange(){const today=israelDate(new Date().toISOString()),month=today.slice(0,7),end=new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5)),0,12)).toISOString().slice(0,10);return {from:month+'-01',to:end,basis:'payment'};}
const cost=(value:number|null)=>value===null?'חסרה עלות':money(value);
export default function AdminMonthClose({ctx}:{ctx:Ctx}){
 const [applied,setApplied]=useState(()=>({...adminViewState('month-close',defaultRange()),basis:'payment'})),[draft,setDraft]=useState(applied),[error,setError]=useState(''),[rangeError,setRangeError]=useState(false),[exporting,setExporting]=useState(false),[page,setPage]=useState(1),[open,setOpen]=useState(''),lock=useRef(false),fromInput=useRef<HTMLInputElement>(null),toInput=useRef<HTMLInputElement>(null);
 const params=new URLSearchParams(applied),state=useData('admin/month-close?'+params,ctx.revision),data=state.data,current=!!data&&data.from===applied.from&&data.to===applied.to&&data.basis===applied.basis;
 const summary=current?data.summary:null,orders:Row[]=current?data.orders:[],maxPage=Math.max(1,Math.ceil(orders.length/20)),shownPage=Math.min(page,maxPage);
 const show=()=>{if(!validReportDay(draft.from)||!validReportDay(draft.to)||draft.from>draft.to){setRangeError(true);(!validReportDay(draft.from)?fromInput:toInput).current?.focus();setError('יש לבחור טווח תקין: תאריך הסיום לא יכול להיות לפני תאריך ההתחלה.');return;}setRangeError(false);setError('');setPage(1);setApplied({...draft});saveAdminViewState('month-close',{...draft});};
 const exportReport=async()=>{if(lock.current)return;lock.current=true;setExporting(true);setError('');try{await downloadAdminWorkbook('admin/month-close?'+new URLSearchParams({...applied,export:'1'}),'month-close-'+applied.from+'-'+applied.to+'.xlsx');}catch(e){setError((e as Error).message);}finally{setExporting(false);lock.current=false;}};
 return <FinancePage title="סגירת חודש" description="תשלומים שאושרו סופית בתקופה שנבחרה." className="finance-month-close-page">
  <form className="finance-report-range" noValidate onSubmit={e=>{e.preventDefault();show();}}>
   <label><span>מתאריך</span><input ref={fromInput} aria-invalid={rangeError} aria-describedby={rangeError?"month-range-error":undefined} type="date" value={draft.from} onChange={e=>setDraft(d=>({...d,from:e.target.value}))}/></label><label><span>עד תאריך</span><input ref={toInput} aria-invalid={rangeError} aria-describedby={rangeError?"month-range-error":undefined} type="date" value={draft.to} onChange={e=>setDraft(d=>({...d,to:e.target.value}))}/></label>
   <Button type="submit">הצגת סיכום</Button><Button type="button" variant="outline" disabled={!current||exporting} onClick={exportReport}><Download size={17}/>{exporting?'מייצא…':'ייצוא לאקסל'}</Button>
  </form>
  {(error||state.error)&&<div className="finance-empty" role="alert"><p id="month-range-error">{error||state.error}</p>{state.error&&<Button variant="outline" onClick={ctx.refresh}>ניסיון נוסף</Button>}</div>}
  {!current&&!state.error?<FinanceEmpty loading retry={ctx.refresh}/>:summary&&<>
   <section className="finance-report-summary" aria-label="סיכום התקופה"><dl className="finance-report-metrics"><div><dt>הכנסות כולל מע״מ</dt><dd><bdi>{orderMoney(summary.total)}</bdi></dd></div><div><dt>עלויות לפני מע״מ</dt><dd>{summary.cost_net===null?'חסרים נתונים':<bdi>{orderMoney(summary.cost_net)}</bdi>}</dd></div><div><dt>רווח מחושב לפני מס</dt><dd>{summary.profit_net===null?'לא ניתן להשלים':<bdi>{orderMoney(summary.profit_net)}</bdi>}</dd></div></dl><p>הכנסות לפני מע״מ: <bdi>{orderMoney(summary.net)}</bdi> · מע״מ: <bdi>{orderMoney(summary.vat)}</bdi></p><p><bdi>{orderDate(applied.from)} – {orderDate(applied.to)}</bdi> · לפי מועד אישור התשלום הסופי בשעון ישראל</p>
    {summary.cost_missing>0&&<p role="status">חסרים {summary.cost_missing} רכיבי עלות. עלויות ידועות: <bdi>{orderMoney(summary.cost_known)}</bdi>. הרווח יושלם לאחר עדכון הנתונים.</p>}{data.missing_payment_dates>0&&<p>{data.missing_payment_dates} הזמנות ללא מועד אישור מתועד אינן משויכות לטווח הזה.</p>}
   </section><div className="finance-list-heading" aria-hidden="true"><span>הזמנה</span><span>לקוח</span><span>אישור תשלום</span><span>הכנסה נטו</span><span>עלות</span><span>רווח</span><span/></div>
   {orders.length?orders.slice((shownPage-1)*20,shownPage*20).map(o=><FinanceRecord key={o.id} id={o.id} label={'פירוט סיכום הזמנה '+orderNumber(o)} open={open===o.id} onToggle={()=>setOpen(open===o.id?'':o.id)} summary={<><span className="finance-record-number"><bdi>{orderNumber(o)}</bdi></span><span className="finance-record-name">{o.user_name||o.name}<small className="finance-phone-only">{orderDate(o.paid_date||o.paid_at)}</small></span><span className="finance-record-date"><bdi>{orderDate(o.paid_date||o.paid_at)}</bdi></span><strong className="finance-record-amount"><bdi>{orderMoney(o.income_net)}</bdi></strong><span className="finance-record-cost"><span className="finance-phone-only">עלות: </span><bdi>{cost(o.cost_net)}</bdi><span className="finance-phone-only"> · רווח: <bdi>{cost(o.profit_net)}</bdi></span></span><strong className="finance-record-profit"><bdi>{cost(o.profit_net)}</bdi></strong></>}><FinanceFacts><FinanceFact label="תאריך ההזמנה"><bdi>{orderTimestamp(o.created)}</bdi></FinanceFact><FinanceFact label="תאריך ביצוע התשלום"><bdi>{orderTimestamp(o.paid_date||o.paid_at)}</bdi></FinanceFact><FinanceFact label="אמצעי תשלום">{o.payment_label}</FinanceFact><FinanceFact label="הכנסה לפני מע״מ"><bdi>{orderMoney(o.income_net)}</bdi></FinanceFact><FinanceFact label="עלות לפני מע״מ"><bdi>{cost(o.cost_net)}</bdi></FinanceFact><FinanceFact label="רווח לפני מס"><bdi>{cost(o.profit_net)}</bdi></FinanceFact><FinanceFact label="דוא״ל"><bdi>{o.user_email||'לא תועד'}</bdi></FinanceFact><FinanceFact label="טלפון"><bdi>{o.user_phone||'לא תועד'}</bdi></FinanceFact></FinanceFacts><Button variant="outline" onClick={()=>ctx.go('admin-order/'+o.id)}>לפרטי ההזמנה<ChevronLeft size={16}/></Button></FinanceRecord>):<FinanceEmpty retry={ctx.refresh}>אין הזמנות ששולמו ואושרו בטווח שנבחר.</FinanceEmpty>}
   <FinancePages page={shownPage} total={orders.length} onChange={setPage} size={20}/><p className="finance-count-note">השיוך לחודש נקבע לפי מועד אישור התשלום. העלויות נלקחות מהתיעוד בעת הרכישה. החישוב אינו כולל הוצאות עסקיות שלא תועדו.</p>
  </>}
 </FinancePage>;
}
