'use client';
import React,{useCallback,useEffect,useRef,useState} from 'react';
import {Search,Download,X,CalendarDays,ChevronLeft,ChevronRight,SlidersHorizontal} from 'lucide-react';
import {Select,SelectTrigger,SelectValue,SelectContent,SelectItem} from '@/components/ui/select';
import {useData} from '@/lib/client';
import {adminViewState,saveAdminViewState} from '@/lib/admin-view-state';
import {adminOrderFilterLabels,paymentConfirmed,israelDate,type AdminOrderFilterBucket} from '@/lib/admin-order-buckets';
import {orderCancellation} from '@/lib/order-finance';
import {historyMonthLabel} from '@/lib/order-history';
import type {Row} from '@/lib/shared';
import type {Ctx} from './workspace';
import {downloadAdminWorkbook} from './admin-export';
import './orders-reference.css';
import {AdminOrderDetails} from './customer-orders';

const amount=(cents:number)=>new Intl.NumberFormat('he-IL',{style:'currency',currency:'ILS',minimumFractionDigits:0,maximumFractionDigits:2}).format(Number(cents||0)/100).replace(/\u00a0/g,'');
const monthNow=()=>israelDate(new Date().toISOString()).slice(0,7);
const monthText=(m:string)=>m==='unknown'?'מועד לא תועד':m===monthNow()?'החודש':historyMonthLabel(m);
const orderDate=(value:string)=>value?new Intl.DateTimeFormat('he-IL',{timeZone:'Asia/Jerusalem',day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(value)):'לא תועד';
export function orderRowStatus(o:Row){
 if(orderCancellation(o)==='full')return {label:'בוטלה',tone:'cancelled'};
 if(o.demo)return {label:'הדגמה',tone:'muted'};
 if(!paymentConfirmed(o)&&o.payment_report?.status==='pending')return {label:'ממתינה לאישור',tone:'pending'};
 if(!paymentConfirmed(o))return o.on_account||o.payment==='monthly'||o.billing_month?{label:'חשבון חודשי פתוח',tone:'pending'}:{label:'ממתינה לתשלום',tone:'pending'};
 return {label:'סגורה',tone:'complete'};
}
const initial=(unpaid:boolean)=>({bucket:(unpaid?'process':'all') as AdminOrderFilterBucket,month:unpaid?'':monthNow(),q:'',page:1,scroll:0});
export default function AdminOrderHistory({ctx,openOrder,initialUnpaid=false}:{ctx:Ctx;openOrder:(o:Row)=>void;initialUnpaid?:boolean}){
 const memoryKey=initialUnpaid?'orders-reference-unpaid':'orders-reference';
 const [saved,setSaved]=useState(()=>adminViewState(memoryKey,initial(initialUnpaid))),[draft,setDraft]=useState(saved.q),[composing,setComposing]=useState(false),[mobileFilters,setMobileFilters]=useState(false),[exporting,setExporting]=useState(false),[error,setError]=useState(''),[expanded,setExpanded]=useState(''),[visited,setVisited]=useState<string[]>([]);
 const input=useRef<HTMLInputElement>(null),latest=useRef(saved),exportLock=useRef(false),restore=useRef(saved.scroll);
 const params=new URLSearchParams({bucket:saved.bucket,month:saved.month,q:saved.q,page:String(saved.page)}),state=useData('admin/orders?'+params,ctx.revision,true,15000),f=state.data?.filters;
 const current=!!f&&f.bucket===saved.bucket&&f.month===saved.month&&f.q===saved.q&&state.data?.requested_page===saved.page;
 const rows:Row[]=current?state.data.orders:[],total=current?Number(state.data.total):0,page=current?Number(state.data.page):saved.page,pages=Math.max(1,Math.ceil(total/Number(state.data?.page_size||20))),size=Number(state.data?.page_size||20);
 const commit=useCallback((change:Partial<typeof saved>)=>{setError('');setSaved(s=>({...s,...change,page:change.page??1,scroll:0}));},[]);
 useEffect(()=>{latest.current=saved;saveAdminViewState(memoryKey,saved);},[memoryKey,saved]);
 useEffect(()=>{if(composing||draft.trim()===saved.q)return;const id=setTimeout(()=>commit({q:draft.trim()}),300);return()=>clearTimeout(id);},[draft,composing,saved.q,commit]);
 useEffect(()=>{const remember=()=>saveAdminViewState(memoryKey,{...latest.current,scroll:window.scrollY});window.addEventListener('scroll',remember,{passive:true});return()=>window.removeEventListener('scroll',remember);},[memoryKey]);
 useEffect(()=>{if(current&&restore.current){window.scrollTo(0,restore.current);restore.current=0;}},[current]);
 const exportOrders=async()=>{if(exportLock.current||!current)return;exportLock.current=true;setExporting(true);setError('');try{await downloadAdminWorkbook('admin/orders?'+new URLSearchParams({bucket:saved.bucket,month:saved.month,q:saved.q,export:'1'}),'orders-'+saved.bucket+'-'+(saved.month||'all')+'.xlsx');}catch(e){setError((e as Error).message);}finally{setExporting(false);exportLock.current=false;}};
 const detail=(o:Row)=>{saveAdminViewState(memoryKey,{...saved,scroll:window.scrollY});openOrder(o);};
 const months=[...new Set([monthNow(),saved.month,...(state.data?.months||[])].filter(Boolean))].sort().reverse();
 const first=Math.max(1,Math.min(page-2,pages-4)),shownPages=Array.from({length:Math.min(5,pages)},(_,i)=>first+i);
 return <section className="orders-match-screen" dir="rtl" aria-labelledby="orders-list-title">
  <button type="button" className="orders-reference-export" onClick={exportOrders} disabled={exporting||!current}><span>{exporting?'מייצא…':'ייצוא נתונים'}</span><Download size={18}/></button>
  <section className="orders-reference-panel">
   <h2 id="orders-list-title">כל ההזמנות</h2>
   <form className={'orders-reference-toolbar'+(mobileFilters?' filters-open':'')} noValidate role="search" onSubmit={e=>{e.preventDefault();if(!composing)commit({q:draft.trim()});}}>
    <div className="orders-reference-search"><Search size={21} aria-hidden="true"/><input ref={input} type="search" maxLength={120} aria-label="חיפוש לפי לקוח או מספר הזמנה" placeholder="חיפוש לפי לקוח או מספר הזמנה" value={draft} onCompositionStart={()=>setComposing(true)} onCompositionEnd={e=>{setDraft(e.currentTarget.value);setComposing(false);}} onChange={e=>setDraft(e.target.value)}/>{draft&&<button type="button" aria-label="ניקוי חיפוש הזמנות" onClick={()=>{setDraft('');commit({q:''});input.current?.focus();}}><X size={17}/></button>}</div>
    <button type="button" className="orders-reference-filter-toggle" aria-label="סינון הזמנות" aria-expanded={mobileFilters} onClick={()=>setMobileFilters(v=>!v)}><SlidersHorizontal size={20}/></button>
    <div className="orders-reference-status-filter"><Select dir="rtl" value={saved.bucket} onValueChange={v=>commit({bucket:v as AdminOrderFilterBucket})}><SelectTrigger aria-label="סינון לפי סטטוס"><SelectValue/></SelectTrigger><SelectContent position="popper" align="start" sideOffset={5} className="orders-reference-options">{Object.entries(adminOrderFilterLabels).map(([key,label])=><SelectItem key={key} value={key}>{label}</SelectItem>)}</SelectContent></Select></div>
    <div className="orders-reference-month-filter"><Select dir="rtl" value={saved.month||'all'} onValueChange={v=>commit({month:v==='all'?'':v})}><SelectTrigger aria-label="סינון לפי חודש"><span><CalendarDays size={20}/><SelectValue/></span></SelectTrigger><SelectContent position="popper" align="start" sideOffset={5} className="orders-reference-options"><SelectItem value="all">כל החודשים</SelectItem>{months.map(m=><SelectItem key={m} value={m}>{monthText(m)}</SelectItem>)}</SelectContent></Select></div>
   </form>
   {(error||state.error)&&<div className="orders-reference-error" role="alert"><p>{error||state.error}</p><button type="button" onClick={ctx.refresh}>ניסיון נוסף</button></div>}
   {!current&&!state.error?<div className="orders-reference-loading" role="status">טוען הזמנות…</div>:current&&!rows.length?<div className="orders-reference-empty"><h3>אין הזמנות שמתאימות לסינון</h3><p>אפשר לשנות את החודש או את הסטטוס, או לנקות את החיפוש.</p><button type="button" onClick={()=>{setDraft('');commit({bucket:'all',month:'',q:''});}}>הצגת כל ההזמנות</button></div>:<>
    <div className="orders-compact-list" aria-label="רשימת ההזמנות">
     <div className="orders-compact-head" aria-hidden="true"><span>מספר הזמנה</span><span>לקוח</span><span>תאריך</span><span>סכום</span><span>סטטוס</span><span/></div>
     {rows.map(o=>{const status=orderRowStatus(o),open=expanded===o.id;return <article key={o.id} className={'orders-compact-record'+(open?' is-open':'')}>
      <button type="button" className="orders-compact-trigger" aria-label={'פירוט הזמנה '+o.number} aria-expanded={open} aria-controls={'order-inline-'+o.id} onClick={()=>{setExpanded(open?'':o.id);setVisited(ids=>ids.includes(o.id)?ids:[...ids,o.id]);}}>
       <strong className="order-compact-number"><bdi>#{String(o.number).replace(/^#/,'')}</bdi></strong><span className="order-compact-client">{o.user_name||o.name}</span><time className="order-compact-date" dateTime={o.created}>{orderDate(o.created)}</time><strong className="order-compact-amount"><bdi>{amount(o.amounts.total)}</bdi></strong><span className={'orders-reference-badge is-'+status.tone}>{status.label}</span><ChevronLeft className="order-expand-chevron" size={18}/>
      </button>
      <div id={'order-inline-'+o.id} className="orders-inline-motion" inert={!open} aria-hidden={!open}><div><div className="orders-inline-body">
       {visited.includes(o.id)&&<><div className="orders-inline-heading"><h3>פירוט הזמנה #{o.number}</h3><button type="button" className="orders-reference-detail" onClick={()=>detail(o)}>ניהול ההזמנה<ChevronLeft size={16}/></button></div><AdminOrderDetails ctx={ctx} order={o}/></>}
      </div></div></div>
     </article>;})}
    </div>
   </>}
   {current&&total>0&&<footer className="orders-reference-pagination"><span role="status">מציג {(page-1)*size+1}–{Math.min(page*size,total)} מתוך {total} הזמנות</span><nav aria-label="עמודי הזמנות"><button type="button" aria-label="העמוד הקודם" disabled={page<=1||state.loading} onClick={()=>commit({page:page-1})}><ChevronRight size={20}/></button>{shownPages.map(n=><button type="button" key={n} aria-label={'עמוד '+n} aria-current={n===page?'page':undefined} disabled={state.loading} onClick={()=>commit({page:n})}>{n}</button>)}<button type="button" aria-label="העמוד הבא" disabled={page>=pages||state.loading} onClick={()=>commit({page:page+1})}><ChevronLeft size={20}/></button></nav></footer>}
  </section>
 </section>;
}
