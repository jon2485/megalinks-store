'use client';
import React,{useState} from 'react';
import {Check,CheckCheck,Lock,MessagesSquare,MoreHorizontal,Plus,Trash2} from 'lucide-react';
import {api} from '@/lib/client';
import {when,type Row} from '@/lib/shared';
import {supportStatus,supportStatusLabels,type SupportStatus} from '@/lib/support-status';
import {ticketThread,type TicketMessage} from '@/lib/ticket-thread-view';
import {DropdownMenu,DropdownMenuContent,DropdownMenuItem,DropdownMenuSeparator,DropdownMenuTrigger} from '@/components/ui/dropdown-menu';
import type {Ctx} from './workspace';
import {OrderPager,OrderSearch,OrderViews} from './order-list-parts';
import {OrdersAreaHead} from './orders-area-head';
import {takeSupportSearch} from './support-search-handoff';
import {takeAdminViewState} from '@/lib/admin-view-state';
import './supplier-v2.css';
import './admin-support-list.css';

const plainClick=(e:React.MouseEvent)=>!(e.metaKey||e.ctrlKey||e.shiftKey||e.altKey||e.button);
// Same initials rule as the conversation page avatar (ticket-conversation.tsx).
const initials=(name:string)=>{const parts=String(name||'').trim().split(/\s+/).filter(Boolean);return (parts.length>1?parts[0][0]+parts[1][0]:(parts[0]||'?').slice(0,2)).toUpperCase();};
const tint=(key:string)=>{let n=0;for(const c of String(key||''))n=(n+c.charCodeAt(0))%6;return 'is-c'+n;};
const zone='Asia/Jerusalem',dayKey=(d:Date)=>new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
// WhatsApp-style time of the last message: the hour today, "אתמול", otherwise the date.
function shortTime(at:string){const d=new Date(at);if(!at||!Number.isFinite(d.getTime()))return '';const now=new Date(),key=dayKey(d),today=dayKey(now);if(key===today)return new Intl.DateTimeFormat('he-IL',{timeZone:zone,hour:'2-digit',minute:'2-digit'}).format(d);if(key===dayKey(new Date(now.getTime()-864e5)))return 'אתמול';return new Intl.DateTimeFormat('he-IL',{timeZone:zone,day:'numeric',month:'numeric',...(key.slice(0,4)!==today.slice(0,4)?{year:'2-digit' as const}:{})}).format(d);}
const fullTime=(at:string)=>{const d=new Date(at);return at&&Number.isFinite(d.getTime())?new Intl.DateTimeFormat('he-IL',{timeZone:zone,day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(d):'';};

// Admin list of service tickets. 22.11.2026 (owner): tickets read like WhatsApp chats, one compact row each,
// instead of a big card per ticket. The row opens the conversation page (admin-support/<id>), which holds the
// whole thread, the order link, the customer details and closing; closing and deleting also stay in the row's ⋯ menu.
// Opening a new ticket and deleting keep the same dialogs as before (edit/remove come from SupportView).
export function AdminSupportList({ctx,state,edit,remove}:{ctx:Ctx;state:{data:any;loading:boolean;error:string};edit:(row?:Row)=>void;remove:(row:Row)=>void}){
 const [search,setSearch]=useState(()=>takeSupportSearch()),[status,setStatus]=useState(()=>{const preset=takeAdminViewState<string>('support-status');return preset&&preset in supportStatusLabels?preset:'all';}),[page,setPage]=useState(1);
 const all:Row[]=state.data?.records||[],query=search.trim().toLocaleLowerCase('he');
 const count=(s:SupportStatus)=>all.filter(r=>supportStatus(r)===s).length;
 const rows=all.filter(r=>(status==='all'||supportStatus(r)===status)&&[r.name,r.message,r.reply,r.order_number,r.id,r.user_name].some(v=>String(v||'').toLocaleLowerCase('he').includes(query)));
 const shown=Math.min(page,Math.max(1,Math.ceil(rows.length/20))),filtered=!!query||status!=='all';
 return <section className="orders-match-screen om-finance om-content om-support sv2 sv2-orders sv2-fin sl-chat" dir="rtl">
  <OrdersAreaHead ctx={ctx} current="admin-support" title="פניות שירות" sub="כל פנייה היא שיחה עם הלקוח: עונים, והוא מקבל התראה. מסיימים, וסוגרים." action={<div className="om-top-actions"><button type="button" className="om-btn is-primary" onClick={()=>edit()}><Plus size={17} aria-hidden="true"/>פתיחת פנייה</button></div>}/>
  <div className="orders-reference-panel">
   <div className="orders-reference-toolbar om-toolbar is-search"><OrderSearch label="חיפוש לפי נושא, לקוח או מספר הזמנה" value={search} onChange={v=>{setSearch(v);setPage(1);}}/></div>
   <OrderViews label="סינון לפי מצב הפנייה" value={status} onChange={v=>{setStatus(v);setPage(1);}} views={[['all','הכול',all.length],['awaiting_reply','ממתינות לתשובה',count('awaiting_reply')],['answered','נענו',count('answered')],['resolved','טופלו',count('resolved')]]}/>
   {state.loading&&!state.data?<div className="orders-reference-loading" role="status">טוען פניות…</div>
   :state.error?<div className="orders-reference-error" role="alert"><p>{state.error}</p><button type="button" onClick={ctx.refresh}>ניסיון נוסף</button></div>
   :rows.length?<div className="sl-card"><ul className="om-list sl-list" aria-label="פניות הלקוחות">{rows.slice((shown-1)*20,shown*20).map(r=><ChatRow key={r.id} ctx={ctx} r={r} remove={remove}/>)}</ul></div>
   :<div className="orders-reference-empty"><h3>{filtered?'לא נמצאו פניות':'עדיין אין פניות'}</h3><p>{filtered?'נסו חיפוש אחר או מצב אחר.':'פניות חדשות של לקוחות יופיעו כאן.'}</p>{search?<button type="button" className="om-btn" onClick={()=>{setSearch('');setPage(1);}}>ניקוי החיפוש</button>:null}</div>}
   <OrderPager page={shown} total={rows.length} size={20} onChange={setPage}/>
  </div>
 </section>;
}

// The row shows the latest message, so a new customer reply is visible without opening it.
function lastLine(thread:TicketMessage[]){const last=thread[thread.length-1];if(!last)return 'ללא פירוט נוסף';return (last.from==='team'?'התשובה שלך: ':thread.length>1?'הלקוח: ':'')+last.text;}
// Customer messages since our last reply: the "unread" count on a ticket waiting for us.
function unanswered(thread:TicketMessage[]){let n=0;for(let i=thread.length-1;i>=0&&thread[i].from==='customer';i--)n++;return n;}

function ChatRow({ctx,r,remove}:{ctx:Ctx;r:Row;remove:(row:Row)=>void}){
 const thread=ticketThread(r.data||r,r.created,r.updated),s=supportStatus(r),waiting=s==='awaiting_reply',fresh=unanswered(thread);
 const at=[thread[thread.length-1]?.at,r.updated,r.created].find(v=>v&&Number.isFinite(new Date(v).getTime()))||'';
 const href='/admin-support/'+r.id,go=()=>ctx.go('admin-support/'+r.id);
 const open=(e:React.MouseEvent)=>{e.stopPropagation();if(!plainClick(e))return;e.preventDefault();go();};
 const close=()=>ctx.open({title:'סגירת הפנייה',description:'הלקוח יראה ״הפנייה טופלה״ ויקבל על כך מייל. אם תענה שוב, הפנייה תיפתח מחדש.',render:(done:()=>void)=><div className="flex-row"><button type="button" className="om-btn is-primary" onClick={()=>ctx.run(()=>api('records/ticket/'+encodeURIComponent(r.id)+'/close','POST',{}),'הפנייה נסגרה. הלקוח יראה ״הפנייה טופלה״').then(done).catch(()=>{})}><Lock size={16} aria-hidden="true"/>סגירת הפנייה</button><button type="button" className="om-btn" onClick={done}>ביטול</button></div>});
 return <li className={'sl-row'+(waiting?' is-unread':'')}>
  <a className="sl-link" href={href} onClick={open} title={(waiting?'מענה ללקוח':'פתיחת השיחה')+(r.name?': '+r.name:'')}>
   <span className={'sl-avatar '+tint(r.user_name||r.user_id||r.id)} aria-hidden="true">{initials(r.user_name)}</span>
   <span className="sl-main">
    <span className="sl-line">
     <span className={'sl-name'+(r.user_name?'':' is-unknown')}>{r.user_name||'לקוח לא ידוע'}</span>
     <span className="sl-subject"><span className="sl-sep" aria-hidden="true">·</span>{r.name||'פנייה ללא נושא'}</span>
    </span>
    <span className="sl-line">
     <span className="sl-preview">{lastLine(thread)}</span>
     {r.order_number?<span className="sl-order">הזמנה <bdi>{r.order_number}</bdi></span>:null}
    </span>
   </span>
   <span className="sl-side">
    <time className="sl-time" dateTime={at||undefined} title={fullTime(at)||when(r.updated)}><bdi>{shortTime(at)||when(r.updated)}</bdi></time>
    <span className="sl-mark" title={supportStatusLabels[s]}>
     {waiting?<span className={'sl-badge'+(fresh?'':' is-dot')} aria-hidden="true">{fresh||''}</span>
     :s==='resolved'?<CheckCheck className="sl-check is-done" size={17} aria-hidden="true"/>
     :<Check className="sl-check" size={17} aria-hidden="true"/>}
     <span className="sl-sr">{supportStatusLabels[s]}{waiting&&fresh?', '+(fresh===1?'הודעה אחת חדשה':fresh+' הודעות חדשות'):''}</span>
    </span>
   </span>
  </a>
  <DropdownMenu dir="rtl">
   <DropdownMenuTrigger asChild><button type="button" className="sl-more" aria-label={'עוד פעולות לפנייה '+(r.name||'')} title="עוד פעולות"><MoreHorizontal size={18} aria-hidden="true"/></button></DropdownMenuTrigger>
   <DropdownMenuContent className="sv2-menu sl-menu" align="end">
    <DropdownMenuItem className="is-first" onSelect={go}><MessagesSquare aria-hidden="true"/>{waiting?'מענה ללקוח':'פתיחת השיחה'}</DropdownMenuItem>
    {s!=='resolved'?<DropdownMenuItem onSelect={close}><Lock aria-hidden="true"/>סגירת הפנייה</DropdownMenuItem>:null}
    <DropdownMenuSeparator/>
    <DropdownMenuItem className="sv2-danger" onSelect={()=>remove(r)}><Trash2 aria-hidden="true"/>מחיקת הפנייה</DropdownMenuItem>
   </DropdownMenuContent>
  </DropdownMenu>
 </li>;
}
