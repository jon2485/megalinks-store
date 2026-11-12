'use client';
import React,{useEffect,useRef,useState} from 'react';
import {toast} from 'sonner';
import {ArrowRight,BarChart3,Bell,CalendarDays,Check,CheckCircle2,ChevronDown,ChevronLeft,ChevronRight,Clock,CreditCard,FileText,History,Info,Landmark,Loader2,Mail,MessageSquare,PenLine,Plug,Plus,ReceiptText,RefreshCcw,RefreshCw,RotateCcw,Search,Send,Store,Tags,TriangleAlert,Wallet,X,XCircle} from 'lucide-react';
import {api,useData} from '@/lib/client';
import {money,when,type Row} from '@/lib/shared';
import {adminViewState,saveAdminViewState} from '@/lib/admin-view-state';
import type {Ctx} from './workspace';
import {useAdminAttention} from './admin-attention';
import {openCancelFocus} from './cancel-focus';
import './admin-lobby-v1.css';

// Lobby v1, approved 10.11.2026 (docs/mockups/lobby-v1.html).
// One row per kind of work with one button, follow-up tiles, quiet queues as chips, business numbers at the side.
// It replaces the lanes of single rows and the folding "more queues" desk: every destination is reached from here.
type Icon=typeof FileText;
type Lane='urgent'|'content'|'service';
type TaskDef={id:string;lane:Lane;icon:Icon;one:string;many:string;go:string;goMany:string;page:string;preset?:[string,unknown];old:string;quiet:string;list?:boolean};
const initial={q:'',state:'open',page:1,scroll:0,limits:{} as Record<string,number>};
const lanes:{id:Lane;label:string;sub:string}[]=[
 {id:'urgent',label:'דחוף',sub:'ביטולים, כסף לאישור ותקלות שליחה'},
 {id:'content',label:'תוכן ופרסום',sub:'כתבות שמחכות לך'},
 {id:'service',label:'שירות וספקים',sub:'אנשים שמחכים לתשובה'},
];
// `page` is where several items of the same kind are handled. A single item opens directly, except `list` kinds.
const taskDefs:TaskDef[]=[
 {id:'cancellation',lane:'urgent',icon:XCircle,one:'בקשת ביטול וזיכוי',many:'בקשות ביטול וזיכוי',go:'טיפול בביטול',goMany:'לבקשות הביטול',page:'admin-orders',preset:['orders-bucket','attention'],old:'הוותיקה',quiet:'בקשות ביטול וזיכוי'},
 {id:'bank',lane:'urgent',icon:Landmark,one:'דיווח תשלום לאישור',many:'דיווחי תשלום לאישור',go:'בדיקה ואישור',goMany:'בדיקה ואישור',page:'admin-payment-reports',old:'הוותיק',quiet:'דיווחי תשלום',list:true},
 {id:'unapplied',lane:'urgent',icon:CreditCard,one:'תשלום בכרטיס שלא זוכה',many:'תשלומים בכרטיס שלא זוכו',go:'טיפול בתשלום',goMany:'טיפול בתשלומים',page:'admin-orders',old:'הוותיק',quiet:'תשלומים בכרטיס שלא זוכו',list:true},
 {id:'topup',lane:'urgent',icon:Wallet,one:'בקשת הטענת יתרה',many:'בקשות הטענת יתרה',go:'בדיקת הבקשה',goMany:'בדיקת הבקשות',page:'admin-topups',old:'הוותיקה',quiet:'הטענות יתרה'},
 {id:'delivery',lane:'urgent',icon:TriangleAlert,one:'תקלה בשליחה לספק',many:'תקלות שליחה לספק',go:'פתיחת הכתבה',goMany:'לתקלות השליחה',page:'admin-publication',old:'הוותיקה',quiet:'תקלות שליחה לספק'},
 {id:'article',lane:'content',icon:FileText,one:'כתבה לאישור שלך',many:'כתבות לאישור שלך',go:'בדיקת הכתבה',goMany:'בדיקת הכתבות',page:'admin-approvals',old:'הוותיקה',quiet:'כתבות לאישור'},
 {id:'publication',lane:'content',icon:Send,one:'מוכנה לשליחה לספק',many:'מוכנות לשליחה לספק',go:'פתיחת הכתבה',goMany:'לכתבות המוכנות',page:'admin-publication',old:'הוותיקה',quiet:'מוכנות לשליחה לספק'},
 {id:'writing',lane:'content',icon:PenLine,one:'כתבה לכותב התוכן',many:'כתבות לכותב התוכן',go:'כתיבת המאמר',goMany:'לכתבות לכתיבה',page:'admin-writing',old:'הוותיקה',quiet:'כתבות לכותב התוכן'},
 {id:'late',lane:'content',icon:TriangleAlert,one:'באיחור אצל הספק',many:'באיחור אצל הספק',go:'מעקב מול הספק',goMany:'מעקב מול הספק',page:'admin-publication',old:'הוותיקה',quiet:'איחורים אצל הספק',list:true},
 {id:'support',lane:'service',icon:MessageSquare,one:'פנייה שמחכה לתשובה',many:'פניות שמחכות לתשובה',go:'פתיחת הפנייה',goMany:'מענה לפניות',page:'admin-support',preset:['support-status','awaiting_reply'],old:'הוותיקה',quiet:'פניות שירות'},
 {id:'seller_request',lane:'service',icon:Store,one:'בקשת ספק לבדיקה',many:'בקשות ספקים לבדיקה',go:'בדיקת הבקשה',goMany:'לבקשות הספקים',page:'admin-seller-requests',preset:['suppliers:requests-v2',{tab:'requests'}],old:'הוותיקה',quiet:'בקשות ספקים'},
 {id:'seller_invoice',lane:'service',icon:ReceiptText,one:'חשבונית ספק לבדיקה',many:'חשבוניות ספקים לבדיקה',go:'בדיקת החשבונית',goMany:'לחשבוניות הספקים',page:'admin-seller-requests',preset:['suppliers:requests-v2',{tab:'invoices'}],old:'הוותיקה',quiet:'חשבוניות ספקים'},
];
const kindIcons:Record<string,Icon>={cancellation:XCircle,delivery:TriangleAlert,bank:Landmark,topup:Wallet,unapplied:CreditCard,article:FileText,publication:Send,writing:PenLine,late:TriangleAlert,support:MessageSquare,seller:Store,paid:CheckCircle2};
const date=(s:string)=>{const d=new Date(s);return Number.isNaN(+d)?'לא תועד':new Intl.DateTimeFormat('he-IL',{timeZone:'Asia/Jerusalem',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(d);};
const clock=(d:Date)=>new Intl.DateTimeFormat('he-IL',{timeZone:'Asia/Jerusalem',hour:'2-digit',minute:'2-digit'}).format(d);
const dayLine=(d:Date)=>new Intl.DateTimeFormat('he-IL',{timeZone:'Asia/Jerusalem',weekday:'long',day:'numeric',month:'long'}).format(d);
const hours=(s:string)=>(Date.now()-+new Date(s))/36e5;
function waited(s:string){const h=hours(s);if(Number.isNaN(h))return 'לא תועד';if(h<1/60)return 'עכשיו';if(h<1){const m=Math.floor(h*60);return m===1?'דקה':m+' דק׳';}if(h<24){const n=Math.floor(h);return n===1?'שעה':n===2?'שעתיים':n+' שעות';}const n=Math.floor(h/24);return n===1?'יום':n===2?'יומיים':n+' ימים';}
const plain=(e:React.MouseEvent)=>e.button===0&&!e.metaKey&&!e.ctrlKey&&!e.shiftKey&&!e.altKey;
const still=()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const whole=(cents:number)=>new Intl.NumberFormat('he-IL',{style:'currency',currency:'ILS',maximumFractionDigits:0}).format((cents||0)/100);
const days=(n:number)=>n<=0?'היום':n===1?'יום':n===2?'יומיים':n+' ימים';
const dayShift=(day:string,n:number)=>{const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
const dayLetter=(day:string)=>new Intl.DateTimeFormat('he-IL',{weekday:'narrow',timeZone:'UTC'}).format(new Date(day+'T12:00:00Z'));
const real=(s:unknown)=>typeof s==='string'&&s.trim()&&s!=='כתבה ללא כותרת'?s.trim():'';
// What identifies a row: the main words, a short tail for the lobby line, a full tail for the item line.
function lines(r:Row,task:string):{lead:string;short:unknown[];full:unknown[]}{
 const ref=r.detail&&'אסמכתא '+r.detail;
 if(task==='bank'||task==='topup')return {lead:r.user_name,short:[r.number,ref],full:[ref||r.status]};
 if(task==='unapplied')return {lead:r.user_name,short:[r.number,r.detail],full:[r.number,r.detail]};
 if(task==='cancellation')return {lead:r.user_name,short:[r.number,r.website_name],full:[r.number,r.website_name,real(r.detail)]};
 if(task==='seller_request')return {lead:r.user_name,short:[r.website_name],full:[r.website_name]};
 if(task==='seller_invoice')return {lead:r.user_name,short:[r.detail&&'חודש '+r.detail],full:[r.detail&&'חודש '+r.detail]};
 return real(r.detail)?{lead:real(r.detail),short:[r.number,r.website_name],full:[r.user_name,r.number,r.website_name]}:{lead:r.user_name,short:[r.number,r.website_name],full:[r.number,r.website_name]};
}
const dot=(parts:unknown[])=>parts.filter(Boolean).map((p,i)=><React.Fragment key={i}>{i>0&&' · '}<bdi>{String(p)}</bdi></React.Fragment>);

// Price changes used to be checked only inside the folding desk. Here the same list and the same action open as a dialog.
function PriceReview({ctx,queues,close}:{ctx:Ctx;queues:Row[];close:()=>void}){
 const [tick,setTick]=useState(0),state=useData('admin/control-center/prices',ctx.revision+tick,true,30000),[busy,setBusy]=useState(''),[error,setError]=useState('');
 const rows:Row[]=state.data?.prices||[],leave=(page:string)=>{close();ctx.go(page);};
 return <div className="lb-prices" dir="rtl">
  {(state.error||error)&&<p className="lb-pr-err" role="alert">{state.error||error}</p>}
  {queues.filter(q=>['pricing_review','sync'].includes(q.id)&&q.count>0).map(q=><div className="lb-pr is-alert" key={q.id}><div><b>{q.label} · {q.count}</b><small>{q.description}</small></div><button type="button" onClick={()=>leave(q.page)}>פתיחת הטיפול</button></div>)}
  {rows.map(p=><div className="lb-pr" key={p.id}><div><b>{p.website_name||'אתר במחירון'}</b><small>{when(p.created)} · מחיר קודם <bdi>{money(p.before_price)}</bdi> · מחיר מעודכן <bdi>{money(p.after_price??p.price)}</bdi></small></div>
   <button type="button" disabled={!!busy} aria-busy={busy===p.id||undefined} onClick={async()=>{if(busy)return;setBusy(p.id);setError('');try{await ctx.run(()=>api('admin/control-center/prices/'+p.id,'POST',{}),'עדכון המחיר סומן כנבדק');setTick(t=>t+1);}catch(e){setError((e as Error).message);}finally{setBusy('');}}}>{busy===p.id?'מסמן…':'בדקתי את השינוי'}</button></div>)}
  {!rows.length&&(state.loading&&!state.data?<p className="lb-pr-none" role="status">טוען שינויי מחירים…</p>:<p className="lb-pr-none">אין שינויי מחירים שממתינים לבדיקה.</p>)}
  <button type="button" className="is-quiet" onClick={()=>leave('admin-websites')}>בדיקת סנכרון וניהול האתרים</button>
 </div>;
}

// A card charge the provider confirmed that was not applied to its order. The admin checks it, then closes it with a note.
function UnappliedReview({ctx,close}:{ctx:Ctx;close:()=>void}){
 const [tick,setTick]=useState(0),state=useData('admin/unapplied-payments',ctx.revision+tick,true,30000),[busy,setBusy]=useState(''),[error,setError]=useState(''),[notes,setNotes]=useState<Record<string,string>>({});
 const rows:Row[]=state.data?.payments||[];
 async function handle(p:Row){const note=(notes[p.id]||'').trim();if(busy)return;if(note.length<2){setError('יש לכתוב מה נעשה עם התשלום.');return;}setBusy(p.id);setError('');try{await ctx.run(()=>api('admin/unapplied-payments/handle','POST',{id:p.id,note}),'התשלום סומן כטופל');setTick(t=>t+1);}catch(e){setError((e as Error).message);}finally{setBusy('');}}
 return <div className="lb-prices" dir="rtl">
  <p className="lb-pr-none">הכרטיס חויב, והסכום לא נרשם להזמנה ולא זוכה ליתרה. בדקו מול חברת הסליקה, טפלו בכסף, ורק אז סמנו כטופל.</p>
  {(state.error||error)&&<p className="lb-pr-err" role="alert">{state.error||error}</p>}
  {rows.map(p=><div className="lb-pr" key={p.id}><div><b><bdi>{p.user_name||'לקוח'}</bdi> · הזמנה <bdi>{p.number}</bdi></b><small><bdi>{money(p.amount_cents)}</bdi> · <bdi>{date(p.created)}</bdi>{p.reason_label&&' · '+p.reason_label}</small></div>
   <button type="button" className="is-quiet" onClick={()=>{close();ctx.go('admin-order/'+p.order_id);}}>פתיחת ההזמנה</button>
   <input type="text" maxLength={500} aria-label={'מה נעשה עם התשלום של '+(p.user_name||'הלקוח')} placeholder="מה נעשה? למשל: הוחזר ללקוח בכרטיס" value={notes[p.id]||''} onChange={e=>setNotes(n=>({...n,[p.id]:e.target.value}))}/>
   <button type="button" disabled={!!busy} aria-busy={busy===p.id||undefined} onClick={()=>handle(p)}>{busy===p.id?'מסמן…':'סימון כטופל'}</button></div>)}
  {!rows.length&&(state.loading&&!state.data?<p className="lb-pr-none" role="status">טוען תשלומים…</p>:<p className="lb-pr-none">אין תשלומים בכרטיס שמחכים לטיפול.</p>)}
 </div>;
}

export default function AdminUpdateFeed({ctx}:{ctx:Ctx}){
 const [saved,setSaved]=useState(()=>({...initial,...adminViewState('updates',initial)})),[draft,setDraft]=useState(saved.q);
 const [busy,setBusy]=useState(''),[done,setDone]=useState<string[]>([]),[rowError,setRowError]=useState<{id:string;message:string}|null>(null),[opening,setOpening]=useState(''),[flash,setFlash]=useState(''),[refreshed,setRefreshed]=useState(false),[moreBusy,setMoreBusy]=useState('');
 const [stamp,setStamp]=useState({day:'',time:''}),[expanded,setExpanded]=useState<Record<string,boolean>>({}),[calm,setCalm]=useState<boolean|null>(null),[foundAll,setFoundAll]=useState(false);
 const input=useRef<HTMLInputElement>(null),root=useRef<HTMLElement>(null),lock=useRef(false),restore=useRef(saved.scroll),latest=useRef(saved),refreshing=useRef(false),timers=useRef<ReturnType<typeof setTimeout>[]>([]);
 const isOpen=saved.state==='open';
 const taskParams=new URLSearchParams({view:'tasks',q:saved.q,...Object.fromEntries(Object.entries(saved.limits).map(([k,v])=>['limit_'+k,String(v)]))});
 const listParams=new URLSearchParams({q:saved.q,state:'handled',page:String(saved.page)});
 const taskState=useData('admin/control-center/updates?'+taskParams,ctx.revision,isOpen,30000),listState=useData('admin/control-center/updates?'+listParams,ctx.revision,!isOpen,30000),state=isOpen?taskState:listState,attention=useAdminAttention(ctx);
 const pulse=useData('admin/control-center/pulse',ctx.revision,true,60000).data;
 const found=useData('admin/control-center/search?q='+encodeURIComponent(saved.q),ctx.revision,isOpen&&saved.q.length>=2,0);
 const later=(fn:()=>void,ms:number)=>{timers.current.push(setTimeout(fn,ms));};
 const data=taskState.data,tasks:Row=data?.tasks||{},laneTotal=(id:string)=>Number(data?.lanes?.[id]||0),urgentN=laneTotal('urgent'),toHandle=urgentN+laneTotal('content')+laneTotal('service');
 const handledCount=Number(data?.counts?.handled??listState.data?.counts?.handled??0),searching=draft.trim()!==saved.q||(!!saved.q&&state.loading);
 const queues:Row[]=attention.data?.queues||[],queueCount=(id:string)=>Number(queues.find(q=>q.id===id)?.count||0);
 const cash=Number(tasks.bank?.amount||0)+Number(tasks.topup?.amount||0);
 useEffect(()=>{latest.current=saved;saveAdminViewState('updates',saved);},[saved]);
 useEffect(()=>{const remember=()=>saveAdminViewState('updates',{...latest.current,scroll:window.scrollY});window.addEventListener('scroll',remember,{passive:true});return()=>window.removeEventListener('scroll',remember);},[]);
 useEffect(()=>()=>{timers.current.forEach(clearTimeout);},[]);
 useEffect(()=>{if(state.data){const now=new Date();setStamp({day:dayLine(now),time:clock(now)});if(restore.current){window.scrollTo(0,restore.current);restore.current=0;}}},[state.data]);
 useEffect(()=>{if(state.loading)return;setMoreBusy('');if(refreshing.current){refreshing.current=false;if(!state.error){setRefreshed(true);later(()=>setRefreshed(false),1800);}}},[state.loading,state.error]);
 useEffect(()=>{const timer=setTimeout(()=>{const q=draft.trim();if(q!==latest.current.q)commit({q});},350);return()=>clearTimeout(timer);},[draft]);
 function commit(change:Partial<typeof initial>){setRowError(null);setFoundAll(false);setSaved(s=>({...s,...change,page:change.page??1,scroll:0}));}
 function refresh(){refreshing.current=true;setRefreshed(false);ctx.refresh();}
 function open(key:string,page:string,preset?:[string,unknown]){if(preset)saveAdminViewState(preset[0],preset[1]);setOpening(key);saveAdminViewState('updates',{...saved,scroll:window.scrollY});ctx.go(page);later(()=>setOpening(''),4000);}
 function openRow(row:Row,key:string){if(row.kind==='cancellation'&&row.resource_id&&!String(row.id).startsWith('cancel-request:')){openCancelFocus(ctx,row.resource_id);return;}open(key,row.page,row.kind==='topup'?['topups-search',row.detail||row.user_name]:undefined);}
 function openUnapplied(){ctx.open({title:'תשלומים בכרטיס שלא זוכו',description:'כסף שנגבה בכרטיס ולא נרשם להזמנה',render:(close:()=>void)=><UnappliedReview ctx={ctx} close={close}/>});}
 function openTask(def:TaskDef,t:Row){if(def.id==='unapplied')return openUnapplied();const first:Row|undefined=t.rows?.[0];if(t.total===1&&first&&!def.list)return openRow(first,'task:'+def.id);open('task:'+def.id,def.page,def.preset);}
 function openPrices(){ctx.open({title:'שינויי מחירים לבדיקה',description:'שינויים במחירון שטרם נבדקו',render:(close:()=>void)=><PriceReview ctx={ctx} queues={queues} close={close}/>});}
 function jump(id:string){setFlash(id);later(()=>setFlash(f=>f===id?'':f),1200);const el=document.getElementById('lb-g-'+id);el?.scrollIntoView({behavior:still()?'auto':'smooth',block:'start'});el?.querySelector<HTMLElement>('h3')?.focus({preventScroll:true});}
 function more(id:string,all:number,shown:number,step=10){setMoreBusy(id);commit({limits:{...saved.limits,[id]:Math.min(all,shown+step)}});}
 function less(id:string){const rest={...saved.limits};delete rest[id];commit({limits:rest});}
 function toggleCalm(){setCalm(c=>c===null?!window.matchMedia('(min-width:761px)').matches:!c);}
 async function undo(historyId:string){try{await api('admin/control-center/updates/reopen','POST',{history_id:historyId});toast.success('ההתראה הוחזרה לטיפול');ctx.refresh();}catch(e){toast.error((e as Error).message||'לא ניתן להחזיר לטיפול. אפשר לעשות זאת מ"טופלו".');}}
 async function mark(row:Row,reopen=false){
  const key=row.history_id||row.id;if(lock.current)return;lock.current=true;setBusy(key);setRowError(null);
  try{const result=await api('admin/control-center/updates'+(reopen?'/reopen':''),'POST',reopen?{history_id:row.history_id}:{id:row.id,version:row.version});
   setDone(list=>[...list,key]);
   if(reopen)toast.success('ההתראה הוחזרה לטיפול');else toast.success('ההתראה הועברה לטופלו',result?.history_id?{action:{label:'ביטול',onClick:()=>undo(result.history_id)},duration:6000}:undefined);
   later(()=>{setDone(list=>list.filter(x=>x!==key));ctx.refresh();},1100);
  }catch(e){setRowError({id:key,message:(e as Error).message||'הפעולה לא הושלמה. אפשר לנסות שוב.'});}finally{setBusy('');lock.current=false;}
 }
 const link=(key:string,page:string,run:()=>void,className:string,children:React.ReactNode,title?:string)=><a key={key} className={className+(opening===key?' is-opening':'')} href={'/'+page} title={title} aria-busy={opening===key||undefined} onClick={e=>{if(!plain(e))return;e.preventDefault();run();}}>{children}</a>;
 const arrow=(key:string)=>opening===key?<Loader2 className="lb-spin" size={16} aria-hidden="true"/>:<ChevronLeft size={16} aria-hidden="true"/>;
 const doneButton=(row:Row)=>{const isBusy=busy===row.id;return <button type="button" className="lb-done" disabled={!!busy} aria-busy={isBusy||undefined} aria-label={'סמן כטופל: '+row.title} title="סמן כטופל" onClick={()=>mark(row)}>{isBusy?<Loader2 className="lb-spin" size={16} aria-hidden="true"/>:<Check size={17} aria-hidden="true"/>}</button>;};
 const failed=(key:string)=>rowError?.id===key&&<p className="lb-row-error" role="alert"><TriangleAlert size={16} aria-hidden="true"/><span>{rowError.message}</span></p>;
 const waitPill=(stampAt:string)=><time className={'lb-wait'+(hours(stampAt)>=24?' is-late':'')} dateTime={stampAt} title={date(stampAt)}><Clock size={13} aria-hidden="true"/>{waited(stampAt)}</time>;
 const item=(r:Row,def:TaskDef)=>{const {lead,full}=lines(r,def.id),finished=done.includes(r.id);
  return <div className={'lb-it'+(finished?' is-finished':'')} key={r.id}>
   <div className="lb-txt"><b><bdi>{lead}</bdi>{(def.id==='bank'||def.id==='topup')&&r.number&&<> · <bdi>{r.number}</bdi></>}</b><small>{dot(full)}</small></div>
   <div className="lb-meta">{r.amount!=null&&<bdi className="lb-amt">{money(r.amount)}</bdi>}{waitPill(r.happened_at)}</div>
   {finished?<span className="lb-finished" role="status"><CheckCircle2 size={18} aria-hidden="true"/>סומן כטופל</span>:<>{link(r.id,r.page,()=>openRow(r,r.id),'lb-btn is-ghost',<span>{opening===r.id?'פותח…':r.action}</span>)}{def.id!=='unapplied'&&doneButton(r)}</>}
   {failed(r.id)}
  </div>;};
 const taskRow=(def:TaskDef)=>{const t:Row|undefined=tasks[def.id];if(!t?.total)return null;
  const rows:Row[]=t.rows||[],first=rows[0],single=t.total===1&&!!first,Icon=def.icon,key='task:'+def.id,shown=!single&&!!expanded[def.id],finished=single&&done.includes(first.id);
  const {lead,short}=first?lines(first,def.id):{lead:'',short:[]},toggle=()=>setExpanded(x=>({...x,[def.id]:!x[def.id]}));
  return <div className={'lb-q'+(finished?' is-finished':'')} key={def.id}>
   <div className={'lb-qrow'+(single?'':' is-many')} onClick={single?undefined:e=>{if(!(e.target as HTMLElement).closest('a,button'))toggle();}}>
    <span className={'lb-num'+(t.total>99?' is-wide':'')}>{t.total}</span>
    <div className="lb-txt"><b><Icon size={17} aria-hidden="true"/>{single?def.one:def.many}</b>{first&&<small>{!single&&def.old+': '}{dot(single?[lead,...short]:[lead,short[0]])}</small>}</div>
    <div className="lb-meta">{Number(t.amount)>0&&<bdi className="lb-amt">{whole(t.amount)}</bdi>}{t.oldest&&waitPill(t.oldest)}</div>
    {link(key,single&&!def.list?first.page:def.page,()=>openTask(def,t),'lb-btn '+(def.lane==='urgent'?'is-pri':'is-soft'),<><span>{opening===key?'פותח…':single?def.go:def.goMany}</span>{arrow(key)}</>)}
    {single?(finished?<span className="lb-finished" role="status" aria-label="סומן כטופל"><Check size={18} aria-hidden="true"/></span>:def.id!=='unapplied'&&doneButton(first)):<button type="button" className="lb-end" aria-expanded={shown} aria-controls={'lb-items-'+def.id} aria-label={(shown?'הסתרת הפריטים: ':'הצגת הפריטים: ')+def.many} onClick={toggle}><ChevronDown size={20} aria-hidden="true"/></button>}
   </div>
   {single&&failed(first.id)}
   {shown&&<div className="lb-items" id={'lb-items-'+def.id}>{rows.map(r=>item(r,def))}
    {moreBusy===def.id?<button type="button" className="lb-more" disabled aria-busy="true">טוען…<Loader2 className="lb-spin" size={16} aria-hidden="true"/></button>:t.total>rows.length&&<button type="button" className="lb-more" onClick={()=>more(def.id,t.total,rows.length)}>הצגת עוד {Math.min(10,t.total-rows.length)} מתוך {t.total-rows.length}<ChevronDown size={16} aria-hidden="true"/></button>}</div>}
  </div>;};
 // Follow-up: not urgent, still has to be closed. Zero counts move to the quiet chips.
 type Follow={id:string;icon:Icon;label:string;sub:React.ReactNode;n:number;ready:boolean;warn?:boolean;page:string;run:()=>void;hint?:string};
 const fromQueue=(id:string,icon:Icon,label:string,sub:string,page:string,extra:Partial<Follow>={}):Follow=>({id,icon,label,sub,page,n:queueCount(id),ready:!!attention.data,run:()=>open(id,page),...extra});
 const follow:Follow[]=[
  {id:'awaiting',icon:CreditCard,label:'ממתינות לתשלום',page:'admin-orders',n:Number(pulse?.awaiting.count||0),ready:!!pulse,sub:pulse?<><bdi>{whole(pulse.awaiting.cents)}</bdi> · {pulse.awaiting.oldest_days<=0?'מהיום':'הוותיקה '+days(pulse.awaiting.oldest_days)}</>:'',run:()=>open('awaiting','admin-orders',['orders-bucket','awaiting'])},
  fromQueue('invoices',ReceiptText,'מסמכים חסרים','שולמו, בלי חשבונית או קבלה','admin-invoices',{warn:true,run:()=>open('invoices','admin-invoices',['invoices-status','missing'])}),
  fromQueue('monthly',CalendarDays,queueCount('monthly')===1?'חשבון חודשי פתוח':'חשבונות חודשיים פתוחים','לקוח וחודש שטרם נסגרו','admin-monthly'),
  fromQueue('supplier_due',Store,'התחשבנות ספקים','ספקים וחודשים שטרם שולמו','admin-supplier-finance'),
  fromQueue('tracking',Send,'פרסומים במעקב','אצל הספק, מחכים לקישור','admin-publication'),
  fromQueue('mail',Mail,'דיוור לטיפול','הודעות שלא נשלחו','admin-notifications',{warn:true}),
  {id:'abandoned',icon:Clock,label:'הזמנות שנזנחו',page:'admin-orders',n:Number(data?.abandoned||0),ready:!!data,sub:'בלי דיווח תשלום מעל 14 ימים',warn:true,run:()=>open('abandoned','admin-orders',['orders-bucket','abandoned'])},
  fromQueue('connections',Plug,'תקלות חיבור','אירועים שנכשלו בחיבורים','admin-jobs',{warn:true}),
  fromQueue('prices',Tags,'שינויי מחירים','שינויים במחירון שטרם נבדקו','admin-websites',{run:openPrices,hint:'נפתח כאן, בחלון'}),
  fromQueue('pricing_review',Tags,'מחירים קבועים לבדיקה','בעקבות שינוי עלות','admin-pricing'),
  fromQueue('sync',RefreshCcw,'סנכרון הקטלוג','עדכון Sheets מחכה לבדיקה','admin-websites'),
 ];
 const tiles=follow.filter(f=>f.n>0);
 const quiet:{id:string;label:string;page:string;run:()=>void}[]=[
  ...(data&&!saved.q?taskDefs.filter(d=>!tasks[d.id]?.total).map(d=>({id:d.id,label:d.quiet,page:d.page,run:()=>d.id==='unapplied'?openUnapplied():open('quiet:'+d.id,d.page,d.preset)})):[]),
  ...follow.filter(f=>f.ready&&f.n===0).map(f=>({id:f.id,label:f.label,page:f.page,run:f.run})),
  // The old desk always had a way to the connection settings; the warning above covers it only while e-mail is off.
  ...(attention.data&&attention.data.email_ready!==false?[{id:'email',label:'חיבור הדוא״ל',page:'admin-connections',run:()=>open('quiet:email','admin-connections')}]:[]),
 ];
 const big:[React.ReactNode,React.ReactNode]=!isOpen?['טופלו',handledCount===1?'התראה אחת סומנה':handledCount+' התראות סומנו']
  :!data?['טוען','את המשימות…']
  :saved.q?[toHandle===0?'לא נמצאו':toHandle===1?'נמצאה אחת':'נמצאו '+toHandle,toHandle===1?'משימה בחיפוש':'משימות בחיפוש']
  :toHandle===0?['הכול רגוע','אין דברים שמחכים לך']
  :[toHandle===1?'דבר אחד מחכה לך':toHandle+' דברים מחכים לך',urgentN===0?'בלי דברים דחופים':toHandle===1?'והוא דחוף':urgentN===toHandle?'כולם דחופים':urgentN===1?'אחד מהם דחוף':<><em>{urgentN}</em> מהם דחופים</>];
 const revenueDelta=pulse?.revenue.previous?Math.round((pulse.revenue.month-pulse.revenue.previous)/pulse.revenue.previous*100):null,ordersDelta=pulse?pulse.orders.today-pulse.orders.yesterday:0;
 const week:{v:number;day:string}[]=pulse?.orders?.series?(pulse.orders.series as number[]).slice(-7).map((v,i)=>({v,day:dayShift(pulse.today,i-6)})):[],weekMax=Math.max(1,...week.map(w=>w.v));
 const profit:Row|null=pulse?.profit||null,matches:Row[]=found.data?.matches||[],info:Row=tasks.paid||{total:0,rows:[]};
 const kpi=(key:string,page:string,label:React.ReactNode,note:React.ReactNode,value:React.ReactNode,preset?:[string,unknown],hero=false)=>link(key,page,()=>open(key,page,preset),'lb-k'+(hero?' is-hero':''),hero
  ?<><span><span className="lb-lab">{label}</span><span className="lb-v">{value}</span><span className="lb-note">{note}</span></span><span/>{opening===key?<Loader2 className="lb-spin lb-chev" size={18} aria-hidden="true"/>:<ChevronLeft className="lb-chev" size={18} aria-hidden="true"/>}</>
  :<><span><span className="lb-lab">{label}</span><span className="lb-note">{note}</span></span>{value}{opening===key?<Loader2 className="lb-spin lb-chev" size={18} aria-hidden="true"/>:<ChevronLeft className="lb-chev" size={18} aria-hidden="true"/>}</>);
 const handledRow=(row:Row)=>{const key=row.history_id,Icon=kindIcons[row.kind]||Bell,finished=done.includes(key);
  return <div className={'lb-it'+(finished?' is-finished':'')} key={key}><span className="lb-ico"><Icon size={18} aria-hidden="true"/></span>
   <div className="lb-txt"><b>{row.title}</b><small>{dot([real(row.detail),row.user_name,row.number,row.website_name])}</small><small>סומן על ידי {row.handled_by_name} · {date(row.handled_at)}</small></div>
   <div className="lb-meta">{row.amount!=null&&<bdi className="lb-amt">{money(row.amount)}</bdi>}</div>
   {finished?<span className="lb-finished" role="status"><CheckCircle2 size={18} aria-hidden="true"/>הוחזר לטיפול</span>:<>{link(key,row.page,()=>openRow(row,key),'lb-btn is-ghost',<span>{opening===key?'פותח…':'פתיחה'}</span>)}
    {row.can_reopen&&<button type="button" className="lb-btn is-ghost is-back" disabled={!!busy} aria-busy={busy===key||undefined} aria-label={'החזרה לטיפול: '+row.title} onClick={()=>mark(row,true)}>{busy===key?<Loader2 className="lb-spin" size={16} aria-hidden="true"/>:<RotateCcw size={16} aria-hidden="true"/>}<span>{busy===key?'מחזיר…':'החזרה לטיפול'}</span></button>}</>}
   {failed(key)}
  </div>;};
 return <section className="lb1" dir="rtl" ref={root}>
  <header className="lb-head">
   <div><h1>לובי</h1><p className="lb-when">{stamp.day}{stamp.time&&<><span className="lb-live" aria-hidden="true"/>עודכן {stamp.time}</>}</p></div>
   <form noValidate role="search" className="lb-search" onSubmit={e=>{e.preventDefault();commit({q:draft.trim()});}}>{searching?<Loader2 className="lb-spin" size={18} aria-hidden="true"/>:<Search size={18} aria-hidden="true"/>}<input ref={input} type="search" maxLength={120} aria-label="חיפוש לקוח, הזמנה או משימה" placeholder="חיפוש לקוח, הזמנה או משימה" value={draft} onChange={e=>setDraft(e.target.value)}/>{draft&&<button type="button" aria-label="ניקוי חיפוש" onClick={()=>{setDraft('');commit({q:''});input.current?.focus();}}><X size={17} aria-hidden="true"/></button>}</form>
   <button type="button" className={'lb-btn is-ghost lb-refresh'+(refreshed?' is-success':'')} disabled={state.loading} aria-busy={state.loading||undefined} aria-label="רענון" onClick={refresh}>{refreshed?<Check size={17} aria-hidden="true"/>:<RefreshCw className={state.loading?'lb-spin':undefined} size={17} aria-hidden="true"/>}<span>{state.loading?'מרענן…':refreshed?'עודכן':'רענון'}</span></button>
  </header>
  <div className="lb-hero">
   <div className="lb-say"><p role="status"><b>{big[0]}</b><span>{big[1]}</span></p>
    {isOpen&&data&&!saved.q&&cash>0&&<button type="button" className="lb-cash" onClick={()=>jump('urgent')}><Wallet size={20} aria-hidden="true"/><b><bdi>{whole(cash)}</bdi></b>מחכים לאישור שלך</button>}</div>
   {isOpen&&data&&toHandle>0&&<nav className="lb-jump" aria-label="קפיצה לפי סוג">{lanes.map(l=><button type="button" key={l.id} className={'is-'+l.id+(l.id==='urgent'&&urgentN>0?' is-hot':'')} disabled={!laneTotal(l.id)} onClick={()=>jump(l.id)}><span>{l.label}</span><b>{laneTotal(l.id)}</b></button>)}</nav>}
  </div>
  {attention.data?.email_ready===false&&<aside className="lb-banner"><Mail size={20} aria-hidden="true"/><div><b>חיבור הדוא״ל אינו פעיל</b><p>{queueCount('mail')>0?queueCount('mail')+' הודעות ללקוחות מחכות לחיבור ולא נשלחו.':'הודעות ללקוחות מחכות לחיבור.'}</p></div>{link('email','admin-connections',()=>open('email','admin-connections'),'lb-btn is-ghost',<><span>{opening==='email'?'פותח…':'הגדרת החיבור'}</span>{arrow('email')}</>)}</aside>}
  {state.error&&<div className="lb-error" role="alert"><p>לא ניתן לרענן.{state.data?' הנתונים האחרונים מוצגים.':''} {state.error}</p><button type="button" className="lb-btn is-ghost" onClick={refresh}><RefreshCw size={17} aria-hidden="true"/><span>ניסיון נוסף</span></button></div>}
  <div className="lb-cols">
   <div className="lb-main">
    {isOpen?<>
     <div className="lb-sh"><h2>דורש טיפול</h2><p>מהדחוף לפחות דחוף</p><button type="button" className="lb-link" onClick={()=>commit({state:'handled'})}><History size={16} aria-hidden="true"/>טופלו ({handledCount})</button></div>
     {!data?(state.error?<div className="lb-empty"><TriangleAlert size={22} aria-hidden="true"/><div><b>לא ניתן לטעון את המשימות</b><small>אפשר לנסות שוב בכפתור הרענון.</small></div></div>:<div aria-busy="true" role="status" aria-label="טוען את המשימות"><div className="lb-skel"/><div className="lb-skel"/><div className="lb-skel"/></div>)
      :toHandle===0?<div className="lb-empty"><CheckCircle2 size={26} aria-hidden="true"/><div><b>{saved.q?'אין משימות פתוחות שתואמות לחיפוש':'אין כרגע משימות שמחכות לך'}</b><small>{saved.q?'אפשר לנקות את החיפוש כדי לראות את כל המשימות.':'ביטולים, כסף לאישור, כתבות ופניות יופיעו כאן ברגע שיגיעו.'}</small></div></div>
      :lanes.map(l=>laneTotal(l.id)>0&&<section className={'lb-g is-'+l.id+(flash===l.id?' is-flash':'')} id={'lb-g-'+l.id} key={l.id}><header className="lb-gh"><h3 tabIndex={-1}>{l.label}</h3><i>{laneTotal(l.id)}</i><span>{l.sub}</span></header>{taskDefs.filter(d=>d.lane===l.id).map(taskRow)}</section>)}
     {saved.q.length>=2&&<section className="lb-found" aria-busy={found.loading||undefined}><div className="lb-sh"><h2>במערכת</h2><p>לקוחות, הזמנות, כתבות ואתרים שתואמים לחיפוש</p></div>
      <div className="lb-box">{found.error?<p className="lb-none" role="alert">{found.error}</p>:!found.data?<p className="lb-none" role="status">מחפש במערכת…</p>:matches.length?<>{(foundAll?matches:matches.slice(0,5)).map(m=><div className="lb-it" key={m.id}><div className="lb-txt"><b>{m.title}</b><small>{m.detail}</small></div>{link('found:'+m.id,m.page,()=>open('found:'+m.id,m.page,m.preset),'lb-btn is-ghost',<span>{opening==='found:'+m.id?'פותח…':'פתיחה'}</span>)}</div>)}
       {matches.length>5&&!foundAll&&<button type="button" className="lb-more" onClick={()=>setFoundAll(true)}>הצגת עוד {matches.length-5}<ChevronDown size={16} aria-hidden="true"/></button>}{found.data.limited&&<p className="lb-none">מוצגות עד 20 תוצאות מכל סוג. אפשר לדייק את החיפוש.</p>}</>:<p className="lb-none">לא נמצאו לקוחות, הזמנות או כתבות שתואמים לחיפוש.</p>}</div></section>}
     {tiles.length>0&&<section className="lb-block"><div className="lb-sh"><h2>מעקב וסגירה</h2><p>לא בוער, אבל צריך לסגור.</p></div>
      <div className="lb-tiles">{tiles.map(f=>{const Icon=f.icon;return link(f.id,f.page,f.run,'lb-t'+(f.warn?' is-warn':''),<><span className="lb-lab"><Icon size={17} aria-hidden="true"/>{f.label}</span>{opening===f.id?<Loader2 className="lb-spin lb-chev" size={18} aria-hidden="true"/>:<ChevronLeft className="lb-chev" size={18} aria-hidden="true"/>}<b className="lb-big">{f.n}</b><span className="lb-sub">{f.sub}</span></>,f.hint);})}</div></section>}
     {quiet.length>0&&<section className={'lb-calm '+(calm===null?'is-auto':calm?'is-open':'is-closed')}><button type="button" className="lb-calm-head" aria-controls="lb-quiet" aria-label={'שקט כרגע: '+quiet.length+' תורים ריקים. הצגה או הסתרה'} onClick={toggleCalm}><CheckCircle2 size={20} aria-hidden="true"/>שקט כרגע<small>{quiet.length===1?'תור אחד ריק':quiet.length+' תורים ריקים'}</small><ChevronDown className="lb-turn" size={18} aria-hidden="true"/></button>
      <div className="lb-quiet" id="lb-quiet">{quiet.map(c=>link('quiet:'+c.id,c.page,c.run,'',<><Check size={15} aria-hidden="true"/>{c.label}</>))}</div></section>}
     <p className="lb-hint"><Info size={15} aria-hidden="true"/><span>סימון כטופל לא מאשר תשלום או פרסום. המסך מתרענן כל 30 שניות.</span></p>
    </>:<section className="lb-hist">
     <div className="lb-sh"><h2>טופלו</h2><p>פרטי ההתראה בעת הסימון</p><button type="button" className="lb-link" onClick={()=>commit({state:'open'})}><ArrowRight size={16} aria-hidden="true"/>חזרה לדורש טיפול</button></div>
     {!listState.data?(state.error?<div className="lb-empty"><TriangleAlert size={22} aria-hidden="true"/><div><b>לא ניתן לטעון</b><small>אפשר לנסות שוב בכפתור הרענון.</small></div></div>:<div aria-busy="true" role="status" aria-label="טוען"><div className="lb-skel"/><div className="lb-skel"/></div>)
      :listState.data.updates.length?<div className="lb-box">{listState.data.updates.map((r:Row)=>handledRow(r))}</div>
      :<div className="lb-empty"><CheckCircle2 size={26} aria-hidden="true"/><div><b>{saved.q?'לא נמצאו התראות שתואמות לחיפוש':'עדיין לא סומנו התראות כטופלו'}</b><small>התראה שתסומן כטופלה תופיע כאן, ואפשר יהיה להחזיר אותה לטיפול.</small></div></div>}
     {listState.data?.total>20&&<footer className="lb-pages"><span role="status">{(listState.data.page-1)*20+1}–{Math.min(listState.data.page*20,listState.data.total)} מתוך {listState.data.total}</span><nav aria-label="עמודי טופלו"><button type="button" className="lb-btn is-ghost" disabled={listState.data.page<=1||listState.loading} onClick={()=>commit({page:listState.data.page-1})}><ChevronRight size={16} aria-hidden="true"/><span>הקודם</span></button><button type="button" className="lb-btn is-ghost" disabled={listState.data.page*20>=listState.data.total||listState.loading} onClick={()=>commit({page:listState.data.page+1})}><span>הבא</span><ChevronLeft size={16} aria-hidden="true"/></button></nav></footer>}
    </section>}
   </div>
   <aside className="lb-side" aria-label="מספרי העסק ומידע">
    <section className="lb-card"><header className="lb-ch"><h3>תמונת מצב</h3>{pulse&&<small>{new Intl.DateTimeFormat('he-IL',{month:'long',timeZone:'UTC'}).format(new Date(pulse.today+'T12:00:00Z'))}</small>}</header>
     {kpi('pulse-revenue','admin-reports','הכנסות החודש',!pulse?' ':revenueDelta==null?'תשלומים שאושרו החודש':<><span className={revenueDelta>=0?'is-up':'is-down'}>{revenueDelta>=0?'↑':'↓'} {Math.abs(revenueDelta)}%</span> לעומת החודש הקודם</>,pulse?<bdi>{whole(pulse.revenue.month)}</bdi>:'—',undefined,true)}
     {profit&&(profit.net!=null
      ?kpi('pulse-profit','admin-month-close','רווח החודש',profit.net<0?'הפסד, לפני מע״מ':profit.income_net>0?Math.round(profit.net/profit.income_net*100)+'% מההכנסה, לפני מע״מ':'אין עדיין תשלומים החודש',<bdi className={'lb-v '+(profit.net<0?'is-loss':'is-grn')}>{whole(profit.net)}</bdi>,['month-close',{from:profit.from,to:profit.to,basis:'payment'}])
      :kpi('pulse-profit','admin-month-close','רווח החודש',<span className="is-warn">{profit.missing===1?'חסרה עלות בפריט אחד':'חסרה עלות ב־'+profit.missing+' פריטים'}</span>,<span className="lb-v is-text">עוד לא ידוע</span>,['month-close',{from:profit.from,to:profit.to,basis:'payment'}]))}
     {week.length===7&&<figure className="lb-week" aria-label="הזמנות בשבעת הימים האחרונים" style={{margin:0}}><p>הזמנות ב־7 הימים האחרונים</p><ol className="lb-bars">{week.map((w,i)=><li key={w.day} className={(i===6?'is-now':'')+(w.v?'':' is-zero')} style={{'--h':Math.max(4,Math.round(w.v/weekMax*52))+'px'} as React.CSSProperties}><b>{w.v}</b><i/>{i===6?'היום':dayLetter(w.day)}</li>)}</ol></figure>}
     {kpi('pulse-orders','admin-orders','הזמנות היום',!pulse?' ':ordersDelta===0?'כמו אתמול':<><span className={ordersDelta>0?'is-up':'is-down'}>{ordersDelta>0?'↑':'↓'} {Math.abs(ordersDelta)}</span> לעומת אתמול</>,<span className="lb-v">{pulse?pulse.orders.today:'—'}</span>,['orders-bucket','active'])}
     {kpi('pulse-articles','admin-articles','כתבות בעבודה',!pulse?' ':pulse.articles.review?(pulse.articles.review===1?'אחת מחכה לאישור שלך':pulse.articles.review+' מחכות לאישור שלך'):'אין כתבות שמחכות לאישור',<span className="lb-v">{pulse?pulse.articles.active:'—'}</span>)}
    </section>
    <section className="lb-card"><header className="lb-ch"><h3>קיצורי דרך</h3></header>
     <nav className="lb-sc" aria-label="קיצורי דרך">
      {link('sc-order','admin-users',()=>open('sc-order','admin-users'),'',<><Plus size={17} aria-hidden="true"/>הזמנה ללקוח</>,'בוחרים לקוח, ואז "הזמנה עבור הלקוח"')}
      {link('sc-month','admin-month-close',()=>open('sc-month','admin-month-close'),'',<><CalendarDays size={17} aria-hidden="true"/>סגירת חודש</>)}
      {link('sc-ticket','admin-support',()=>open('sc-ticket','admin-support'),'',<><MessageSquare size={17} aria-hidden="true"/>פתיחת פנייה</>)}
      {link('sc-reports','admin-reports',()=>open('sc-reports','admin-reports'),'',<><BarChart3 size={17} aria-hidden="true"/>דוחות</>)}
     </nav></section>
    <section className="lb-card" id="lb-g-info"><header className="lb-ch"><h3>לידיעה בלבד</h3><small>לא דורש פעולה</small><span className="lb-cnt">{data?info.total:'—'}</span></header>
     {(info.rows||[]).map((row:Row)=>{const finished=done.includes(row.id);return <div className={'lb-f'+(finished?' is-finished':'')} key={row.id}>
      {link(row.id,row.page,()=>open(row.id,row.page),'',<>{opening===row.id?<Loader2 className="lb-spin" size={19} aria-hidden="true"/>:<CheckCircle2 size={19} aria-hidden="true"/>}<span><b>{row.title}{row.number&&<> · <bdi>{row.number}</bdi></>}</b><small>{row.user_name}</small></span><span className="lb-e">{row.amount!=null&&<b><bdi>{whole(row.amount)}</bdi></b>}<small>לפני {waited(row.happened_at)}</small></span></>)}
      {finished?<span className="lb-finished" role="status" aria-label="סומן כטופל"><Check size={16} aria-hidden="true"/></span>:doneButton(row)}{failed(row.id)}</div>;})}
     {data&&!info.total&&<p className="lb-none">אין עדכוני מידע</p>}
     {moreBusy==='paid'?<button type="button" className="lb-more" disabled aria-busy="true">טוען…<Loader2 className="lb-spin" size={16} aria-hidden="true"/></button>:info.total>(info.rows||[]).length?<button type="button" className="lb-more" onClick={()=>more('paid',info.total,info.rows.length)}>הצגת עוד {Math.min(10,info.total-info.rows.length)}<ChevronDown size={16} aria-hidden="true"/></button>:saved.limits.paid?<button type="button" className="lb-more" onClick={()=>less('paid')}>הצגת פחות</button>:null}
    </section>
   </aside>
  </div>
 </section>;
}
