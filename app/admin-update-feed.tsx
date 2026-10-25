'use client';
import React,{useEffect,useRef,useState} from 'react';
import {Search,X,RefreshCw,Check,CheckCircle2,ChevronLeft,ChevronRight,RotateCcw} from 'lucide-react';
import {api,useData} from '@/lib/client';
import {money,type Row} from '@/lib/shared';
import {adminViewState,saveAdminViewState} from '@/lib/admin-view-state';
import type {Ctx} from './workspace';
const initial={q:'',filter:'all',state:'open',page:1,scroll:0};
const date=(s:string)=>{const d=new Date(s);return Number.isNaN(+d)?'לא תועד':new Intl.DateTimeFormat('he-IL',{timeZone:'Asia/Jerusalem',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(d);};
export default function AdminUpdateFeed({ctx}:{ctx:Ctx}){
 const [saved,setSaved]=useState(()=>({...initial,...adminViewState('updates',initial)})),[draft,setDraft]=useState(saved.q),[busy,setBusy]=useState(''),[error,setError]=useState('');
 const input=useRef<HTMLInputElement>(null),lock=useRef(false),restore=useRef(saved.scroll),latest=useRef(saved);
 const params=new URLSearchParams({q:saved.q,filter:saved.filter,state:saved.state,page:String(saved.page)}),state=useData('admin/control-center/updates?'+params,ctx.revision,true,30000);
 const current=state.data?.state===saved.state&&state.data?.filters?.q===saved.q&&state.data?.filters?.filter===saved.filter&&state.data?.requested_page===saved.page,rows:Row[]=current?state.data?.updates||[]:[],counts=state.data?.counts;
 useEffect(()=>{latest.current=saved;saveAdminViewState('updates',saved);},[saved]);
 useEffect(()=>{const remember=()=>saveAdminViewState('updates',{...latest.current,scroll:window.scrollY});window.addEventListener('scroll',remember,{passive:true});return()=>window.removeEventListener('scroll',remember);},[]);
 useEffect(()=>{if(current&&restore.current){window.scrollTo(0,restore.current);restore.current=0;}},[current,state.data]);
 const commit=(change:Partial<typeof initial>)=>{setError('');setSaved(s=>({...s,...change,page:change.page??1,scroll:0}));};
 async function mark(row:Row,reopen=false){
  if(lock.current)return;lock.current=true;setBusy(row.history_id||row.id);setError('');
  try{await ctx.run(()=>api('admin/control-center/updates'+(reopen?'/reopen':''),'POST',reopen?{history_id:row.history_id}:{id:row.id,version:row.version}),reopen?'ההתראה הוחזרה לטיפול':'ההתראה הועברה לטופלו');
   state.setData((prior:Row)=>prior?.state===saved.state&&prior.filters?.q===saved.q&&prior.filters?.filter===saved.filter?{...prior,updates:prior.updates.filter((r:Row)=>r.id!==row.id),total:Math.max(0,prior.total-1)}:prior);
  }catch(e){setError((e as Error).message);}finally{setBusy('');lock.current=false;}
 }
 return <section className="admin-updates admin-guide guide-work-center" dir="rtl">
  <header className="guide-heading"><div><h1>מרכז העבודה</h1><p>עדכונים שממתינים לטיפול</p></div><button type="button" className="guide-button" onClick={ctx.refresh} disabled={state.loading} aria-label="רענון העדכונים"><RefreshCw size={18}/><span>רענון</span></button></header>
  <div className="guide-tabs" role="group" aria-label="מצב הטיפול בהתראות">{[['open','פתוח לטיפול'],['handled','טופלו']].map(([value,label])=><button key={value} type="button" aria-pressed={saved.state===value} onClick={()=>commit({state:value})}>{label}{counts&&<bdi>({Number(counts[value]||0)})</bdi>}</button>)}</div>
  <form noValidate className="guide-filter-form" role="search" onSubmit={e=>{e.preventDefault();commit({q:draft.trim()});}}><label className="guide-search"><Search size={18} aria-hidden="true"/><input ref={input} type="search" maxLength={120} aria-label="חיפוש התראה או לקוח" placeholder="חיפוש התראה או לקוח" value={draft} onChange={e=>setDraft(e.target.value)}/>{draft&&<button type="button" aria-label="ניקוי חיפוש" onClick={()=>{setDraft('');commit({q:''});input.current?.focus();}}><X size={18}/></button>}</label><label className="guide-select-label"><span>סוג העדכון</span><select value={saved.filter} onChange={e=>commit({filter:e.target.value})}><option value="all">כל העדכונים</option><option value="action">דורשים פעולה</option><option value="info">עדכוני מידע</option></select></label><button className="guide-button" type="submit">חיפוש</button></form>
  <p className="guide-hint">סימון התראה לא מאשר תשלום או פרסום.</p>
  {(error||state.error)&&<div className="guide-error" role="alert"><p>{error||'לא ניתן לרענן. '+(current?'הנתונים האחרונים מוצגים.':'')+' '+state.error}</p><button className="guide-button" onClick={ctx.refresh} type="button">ניסיון נוסף</button></div>}
  {!current&&state.error?null:!current||state.loading&&!state.data?<p role="status" className="guide-empty">טוען עדכונים…</p>:!rows.length?<div className="guide-empty"><CheckCircle2 size={28}/><h2>{saved.q?'לא נמצאו התראות מתאימות':saved.state==='handled'?'עדיין לא סומנו התראות כטופלו':'אין התראות פתוחות לטיפול'}</h2><p>{saved.q?'אפשר לנקות את החיפוש ולנסות שוב.':'עדכונים חדשים יופיעו כאן כשיתקבלו.'}</p></div>:<div className="guide-notifications" aria-busy={!!busy}>{rows.map(row=><article className="guide-notification" key={row.history_id||row.id}>
   <div className="guide-notification-heading"><h2>{row.title}</h2><span className={'guide-status '+(saved.state==='handled'?'is-success':row.needs_action?'is-warning':'is-info')}>{saved.state==='handled'?'סומן כטופל':row.status}</span></div>
   <p className="guide-meta">{row.number&&<><bdi>{row.number}</bdi> · </>}{row.user_name}{row.website_name&&<> · <bdi>{row.website_name}</bdi></>}</p>
   <div className="guide-notification-facts">{row.amount!=null&&<strong><bdi>{money(row.amount)}</bdi></strong>}<time dateTime={saved.state==='handled'?row.handled_at:row.happened_at}>{date(saved.state==='handled'?row.handled_at:row.happened_at)}</time></div>
   {saved.state==='handled'&&<p className="guide-meta">סומן על ידי {row.handled_by_name} · פרטי ההתראה בעת הסימון</p>}
   {row.detail&&<p className="guide-notification-copy">{row.detail}</p>}
   <footer className="guide-notification-actions"><a className={'guide-button '+(saved.state==='open'?'is-primary':'')} href={'/'+row.page} onClick={e=>{if(e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;e.preventDefault();saveAdminViewState('updates',{...saved,scroll:window.scrollY});ctx.go(row.page);}}>{row.action}<ChevronLeft size={17}/></a>
    {saved.state==='open'?<button className="guide-button is-success-outline" type="button" disabled={!!busy} onClick={()=>mark(row)}><Check size={18}/>{busy===row.id?'מסמן…':'סמן כטופל'}</button>:row.can_reopen&&<button className="guide-button" type="button" disabled={!!busy} onClick={()=>mark(row,true)}><RotateCcw size={17}/>{busy===row.history_id?'מחזיר…':'החזרה לטיפול'}</button>}
   </footer>
  </article>)}</div>}
  {current&&state.data?.total>0&&<footer className="guide-pagination"><span role="status">{(state.data.page-1)*20+1}–{Math.min(state.data.page*20,state.data.total)} מתוך {state.data.total}</span>{state.data.total>20&&<nav aria-label="עמודי עדכונים"><button className="guide-button" type="button" disabled={state.data.page<=1||state.loading} onClick={()=>commit({page:state.data.page-1})}><ChevronRight size={17}/>הקודם</button><span>{state.data.page}</span><button className="guide-button" type="button" disabled={state.data.page*20>=state.data.total||state.loading} onClick={()=>commit({page:state.data.page+1})}>הבא<ChevronLeft size={17}/></button></nav>}</footer>}
 </section>;
}
