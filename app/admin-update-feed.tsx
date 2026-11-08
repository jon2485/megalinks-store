'use client';
import React,{useEffect,useLayoutEffect,useRef,useState} from 'react';
import {toast} from 'sonner';
import {Bell,CalendarDays,Check,CheckCircle2,ChevronDown,ChevronLeft,ChevronRight,ChevronUp,Clock,FileText,Info,Landmark,Loader2,Mail,MessageSquare,Moon,PenLine,Plug,ReceiptText,RefreshCcw,RefreshCw,RotateCcw,Search,Send,Store,Sun,Tags,TriangleAlert,Wallet,X,XCircle} from 'lucide-react';
import {api,useData} from '@/lib/client';
import {money,type Row} from '@/lib/shared';
import {adminViewState,saveAdminViewState} from '@/lib/admin-view-state';
import type {Ctx} from './workspace';
import {useAdminAttention} from './admin-attention';
import './admin-work-center-v2.css';
import './admin-work-center-sky.css';
// Approved redesign 05.11.2026 (docs/proposals/work-center-v2): summary numbers, jump pills, quiet lanes, undo after "handled".
const initial={q:'',state:'open',page:1,scroll:0,limits:{} as Record<string,number>};
const lanes=[{id:'urgent',label:'דחוף',sub:'ביטולים, כסף שממתין ותקלות שליחה',icon:TriangleAlert,empty:'אין כרגע דברים דחופים',step:20},{id:'content',label:'תוכן ופרסום',sub:'כתבות שמחכות לך',icon:FileText,empty:'אין כתבות שמחכות לך',step:10},{id:'service',label:'שירות וספקים',sub:'אנשים שמחכים לתשובה',icon:MessageSquare,empty:'אין פניות או בקשות פתוחות',step:10}] as const;
const defaults:Record<string,number>={urgent:20,content:5,service:5,info:3};
const kindIcons:Record<string,typeof FileText>={cancellation:XCircle,delivery:TriangleAlert,bank:Landmark,topup:Wallet,article:FileText,publication:Send,writing:PenLine,late:TriangleAlert,support:MessageSquare,seller:Store,paid:CheckCircle2};
const extraQueues:[string,typeof FileText,boolean?][]=[['invoices',ReceiptText,true],['mail',Mail,true],['connections',Plug,true],['monthly',CalendarDays],['tracking',Send],['writing',PenLine],['supplier_due',Store],['prices',Tags],['pricing_review',Tags],['sync',RefreshCcw]];
const date=(s:string)=>{const d=new Date(s);return Number.isNaN(+d)?'לא תועד':new Intl.DateTimeFormat('he-IL',{timeZone:'Asia/Jerusalem',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(d);};
const clock=(d:Date)=>new Intl.DateTimeFormat('he-IL',{timeZone:'Asia/Jerusalem',hour:'2-digit',minute:'2-digit'}).format(d);
const hours=(s:string)=>(Date.now()-+new Date(s))/36e5;
function waited(s:string){const h=hours(s);if(Number.isNaN(h))return 'לא תועד';if(h<1/60)return 'עכשיו';if(h<1){const m=Math.floor(h*60);return m===1?'דקה':m+' דק׳';}if(h<24){const n=Math.floor(h);return n===1?'שעה':n===2?'שעתיים':n+' שעות';}const n=Math.floor(h/24);return n===1?'יום':n===2?'יומיים':n+' ימים';}
const plain=(e:React.MouseEvent)=>e.button===0&&!e.metaKey&&!e.ctrlKey&&!e.shiftKey&&!e.altKey;
const calm=()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const whole=(cents:number)=>new Intl.NumberFormat('he-IL',{style:'currency',currency:'ILS',maximumFractionDigits:0}).format((cents||0)/100);
const days=(n:number)=>n<=0?'היום':n===1?'יום':n===2?'יומיים':n+' ימים';
function Spark({values}:{values:number[]}){
 if(values.length<2||!values.some(Boolean))return null;
 const max=Math.max(...values),w=84,h=34,pts=values.map((v,i)=>[w-2-(i*(w-4))/(values.length-1),h-3-(v/max)*(h-8)]);
 return <svg className="wc2-spark" viewBox={`0 0 ${w} ${h}`} aria-hidden="true"><polyline points={pts.map(p=>p.join(',')).join(' ')}/></svg>;
}
// "Sky" stage 08.11.2026: glass panels over the brand waves, inspired by the Forecast Center reference.
// The wave shows orders for the last 7 days. Oldest day sits on the right (RTL), today on the left.
const dayShift=(day:string,n:number)=>{const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
const dayName=(day:string)=>new Intl.DateTimeFormat('he-IL',{weekday:'long',timeZone:'UTC'}).format(new Date(day+'T12:00:00Z')).replace('יום ','');
function Wave({values}:{values:number[]}){
 const id=React.useId().replace(/:/g,''),W=700,H=150,n=values.length,max=Math.max(1,...values);
 const pts=values.map((v,i)=>[W-(i+.5)*W/n,H-22-(v/max)*(H-62)]);
 let d=`M${W},${pts[0][1]} L${pts[0][0]},${pts[0][1]}`;
 for(let i=0;i<n-1;i++){const p0=pts[Math.max(0,i-1)],p1=pts[i],p2=pts[i+1],p3=pts[Math.min(n-1,i+2)];d+=` C${p1[0]+(p2[0]-p0[0])/6},${p1[1]+(p2[1]-p0[1])/6} ${p2[0]-(p3[0]-p1[0])/6},${p2[1]-(p3[1]-p1[1])/6} ${p2[0]},${p2[1]}`;}
 d+=` L0,${pts[n-1][1]}`;const last=pts[n-1];
 return <svg className="sky-wave" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
  <defs><linearGradient id={id+'s'} x1="1" x2="0"><stop className="sky-s1" offset="0" stopColor="#fff" stopOpacity=".35"/><stop className="sky-s2" offset=".55" stopColor="#fff" stopOpacity=".95"/><stop className="sky-s3" offset="1" stopColor="#7fe7f2"/></linearGradient>
   <linearGradient id={id+'f'} x1="0" y1="0" x2="0" y2="1"><stop className="sky-f1" offset="0" stopColor="#7fe7f2" stopOpacity=".32"/><stop className="sky-f2" offset="1" stopColor="#7fe7f2" stopOpacity="0"/></linearGradient>
   <clipPath id={id+'c'}><rect className="sky-wave-wipe" x="0" y="0" width={W} height={H}/></clipPath></defs>
  <path d={d+` L0,${H} L${W},${H} Z`} fill={`url(#${id}f)`} clipPath={`url(#${id}c)`}/>
  <path className="sky-wave-glow" d={d} pathLength={1}/>
  <path className="sky-wave-line" d={d} pathLength={1} stroke={`url(#${id}s)`}/>
  <circle className="sky-wave-dot" cx={last[0]} cy={last[1]} r="5"/>
 </svg>;
}
export default function AdminUpdateFeed({ctx}:{ctx:Ctx}){
 const [saved,setSaved]=useState(()=>({...initial,...adminViewState('updates',initial)})),[draft,setDraft]=useState(saved.q);
 const [busy,setBusy]=useState(''),[done,setDone]=useState<string[]>([]),[rowError,setRowError]=useState<{id:string;message:string}|null>(null),[opening,setOpening]=useState(''),[active,setActive]=useState('urgent'),[flash,setFlash]=useState(''),[refreshed,setRefreshed]=useState(false),[moreBusy,setMoreBusy]=useState(''),[updatedAt,setUpdatedAt]=useState('');
 const input=useRef<HTMLInputElement>(null),root=useRef<HTMLElement>(null),seg=useRef<HTMLDivElement>(null),lock=useRef(false),restore=useRef(saved.scroll),latest=useRef(saved),refreshing=useRef(false),timers=useRef<ReturnType<typeof setTimeout>[]>([]);
 const [theme,setTheme]=useState<'dark'|'light'>('dark');
 useLayoutEffect(()=>{try{if(localStorage.getItem('wc2-theme')==='light')setTheme('light');}catch{}},[]);
 function switchTheme(){const next=theme==='light'?'dark':'light';setTheme(next);try{localStorage.setItem('wc2-theme',next);}catch{}}
 const isOpen=saved.state==='open',limits={...defaults,...saved.limits};
 const laneParams=new URLSearchParams({view:'lanes',q:saved.q,...Object.fromEntries(Object.entries(limits).map(([k,v])=>['limit_'+k,String(v)]))});
 const listParams=new URLSearchParams({q:saved.q,state:'handled',page:String(saved.page)});
 const laneState=useData('admin/control-center/updates?'+laneParams,ctx.revision,isOpen,30000),listState=useData('admin/control-center/updates?'+listParams,ctx.revision,!isOpen,30000),state=isOpen?laneState:listState,attention=useAdminAttention(ctx);
 const pulse=useData('admin/control-center/pulse',ctx.revision,isOpen,60000).data;
 const later=(fn:()=>void,ms:number)=>{timers.current.push(setTimeout(fn,ms));};
 const data=laneState.data,laneData:Row=data?.lanes||{},total=(id:string)=>Number(laneData[id]?.total||0),toHandle=total('urgent')+total('content')+total('service');
 const handledCount=Number(data?.counts?.handled??listState.data?.counts?.handled??0),searching=draft.trim()!==saved.q||(!!saved.q&&state.loading);
 const queues:Row[]=attention.data?.queues||[],waiting=extraQueues.map(([id,Icon,warn])=>({row:queues.find(q=>q.id===id),Icon,warn})).filter(q=>Number(q.row?.count||0)>0);
 useEffect(()=>{latest.current=saved;saveAdminViewState('updates',saved);},[saved]);
 useEffect(()=>{const remember=()=>saveAdminViewState('updates',{...latest.current,scroll:window.scrollY});window.addEventListener('scroll',remember,{passive:true});return()=>window.removeEventListener('scroll',remember);},[]);
 useEffect(()=>()=>{timers.current.forEach(clearTimeout);},[]);
 useEffect(()=>{if(state.data){setUpdatedAt(clock(new Date()));if(restore.current){window.scrollTo(0,restore.current);restore.current=0;}}},[state.data]);
 useEffect(()=>{if(state.loading)return;setMoreBusy('');if(refreshing.current){refreshing.current=false;if(!state.error){setRefreshed(true);later(()=>setRefreshed(false),1800);}}},[state.loading,state.error]);
 useEffect(()=>{const timer=setTimeout(()=>{const q=draft.trim();if(q!==latest.current.q)commit({q});},350);return()=>clearTimeout(timer);},[draft]);
 useEffect(()=>{const header=document.querySelector('.admin-glass-header'),el=root.current;if(!header||!el)return;const place=()=>el.style.setProperty('--wc-top',getComputedStyle(header).position==='sticky'||getComputedStyle(header).position==='fixed'?header.getBoundingClientRect().height+'px':'0px');place();const watch=new ResizeObserver(place);watch.observe(header);return()=>watch.disconnect();},[]);
 useEffect(()=>{if(!isOpen||typeof IntersectionObserver==='undefined')return;const watch=new IntersectionObserver(items=>{const seen=items.filter(i=>i.isIntersecting).sort((a,b)=>a.boundingClientRect.top-b.boundingClientRect.top)[0];if(seen)setActive(seen.target.id.replace('wc-lane-',''));},{rootMargin:'-25% 0px -65% 0px'});root.current?.querySelectorAll('.wc2-lane,#wc-lane-info').forEach(el=>watch.observe(el));return()=>watch.disconnect();},[isOpen,!!data]);
 // Sliding thumb under the open/handled switch.
 useLayoutEffect(()=>{const box=seg.current;if(!box)return;const place=()=>{const on=box.querySelector<HTMLElement>('button[aria-pressed=true]'),thumb=box.querySelector<HTMLElement>('.wc2-thumb');if(!on||!thumb)return;thumb.style.width=on.offsetWidth+'px';thumb.style.transform=`translateX(${on.offsetLeft}px)`;};place();const watch=new ResizeObserver(place);watch.observe(box);return()=>watch.disconnect();},[saved.state,!!data,handledCount]);
 function commit(change:Partial<typeof initial>){setRowError(null);setSaved(s=>({...s,...change,page:change.page??1,scroll:0}));}
 function refresh(){refreshing.current=true;setRefreshed(false);ctx.refresh();}
 function open(key:string,page:string){setOpening(key);saveAdminViewState('updates',{...saved,scroll:window.scrollY});ctx.go(page);later(()=>setOpening(''),4000);}
 function showLobby(target?:string){const box=document.getElementById('admin-extra-queues') as HTMLDetailsElement|null;if(!box)return;box.open=true;if(target)window.dispatchEvent(new CustomEvent('admin-lobby:open',{detail:target}));box.scrollIntoView({behavior:calm()?'auto':'smooth',block:'start'});box.querySelector('summary')?.focus({preventScroll:true});}
 function openQueue(q:Row){if(q.id==='writing')return showLobby('lobby-writing');if(q.id==='prices')return showLobby('lobby-prices');if(q.id==='invoices')saveAdminViewState('invoices-status','missing');open(q.id,q.page);}
 function jump(id:string){setActive(id);setFlash(id);later(()=>setFlash(f=>f===id?'':f),1200);const el=document.getElementById('wc-lane-'+id);el?.scrollIntoView({behavior:calm()?'auto':'smooth',block:'start'});el?.querySelector<HTMLElement>('h2')?.focus({preventScroll:true});}
 function more(id:string,all:number,step:number){setMoreBusy(id);commit({limits:{...saved.limits,[id]:Math.min(all,limits[id]+step)}});}
 function less(id:string){const rest={...saved.limits};delete rest[id];commit({limits:rest});if(id!=='info')jump(id);}
 async function undo(historyId:string){try{await api('admin/control-center/updates/reopen','POST',{history_id:historyId});toast.success('ההתראה הוחזרה לטיפול');ctx.refresh();}catch(e){toast.error((e as Error).message||'לא ניתן להחזיר לטיפול. אפשר לעשות זאת מ"טופלו".');}}
 async function mark(row:Row,reopen=false){
  const key=row.history_id||row.id;if(lock.current)return;lock.current=true;setBusy(key);setRowError(null);
  try{const result=await api('admin/control-center/updates'+(reopen?'/reopen':''),'POST',reopen?{history_id:row.history_id}:{id:row.id,version:row.version});
   setDone(list=>[...list,key]);
   if(reopen)toast.success('ההתראה הוחזרה לטיפול');else toast.success('ההתראה הועברה לטופלו',result?.history_id?{action:{label:'ביטול',onClick:()=>undo(result.history_id)},duration:6000}:undefined);
   later(()=>{setDone(list=>list.filter(x=>x!==key));ctx.refresh();},1100);
  }catch(e){setRowError({id:key,message:(e as Error).message||'הפעולה לא הושלמה. אפשר לנסות שוב.'});}finally{setBusy('');lock.current=false;}
 }
 const go=(row:Row,key:string,className:string,label=row.action)=><a className={className+(opening===key?' is-opening':'')} href={'/'+row.page} aria-busy={opening===key||undefined} onClick={e=>{if(!plain(e))return;e.preventDefault();if(row.kind==='topup')saveAdminViewState('topups-search',row.detail||row.user_name);open(key,row.page);}}><span>{opening===key?'פותח…':label}</span>{opening===key?<Loader2 className="wc2-spin" size={16} aria-hidden="true"/>:<ChevronLeft size={16} aria-hidden="true"/>}</a>;
 const markButton=(row:Row,small=false)=>{const key=row.id,isBusy=busy===key;return <button type="button" className={'wc2-done'+(small?' is-small':'')+(isBusy?' is-busy':'')} disabled={!!busy} aria-busy={isBusy||undefined} aria-label={'סמן כטופל: '+row.title} title="סמן כטופל" onClick={()=>mark(row)}>{isBusy?<Loader2 className="wc2-spin" size={16} aria-hidden="true"/>:<Check size={small?15:17} aria-hidden="true"/>}{!small&&<span>{isBusy?'מסמן…':'סמן כטופל'}</span>}</button>;};
 const record=(row:Row,handled=false)=>{const key=row.history_id||row.id,Icon=kindIcons[row.kind]||Bell,stamp=handled?row.handled_at:row.happened_at,late=!handled&&hours(stamp)>=24,finished=done.includes(key);
  return <article className={'wc2-row'+(finished?' is-finished':'')} key={key}><span className="wc2-chip"><Icon size={19} aria-hidden="true"/></span>
   <div className="wc2-main"><h3>{row.title}</h3>{row.detail&&<p>{row.detail}</p>}{handled&&<p>סומן על ידי {row.handled_by_name}</p>}</div>
   <div className="wc2-who"><b>{row.user_name}</b>{(row.number||row.website_name)&&<span>{row.number&&<bdi>{row.number}</bdi>}{row.number&&row.website_name&&' · '}{row.website_name&&<bdi>{row.website_name}</bdi>}</span>}</div>
   <div className="wc2-meta">{row.amount!=null&&<b><bdi>{money(row.amount)}</bdi></b>}<time className={'wc2-age'+(late?' is-late':'')} dateTime={stamp} title={date(stamp)}><Clock size={13} aria-hidden="true"/><span>{handled?date(stamp):waited(stamp)}</span></time></div>
   <div className="wc2-actions">{finished?<span className="wc2-finished" role="status"><CheckCircle2 size={18} aria-hidden="true"/>{handled?'הוחזר לטיפול':'סומן כטופל'}</span>:<>{go(row,key,handled?'wc2-glass':'wc2-go',handled?'פתיחה':row.action)}{handled?row.can_reopen&&<button type="button" className={'wc2-glass'+(busy===key?' is-busy':'')} disabled={!!busy} aria-busy={busy===key||undefined} aria-label={'החזרה לטיפול: '+row.title} onClick={()=>mark(row,true)}>{busy===key?<Loader2 className="wc2-spin" size={16} aria-hidden="true"/>:<RotateCcw size={16} aria-hidden="true"/>}<span>{busy===key?'מחזיר…':'החזרה לטיפול'}</span></button>:markButton(row)}</>}</div>
   {rowError?.id===key&&<p className="wc2-row-error" role="alert"><TriangleAlert size={16} aria-hidden="true"/><span>{rowError?.message}</span></p>}
  </article>;};
 const moreButton=(id:string,label:string,count:number,shown:number,step:number)=>moreBusy===id?<button type="button" className="wc2-more" disabled aria-busy="true"><span>טוען…</span><Loader2 className="wc2-spin" size={16} aria-hidden="true"/></button>:count>limits[id]?<button type="button" className="wc2-more" onClick={()=>more(id,count,step)}><span>הצגת עוד {count-shown} ב{label}</span><ChevronDown size={16} aria-hidden="true"/></button>:limits[id]>defaults[id]&&<button type="button" className="wc2-more" onClick={()=>less(id)}><span>הצגת פחות</span><ChevronUp size={16} aria-hidden="true"/></button>;
 const kpi=(key:string,label:string,value:React.ReactNode,note:React.ReactNode,page:string,preset?:()=>void,series?:number[],extra='')=><a key={key} className={'wc2-kpi'+extra+(opening===key?' is-opening':'')} href={'/'+page} onClick={e=>{if(!plain(e))return;e.preventDefault();preset?.();open(key,page);}}><div><span className="wc2-kpi-label">{label}</span><strong>{pulse?value:'—'}</strong><small>{pulse?note:' '}</small></div>{series&&<Spark values={series}/>}{opening===key?<Loader2 className="wc2-spin sky-kpi-go" size={18} aria-hidden="true"/>:<ChevronLeft className="sky-kpi-go" size={18} aria-hidden="true"/>}</a>;
 const ordersDelta=pulse?pulse.orders.today-pulse.orders.yesterday:0,revenueDelta=pulse?.revenue.previous?Math.round((pulse.revenue.month-pulse.revenue.previous)/pulse.revenue.previous*100):null;
 const urgentN=total('urgent'),contentN=total('content'),serviceN=total('service');
 const bigLines:[string,string]=!isOpen?['טופלו',handledCount===1?'התראה אחת סומנה':handledCount+' התראות סומנו']:!data?['טוען','את העדכונים…']:saved.q?['נמצאו '+toHandle,'לטיפול בחיפוש']:toHandle===0?['הכול רגוע','אין דברים לטיפול']:[toHandle+' לטיפול',urgentN===0?'בלי דברים דחופים':urgentN===1?'ואחד מהם דחוף':'ו־'+urgentN+' מהם דחופים'];
 const blurb=!isOpen?'אלה ההתראות שסימנת כטופלו. אפשר לפתוח כל אחת או להחזיר אותה לטיפול.':!data?'':toHandle===0?'אין כרגע ביטולים, כסף שממתין, כתבות או פניות שמחכים לך.':[urgentN&&(urgentN===1?'דבר דחוף אחד: ביטול, כסף שממתין או תקלת שליחה.':urgentN+' דברים דחופים: ביטולים, כסף שממתין ותקלות שליחה.'),contentN&&(contentN===1?'כתבה אחת מחכה לך.':contentN+' כתבות מחכות לך.'),serviceN&&(serviceN===1?'פנייה אחת מחכה לתשובה.':serviceN+' פניות מחכות לתשובה.')].filter(Boolean).join(' ');
 const week:{v:number;day:string}[]=pulse?.orders?.series?(pulse.orders.series as number[]).slice(-7).map((v,i)=>({v,day:dayShift(pulse.today,i-6)})):[];
 return <section className={'wc2 is-sky'+(theme==='light'?' is-light':'')} dir="rtl" ref={root}>
  <div className="sky-stage">
  <header className="wc2-head"><div className="sky-title"><h1>מרכז העבודה</h1>{updatedAt&&<span className="wc2-live">עודכן {updatedAt}</span>}</div>
   <div className="wc2-tools"><form noValidate role="search" className="wc2-search" onSubmit={e=>{e.preventDefault();commit({q:draft.trim()});}}>{searching?<Loader2 className="wc2-spin" size={17} aria-hidden="true"/>:<Search size={17} aria-hidden="true"/>}<input ref={input} type="search" maxLength={120} aria-label="חיפוש התראה או לקוח" placeholder="חיפוש התראה או לקוח" value={draft} onChange={e=>setDraft(e.target.value)}/>{draft&&<button type="button" aria-label="ניקוי חיפוש" onClick={()=>{setDraft('');commit({q:''});input.current?.focus();}}><X size={17} aria-hidden="true"/></button>}</form>
    <div className="wc2-seg" ref={seg} role="group" aria-label="מצב הטיפול בהתראות"><span className="wc2-thumb" aria-hidden="true"/>{[['open','פתוח',toHandle+total('info')],['handled','טופלו',handledCount]].map(([value,label,n])=><button key={String(value)} type="button" aria-pressed={saved.state===value} onClick={()=>commit({state:String(value)})}>{label}{(value==='handled'||data)&&<bdi>({Number(n)})</bdi>}</button>)}</div>
    <button type="button" className={'wc2-glass'+(refreshed?' is-success':'')} disabled={state.loading} aria-busy={state.loading||undefined} aria-label="רענון העדכונים" onClick={refresh}>{refreshed?<Check size={17} aria-hidden="true"/>:<RefreshCw className={state.loading?'wc2-spin':undefined} size={17} aria-hidden="true"/>}<span>{state.loading?'מרענן…':refreshed?'עודכן':'רענון'}</span></button>
    <button type="button" className="wc2-glass sky-theme" aria-pressed={theme==='light'} aria-label={theme==='light'?'מעבר למצב כהה':'מעבר למצב בהיר'} title={theme==='light'?'מצב כהה':'מצב בהיר'} onClick={switchTheme}>{theme==='light'?<Moon size={18} aria-hidden="true"/>:<Sun size={18} aria-hidden="true"/>}</button></div></header>
  <div className="sky-hero">
   <div className="sky-main">
    <p className="sky-big" role="status"><span className="sky-ln"><span>{bigLines[0]}</span></span><span className="sky-ln"><span>{bigLines[1]}</span></span></p>
    {blurb&&<p className="sky-blurb">{blurb}</p>}
    {isOpen&&week.length===7&&<figure className="sky-forecast" aria-label="הזמנות בשבעת הימים האחרונים"><figcaption>הזמנות ב־7 הימים האחרונים</figcaption>
     <ol className="sky-nums">{week.map((w,i)=><li key={w.day} className={i===6?'is-on':undefined}><b>{w.v}</b><span>{i===6?'היום':dayName(w.day)}</span></li>)}</ol>
     <Wave values={week.map(w=>w.v)}/></figure>}
   </div>
   {isOpen&&<nav className="wc2-kpis sky-rail" aria-label="תמונת מצב">
    {kpi('pulse-revenue','הכנסות החודש',pulse&&whole(pulse.revenue.month),revenueDelta==null?'תשלומים שאושרו החודש':<><span className={revenueDelta>=0?'is-up':'is-down'}>{revenueDelta>=0?'↑':'↓'} {Math.abs(revenueDelta)}%</span> לעומת החודש הקודם</>,'admin-reports',undefined,undefined,' is-big')}
    {kpi('pulse-orders','הזמנות היום',pulse?.orders.today,<>{ordersDelta!==0&&<span className={ordersDelta>0?'is-up':'is-down'}>{ordersDelta>0?'↑':'↓'} {Math.abs(ordersDelta)}</span>} {ordersDelta===0?'כמו אתמול':'לעומת אתמול'}</>,'admin-orders',()=>saveAdminViewState('orders-bucket','active'))}
    {kpi('pulse-awaiting','ממתין לתשלום',pulse&&whole(pulse.awaiting.cents),pulse?.awaiting.count?<><span className="is-warn">{pulse.awaiting.count===1?'הזמנה אחת':pulse.awaiting.count+' הזמנות'}</span> · הוותיקה {days(pulse.awaiting.oldest_days)}</>:'אין הזמנות שממתינות','admin-orders',()=>saveAdminViewState('orders-bucket','awaiting'))}
    {kpi('pulse-articles','כתבות בעבודה',pulse?.articles.active,pulse?.articles.review?<><span className="is-warn">{pulse.articles.review}</span> מחכות לאישור שלך</>:'אין כתבות שמחכות לאישור','admin-articles')}
   </nav>}
  </div>
  </div>
  {attention.data?.email_ready===false&&<aside className="wc2-alert"><Mail size={20} aria-hidden="true"/><div><b>חיבור הדוא״ל אינו פעיל</b><p>הודעות ממתינות לחיבור.</p></div><button type="button" className="wc2-glass" onClick={()=>open('email','admin-connections')}><span>{opening==='email'?'פותח…':'הגדרת החיבור'}</span>{opening==='email'?<Loader2 className="wc2-spin" size={16} aria-hidden="true"/>:<ChevronLeft size={16} aria-hidden="true"/>}</button></aside>}
  {isOpen&&<div className="wc2-jump"><nav aria-label="קפיצה לפי סוג">{[...lanes,{id:'info',label:'לידיעה בלבד',icon:Bell}].map(l=>{const Icon=l.icon,n=total(l.id);return <button type="button" key={l.id} className={'wc2-pill is-'+l.id+(l.id==='urgent'&&n>0?' is-loud':'')} aria-current={active===l.id?'true':undefined} onClick={()=>jump(l.id)}><span className="wc2-pill-icon"><Icon size={15} aria-hidden="true"/></span><span>{l.label}</span><strong>{data?n:'—'}</strong></button>;})}</nav></div>}
  {state.error&&<div className="wc2-error" role="alert"><p>לא ניתן לרענן.{state.data?' הנתונים האחרונים מוצגים.':''} {state.error}</p><button type="button" className="wc2-glass" onClick={refresh}><RefreshCw size={17} aria-hidden="true"/><span>ניסיון נוסף</span></button></div>}
  {isOpen?<div className="wc2-cols"><div className="wc2-lanes" aria-busy={laneState.loading}>{lanes.map(l=>{const rows:Row[]=laneData[l.id]?.rows||[],n=total(l.id),Icon=l.icon;return <section className={'wc2-lane is-'+l.id+(flash===l.id?' is-flash':'')} id={'wc-lane-'+l.id} key={l.id}><header className="wc2-lane-head"><span className="wc2-lane-icon"><Icon size={18} aria-hidden="true"/></span><div><h2 tabIndex={-1}>{l.label}</h2><p>{l.sub}</p></div><strong>{data?n:'—'}</strong></header>{!data?<p className="wc2-empty" role="status">{state.error?'לא ניתן לטעון':'טוען…'}</p>:rows.length?<div className="wc2-rows">{rows.map(r=>record(r))}</div>:<p className="wc2-empty"><CheckCircle2 size={18} aria-hidden="true"/>{saved.q?'לא נמצאו התאמות':l.empty}</p>}{moreButton(l.id,l.label,n,rows.length,l.step)}</section>;})}</div>
   <aside className="wc2-rail" aria-label="מידע ותורים נוספים">
    <section className="wc2-card" id="wc-lane-info"><header className="wc2-lane-head"><div><h2 tabIndex={-1}>לידיעה בלבד</h2><p>לא דורש פעולה ממך.</p></div><strong>{data?total('info'):'—'}</strong></header>{(laneData.info?.rows||[]).map((row:Row)=>{const finished=done.includes(row.id);return <div className={'wc2-fyi'+(finished?' is-finished':'')} key={row.id}><a href={'/'+row.page} className={opening===row.id?'is-opening':undefined} onClick={e=>{if(!plain(e))return;e.preventDefault();open(row.id,row.page);}}><span className="wc2-tick">{opening===row.id?<Loader2 className="wc2-spin" size={18} aria-hidden="true"/>:<CheckCircle2 size={18} aria-hidden="true"/>}</span><span className="wc2-fyi-main"><b>{row.title}</b><small>{row.number&&<bdi>{row.number}</bdi>}{row.number&&' · '}{row.user_name}</small></span><span className="wc2-fyi-end">{row.amount!=null&&<b><bdi>{money(row.amount)}</bdi></b>}<small>לפני {waited(row.happened_at)}</small></span></a>{finished?<span className="wc2-finished is-icon" role="status" aria-label="סומן כטופל"><Check size={16} aria-hidden="true"/></span>:markButton(row,true)}{rowError?.id===row.id&&<p className="wc2-row-error" role="alert"><span>{rowError?.message}</span></p>}</div>;})}{data&&!total('info')&&<p className="wc2-empty is-small">אין עדכוני מידע</p>}{moreButton('info','עדכוני מידע',total('info'),laneData.info?.rows?.length||0,10)}</section>
    <section className="wc2-card"><header className="wc2-lane-head"><div><h2>תורים נוספים</h2><p>{attention.error&&attention.data?'הנתונים האחרונים. הרענון נכשל.':'מה שמחכה מחוץ לרשימה.'}</p></div></header>{waiting.map(({row,Icon,warn})=><a key={row!.id} className={'wc2-queue'+(warn?' is-warn':'')+(opening===row!.id?' is-opening':'')} href={'/'+row!.page} title={row!.description} onClick={e=>{if(!plain(e))return;e.preventDefault();openQueue(row!);}}><Icon size={18} aria-hidden="true"/><span>{row!.label}</span><b>{row!.count}</b>{opening===row!.id?<Loader2 className="wc2-spin" size={16} aria-hidden="true"/>:<ChevronLeft size={16} aria-hidden="true"/>}</a>)}{Number(data?.abandoned)>0&&<a className={'wc2-queue'+(opening==='abandoned'?' is-opening':'')} href="/admin-orders" title="הזמנות ללא דיווח תשלום מעל 14 ימים" onClick={e=>{if(!plain(e))return;e.preventDefault();saveAdminViewState('orders-bucket','abandoned');open('abandoned','admin-orders');}}><Clock size={18} aria-hidden="true"/><span>הזמנות שנזנחו</span><b>{data.abandoned}</b>{opening==='abandoned'?<Loader2 className="wc2-spin" size={16} aria-hidden="true"/>:<ChevronLeft size={16} aria-hidden="true"/>}</a>}{attention.data&&!waiting.length&&!Number(data?.abandoned)&&<p className="wc2-empty is-small"><CheckCircle2 size={18} aria-hidden="true"/>אין תורים פתוחים</p>}<button type="button" className="wc2-more" onClick={()=>showLobby()}><span>כל תורי הטיפול</span><ChevronLeft size={16} aria-hidden="true"/></button></section>
    <p className="wc2-hint"><Info size={15} aria-hidden="true"/><span>סימון התראה כטופלה לא מאשר תשלום או פרסום. המסך מתרענן כל 30 שניות.</span></p>
   </aside></div>
  :<section className="wc2-lane is-handled"><header className="wc2-lane-head"><span className="wc2-lane-icon"><CheckCircle2 size={18} aria-hidden="true"/></span><div><h2>טופלו</h2><p>פרטי ההתראה בעת הסימון</p></div><strong>{listState.data?listState.data.total:'—'}</strong></header>{!listState.data?<p className="wc2-empty" role="status">{state.error?'לא ניתן לטעון':'טוען…'}</p>:listState.data.updates.length?<div className="wc2-rows">{listState.data.updates.map((r:Row)=>record(r,true))}</div>:<p className="wc2-empty"><CheckCircle2 size={18} aria-hidden="true"/>{saved.q?'לא נמצאו התראות מתאימות':'עדיין לא סומנו התראות כטופלו'}</p>}{listState.data?.total>20&&<footer className="wc2-pages"><span role="status">{(listState.data.page-1)*20+1}–{Math.min(listState.data.page*20,listState.data.total)} מתוך {listState.data.total}</span><nav aria-label="עמודי עדכונים"><button type="button" className="wc2-glass" disabled={listState.data.page<=1||listState.loading} onClick={()=>commit({page:listState.data.page-1})}><ChevronRight size={16} aria-hidden="true"/><span>הקודם</span></button><button type="button" className="wc2-glass" disabled={listState.data.page*20>=listState.data.total||listState.loading} onClick={()=>commit({page:listState.data.page+1})}><span>הבא</span><ChevronLeft size={16} aria-hidden="true"/></button></nav></footer>}</section>}
 </section>;
}
