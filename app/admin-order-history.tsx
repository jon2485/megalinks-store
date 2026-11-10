'use client';
import React,{useCallback,useEffect,useRef,useState} from 'react';
import {Check,Search,Download,X,CalendarDays,ChevronDown,ChevronLeft,ExternalLink,FileText,List,Loader2,Mail,MoreHorizontal,SlidersHorizontal,UserRound} from 'lucide-react';
import {DropdownMenu,DropdownMenuContent,DropdownMenuItem,DropdownMenuSeparator,DropdownMenuTrigger} from '@/components/ui/dropdown-menu';
import {OrdersAreaHead} from './orders-area-head';
import {haptic} from './press-feedback';
import './supplier-v2.css';
import './orders-v2.css';
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
import {orderSites,siteLabel,RecordPanel} from './order-list-parts';
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
const chips:[AdminOrderFilterBucket,string][]=[['all' as AdminOrderFilterBucket,'כל ההזמנות'],['attention','לטיפול'],['awaiting','ממתינות לתשלום'],['monthly','חודשיות']];
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
 const [saved,setSaved]=useState(()=>{const preset=takeAdminViewState<AdminOrderFilterBucket>('orders-bucket'),base=adminViewState(memoryKey,initial(initialUnpaid));return preset?{...base,bucket:preset,month:'',q:'',page:1,scroll:0}:base;}),[draft,setDraft]=useState(saved.q),[composing,setComposing]=useState(false),[exporting,setExporting]=useState(false),[error,setError]=useState(''),[expanded,setExpanded]=useState(''),[opening,setOpening]=useState(''),[exported,setExported]=useState(false),[filters,setFilters]=useState(false);
 const input=useRef<HTMLInputElement>(null),latest=useRef(saved),exportLock=useRef(false),restore=useRef(saved.scroll),card=useRef<HTMLElement>(null),paged=useRef(saved.page);
 const params=new URLSearchParams({bucket:saved.bucket,month:saved.month,q:saved.q,page:String(saved.page)}),state=useData('admin/orders?'+params,ctx.revision,true,15000),f=state.data?.filters;
 const current=!!f&&f.bucket===saved.bucket&&f.month===saved.month&&f.q===saved.q&&state.data?.requested_page===saved.page;
 const rows:Row[]=current?state.data.orders:[],total=current?Number(state.data.total):0,page=current?Number(state.data.page):saved.page,pages=Math.max(1,Math.ceil(total/Number(state.data?.page_size||20))),size=Number(state.data?.page_size||20);
 const commit=useCallback((change:Partial<typeof saved>)=>{setError('');setSaved(s=>({...s,...change,page:change.page??1,scroll:0}));},[]);
 useEffect(()=>{latest.current=saved;saveAdminViewState(memoryKey,saved);},[memoryKey,saved]);
 useEffect(()=>{if(composing||draft.trim()===saved.q)return;const id=setTimeout(()=>commit({q:draft.trim()}),300);return()=>clearTimeout(id);},[draft,composing,saved.q,commit]);
 useEffect(()=>{const remember=()=>saveAdminViewState(memoryKey,{...latest.current,scroll:window.scrollY});window.addEventListener('scroll',remember,{passive:true});return()=>window.removeEventListener('scroll',remember);},[memoryKey]);
 useEffect(()=>{if(current&&restore.current){window.scrollTo(0,restore.current);restore.current=0;}},[current]);
 useEffect(()=>{if(paged.current===saved.page)return;paged.current=saved.page;const el=card.current;if(el&&el.getBoundingClientRect().top<0)el.scrollIntoView({block:'start',behavior:window.matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth'});},[saved.page]);
 const exportOrders=async()=>{if(exportLock.current||!current)return;exportLock.current=true;setExporting(true);setError('');try{await downloadAdminWorkbook('admin/orders?'+new URLSearchParams({bucket:saved.bucket,month:saved.month,q:saved.q,export:'1'}),'orders-'+saved.bucket+'-'+(saved.month||'all')+'.xlsx');haptic(true);setExported(true);setTimeout(()=>setExported(false),2200);}catch(e){haptic(false);setError((e as Error).message);}finally{setExporting(false);exportLock.current=false;}};
 const detail=(o:Row)=>{setOpening(o.id);saveAdminViewState(memoryKey,{...saved,scroll:window.scrollY});openOrder(o);setTimeout(()=>setOpening(''),4000);};
 const review=async(o:Row)=>{setOpening(o.id);setError('');try{const {report}=await api('orders/'+o.id+'/payment-report');if(!report)throw new Error('הדיווח כבר אינו ממתין לבדיקה. יש לרענן.');ctx.open({kind:'admin-finance',title:'דיווח תשלום לבדיקה',render:(close:()=>void)=><ReportReview ctx={ctx} report={report} close={close}/>});}catch(e){setError((e as Error).message);}finally{setOpening('');}};
 const counts:Row=state.data?.counts||{};
 const months=[...new Set([monthNow(),saved.month,...(state.data?.months||[])].filter(Boolean))].sort().reverse();
 const first=Math.max(1,Math.min(page-2,pages-4)),shownPages=Array.from({length:Math.min(5,pages)},(_,i)=>first+i);
 const statusFilter=saved.bucket==='closed'||saved.bucket==='archive'?saved.bucket:'any';
 const cardHint:Record<string,string>={all:'כולל ממתינות, סגורות ומבוטלות',attention:'דיווחי תשלום ובקשות ביטול',awaiting:'טרם שולמו',monthly:'חיוב בסוף החודש'};
 const searching=draft.trim()!==saved.q||(!current&&!state.error&&!!saved.q);
 const cols={gridTemplateColumns:'96px minmax(0,1.5fr) minmax(0,1fr) 150px 100px 120px 150px',gap:12};
 return <section className="orders-match-screen sv2 sv2-orders" dir="rtl" aria-labelledby="orders-list-title">
  <OrdersAreaHead ctx={ctx} current="admin-orders" title="הזמנות" sub="" action={<><div className="sv2-sum is-4 sv2-sumline" role="group" aria-label="איזה הזמנות להציג">{chips.map(([key,label])=>{const n=Number(counts[key]||0),on=saved.bucket===key||(key==='all'&&['active','closed','archive'].includes(saved.bucket));return <button type="button" key={key} className={'sv2-card sv2-pad sv2-sumbtn'+(on?' on':'')+(key==='attention'&&n>0?' hot':'')+(on&&!current&&!state.error?' is-loading':'')} aria-pressed={on} title={cardHint[key]} onClick={()=>commit({bucket:key})}><span className="lbl"><span className="sv2-dsk">{label}</span><span className="sv2-mob">{shortChip[key]||label}</span></span><b className="big">{state.data?n:'—'}</b><span className="hint">{cardHint[key]}</span></button>;})}</div><button type="button" className={'sv2-btn quiet'+(exported?' fx-done':'')} onClick={exportOrders} disabled={exporting||!current} aria-busy={exporting||undefined}>{exporting?<Loader2 className="om-spin" size={16} aria-hidden="true"/>:exported?<Check size={16} aria-hidden="true"/>:<Download size={16} aria-hidden="true"/>}<span aria-live="polite">{exporting?'מייצא…':exported?'הקובץ ירד':<>ייצוא<span className="sv2-wide"> נתונים</span></>}</span></button></>}/>
  <section ref={card} className="sv2-card ofx-card" style={{backdropFilter:'none',WebkitBackdropFilter:'none'}}>
   <h2 id="orders-list-title" className="om-hidden">רשימת הזמנות</h2>
   <form className={'sv2-tools'+(filters||saved.month||statusFilter!=='any'?' is-filters':'')} noValidate role="search" onSubmit={e=>{e.preventDefault();if(!composing)commit({q:draft.trim()});}}>
    <label className="sv2-search">{searching?<Loader2 className="om-spin" size={17} aria-hidden="true"/>:<Search size={17} aria-hidden="true"/>}<input ref={input} type="search" maxLength={120} aria-label="חיפוש לקוח, מספר הזמנה או אתר" placeholder="חיפוש לקוח, מספר הזמנה או אתר" value={draft} onCompositionStart={()=>setComposing(true)} onCompositionEnd={e=>{setDraft(e.currentTarget.value);setComposing(false);}} onChange={e=>setDraft(e.target.value)}/>{draft&&<button type="button" className="sv2-clear" aria-label="ניקוי חיפוש הזמנות" onClick={()=>{setDraft('');commit({q:''});input.current?.focus();}}><X size={15}/></button>}</label>
    <button type="button" className={'sv2-fbtn'+(saved.month||statusFilter!=='any'?' is-on':'')} aria-label="סינון לפי חודש ומצב" aria-expanded={filters||!!saved.month||statusFilter!=='any'} onClick={()=>setFilters(v=>!v)}><SlidersHorizontal size={18} aria-hidden="true"/></button>
    <label className={'sv2-select'+(saved.month?' is-on':'')}><CalendarDays size={16} aria-hidden="true"/><span className="sr-only">סינון לפי חודש</span><select value={saved.month||'all'} onChange={e=>commit({month:e.target.value==='all'?'':e.target.value})}><option value="all">כל החודשים</option>{months.map(m=><option key={m} value={m}>{monthText(m)}</option>)}</select></label>
    <label className={'sv2-select'+(statusFilter!=='any'?' is-on':'')}><SlidersHorizontal size={16} aria-hidden="true"/><span className="sr-only">סינון לפי מצב</span><select value={statusFilter} onChange={e=>commit({bucket:(e.target.value==='any'?'all':e.target.value) as AdminOrderFilterBucket})}><option value="any">כל המצבים</option><option value="closed">סגורות</option><option value="archive">בוטלו והדגמות</option></select></label>
   </form>
   {(error||state.error)&&<div className="sv2-error" role="alert"><p>{error||state.error}</p><button type="button" className="sv2-btn quiet sm" onClick={ctx.refresh}>ניסיון נוסף</button></div>}
   {!current&&!state.error?<div className="ofx-skel" role="status" aria-label="טוען הזמנות">{[0,1,2,3,4,5].map(i=><div key={i} className="ofx-skel-row"><i/><i/><i/><i/><i/></div>)}</div>:current&&!rows.length?<div className="sv2-empty"><h3>{saved.bucket==='attention'&&!saved.q&&!saved.month?'אין כרגע הזמנות לטיפול':'אין הזמנות שמתאימות לסינון'}</h3><p>{saved.bucket==='attention'&&!saved.q&&!saved.month?'דיווחי תשלום ובקשות ביטול חדשים יופיעו כאן.':'אפשר לשנות את החודש או את המצב, או לנקות את החיפוש.'}</p><button type="button" className="sv2-btn tint" onClick={()=>{setDraft('');commit({bucket:'all' as AdminOrderFilterBucket,month:'',q:''});}}>הצגת כל ההזמנות</button></div>:<>
    <div className="sv2-th" style={cols} aria-hidden="true"><span>הזמנה</span><span>לקוח</span><span>אתרים</span><span>תשלום</span><span>פרסום</span><span>סכום</span><span/></div>
    <div className="om-list sv2-olist" aria-label="רשימת ההזמנות">
     {rows.map((o,index)=>{const startsAbandoned=(saved.bucket==='awaiting')&&isAbandoned(o)&&(index===0||!isAbandoned(rows[index-1])),open=expanded===o.id,pay=orderPaymentState(o),sites=orderSites(o),cancelAsk=Number(o.cancel_pending_count)>0,askReview=!cancelAsk&&reportPending(o),busy=opening===o.id,label=busy?'פותח…':cancelAsk?'טיפול בביטול':askReview?'בדיקת הדיווח':'פירוט',primary=cancelAsk||askReview,monthly=o.on_account||o.payment==='monthly'||o.billing_month,name=String(o.user_name||o.name||''),cancelled=orderCancellation(o)==='full',note=pay.note&&pay.note!==String(o.payment_label||'')&&pay.tone!=='month'?pay.note:'',num='#'+String(o.number).replace(/^#/,''),siteText=sites.length===1?siteName(siteLabel(sites[0])):sites.length?sites.length+' אתרים':'',toggle=()=>setExpanded(open?'':o.id);
      return <React.Fragment key={o.id}>{startsAbandoned&&<div className="sv2-grp n0">נזנחו, מעל {ORDER_ABANDONED_DAYS} ימים</div>}<article className={'om-order sv2-order is-tone-'+pay.tone+(cancelAsk?' has-cancel':'')+(primary?' has-cta':'')+(cancelled?' is-cancelled':'')+(open?' is-open':'')}>
      <div className="sv2-tr sv2-orow" style={cols} onClick={toggle}>
       <div className="sv2-ord"><b><bdi>#{String(o.number).replace(/^#/,'')}</bdi></b><time dateTime={o.created}>{orderDate(o.created)}</time></div>
       <div className="sv2-who"><span className="sv2-av sm" style={{background:avatarTone(name)}} aria-hidden="true">{name.trim().slice(0,1)||'ל'}</span><span><b>{name||'לקוח'}</b><small className="sv2-dsk">{monthly?'חודשית':'רגילה'}{sites.length?' · '+(sites.length===1?'אתר אחד':sites.length+' אתרים'):''}</small><small className="sv2-mob"><bdi>{num}</bdi> · {orderDate(o.created).slice(0,5)}{siteText&&<> · <bdi dir="ltr">{siteText}</bdi></>}</small></span></div>
       <div className="sv2-favs"><small className="sv2-ml">אתרים</small>{sites.length>0&&<bdi className="sv2-site1" dir="ltr" title={sites.map((x:Row)=>siteLabel(x)).join(', ')}>{siteName(siteLabel(sites[0]))}</bdi>}{sites.length>1&&<span className="sv2-more" title={sites.slice(1).map((x:Row)=>siteLabel(x)).join(', ')}><bdi dir="ltr">+{sites.length-1}</bdi></span>}{!sites.length&&<span className="sv2-muted">אין פריטים</span>}</div>
       <div className="sv2-paycell"><small className="sv2-ml">תשלום</small><span className={'sv2-pill '+payPill(pay.tone)} title={o.payment_label||undefined}><i/>{pay.label}</span>{note&&<small className="sv2-sub">{note}</small>}</div>
       <div className="sv2-pubcell"><small className="sv2-ml">פרסום</small><Pub o={o}/></div>
       <span className="sv2-num lg"><small className="sv2-ml">סכום</small>{cancelled?<span className="sv2-muted" title="ההזמנה בוטלה">—</span>:<bdi>{orderMoney(o.amounts.total)}</bdi>}</span>
       <div className="sv2-rowact" onClick={e=>e.stopPropagation()}>
        {primary&&<a className="sv2-btn sm primary" href={'/admin-order/'+o.id} aria-busy={busy||undefined} onClick={e=>{if(!plain(e))return;e.preventDefault();if(askReview)review(o);else detail(o);}}>{busy?<Loader2 className="om-spin" size={15} aria-hidden="true"/>:null}<span>{label}</span></a>}
        {open?<button type="button" className="sv2-dots is-close" aria-label={'סגירת פירוט הזמנה '+o.number} aria-expanded={open} aria-controls={'order-inline-'+o.id} onClick={toggle}><X size={16}/></button>:
        <DropdownMenu dir="rtl"><DropdownMenuTrigger asChild><button type="button" className="sv2-dots" aria-label={'עוד פעולות להזמנה '+o.number}><MoreHorizontal size={16}/></button></DropdownMenuTrigger><DropdownMenuContent className="sv2-menu" align="end">
         <DropdownMenuItem className="is-first" onSelect={()=>detail(o)}><ExternalLink size={16}/>פתיחת כל ההזמנה</DropdownMenuItem>
         <DropdownMenuItem onSelect={toggle}><ChevronDown size={16}/>פירוט בשורה</DropdownMenuItem>
         {askReview&&<DropdownMenuItem onSelect={()=>review(o)}><FileText size={16}/>בדיקת דיווח התשלום</DropdownMenuItem>}
         <DropdownMenuSeparator/>
         <DropdownMenuItem onSelect={()=>ctx.go('admin-customer-account/'+o.user_id)}><UserRound size={16}/>תיק לקוח</DropdownMenuItem>
         <DropdownMenuItem onSelect={()=>ctx.go('admin-customer-account/'+o.user_id+'/orders')}><List size={16}/>כל ההזמנות של הלקוח</DropdownMenuItem>
         {(o.user_email||o.email)&&<DropdownMenuItem onSelect={()=>{window.location.href='mailto:'+(o.user_email||o.email);}}><Mail size={16}/>שליחת מייל ללקוח</DropdownMenuItem>}
        </DropdownMenuContent></DropdownMenu>}
        {!primary&&!open&&<button type="button" className="sv2-chevbtn" aria-label={'פירוט הזמנה '+o.number} aria-expanded={false} aria-controls={'order-inline-'+o.id} onClick={toggle}>{busy?<Loader2 className="om-spin" size={16} aria-hidden="true"/>:<ChevronLeft className="ofx-chev" size={17} aria-hidden="true"/>}</button>}
       </div>
      </div>
      {open&&<RecordPanel id={'order-inline-'+o.id} title={<>הזמנה <bdi>#{String(o.number).replace(/^#/,'')}</bdi></>} badge={<span className={'sv2-pill '+payPill(pay.tone)}><i/>{pay.label}</span>} onClose={()=>setExpanded('')}><OrderPanel ctx={ctx} order={o} manage={()=>detail(o)} profit/></RecordPanel>}
     </article></React.Fragment>;})}
    </div>
   </>}
   {current&&total>0&&<footer className="sv2-foot"><span role="status">מציג {(page-1)*size+1}–{Math.min(page*size,total)} מתוך {total} הזמנות</span><nav className="sv2-pager" aria-label="עמודי הזמנות"><button type="button" aria-label="העמוד הקודם" disabled={page<=1||state.loading} onClick={()=>commit({page:page-1})}>‹</button>{shownPages.map(n=><button type="button" key={n} className={n===page?'on':''} aria-label={'עמוד '+n} aria-current={n===page?'page':undefined} disabled={state.loading} onClick={()=>commit({page:n})}>{n}</button>)}<button type="button" aria-label="העמוד הבא" disabled={page>=pages||state.loading} onClick={()=>commit({page:page+1})}>›</button></nav></footer>}
  </section>
 </section>;
}
const shortChip:Record<string,string>={all:'הכול',awaiting:'לתשלום'};
// Publication in one short line: a small bar and done/all.
function Pub({o}:{o:Row}){const all=Math.max(0,Number(o.article_count||0)-Number(o.fully_refunded_count||0)),done=Math.min(all,Number(o.published_count||0));if(!all)return <span className="sv2-muted" title="לא רלוונטי">—</span>;return <span className="sv2-pub" title={done===all?'הכול פורסם':done+' מתוך '+all+' פורסמו'}><span className="sv2-mob">פורסם</span><i aria-hidden="true"><b style={{width:(done/all*100)+'%'}}/></i><bdi dir="ltr">{done}/{all}</bdi></span>;}
const payPill=(tone:string)=>tone==='ok'?'p-paid':tone==='report'?'p-open':tone==='month'?'p-month':tone==='cancelled'?'p-man':'p-inv';
const avatarTone=(s:string)=>['#0071e3','#30a46c','#bf5af2','#ff9f0a','#ff375f','#0a84ff','#5e5ce6'][[...String(s||'')].reduce((n,c)=>n+c.charCodeAt(0),0)%7];
const siteName=(s:string)=>String(s||'').replace(/^https?:\/\//,'').replace(/^www\./,'');
