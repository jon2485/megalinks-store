'use client';
import React,{useEffect,useRef,useState} from 'react';
import {toast} from 'sonner';
import {ArrowRight,Check,CheckCircle2,ChevronLeft,LoaderCircle,Lock,Pencil,Plus,Send,ShoppingCart,UserRound,Users} from 'lucide-react';
import {api,useData} from '@/lib/client';
import {when,type Row} from '@/lib/shared';
import {supportStatus,supportStatusLabels,type SupportStatus} from '@/lib/support-status';
import {ticketThread,type TicketMessage} from '@/lib/ticket-thread-view';
import {handOffSupportSearch} from './support-search-handoff';
import type {Ctx} from './workspace';
import './ticket-conversation.css';

// 10.11.2026 A support ticket reads as a conversation. A team reply emails the customer and
// marks it "נענתה"; a customer message marks it "ממתין לתשובה" again; closing marks it
// "הפנייה טופלה" and the customer opens a new ticket instead of writing in it.
export const ticketPill:Record<SupportStatus,string>={awaiting_reply:'is-orange',answered:'is-blue',resolved:'is-green'};
const quick:[string,string][]=[
 ['הכתבה אצל הספק','היי, הכתבה נמצאת אצל הספק. ביקשנו ממנו לעדכן אותנו, ונעדכן אותך כאן ברגע שהיא עולה.'],
 ['פורסמה, מצרפים קישור','היי, הכתבה פורסמה. זה הקישור: '],
 ['צריך עוד פרטים','היי, כדי שנוכל לבדוק, אפשר לשלוח עוד פרטים? למשל מספר הזמנה או קישור לכתבה.'],
];
const initials=(name:string)=>{const parts=String(name||'').trim().split(/\s+/).filter(Boolean);return (parts.length>1?parts[0][0]+parts[1][0]:(parts[0]||'?').slice(0,2)).toUpperCase();};
// Message time in Israel: "10.11, 17:11" (the year only when it is not this year).
const stamp=(at:string)=>{const d=new Date(at);if(!Number.isFinite(d.getTime()))return '';return new Intl.DateTimeFormat('he-IL',{timeZone:'Asia/Jerusalem',day:'numeric',month:'numeric',...(d.getFullYear()!==new Date().getFullYear()?{year:'2-digit'}:{}),hour:'2-digit',minute:'2-digit'}).format(d);};
const plainClick=(e:React.MouseEvent)=>!(e.metaKey||e.ctrlKey||e.shiftKey||e.altKey||e.button);
// What happened to the customer's email after a team reply or a close.
const mailNote=(status?:string)=>status==='succeeded'||status==='demo'?['נשלחה התראה ללקוח','is-ok']:status==='failed'?['המייל ללקוח נכשל','is-bad']:status==='blocked'?['המייל ממתין לחיבור הדיוור','is-wait']:status?['ההתראה בדרך ללקוח','is-wait']:null;
const mailToast=(status:string|undefined,ok:string)=>{if(status==='failed')toast.warning(ok+' המייל ללקוח נכשל, אפשר לבדוק בדיוור.');else if(status==='blocked')toast.info(ok+' המייל ללקוח ממתין, כי שליחת המיילים כבויה.');else toast.success(ok+(status==='succeeded'||status==='demo'?' הלקוח קיבל התראה במייל.':''));};

type Details=(row:Row,done:()=>void)=>React.ReactNode;

/** The admin's full page for one ticket. */
export function TicketConversationPage({ctx,id,details,onDirty}:{ctx:Ctx;id:string;details:Details;onDirty?:(value:boolean)=>void}){
 const state=useData('records/ticket/'+encodeURIComponent(id),ctx.revision,true,30000),row:Row|undefined=state.data?.record,customer:Row=state.data?.customer||{};
 const [asking,setAsking]=useState(false),closeBox=useRef<HTMLDivElement>(null);
 if(!row)return <section className="tc tc-page" dir="rtl"><div className="tc-card tc-loading" role={state.error?'alert':'status'}>{state.error?<><p>{state.error}</p><button type="button" className="tc-btn" onClick={ctx.refresh}>ניסיון נוסף</button></>:state.loading?'טוען את הפנייה…':<><p>הפנייה לא נמצאה או שאינה זמינה עוד.</p><button type="button" className="tc-btn" onClick={()=>ctx.go('admin-support')}>לכל הפניות</button></>}</div></section>;
 const status=supportStatus(row),thread=ticketThread(row.data||row,row.created,row.updated);
 const link=(page:string)=>(e:React.MouseEvent)=>{if(!plainClick(e))return;e.preventDefault();ctx.go(page);};
 const askClose=()=>{setAsking(true);requestAnimationFrame(()=>closeBox.current?.scrollIntoView({behavior:'smooth',block:'center'}));};
 return <section className="tc tc-page" dir="rtl">
  <header className="tc-card tc-head">
   <div className="tc-head-top"><button type="button" className="tc-back" onClick={()=>ctx.go('admin-support')}><ArrowRight size={17} aria-hidden="true"/>כל הפניות</button><div className="tc-head-actions">{status!=='resolved'?<button type="button" className="tc-btn is-danger is-sm tc-head-close" onClick={askClose}><Lock size={15} aria-hidden="true"/>סגירת הפנייה</button>:null}<button type="button" className="tc-back" onClick={()=>ctx.go('admin')}>חזרה לעדכונים</button></div></div>
   <div className="tc-head-main"><span className="tc-avatar" aria-hidden="true">{initials(row.user_name)}</span>
    <div className="tc-head-copy"><small>פנייה מאת {row.user_name||'לקוח לא ידוע'}</small><h1>{row.name||'פנייה ללא נושא'}</h1>
     <div className="tc-meta"><span className={'tc-pill '+ticketPill[status]}>{supportStatusLabels[status]}</span>{row.order_number?(row.order_id?<a className="tc-chip is-link" href={'/admin-order/'+row.order_id} onClick={link('admin-order/'+row.order_id)}>הזמנה <bdi>{row.order_number}</bdi></a>:<span className="tc-chip">הזמנה <bdi>{row.order_number}</bdi></span>):null}<span className="tc-chip">נפתחה <bdi>{when(row.created)}</bdi></span>{customer.email?<bdi className="tc-chip">{customer.email}</bdi>:null}</div>
    </div>
   </div>
   <p className={'tc-now '+ticketPill[status]}>{status==='awaiting_reply'?<><b>הפנייה ממתינה לתשובה שלך.</b> כשתענה, הלקוח יקבל התראה במייל והמצב ישתנה ל״נענתה״.</>:status==='answered'?<><b>ענית ללקוח.</b> אם הוא יכתוב שוב, הפנייה תחזור ל״ממתין לתשובה״. סיימת? אפשר לסגור אותה.</>:<><b>הפנייה סגורה.</b> הלקוח רואה ״הפנייה טופלה״. תשובה חדשה תפתח אותה מחדש.</>}</p>
  </header>
  <div className="tc-layout">
   <div className="tc-stack">
    <section className="tc-card" aria-label="השיחה"><header className="tc-card-head"><h2>השיחה</h2><span className="tc-mute">{thread.length===1?'הודעה אחת':thread.length+' הודעות'}</span></header>
     <TicketThread messages={thread} team customerName={row.user_name}/>
     <Composer key={row.id} ctx={ctx} row={row} team onDirty={onDirty}/>
    </section>
    <EditDetails row={row} details={details}/>
   </div>
   <aside className="tc-stack tc-aside">
    <section className="tc-card"><header className="tc-card-head"><h2>מצב הפנייה</h2></header><StatusTrack status={status}/><div ref={closeBox}><CloseTicket ctx={ctx} row={row} asking={asking} setAsking={setAsking}/></div></section>
    <section className="tc-card"><header className="tc-card-head"><h2>הלקוח</h2></header>
     <nav className="tc-links" aria-label="קישורים ללקוח">
      {customer.role&&customer.role!=='admin'?<a href={'/admin-customer-account/'+row.user_id} onClick={link('admin-customer-account/'+row.user_id)}><span><UserRound size={16} aria-hidden="true"/>תיק לקוח · {row.user_name||'הלקוח'}</span><ChevronLeft size={16} aria-hidden="true"/></a>:null}
      {row.order_id?<a href={'/admin-order/'+row.order_id} onClick={link('admin-order/'+row.order_id)}><span><ShoppingCart size={16} aria-hidden="true"/>הזמנה <bdi>{row.order_number}</bdi></span><ChevronLeft size={16} aria-hidden="true"/></a>:null}
      <a href={'/admin-support?customer='+encodeURIComponent(row.user_name||'')} onClick={e=>{if(!plainClick(e))return;e.preventDefault();handOffSupportSearch(row.user_name||'');ctx.go('admin-support');}}><span><Users size={16} aria-hidden="true"/>כל הפניות של הלקוח{customer.tickets?<> · <bdi>{customer.tickets}</bdi></>:null}</span><ChevronLeft size={16} aria-hidden="true"/></a>
     </nav>
    </section>
    <section className="tc-card tc-customer-view"><header className="tc-card-head"><h2>כך הלקוח רואה</h2></header><div className="tc-cv-row"><b>{row.name||'פנייה'}</b><span className={'tc-pill '+ticketPill[status]}>{supportStatusLabels[status]}</span></div><p className="tc-after">{status==='resolved'?'הפנייה סגורה אצלו. כדי לכתוב שוב הוא יפתח פנייה חדשה.':'הוא רואה את כל השיחה בדף הפניות שלו ויכול להגיב בה.'}</p></section>
   </aside>
  </div>
 </section>;
}

/** The customer's conversation, shown inside the existing ticket dialog. */
export function TicketConversationDialog({ctx,id,details,onNew}:{ctx:Ctx;id:string;details:Details;onNew:()=>void}){
 const state=useData('records/ticket/'+encodeURIComponent(id),ctx.revision,true,30000),row:Row|undefined=state.data?.record;
 if(!row)return <div className="tc tc-dialog" dir="rtl"><p className="tc-loading" role={state.error?'alert':'status'}>{state.error||(state.loading?'טוען את השיחה…':'הפנייה לא נמצאה.')}</p></div>;
 const status=supportStatus(row),thread=ticketThread(row.data||row,row.created,row.updated);
 return <div className="tc tc-dialog" dir="rtl">
  <div className="tc-dialog-head"><span className={'tc-pill '+ticketPill[status]}>{supportStatusLabels[status]}</span>{row.order_number?<span className="tc-chip">הזמנה <bdi>{row.order_number}</bdi></span>:null}<span className="tc-chip">נפתחה <bdi>{when(row.created)}</bdi></span></div>
  <TicketThread messages={thread} customerName={row.user_name}/>
  {status==='resolved'?<div className="tc-closed" role="status"><CheckCircle2 size={20} aria-hidden="true"/><div><b>הפנייה טופלה ונסגרה.</b><p>צריכים עוד עזרה? פתחו פנייה חדשה ונמשיך משם.</p></div><button type="button" className="tc-btn" onClick={onNew}><Plus size={16} aria-hidden="true"/>פנייה חדשה</button></div>:<Composer key={row.id} ctx={ctx} row={row}/>}
  <EditDetails row={row} details={details}/>
 </div>;
}

/** The messages in order: the customer's on the start side, the team's on the end side. */
export function TicketThread({messages,team=false,customerName,limit}:{messages:TicketMessage[];team?:boolean;customerName?:string;limit?:number}){
 if(!messages.length)return <p className="tc-empty">עדיין אין הודעות בפנייה הזו.</p>;
 const shown=limit&&messages.length>limit?messages.slice(-limit):messages,hidden=messages.length-shown.length;
 return <ol className="tc-thread" aria-label="הודעות הפנייה">
  {hidden?<li className="tc-more">ועוד {hidden===1?'הודעה אחת קודמת':hidden+' הודעות קודמות'}</li>:null}
  {shown.map(m=>{const note=team&&m.from==='team'?mailNote((m as Row).mail):null;return <li key={m.id} className={'tc-msg '+(m.from==='team'?'from-team':'from-customer')}>
   <span className="tc-who">{m.from==='team'?(team?'התשובה שלך':'צוות מגה לינקס'):(team?(m.author||customerName||'הלקוח'):'אתם')}{m.at&&stamp(m.at)?<> · <bdi>{stamp(m.at)}</bdi></>:null}{note?<span className={'tc-mail '+note[1]}> · {note[0]}</span>:null}</span>
   <p>{m.text}</p>
  </li>;})}
 </ol>;
}

function Composer({ctx,row,team=false,onDirty}:{ctx:Ctx;row:Row;team?:boolean;onDirty?:(value:boolean)=>void}){
 const [text,setText]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),lock=useRef(false),box=useRef<HTMLTextAreaElement>(null);
 const closed=supportStatus(row)==='resolved';
 useEffect(()=>{onDirty?.(!!text.trim());},[text,onDirty]);
 useEffect(()=>()=>onDirty?.(false),[onDirty]);
 const send=async(e:React.FormEvent)=>{
  e.preventDefault();if(lock.current)return;setError('');
  const value=text.trim();if(!value){setError(team?'יש לכתוב תשובה לפני השליחה.':'יש לכתוב הודעה לפני השליחה.');box.current?.focus();return;}
  lock.current=true;setBusy(true);
  try{const res=await ctx.run(()=>api('records/ticket/'+encodeURIComponent(row.id)+'/messages','POST',{text:value}),'');setText('');if(team)mailToast(res?.mail_status,'התשובה נשלחה והמצב ״נענתה״.');else toast.success('ההודעה נשלחה לצוות');}
  catch(err){setError((err as Error).message);}finally{lock.current=false;setBusy(false);}
 };
 return <form className="tc-composer" onSubmit={send} noValidate>
  <label className="tc-sr" htmlFor={'tc-text-'+row.id}>{team?'התשובה ללקוח':'ההודעה שלכם'}</label>
  <textarea ref={box} id={'tc-text-'+row.id} className="tc-text" maxLength={5000} value={text} onChange={e=>{setText(e.target.value);if(error)setError('');}} onKeyDown={e=>{if(e.key==='Enter'&&(e.metaKey||e.ctrlKey)){e.preventDefault();(e.currentTarget.form as HTMLFormElement|null)?.requestSubmit();}}} placeholder={team?'כתבו תשובה ללקוח…':'כתבו הודעה לצוות…'} disabled={busy}/>
  <div className="tc-composer-bar">
   {team?<div className="tc-quick" role="group" aria-label="תשובות מוכנות">{quick.map(([label,body])=><button key={label} type="button" className="tc-btn is-tint is-sm" disabled={busy} onClick={()=>{setText(body);setError('');requestAnimationFrame(()=>{const el=box.current;if(el){el.focus();el.setSelectionRange(body.length,body.length);}});}}>{label}</button>)}</div>:<span/>}
   <button type="submit" className="tc-btn is-primary" disabled={busy} aria-busy={busy||undefined}>{busy?<LoaderCircle size={17} className="animate-spin" aria-hidden="true"/>:team?<Check size={17} aria-hidden="true"/>:<Send size={17} aria-hidden="true"/>}{busy?'שולח…':team?'שליחת התשובה':'שליחת הודעה'}</button>
  </div>
  {error?<p className="tc-error" role="alert">{error}</p>:<p className="tc-after">{team?(closed?'הפנייה סגורה. תשובה חדשה תפתח אותה מחדש, והלקוח יקבל התראה.':'הלקוח יקבל התראה במייל, והמצב ישתנה ל״נענתה״.'):'הצוות יקבל את ההודעה ויענה כאן.'}</p>}
 </form>;
}

function StatusTrack({status}:{status:SupportStatus}){
 const at=status==='awaiting_reply'?1:status==='answered'?2:3;
 return <ol className="tc-track" aria-label="שלבי הפנייה">{['נפתחה','ממתין לתשובה','נענתה','הפנייה טופלה'].map((label,i)=><li key={label} className={i<at||at===3?'is-done':i===at?'is-now':''} aria-current={i===at?'step':undefined}>{label}</li>)}</ol>;
}

function CloseTicket({ctx,row,asking,setAsking}:{ctx:Ctx;row:Row;asking:boolean;setAsking:(v:boolean)=>void}){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 if(supportStatus(row)==='resolved')return <p className="tc-done"><Lock size={15} aria-hidden="true"/>הפנייה נסגרה{row.closed_at?<> ב־<bdi>{when(row.closed_at)}</bdi></>:null}</p>;
 const close=async()=>{setBusy(true);setError('');try{const res=await ctx.run(()=>api('records/ticket/'+encodeURIComponent(row.id)+'/close','POST',{}),'');setAsking(false);mailToast(res?.mail_status,'הפנייה נסגרה. הלקוח יראה ״הפנייה טופלה״.');}catch(e){setError((e as Error).message);}finally{setBusy(false);}};
 return <div className="tc-close">
  {asking?<div className="tc-confirm" role="group" aria-label="אישור סגירת הפנייה"><p>לסגור את הפנייה? הלקוח יקבל מייל שהיא טופלה.</p><div className="tc-confirm-actions"><button type="button" className="tc-btn is-danger-solid" disabled={busy} aria-busy={busy||undefined} onClick={close}>{busy?<LoaderCircle size={16} className="animate-spin" aria-hidden="true"/>:<Lock size={16} aria-hidden="true"/>}כן, לסגור</button><button type="button" className="tc-btn" disabled={busy} onClick={()=>setAsking(false)}>ביטול</button></div></div>
  :<button type="button" className="tc-btn is-danger is-wide" onClick={()=>setAsking(true)}><Lock size={16} aria-hidden="true"/>סגירת הפנייה</button>}
  {error?<p className="tc-error" role="alert">{error}</p>:<p className="tc-after is-center">הלקוח יראה ״הפנייה טופלה״, והפנייה תיסגר.</p>}
 </div>;
}

function EditDetails({row,details}:{row:Row;details:Details}){
 const [open,setOpen]=useState(false);
 return <details className="tc-details" open={open} onToggle={e=>setOpen((e.currentTarget as HTMLDetailsElement).open)}>
  <summary><Pencil size={16} aria-hidden="true"/>עריכת פרטי הפנייה (נושא, פירוט, מספר הזמנה)</summary>
  {open?<div className="tc-details-body">{details(row,()=>setOpen(false))}</div>:null}
 </details>;
}
