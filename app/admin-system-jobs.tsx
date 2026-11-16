'use client';
import React,{useEffect,useRef,useState} from 'react';
import {Bell,Building2,Check,Clock,CreditCard,Download,FileText,Globe,Loader2,Mail,Plug,RefreshCw,Send,ShoppingCart,Sparkles,TriangleAlert,Zap} from 'lucide-react';
import {download,useData} from '@/lib/client';
import {money,stages,when,type Row} from '@/lib/shared';
import {takeAdminViewState} from '@/lib/admin-view-state';
import type {Ctx} from './workspace';
import {DispatchForm} from './screens';
import {OrderFilter,OrderFilters,OrderPager,OrderRecord,OrderSearch,OrderViews,plainClick} from './order-list-parts';
import {OrdersAreaHead} from './orders-area-head';
import './admin-system-jobs.css';

// 16.11.2026: the connections log (admin-jobs) in the approved v2 list look. Same data and actions as the
// old LogsView: refresh, send a waiting event (DispatchForm), download the AI result. Failures come first to the eye.

// Plain names for the job kinds the server writes (route.ts, lib/mail.ts, lib/publication.ts, lib/server.ts notify).
const kinds:Record<string,[string,React.ElementType]>={
 ai_generation:['כתיבת כתבה ב-AI',Sparkles],
 wordpress:['פרסום ב-WordPress',Globe],
 email:['שליחת מייל',Mail],
 payment_link:['קישור לתשלום',CreditCard],
 supplier_publication:['מסירה לספק',Building2],
 article_status:['עדכון מצב כתבה',Bell],
};
const kindName=(k:string)=>kinds[k]?.[0]||k||'אירוע מערכת';

// Status: label, side stripe and pill. Failed and blocked are the problems the lobby counts as "תקלות חיבור".
type Tone='red'|'wait'|'work'|'ok'|'grey';
const statuses:Record<string,[string,Tone]>={failed:['נכשל','red'],blocked:['נחסם','red'],requested:['ממתין לשליחה','wait'],writing:['בתהליך','work'],succeeded:['הצליח','ok'],completed:['הושלם','ok'],demo:['הדגמה','grey'],demo_completed:['הדגמה הושלמה','grey'],cancelled:['בוטל','grey']};
const statusOf=(s:string):[string,Tone]=>statuses[s]||[stages[s]||s||'לא ידוע','grey'];
const stripe:Record<Tone,string>={red:'red',wait:'wait',work:'work',ok:'ok',grey:'neutral'};
const pill:Record<Tone,string>={red:'is-red',wait:'is-wait',work:'is-work',ok:'is-ok',grey:'is-cancelled'};

const views:Record<string,(r:Row)=>boolean>={all:()=>true,issues:r=>r.status==='failed'||r.status==='blocked',requested:r=>r.status==='requested',writing:r=>r.status==='writing',done:r=>r.status==='succeeded'||r.status==='completed'};
const isIssue=views.issues;
const errorOf=(r:Row)=>String(r.error||r.delivery_error||'').trim();
const hebrew=(s:string)=>/[֐-׿]/.test(s);
const PAGE=20;

// What the row says about the job: its title, or who it went to, or the ids it belongs to.
function headline(r:Row):React.ReactNode{
 if(r.title||r.subject)return String(r.title||r.subject);
 if(r.to||r.recipient_email)return <>אל <bdi dir="ltr">{String(r.to||r.recipient_email)}</bdi></>;
 if(r.article_id)return <>כתבה <bdi dir="ltr">{String(r.article_id)}</bdi></>;
 if(r.order_id)return <>הזמנה <bdi dir="ltr">{String(r.order_id)}</bdi></>;
 return 'אירוע מערכת';
}
const meta=(r:Row)=>[r.website_name,r.supplier_name,(r.title||r.subject)&&(r.to||r.recipient_email)].filter(Boolean).map(String);

export function AdminJobsPage({ctx}:{ctx:Ctx}){
 const state=useData('admin/jobs',ctx.revision),all:Row[]=state.data?.jobs||[];
 const [view,setView]=useState(()=>{const preset=takeAdminViewState<string>('jobs-status');return preset==='failed'||preset==='blocked'?'issues':preset&&preset in views?preset:'all';});
 const [kind,setKind]=useState('all'),[search,setSearch]=useState(''),[open,setOpen]=useState(''),[page,setPage]=useState(1);
 // Refresh feedback: busy from the click until the new list arrives, then a short "עודכן".
 const [asked,setAsked]=useState(false),[fresh,setFresh]=useState(false),seen=useRef(false),reloading=state.loading&&!!state.data;
 useEffect(()=>{if(!asked)return;if(reloading){seen.current=true;return;}if(seen.current){seen.current=false;setAsked(false);if(!state.error)setFresh(true);}},[asked,reloading,state.error]);
 useEffect(()=>{if(!asked)return;const t=setTimeout(()=>{seen.current=false;setAsked(false);},15000);return()=>clearTimeout(t);},[asked]);
 useEffect(()=>{if(!fresh)return;const t=setTimeout(()=>setFresh(false),1600);return()=>clearTimeout(t);},[fresh]);
 const busy=asked||reloading;
 const refresh=()=>{if(busy)return;setFresh(false);seen.current=false;setAsked(true);ctx.refresh();};

 const query=search.trim().toLocaleLowerCase('he');
 const base=all.filter(r=>(kind==='all'||r.kind===kind)&&(!query||[kindName(r.kind),r.kind,statusOf(r.status)[0],r.title,r.subject,r.to,r.recipient_email,r.website_name,r.supplier_name,r.article_id,r.order_id,r.id,errorOf(r)].some(v=>String(v||'').toLocaleLowerCase('he').includes(query))));
 const count=(key:string)=>base.filter(views[key]).length;
 const rows=base.filter(views[view]||views.all),shown=Math.min(page,Math.max(1,Math.ceil(rows.length/PAGE)));
 const issues=all.filter(isIssue).length,filtered=!!query||view!=='all'||kind!=='all';
 const kindOptions:Record<string,string>={all:'כל הסוגים',...Object.fromEntries([...new Set(all.map(r=>String(r.kind||'')))].filter(Boolean).map(k=>[k,kindName(k)]))};
 const reset=()=>{setPage(1);setOpen('');};
 const showIssues=()=>{setView('issues');setKind('all');setSearch('');reset();};
 const go=(page:string)=>(e:React.MouseEvent)=>{e.stopPropagation();if(!plainClick(e))return;e.preventDefault();ctx.go(page);};
 const dispatch=(r:Row)=>ctx.open({title:'שליחת אירוע לספק',description:'הפעולה תשלח את נתוני האירוע דרך החיבור שהוגדר.',render:(close:()=>void)=><DispatchForm ctx={ctx} id={r.id} close={close}/>});
 const aiFile=(r:Row)=>download('ai-result.txt',r.title+'\n\n'+r.content);
 const acts={dispatch,aiFile,go};

 return <section className="orders-match-screen om-finance om-content sv2 sv2-orders sv2-fin sys-jobs" dir="rtl">
  <OrdersAreaHead ctx={ctx} current="admin-jobs" title="יומן חיבורים" sub="בקשות AI, פרסום, מיילים וסליקה. ״הצליח״ מופיע רק אחרי שהשירות אישר קבלה."
   action={<div className="om-top-actions"><button type="button" className={'sj-refresh'+(busy?' is-busy':'')+(fresh?' is-done':'')} aria-busy={busy||undefined} onClick={refresh}>{busy?<Loader2 className="sj-spin" size={17} aria-hidden="true"/>:fresh?<Check size={17} aria-hidden="true"/>:<RefreshCw size={17} aria-hidden="true"/>}<span>{busy?'מרענן…':fresh?'עודכן':'רענון'}</span></button></div>}/>
  <div className="orders-reference-panel">
   {issues>0&&view!=='issues'&&<aside className="sj-alert" role="status">
    <span className="sj-alert-ico" aria-hidden="true"><TriangleAlert size={20}/></span>
    <div className="sj-alert-txt"><b>{issues===1?'אירוע אחד נכשל או נחסם':<><bdi>{issues}</bdi> אירועים נכשלו או נחסמו</>}</b><small>פתחו את האירוע כדי לראות מה השתבש.</small></div>
    <div className="sj-alert-acts"><button type="button" className="sj-alert-btn is-strong" onClick={showIssues}>הצגת התקלות</button><a className="sj-alert-btn" href="/admin-connections" onClick={go('admin-connections')}><Plug size={16} aria-hidden="true"/>חיבורים והגדרות</a></div>
   </aside>}
   <div className="orders-reference-toolbar om-toolbar is-search">
    <OrderSearch label="חיפוש לפי סוג, נמען, כתבה, הזמנה או שגיאה" value={search} onChange={v=>{setSearch(v);reset();}}/>
    {Object.keys(kindOptions).length>2&&<OrderFilters active={kind!=='all'?1:0}><OrderFilter label="סוג הפעולה" value={kind} onChange={v=>{setKind(v);reset();}} options={kindOptions} icon={<Zap size={16} aria-hidden="true"/>}/></OrderFilters>}
   </div>
   <OrderViews label="סינון לפי מצב" value={view} onChange={v=>{setView(v);reset();}} views={[['all','הכול',base.length],['issues','תקלות',count('issues')],['requested','ממתינים לשליחה',count('requested')],['writing','בתהליך',count('writing')],['done','הצליחו',count('done')]]}/>
   {state.error&&state.data&&<div className="sj-inline-error" role="alert"><TriangleAlert size={17} aria-hidden="true"/><span>הרענון לא הצליח: {state.error}</span><button type="button" onClick={refresh}>ניסיון נוסף</button></div>}
   {state.loading&&!state.data?<div className="orders-reference-loading" role="status"><Loader2 className="sj-spin" size={20} aria-hidden="true"/>טוען את היומן…</div>
   :state.error&&!state.data?<div className="orders-reference-error" role="alert"><p>{state.error}</p><button type="button" className="sj-retry" onClick={refresh}>ניסיון נוסף</button></div>
   :rows.length?<>
    <div className="om-head sj-head" aria-hidden="true"><span>פעולה</span><span>פרטים</span><span>מצב</span><span>נוצר</span><span/><span/></div>
    <div className="om-list" aria-label="אירועי החיבורים" aria-busy={busy||undefined}>{rows.slice((shown-1)*PAGE,shown*PAGE).map(r=>{
     const [label,tone]=statusOf(r.status),Icon=kinds[r.kind]?.[1]||Zap,err=errorOf(r),isOpen=open===r.id,known=!!kinds[r.kind],more=meta(r);
     const action=r.status==='requested'?<button type="button" className="om-btn om-action is-primary" onClick={e=>{e.stopPropagation();dispatch(r);}}><Send size={15} aria-hidden="true"/><span>שליחה</span></button>
      :r.kind==='ai_generation'&&r.content?<button type="button" className="om-btn om-action" onClick={e=>{e.stopPropagation();aiFile(r);}}><Download size={15} aria-hidden="true"/><span>תוצר AI</span></button>:null;
     return <OrderRecord key={r.id} id={r.id} tone={stripe[tone]} label={kindName(r.kind)+' · '+label} open={isOpen} onToggle={()=>setOpen(isOpen?'':r.id)} panel={<JobPanel r={r} acts={acts}/>}>
      <div className="sj-kind"><span className="sj-ico" aria-hidden="true"><Icon size={17}/></span><div><b>{kindName(r.kind)}</b>{known&&<code dir="ltr">{r.kind}</code>}</div></div>
      <div className="sj-info"><b>{headline(r)}</b>{err?<small className="sj-err-line"><TriangleAlert size={13} aria-hidden="true"/><bdi>{err}</bdi></small>:more.length?<small><bdi>{more.join(' · ')}</bdi></small>:null}</div>
      <div className="sj-state"><span className={'om-pill '+pill[tone]}>{label}</span></div>
      <div className="sj-time">{r.created?<time dateTime={r.created}><bdi>{when(r.created)}</bdi></time>:<span className="om-muted">אין תאריך</span>}</div>
      {action?<div className="sj-act">{action}</div>:<span className="sj-noact" aria-hidden="true"/>}
     </OrderRecord>;})}</div>
   </>
   :<div className="orders-reference-empty">{view==='issues'&&!query&&kind==='all'?<><h3>אין תקלות</h3><p>אין כרגע אירועים שנכשלו או נחסמו.</p></>:filtered?<><h3>לא נמצאו אירועים</h3><p>נסו חיפוש אחר, סוג אחר או מצב אחר.</p></>:<><h3>היומן ריק</h3><p>פעולות חדשות מול שירותים חיצוניים יירשמו כאן.</p></>}
    {filtered&&<button type="button" className="sj-retry" onClick={()=>{setSearch('');setKind('all');setView('all');reset();}}>הצגת כל האירועים</button>}</div>}
   <OrderPager page={shown} total={rows.length} size={PAGE} onChange={v=>{setPage(v);setOpen('');}}/>
   {all.length>=400&&<p className="om-note">מוצגים 400 האירועים האחרונים.</p>}
  </div>
 </section>;
}

type Acts={dispatch:(r:Row)=>void;aiFile:(r:Row)=>void;go:(page:string)=>(e:React.MouseEvent)=>void};

// A short line on what to expect when there is no error text from the service.
function statusNote(r:Row){
 if(r.status==='requested')return 'האירוע עוד לא נשלח. אפשר לשלוח אותו עכשיו דרך אחד החיבורים.';
 if(r.status==='writing')return 'השליחה התחילה, ועדיין אין תשובה מהשירות.';
 if(r.status==='blocked')return r.kind==='email'?'המייל לא נשלח כי חיבור הדוא״ל אינו פעיל.':'האירוע נעצר לפני השליחה.';
 if(r.status==='failed')return 'השירות לא אישר את הבקשה, ולא נשמר פירוט.';
 return '';
}

function JobPanel({r,acts}:{r:Row;acts:Acts}){
 const [label,tone]=statusOf(r.status),err=errorOf(r),note=err?'':statusNote(r),problem=isIssue(r);
 const diag=r.provider_error&&typeof r.provider_error==='object'?Object.entries(r.provider_error as Row).filter(([,v])=>v!==undefined&&v!==null&&v!=='').map(([k,v])=>k+': '+String(v)).join(' · '):'';
 const link=String(r.url||r.payment_url||''),web=/^https?:\/\//i.test(link);
 const facts:[string,React.ReactNode][]=([
  ['סוג הפעולה',<>{kindName(r.kind)}{kinds[r.kind]&&<code dir="ltr">{r.kind}</code>}</>],
  ['מצב',<span className={'om-pill '+pill[tone]}>{label}</span>],
  ['נוצר',r.created&&<bdi>{when(r.created)}</bdi>],
  ['עודכן',r.updated&&r.updated!==r.created&&<bdi>{when(r.updated)}</bdi>],
  ['כותרת',r.title&&String(r.title)],
  ['נושא',r.subject&&String(r.subject)],
  ['נמען',(r.to||r.recipient_email)&&<bdi dir="ltr">{String(r.to||r.recipient_email)}</bdi>],
  ['אתר',r.website_name&&String(r.website_name)],
  ['ספק',r.supplier_name&&String(r.supplier_name)],
  ['סכום',r.amount_cents!=null&&r.amount_cents!==''&&<bdi>{money(Number(r.amount_cents))}</bdi>],
  ['קישור',link&&(web?<a href={link} target="_blank" rel="noopener noreferrer" dir="ltr" onClick={e=>e.stopPropagation()}>{link}</a>:<bdi dir="ltr">{link}</bdi>)],
  ['הדגמה',r.demo?'כן':null],
  ['כתבה',r.article_id&&<code dir="ltr">{String(r.article_id)}</code>],
  ['הזמנה',r.order_id&&<code dir="ltr">{String(r.order_id)}</code>],
  ['מזהה האירוע',<code dir="ltr">{String(r.id)}</code>],
 ] as [string,React.ReactNode][]).filter(([,v])=>v!==null&&v!==undefined&&v!==false&&v!=='');
 const buttons=[
  r.status==='requested'&&<button key="send" type="button" className="om-btn is-primary" onClick={()=>acts.dispatch(r)}><Send size={17} aria-hidden="true"/>שליחה</button>,
  r.kind==='ai_generation'&&r.content&&<button key="ai" type="button" className="om-btn" onClick={()=>acts.aiFile(r)}><Download size={17} aria-hidden="true"/>הורדת תוצר AI</button>,
  r.article_id&&<a key="article" className="om-btn" href={'/admin-article/'+r.article_id} onClick={acts.go('admin-article/'+r.article_id)}><FileText size={17} aria-hidden="true"/>פתיחת הכתבה</a>,
  r.order_id&&<a key="order" className="om-btn" href={'/admin-order/'+r.order_id} onClick={acts.go('admin-order/'+r.order_id)}><ShoppingCart size={17} aria-hidden="true"/>פתיחת ההזמנה</a>,
  problem&&<a key="settings" className="om-btn" href="/admin-connections" onClick={acts.go('admin-connections')}><Plug size={17} aria-hidden="true"/>חיבורים והגדרות</a>,
 ].filter(Boolean);
 return <div className="sj-panel">
  {(err||note||diag)&&<section className={'sj-msg'+(problem?' is-error':' is-wait')}>
   <h3>{problem||err?<TriangleAlert size={17} aria-hidden="true"/>:<Clock size={17} aria-hidden="true"/>}{problem||err?'מה השתבש':'מה המצב'}</h3>
   {err&&(hebrew(err)?<p className="sj-err-text" dir="auto">{err}</p>:<code className="sj-code" dir="ltr"><bdi dir="ltr">{err}</bdi></code>)}
   {note&&<p className="sj-err-text">{note}</p>}
   {diag&&<div className="sj-diag"><small>פרטים טכניים</small><code className="sj-code" dir="ltr"><bdi dir="ltr">{diag}</bdi></code></div>}
  </section>}
  <dl className="sj-facts">{facts.map(([k,v])=><div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
  {buttons.length>0&&<footer className="om-panel-foot sj-foot">{buttons}</footer>}
 </div>;
}
