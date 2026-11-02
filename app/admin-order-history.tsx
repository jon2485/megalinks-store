'use client';
import React,{useCallback,useEffect,useRef,useState} from 'react';
import {Search,Download,X,CalendarDays,ChevronDown,ChevronLeft,ChevronRight,ChevronUp,Loader2,SlidersHorizontal,XCircle} from 'lucide-react';
import {Select,SelectTrigger,SelectValue,SelectContent,SelectItem} from '@/components/ui/select';
import {api,useData} from '@/lib/client';
import {adminViewState,saveAdminViewState,takeAdminViewState} from '@/lib/admin-view-state';
import {paymentConfirmed,israelDate,ORDER_ABANDONED_DAYS,type AdminOrderFilterBucket} from '@/lib/admin-order-buckets';
import {orderCancellation} from '@/lib/order-finance';
import {historyMonthLabel} from '@/lib/order-history';
import type {Row} from '@/lib/shared';
import type {Ctx} from './workspace';
import {downloadAdminWorkbook} from './admin-export';
import './orders-reference.css';
import './orders-modern.css';
import {OrderPanel} from './admin-order-panel';
import {orderSites,OrderPublication as Publication} from './order-list-parts';
import {orderMoney} from './order-presentation';
import {ReportReview} from './payment-reports';

const amount=(cents:number)=>new Intl.NumberFormat('he-IL',{style:'currency',currency:'ILS',minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(cents||0)/100).replace(/\u00a0/g,'');
const monthNow=()=>israelDate(new Date().toISOString()).slice(0,7);
const monthText=(m:string)=>m==='unknown'?'מועד לא תועד':m===monthNow()?'החודש':historyMonthLabel(m);
const orderDate=(value:string)=>value?new Intl.DateTimeFormat('he-IL',{timeZone:'Asia/Jerusalem',day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(value)):'לא תועד';
export function orderRowStatus(o:Row){
 if(orderCancellation(o)==='full')return {label:'בוטלה',tone:'cancelled'};
 if(Number(o.cancel_pending_count)>0)return {label:'בקשת ביטול',tone:'pending'};
 if(o.demo)return {label:'הדגמה',tone:'muted'};
 if(!paymentConfirmed(o)&&o.payment_report?.status==='pending')return {label:'ממתינה לאישור',tone:'pending'};
 if(!paymentConfirmed(o))return o.on_account||o.payment==='monthly'||o.billing_month?{label:'פתוחה חודשית',tone:'pending'}:{label:'ממתינה לתשלום',tone:'pending'};
 return {label:'סגורה',tone:'complete'};
}
const chips:[AdminOrderFilterBucket,string][]=[['active','כל ההזמנות'],['attention','לטיפול'],['awaiting','ממתינות לתשלום'],['monthly','חודשיות']];
const isAbandoned=(o:Row)=>orderPaymentState(o).label==='נזנחה';
const waitedDays=(value:string)=>Math.floor((Date.now()-+new Date(value))/864e5);
const plain=(e:React.MouseEvent)=>e.button===0&&!e.metaKey&&!e.ctrlKey&&!e.shiftKey&&!e.altKey;
const reportPending=(o:Row)=>!paymentConfirmed(o)&&o.payment_report?.status==='pending'&&!['card','credits_card'].includes(o.payment);
export function orderPaymentState(o:Row){
 if(orderCancellation(o)==='full')return {label:'בוטלה',tone:'cancelled',note:''};
 if(o.demo)return {label:'הדגמה',tone:'cancelled',note:''};
 if(paymentConfirmed(o))return {label:'שולם',tone:'ok',note:o.payment_label||''};
 if(o.payment_report?.status==='pending')return {label:'ממתין לאישור תשלום',tone:'report',note:o.payment_report.reference?'אסמכתא '+o.payment_report.reference:o.payment_label||''};
 if(o.on_account||o.payment==='monthly'||o.billing_month)return {label:'חודשית פתוחה',tone:'month',note:'חיוב בסוף החודש'};
 const days=waitedDays(o.created);
 if(days>=ORDER_ABANDONED_DAYS)return {label:'נזנחה',tone:'unreported',note:'ללא דיווח '+days+' ימים'};
 return {label:'טרם דווח תשלום',tone:'unreported',note:o.payment_label||''};
}
const initial=(unpaid:boolean)=>({bucket:(unpaid?'awaiting':'attention') as AdminOrderFilterBucket,month:'',q:'',page:1,scroll:0});
export default function AdminOrderHistory({ctx,openOrder,initialUnpaid=false}:{ctx:Ctx;openOrder:(o:Row)=>void;initialUnpaid?:boolean}){
 const memoryKey=initialUnpaid?'orders-reference-unpaid':'orders-reference';
 const [saved,setSaved]=useState(()=>{const preset=takeAdminViewState<AdminOrderFilterBucket>('orders-bucket'),base=adminViewState(memoryKey,initial(initialUnpaid));return preset?{...base,bucket:preset,month:'',q:'',page:1,scroll:0}:base;}),[draft,setDraft]=useState(saved.q),[composing,setComposing]=useState(false),[exporting,setExporting]=useState(false),[error,setError]=useState(''),[expanded,setExpanded]=useState(''),[opening,setOpening]=useState('');
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
 const detail=(o:Row)=>{setOpening(o.id);saveAdminViewState(memoryKey,{...saved,scroll:window.scrollY});openOrder(o);setTimeout(()=>setOpening(''),4000);};
 const review=async(o:Row)=>{setOpening(o.id);setError('');try{const {report}=await api('orders/'+o.id+'/payment-report');if(!report)throw new Error('הדיווח כבר אינו ממתין לבדיקה. יש לרענן.');ctx.open({kind:'admin-finance',title:'דיווח תשלום לבדיקה',render:(close:()=>void)=><ReportReview ctx={ctx} report={report} close={close}/>});}catch(e){setError((e as Error).message);}finally{setOpening('');}};
 const counts:Row=state.data?.counts||{};
 const months=[...new Set([monthNow(),saved.month,...(state.data?.months||[])].filter(Boolean))].sort().reverse();
 const first=Math.max(1,Math.min(page-2,pages-4)),shownPages=Array.from({length:Math.min(5,pages)},(_,i)=>first+i);
 return <section className="orders-match-screen" dir="rtl" aria-labelledby="orders-list-title">
  <button type="button" className="orders-reference-export" onClick={exportOrders} disabled={exporting||!current}><span>{exporting?'מייצא…':'ייצוא נתונים'}</span><Download size={18}/></button>
  <section className="orders-reference-panel">
   <h2 id="orders-list-title" className="om-hidden">רשימת הזמנות</h2>
   <form className="orders-reference-toolbar om-toolbar" noValidate role="search" onSubmit={e=>{e.preventDefault();if(!composing)commit({q:draft.trim()});}}>
    <div className="orders-reference-search"><Search size={21} aria-hidden="true"/><input ref={input} type="search" maxLength={120} aria-label="חיפוש לקוח, מספר הזמנה או אתר" placeholder="חיפוש לקוח, מספר הזמנה או אתר" value={draft} onCompositionStart={()=>setComposing(true)} onCompositionEnd={e=>{setDraft(e.currentTarget.value);setComposing(false);}} onChange={e=>setDraft(e.target.value)}/>{draft&&<button type="button" aria-label="ניקוי חיפוש הזמנות" onClick={()=>{setDraft('');commit({q:''});input.current?.focus();}}><X size={17}/></button>}</div>
    <div className="orders-reference-month-filter"><Select dir="rtl" value={saved.month||'all'} onValueChange={v=>commit({month:v==='all'?'':v})}><SelectTrigger aria-label="סינון לפי חודש"><span><CalendarDays size={20}/><SelectValue/></span></SelectTrigger><SelectContent position="popper" align="start" sideOffset={5} className="orders-reference-options"><SelectItem value="all">כל החודשים</SelectItem>{months.map(m=><SelectItem key={m} value={m}>{monthText(m)}</SelectItem>)}</SelectContent></Select></div>
    <div className="orders-reference-month-filter om-status-filter"><Select dir="rtl" value={saved.bucket==='closed'||saved.bucket==='archive'?saved.bucket:'any'} onValueChange={v=>commit({bucket:(v==='any'?'active':v) as AdminOrderFilterBucket})}><SelectTrigger aria-label="סינון לפי מצב"><span><SlidersHorizontal size={20}/><SelectValue/></span></SelectTrigger><SelectContent position="popper" align="start" sideOffset={5} className="orders-reference-options"><SelectItem value="any">כל המצבים</SelectItem><SelectItem value="closed">סגורות</SelectItem><SelectItem value="archive">בוטלו והדגמות</SelectItem></SelectContent></Select></div>
   </form>
   <div className="om-chips" role="group" aria-label="איזה הזמנות להציג">{chips.map(([key,label])=>{const n=Number(counts[key]||0);return <button type="button" key={key} className={'is-'+key} aria-pressed={saved.bucket===key||(key==='active'&&(saved.bucket==='closed'||saved.bucket==='archive'))} onClick={()=>commit({bucket:key})}>{label}{key!=='active'&&state.data&&n>0&&<b>{n}</b>}</button>;})}</div>
   {(error||state.error)&&<div className="orders-reference-error" role="alert"><p>{error||state.error}</p><button type="button" onClick={ctx.refresh}>ניסיון נוסף</button></div>}
   {!current&&!state.error?<div className="orders-reference-loading" role="status">טוען הזמנות…</div>:current&&!rows.length?<div className="orders-reference-empty"><h3>{saved.bucket==='attention'&&!saved.q&&!saved.month?'אין כרגע הזמנות לטיפול':'אין הזמנות שמתאימות לסינון'}</h3><p>{saved.bucket==='attention'&&!saved.q&&!saved.month?'דיווחי תשלום ובקשות ביטול חדשים יופיעו כאן.':'אפשר לשנות את החודש או את המצב, או לנקות את החיפוש.'}</p><button type="button" onClick={()=>{setDraft('');commit({bucket:'active',month:'',q:''});}}>הצגת כל ההזמנות</button></div>:<>
    <div className="om-head" aria-hidden="true"><span>הזמנה</span><span>לקוח</span><span>אתרים</span><span>תשלום</span><span>פרסום</span><span>סכום</span><span/><span/></div>
    <div className="om-list" aria-label="רשימת ההזמנות">
     {rows.map((o,index)=>{const startsAbandoned=(saved.bucket==='awaiting')&&isAbandoned(o)&&(index===0||!isAbandoned(rows[index-1])),open=expanded===o.id,pay=orderPaymentState(o),sites=orderSites(o),cancelAsk=Number(o.cancel_pending_count)>0,askReview=!cancelAsk&&reportPending(o),busy=opening===o.id,label=busy?'פותח…':cancelAsk?'טיפול בביטול':askReview?'בדיקת הדיווח':'ניהול הזמנה';return <React.Fragment key={o.id}>{startsAbandoned&&<h3 className="om-section">נזנחו, מעל {ORDER_ABANDONED_DAYS} ימים</h3>}<article className={'om-order'+(open?' is-open':'')}>
      <div className="om-row" onClick={()=>setExpanded(open?'':o.id)}>
       <div className="om-id"><strong><bdi>#{String(o.number).replace(/^#/,'')}</bdi></strong><time dateTime={o.created}>{orderDate(o.created)}</time></div>
       <div className="om-who"><b>{o.user_name||o.name}</b>{o.on_account||o.payment==='monthly'||o.billing_month?<span className="is-monthly">הזמנה חודשית</span>:<span>הזמנה רגילה</span>}</div>
       <div className="om-sites">{sites[0]?<span className="om-site" title={sites.map((x:Row)=>x.name).join(', ')}>{sites[0].name}</span>:<span className="om-muted">אין פריטים</span>}{sites.length>1&&<span className="om-plus"><bdi dir="ltr">+{sites.length-1}</bdi></span>}</div>
       <div className="om-pay"><span className={'om-pill is-'+pay.tone}>{pay.label}</span>{pay.note&&<small>{pay.note}</small>}</div>
       <div className="om-pub"><Publication o={o}/></div>
       <div className="om-amount"><bdi>{orderMoney(o.amounts.total)}</bdi></div>
       <a className={'om-btn om-action'+(cancelAsk||askReview?' is-primary':'')+(busy?' is-opening':'')} href={'/admin-order/'+o.id} aria-busy={busy||undefined} onClick={e=>{e.stopPropagation();if(!plain(e))return;e.preventDefault();if(askReview)review(o);else detail(o);}}><span>{label}</span>{busy?<Loader2 className="om-spin" size={16} aria-hidden="true"/>:<ChevronLeft size={16} aria-hidden="true"/>}</a>
       <button type="button" className="om-expand" aria-label={(open?'סגירת פירוט הזמנה ':'פירוט הזמנה ')+o.number} aria-expanded={open} aria-controls={'order-inline-'+o.id} onClick={e=>{e.stopPropagation();setExpanded(open?'':o.id);}}>{open?<ChevronUp size={19} aria-hidden="true"/>:<ChevronDown size={19} aria-hidden="true"/>}</button>
      </div>
      {open&&<div id={'order-inline-'+o.id}><OrderPanel ctx={ctx} order={o} manage={()=>detail(o)}/></div>}
     </article></React.Fragment>;})}
    </div>
   </>}
   {current&&total>0&&<footer className="orders-reference-pagination"><span role="status">מציג {(page-1)*size+1}–{Math.min(page*size,total)} מתוך {total} הזמנות</span><nav aria-label="עמודי הזמנות"><button type="button" aria-label="העמוד הקודם" disabled={page<=1||state.loading} onClick={()=>commit({page:page-1})}><ChevronRight size={20}/></button>{shownPages.map(n=><button type="button" key={n} aria-label={'עמוד '+n} aria-current={n===page?'page':undefined} disabled={state.loading} onClick={()=>commit({page:n})}>{n}</button>)}<button type="button" aria-label="העמוד הבא" disabled={page>=pages||state.loading} onClick={()=>commit({page:page+1})}><ChevronLeft size={20}/></button></nav></footer>}
  </section>
 </section>;
}
