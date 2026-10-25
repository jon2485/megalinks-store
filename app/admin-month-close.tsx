'use client';
import Link from 'next/link';
import React,{useRef,useState} from 'react';
import {ChevronLeft,ChevronRight,ChevronDown,Download} from 'lucide-react';
import {useData} from '@/lib/client';
import {money,type Row} from '@/lib/shared';
import {israelDate} from '@/lib/admin-order-buckets';
import {validReportDay} from '@/lib/admin-date-range';
import {adminViewState,saveAdminViewState} from '@/lib/admin-view-state';
import type {Ctx} from './workspace';
import {orderDate} from './customer-order-screen';
import {downloadAdminWorkbook} from './admin-export';
function defaultRange(){const today=israelDate(new Date().toISOString()),month=today.slice(0,7),end=new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5)),0,12)).toISOString().slice(0,10);return {from:month+'-01',to:end,basis:'payment'};}
const cost=(value:number|null)=>value===null?'חסרה עלות':money(value);
export default function AdminMonthClose({ctx}:{ctx:Ctx}){
 const [applied,setApplied]=useState(()=>adminViewState('month-close',defaultRange())),[draft,setDraft]=useState(applied),[error,setError]=useState(''),[rangeError,setRangeError]=useState(false),[exporting,setExporting]=useState(false),[page,setPage]=useState(1),lock=useRef(false),fromInput=useRef<HTMLInputElement>(null),toInput=useRef<HTMLInputElement>(null);
 const params=new URLSearchParams(applied),state=useData('admin/month-close?'+params,ctx.revision),data=state.data,current=!!data&&data.from===applied.from&&data.to===applied.to&&data.basis===applied.basis;
 const summary=current?data.summary:null,orders:Row[]=current?data.orders:[],maxPage=Math.max(1,Math.ceil(orders.length/20)),shownPage=Math.min(page,maxPage);
 const show=()=>{if(!validReportDay(draft.from)||!validReportDay(draft.to)||draft.from>draft.to){setRangeError(true);(!validReportDay(draft.from)?fromInput:toInput).current?.focus();setError('יש לבחור טווח תקין: תאריך הסיום לא יכול להיות לפני תאריך ההתחלה.');return;}setRangeError(false);setError('');setPage(1);setApplied({...draft});saveAdminViewState('month-close',{...draft});};
 const exportReport=async()=>{if(lock.current)return;lock.current=true;setExporting(true);setError('');try{await downloadAdminWorkbook('admin/month-close?'+new URLSearchParams({...applied,export:'1'}),'month-close-'+applied.from+'-'+applied.to+'.xlsx');}catch(e){setError((e as Error).message);}finally{setExporting(false);lock.current=false;}};
 const back=(e:React.MouseEvent<HTMLAnchorElement>)=>{if(e.button||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;e.preventDefault();ctx.go('admin-orders');};
 return <section className="admin-guide guide-month-close" dir="rtl">
  <header className="guide-heading"><div><h1>סגירת חודש</h1><p>סיכום הכנסות, עלויות ורווח לפי נתוני המערכת</p></div><Link prefetch={false} className="guide-back-link" href="/admin-orders" onClick={back}>חזרה להזמנות<ChevronLeft size={20}/></Link></header>
  <form className="guide-report-filters guide-frame" noValidate onSubmit={e=>{e.preventDefault();show();}}>
   <label className="guide-select-label"><span>מתאריך</span><input ref={fromInput} aria-invalid={rangeError} aria-describedby={rangeError?"month-range-error":undefined} type="date" value={draft.from} onChange={e=>setDraft(d=>({...d,from:e.target.value}))}/></label><label className="guide-select-label"><span>עד תאריך</span><input ref={toInput} aria-invalid={rangeError} aria-describedby={rangeError?"month-range-error":undefined} type="date" value={draft.to} onChange={e=>setDraft(d=>({...d,to:e.target.value}))}/></label>
   <label className="guide-select-label guide-basis"><span>בסיס התאריך</span><select value={draft.basis} onChange={e=>setDraft(d=>({...d,basis:e.target.value}))}><option value="payment">לפי תאריך תשלום</option><option value="order">לפי תאריך הזמנה</option></select></label>
   <div className="guide-report-filter-actions"><button type="submit" className="guide-button is-primary">הצגת סיכום</button><button type="button" className="guide-button" disabled={!current||exporting} onClick={exportReport}><Download size={18}/>{exporting?'מייצא…':'ייצוא לאקסל'}</button></div>
   <p className="guide-hint">הייצוא לפי הטווח המוצג בסיכום. שינוי תאריכים נכנס לתוקף בלחיצה על ״הצגת סיכום״.</p>
  </form>
  {(error||state.error)&&<div className="guide-error" role="alert"><p id="month-range-error">{error||state.error}</p>{state.error&&<button className="guide-button" type="button" onClick={ctx.refresh}>ניסיון נוסף</button>}</div>}
  {!current&&!state.error?<p className="guide-empty" role="status">מחשב את סיכום התקופה…</p>:summary&&<>
   <section className="guide-frame guide-report-summary" aria-labelledby="month-summary-title"><div className="guide-section-heading"><h2 id="month-summary-title">סיכום התקופה</h2><p><bdi>{orderDate(applied.from)} – {orderDate(applied.to)}</bdi> · {applied.basis==='payment'?'לפי תאריך תשלום':'לפי תאריך הזמנה'}</p></div>
    <dl className="guide-summary-lines"><div><dt>הכנסות לפני מע״מ</dt><dd><bdi>{money(summary.net)}</bdi></dd></div><div><dt>מע״מ על ההכנסות</dt><dd><bdi>{money(summary.vat)}</bdi></dd></div><div><dt>הכנסות כולל מע״מ</dt><dd><bdi>{money(summary.total)}</bdi></dd></div><div><dt>עלויות לפני מע״מ</dt><dd>{summary.cost_net===null?<span>חסרים נתוני עלות</span>:<bdi>{money(summary.cost_net)}</bdi>}</dd></div><div className="guide-summary-profit"><dt>רווח מחושב לפני מס</dt><dd>{summary.profit_net===null?<span>לא ניתן להשלים</span>:<bdi>{money(summary.profit_net)}</bdi>}</dd></div></dl>
    <p className="guide-hint">{summary.paid_orders} הזמנות ששולמו ואושרו · לפי העלויות הישירות המתועדות במערכת. החישוב אינו כולל הוצאות עסקיות שלא תועדו.</p>
    {summary.cost_missing>0&&<p className="guide-report-warning" role="status">חסרים {summary.cost_missing} רכיבי עלות. העלויות הידועות: <bdi>{money(summary.cost_known)}</bdi>. הסיכום אינו מציג רווח מלא עד להשלמת הנתונים.</p>}
    {data.missing_payment_dates>0&&<p className="guide-report-warning">{data.missing_payment_dates} הזמנות ששולמו ללא תאריך תשלום מתועד אינן משויכות לטווח. ניתן למצוא אותן בהזמנות סגורות, תחת ״תאריך לא תועד״.</p>}
    <p className="guide-hint">העלויות נשמרו בזמן הרכישה ואינן תשלומים שבוצעו לספק. זיכוי ללקוח מפחית הכנסה; הוא אינו מבטל עלות ספק שנרשמה.</p>
   </section>
   <section className="guide-frame guide-report-orders" aria-labelledby="month-orders-title"><div className="guide-section-heading"><h2 id="month-orders-title">ההזמנות לפי הסינון ({orders.length})</h2><p>{applied.basis==='payment'?'תשלומים שאושרו בטווח שנבחר':'כל ההזמנות שנוצרו בטווח; הכנסה נכללת רק לאחר אישור התשלום'}</p></div>
    {!orders.length?<p className="guide-empty">אין הזמנות בטווח שנבחר. אפשר לשנות את התאריכים ולהציג סיכום חדש.</p>:<><div className="guide-report-table-heading" aria-hidden="true"><span>הזמנה ולקוח</span><span>תאריך תשלום</span><span>הכנסה לפני מע״מ</span><span>עלות</span><span>רווח</span><span/></div><div className="guide-report-order-list">{orders.slice((shownPage-1)*20,shownPage*20).map(o=><details className="guide-report-order" key={o.id}><summary><span className="guide-report-client"><span className={'guide-status '+(o.confirmed?'is-success':'is-warning')}>{o.confirmed?'שולם':'טרם שולם'}</span><span><bdi>{o.number}</bdi><strong>{o.user_name||o.name}</strong></span></span><span className="guide-desktop-amounts">{o.confirmed?orderDate(o.paid_date||o.payment_date||o.paid_at):'—'}</span><bdi className="guide-report-income">{money(o.income_net)}</bdi><span className="guide-desktop-amounts"><bdi>{o.confirmed?cost(o.cost_net):'טרם שולם'}</bdi></span><span className="guide-desktop-amounts"><bdi>{o.confirmed?cost(o.profit_net):'טרם שולם'}</bdi></span><ChevronDown size={18}/></summary><div className="guide-report-order-detail"><dl><div><dt>תאריך ההזמנה</dt><dd>{orderDate(o.created)}</dd></div><div><dt>תאריך התשלום</dt><dd>{o.confirmed?orderDate(o.paid_date||o.payment_date||o.paid_at):'טרם שולם'}</dd></div><div><dt>אופן התשלום</dt><dd>{o.payment_label}</dd></div><div><dt>הכנסה לפני מע״מ</dt><dd><bdi>{money(o.income_net)}</bdi></dd></div><div><dt>עלות לפני מע״מ</dt><dd><bdi>{cost(o.cost_net)}</bdi></dd></div><div><dt>רווח לפני מס</dt><dd><bdi>{o.confirmed?cost(o.profit_net):'טרם שולם'}</bdi></dd></div><div><dt>דוא״ל</dt><dd><bdi>{o.user_email||'לא תועד'}</bdi></dd></div><div><dt>טלפון</dt><dd><bdi>{o.user_phone||'לא תועד'}</bdi></dd></div></dl><button className="guide-button" type="button" onClick={()=>ctx.go('admin-order/'+o.id)}>לפרטי ההזמנה<ChevronLeft size={17}/></button></div></details>)}</div>
    <footer className="guide-pagination"><span>{(shownPage-1)*20+1}–{Math.min(shownPage*20,orders.length)} מתוך {orders.length}</span>{maxPage>1&&<nav aria-label="עמודי דוח"><button className="guide-button" type="button" disabled={shownPage<=1} onClick={()=>setPage(shownPage-1)}><ChevronRight size={17}/>הקודם</button><span>{shownPage}</span><button className="guide-button" type="button" disabled={shownPage>=maxPage} onClick={()=>setPage(shownPage+1)}>הבא<ChevronLeft size={17}/></button></nav>}</footer></>}
    <p className="guide-report-export-note">באקסל: שורה מסכמת לכל לקוח, עם כל מספרי ההזמנות שלו בטווח, פרטי קשר, הכנסות, עלויות ורווח. הייצוא כולל את כל עמודי הדוח.</p>
   </section>
  </>}
 </section>;
}
