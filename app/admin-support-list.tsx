'use client';
import React,{useState} from 'react';
import {Lock,MessagesSquare,Plus,Trash2} from 'lucide-react';
import {api} from '@/lib/client';
import {when,type Row} from '@/lib/shared';
import {supportStatus,supportStatusLabels,type SupportStatus} from '@/lib/support-status';
import {ticketThread} from '@/lib/ticket-thread-view';
import type {Ctx} from './workspace';
import {OrderPager,OrderRecord,OrderSearch,OrderViews} from './order-list-parts';
import {OrdersAreaHead} from './orders-area-head';
import {TicketThread} from './ticket-conversation';
import {takeSupportSearch} from './support-search-handoff';

// Side stripe and status pill per ticket state: waiting for our reply needs handling.
const tones:Record<SupportStatus,[string,string]>={awaiting_reply:['red','unreported'],answered:['month','month'],resolved:['ok','ok']};
const plainClick=(e:React.MouseEvent)=>!(e.metaKey||e.ctrlKey||e.shiftKey||e.altKey||e.button);

// Admin list of service tickets in the approved orders look. 10.11.2026: a ticket opens as a
// conversation on its own page; the panel shows the latest messages and can close the ticket.
// Opening a new ticket and deleting keep the same dialogs as before (edit/remove come from SupportView).
export function AdminSupportList({ctx,state,edit,remove}:{ctx:Ctx;state:{data:any;loading:boolean;error:string};edit:(row?:Row)=>void;remove:(row:Row)=>void}){
 const [search,setSearch]=useState(()=>takeSupportSearch()),[status,setStatus]=useState('all'),[open,setOpen]=useState(''),[page,setPage]=useState(1);
 const all:Row[]=state.data?.records||[],query=search.trim().toLocaleLowerCase('he');
 const count=(s:SupportStatus)=>all.filter(r=>supportStatus(r)===s).length;
 const rows=all.filter(r=>(status==='all'||supportStatus(r)===status)&&[r.name,r.message,r.reply,r.order_number,r.id,r.user_name].some(v=>String(v||'').toLocaleLowerCase('he').includes(query)));
 const shown=Math.min(page,Math.max(1,Math.ceil(rows.length/20))),filtered=!!query||status!=='all';
 const conversation=(r:Row)=>(e:React.MouseEvent)=>{e.stopPropagation();if(!plainClick(e))return;e.preventDefault();ctx.go('admin-support/'+r.id);};
 return <section className="orders-match-screen om-finance om-content om-support sv2 sv2-orders sv2-fin" dir="rtl">
  <OrdersAreaHead ctx={ctx} current="admin-support" title="פניות שירות" sub="כל פנייה היא שיחה עם הלקוח: עונים, והוא מקבל התראה. מסיימים, וסוגרים." action={<div className="om-top-actions"><button type="button" className="om-btn is-primary" onClick={()=>edit()}><Plus size={17} aria-hidden="true"/>פתיחת פנייה</button></div>}/>
  <div className="orders-reference-panel">
   <div className="orders-reference-toolbar om-toolbar is-search"><OrderSearch label="חיפוש לפי נושא, לקוח או מספר הזמנה" value={search} onChange={v=>{setSearch(v);setPage(1);setOpen('');}}/></div>
   <OrderViews label="סינון לפי מצב הפנייה" value={status} onChange={v=>{setStatus(v);setPage(1);setOpen('');}} views={[['all','הכול',all.length],['awaiting_reply','ממתינות לתשובה',count('awaiting_reply')],['answered','נענו',count('answered')],['resolved','טופלו',count('resolved')]]}/>
   {state.loading&&!state.data?<div className="orders-reference-loading" role="status">טוען פניות…</div>
   :state.error?<div className="orders-reference-error" role="alert"><p>{state.error}</p><button type="button" onClick={ctx.refresh}>ניסיון נוסף</button></div>
   :rows.length?<>
    <div className="om-head om-ticket-head" aria-hidden="true"><span>פנייה</span><span>לקוח</span><span>הזמנה</span><span>מצב</span><span>עודכנה</span><span/><span/></div>
    <div className="om-list" aria-label="פניות הלקוחות">{rows.slice((shown-1)*20,shown*20).map(r=>{const s=supportStatus(r),isOpen=open===r.id;return <OrderRecord key={r.id} id={r.id} tone={tones[s][0]} label={r.name||'פנייה'} open={isOpen} onToggle={()=>setOpen(isOpen?'':r.id)} panel={<TicketPanel ctx={ctx} r={r} remove={remove} conversation={conversation(r)}/>}>
     <div className="om-who om-ticket"><b>{r.name||'פנייה ללא נושא'}</b><span>{lastLine(r)}</span></div>
     <div className="om-ticket-customer"><small className="om-phone-label">לקוח</small>{r.user_name||<span className="om-muted">לא ידוע</span>}</div>
     <div className="om-ticket-order"><small className="om-phone-label">הזמנה</small>{r.order_number?<bdi>{r.order_number}</bdi>:<span className="om-muted">אין</span>}</div>
     <div className="om-ticket-state"><span className={'om-pill is-'+tones[s][1]}>{supportStatusLabels[s]}</span></div>
     <div className="om-ticket-time"><bdi>{when(r.updated)}</bdi></div>
     <div className="om-ticket-actions"><a className="om-btn om-action is-primary" href={'/admin-support/'+r.id} onClick={conversation(r)}><MessagesSquare size={16} aria-hidden="true"/><span>{s==='awaiting_reply'?'מענה ללקוח':'פתיחת השיחה'}</span></a><button type="button" className="om-ticket-delete" aria-label={'מחיקת פנייה '+(r.name||'')} title="מחיקת פנייה" onClick={e=>{e.stopPropagation();remove(r);}}><Trash2 size={16} aria-hidden="true"/></button></div>
    </OrderRecord>;})}</div>
   </>
   :<div className="orders-reference-empty"><h3>{filtered?'לא נמצאו פניות':'עדיין אין פניות'}</h3><p>{filtered?'נסו חיפוש אחר או מצב אחר.':'פניות חדשות של לקוחות יופיעו כאן.'}</p>{search?<button type="button" className="om-btn" onClick={()=>{setSearch('');setPage(1);}}>ניקוי החיפוש</button>:null}</div>}
   <OrderPager page={shown} total={rows.length} size={20} onChange={v=>{setPage(v);setOpen('');}}/>
  </div>
 </section>;
}

// The row shows the latest message, so a new customer reply is visible without opening it.
function lastLine(r:Row){const thread=ticketThread(r.data||r,r.created,r.updated),last=thread[thread.length-1];if(!last)return 'ללא פירוט נוסף';return (last.from==='team'?'התשובה שלך: ':thread.length>1?'הלקוח: ':'')+last.text;}

function TicketPanel({ctx,r,remove,conversation}:{ctx:Ctx;r:Row;remove:(row:Row)=>void;conversation:(e:React.MouseEvent)=>void}){
 const thread=ticketThread(r.data||r,r.created,r.updated),s=supportStatus(r);
 const close=()=>ctx.open({title:'סגירת הפנייה',description:'הלקוח יראה ״הפנייה טופלה״ ויקבל על כך מייל. אם תענה שוב, הפנייה תיפתח מחדש.',render:(done:()=>void)=><div className="flex-row"><button type="button" className="om-btn is-primary" onClick={()=>ctx.run(()=>api('records/ticket/'+encodeURIComponent(r.id)+'/close','POST',{}),'הפנייה נסגרה. הלקוח יראה ״הפנייה טופלה״').then(done).catch(()=>{})}><Lock size={16} aria-hidden="true"/>סגירת הפנייה</button><button type="button" className="om-btn" onClick={done}>ביטול</button></div>});
 return <div className="om-ticket-panel">
  <section className="om-wide"><h3>השיחה{thread.length>1?<span className="om-muted"> · <bdi>{thread.length}</bdi> הודעות</span>:null}</h3><div className="tc tc-preview"><TicketThread messages={thread} team customerName={r.user_name} limit={3}/></div><p className="om-note">{r.user_name?'מאת '+r.user_name:'לקוח לא ידוע'}{r.order_number?<> · הזמנה <bdi>{r.order_number}</bdi></>:null} · עודכנה <bdi>{when(r.updated)}</bdi></p></section>
  <footer className="om-panel-foot"><a className="om-btn is-primary" href={'/admin-support/'+r.id} onClick={conversation}><MessagesSquare size={17} aria-hidden="true"/>{s==='awaiting_reply'?'מענה ללקוח':'פתיחת השיחה'}</a>{s!=='resolved'?<button type="button" className="om-btn" onClick={close}><Lock size={17} aria-hidden="true"/>סגירת הפנייה</button>:null}<button type="button" className="om-btn om-ticket-delete-wide" onClick={()=>remove(r)}><Trash2 size={17} aria-hidden="true"/>מחיקת הפנייה</button></footer>
 </div>;
}
