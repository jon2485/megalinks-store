'use client';
import React,{useEffect,useRef,useState} from 'react';
import {Bell,Building2,Check,ChevronDown,ChevronUp,Clock,CreditCard,Download,FileText,Globe,Loader2,Mail,Plug,RefreshCw,Search,Send,ShoppingCart,Sparkles,TriangleAlert,X,Zap} from 'lucide-react';
import {download,useData} from '@/lib/client';
import {money,stages,when,type Row} from '@/lib/shared';
import {takeAdminViewState} from '@/lib/admin-view-state';
import type {Ctx} from './workspace';
import {DispatchForm} from './screens';
import {OrderFilter,OrderFilters,OrderPager,RecordPanel,plainClick} from './order-list-parts';
import {OrdersAreaHead} from './orders-area-head';
import './supplier-v2.css';
import './admin-system-jobs.css';

// 22.11.2026 (owner: "like the other admin pages"): "יומן חיבורים" in the same look as "חיבורים והגדרות",
// the suppliers and the orders lists: a calm failures notice, one white card with the state chips, search and
// the kind filter, then a table of rows. Same data (admin/jobs), same refresh, send (DispatchForm), AI result
// download and links as before; the open row keeps every detail (error, technical details, all facts).
// 16.11.2026: first v2 version of the old LogsView.

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

// Status: label and tone. Failed and blocked are the problems the lobby counts as "תקלות חיבור".
type Tone='red'|'wait'|'work'|'ok'|'grey';
const statuses:Record<string,[string,Tone]>={failed:['נכשל','red'],blocked:['נחסם','red'],requested:['ממתין לשליחה','wait'],writing:['בתהליך','work'],succeeded:['הצליח','ok'],completed:['הושלם','ok'],demo:['הדגמה','grey'],demo_completed:['הדגמה הושלמה','grey'],cancelled:['בוטל','grey']};
const statusOf=(s:string):[string,Tone]=>statuses[s]||[stages[s]||s||'לא ידוע','grey'];
// sv2 state dot per tone, and the row tint (failed rows: is-late, waiting to send: is-wait).
const stateCls:Record<Tone,string>={red:'late',wait:'wait',work:'sj-work',ok:'on',grey:'off'};
const rowCls:Record<Tone,string>={red:' is-late',wait:' is-wait',work:'',ok:'',grey:''};
const State=({tone,label}:{tone:Tone;label:string})=><span className={'sv2-state '+stateCls[tone]}><i/>{label}</span>;

const views:Record<string,(r:Row)=>boolean>={all:()=>true,issues:r=>r.status==='failed'||r.status==='blocked',requested:r=>r.status==='requested',writing:r=>r.status==='writing',done:r=>r.status==='succeeded'||r.status==='completed'};
const isIssue=views.issues;
const errorOf=(r:Row)=>String(r.error||r.delivery_error||'').trim();
const hebrew=(s:string)=>/[֐-׿]/.test(s);
const PAGE=20;
const cols={gridTemplateColumns:'minmax(190px,1.1fr) minmax(0,1.7fr) 104px 128px 118px 148px'};

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
 const chips:[string,string,number][]=[['all','הכול',base.length],['issues','תקלות',count('issues')],['requested','ממתינים לשליחה',count('requested')],['writing','בתהליך',count('writing')],['done','הצליחו',count('done')]];
 const searchLabel='חיפוש לפי סוג, נמען, כתבה, הזמנה או שגיאה',manyKinds=Object.keys(kindOptions).length>2;

 return <section className="orders-match-screen sv2 sv2-orders sv2-fin sys-jobs" dir="rtl">
  <OrdersAreaHead ctx={ctx} current="admin-jobs" title="יומן חיבורים" sub="בקשות AI, פרסום, מיילים וסליקה. ״הצליח״ מופיע רק אחרי שהשירות אישר קבלה."
   action={<div className="om-top-actions"><button type="button" className={'sj-refresh'+(busy?' is-busy':'')+(fresh?' is-done':'')} aria-busy={busy||undefined} onClick={refresh}>{busy?<Loader2 className="sj-spin" size={17} aria-hidden="true"/>:fresh?<Check size={17} aria-hidden="true"/>:<RefreshCw size={17} aria-hidden="true"/>}<span>{busy?'מרענן…':fresh?'עודכן':'רענון'}</span></button></div>}/>
  <div className="sj-body">
   {issues>0&&view!=='issues'&&<aside className="sv2-card sj-alert" role="status">
    <span className="sj-alert-ico" aria-hidden="true"><TriangleAlert size={18}/></span>
    <div className="sj-alert-txt"><b>{issues===1?'אירוע אחד נכשל או נחסם':<><bdi>{issues}</bdi> אירועים נכשלו או נחסמו</>}</b><small>פתחו את האירוע כדי לראות מה השתבש.</small></div>
    <div className="sj-alert-acts"><button type="button" className="sv2-btn tint sm" onClick={showIssues}>הצגת התקלות</button><a className="sv2-btn quiet sm" href="/admin-connections" onClick={go('admin-connections')}><Plug size={15} aria-hidden="true"/>חיבורים והגדרות</a></div>
   </aside>}
   <section className="sv2-card sj-card" aria-label="אירועי החיבורים">
    <div className="sv2-tools sj-tools">
     <div className="sv2-seg sj-seg" role="group" aria-label="סינון לפי מצב">{chips.map(([key,label,n])=><button key={key} type="button" className={(view===key?'on':'')+(key==='issues'&&n>0?' is-issues':'')} aria-pressed={view===key} onClick={()=>{setView(key);reset();}}>{label}<b><bdi>{n}</bdi></b></button>)}</div>
     <label className="sv2-search sj-search"><Search size={17} aria-hidden="true"/><input type="search" maxLength={120} aria-label={searchLabel} placeholder={searchLabel} value={search} onChange={e=>{setSearch(e.target.value);reset();}}/>{search&&<button type="button" className="sv2-clear" aria-label="ניקוי חיפוש" onClick={()=>{setSearch('');reset();}}><X size={15}/></button>}</label>
     {manyKinds&&<label className={'sv2-select sj-kindsel'+(kind!=='all'?' is-on':'')}><Zap size={16} aria-hidden="true"/><span className="sr-only">סוג הפעולה</span><select value={kind} onChange={e=>{setKind(e.target.value);reset();}}>{Object.entries(kindOptions).map(([k,t])=><option key={k} value={k}>{t}</option>)}</select></label>}
     {/* phones: the kind filter opens in the "סינון" sheet */}
     {manyKinds&&<span className="sj-sheetfilter"><OrderFilters active={kind!=='all'?1:0}><OrderFilter label="סוג הפעולה" value={kind} onChange={v=>{setKind(v);reset();}} options={kindOptions} icon={<Zap size={16} aria-hidden="true"/>}/></OrderFilters></span>}
    </div>
    {state.error&&state.data&&<div className="sj-inline-error" role="alert"><TriangleAlert size={16} aria-hidden="true"/><span>הרענון לא הצליח: {state.error}</span><button type="button" className="sv2-btn quiet sm" onClick={refresh}>ניסיון נוסף</button></div>}
    {state.loading&&!state.data?<div className="sv2-loading sj-loading" role="status"><Loader2 className="sj-spin" size={20} aria-hidden="true"/>טוען את היומן…</div>
    :state.error&&!state.data?<div className="sv2-empty sj-fail" role="alert"><p>{state.error}</p><button type="button" className="sv2-btn tint" onClick={refresh}>ניסיון נוסף</button></div>
    :rows.length?<>
     <div className="sv2-th" style={cols} aria-hidden="true"><span>פעולה</span><span>פרטים</span><span>קישורים</span><span>מצב</span><span>נוצר</span><span/></div>
     <div className="sj-list" aria-label="אירועי החיבורים" aria-busy={busy||undefined}>{rows.slice((shown-1)*PAGE,shown*PAGE).map(r=>{
      const [label,tone]=statusOf(r.status),Icon=kinds[r.kind]?.[1]||Zap,err=errorOf(r),isOpen=open===r.id,known=!!kinds[r.kind],more=meta(r),title=kindName(r.kind)+' · '+label,toggle=()=>setOpen(isOpen?'':r.id);
      const action=r.status==='requested'?<button type="button" className="sv2-btn primary sm" onClick={e=>{e.stopPropagation();dispatch(r);}}><Send size={15} aria-hidden="true"/><span>שליחה</span></button>
       :r.kind==='ai_generation'&&r.content?<button type="button" className="sv2-btn tint sm" onClick={e=>{e.stopPropagation();aiFile(r);}}><Download size={15} aria-hidden="true"/><span>תוצר AI</span></button>:null;
      const linked=!!(r.article_id||r.order_id);
      return <article key={r.id} className={'sj-job'+(isOpen?' is-open':'')}>
       <div className={'sv2-tr sj-row'+rowCls[tone]+(action?' has-act':'')+(linked?' has-links':'')} style={cols} onClick={toggle}>
        <div className="sv2-who sj-kind"><span className="sv2-thumb sj-ico" aria-hidden="true"><Icon size={18}/></span><span><b>{kindName(r.kind)}</b>{known&&<small className="sj-code-kind"><bdi dir="ltr">{r.kind}</bdi></small>}</span></div>
        <div className="sj-info"><b>{headline(r)}</b>{err?<small className="sj-err-line"><TriangleAlert size={13} aria-hidden="true"/><bdi>{err}</bdi></small>:more.length?<small><bdi>{more.join(' · ')}</bdi></small>:null}</div>
        <div className={'sj-links'+(linked?'':' is-empty')}><small className="sv2-ml">קישורים</small>{linked?<span>
         {r.article_id&&<a className="sv2-lk" href={'/admin-article/'+r.article_id} title="פתיחת הכתבה" onClick={go('admin-article/'+r.article_id)}><FileText size={14} aria-hidden="true"/>כתבה</a>}
         {r.order_id&&<a className="sv2-lk" href={'/admin-order/'+r.order_id} title="פתיחת ההזמנה" onClick={go('admin-order/'+r.order_id)}><ShoppingCart size={14} aria-hidden="true"/>הזמנה</a>}
        </span>:<span className="sv2-muted">—</span>}</div>
        <div className="sj-state"><State tone={tone} label={label}/></div>
        <div className="sj-time"><small className="sv2-ml">נוצר</small>{r.created?<time dateTime={r.created}><bdi>{when(r.created)}</bdi></time>:<span className="sv2-muted">אין תאריך</span>}</div>
        <div className="sv2-rowact sj-act" onClick={e=>e.stopPropagation()}>
         {action}
         <button type="button" className="sj-exp" aria-label={(isOpen?'סגירת פירוט ':'פירוט ')+title} aria-expanded={isOpen} aria-controls={'record-'+r.id} onClick={toggle}>{isOpen?<ChevronUp size={18} aria-hidden="true"/>:<ChevronDown size={18} aria-hidden="true"/>}</button>
        </div>
       </div>
       {isOpen&&<RecordPanel id={'record-'+r.id} title={title} onClose={toggle}><JobPanel r={r} acts={acts}/></RecordPanel>}
      </article>;})}</div>
    </>
    :<div className="sv2-empty">{view==='issues'&&!query&&kind==='all'?<><h3>אין תקלות</h3><p>אין כרגע אירועים שנכשלו או נחסמו.</p></>:filtered?<><h3>לא נמצאו אירועים</h3><p>נסו חיפוש אחר, סוג אחר או מצב אחר.</p></>:<><h3>היומן ריק</h3><p>פעולות חדשות מול שירותים חיצוניים יירשמו כאן.</p></>}
     {filtered&&<button type="button" className="sv2-btn tint" onClick={()=>{setSearch('');setKind('all');setView('all');reset();}}>הצגת כל האירועים</button>}</div>}
    <OrderPager page={shown} total={rows.length} size={PAGE} onChange={v=>{setPage(v);setOpen('');}}/>
    {all.length>=400&&<p className="sj-note">מוצגים 400 האירועים האחרונים.</p>}
   </section>
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
  ['מצב',<State tone={tone} label={label}/>],
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
  r.status==='requested'&&<button key="send" type="button" className="sv2-btn primary" onClick={()=>acts.dispatch(r)}><Send size={16} aria-hidden="true"/>שליחה</button>,
  r.kind==='ai_generation'&&r.content&&<button key="ai" type="button" className="sv2-btn tint" onClick={()=>acts.aiFile(r)}><Download size={16} aria-hidden="true"/>הורדת תוצר AI</button>,
  r.article_id&&<a key="article" className="sv2-btn tint" href={'/admin-article/'+r.article_id} onClick={acts.go('admin-article/'+r.article_id)}><FileText size={16} aria-hidden="true"/>פתיחת הכתבה</a>,
  r.order_id&&<a key="order" className="sv2-btn tint" href={'/admin-order/'+r.order_id} onClick={acts.go('admin-order/'+r.order_id)}><ShoppingCart size={16} aria-hidden="true"/>פתיחת ההזמנה</a>,
  problem&&<a key="settings" className="sv2-btn quiet" href="/admin-connections" onClick={acts.go('admin-connections')}><Plug size={16} aria-hidden="true"/>חיבורים והגדרות</a>,
 ].filter(Boolean);
 return <div className="sj-panel">
  {(err||note||diag)&&<section className={'sj-msg'+(problem?' is-error':' is-wait')}>
   <h3>{problem||err?<TriangleAlert size={16} aria-hidden="true"/>:<Clock size={16} aria-hidden="true"/>}{problem||err?'מה השתבש':'מה המצב'}</h3>
   {err&&(hebrew(err)?<p className="sj-err-text" dir="auto">{err}</p>:<code className="sj-code" dir="ltr"><bdi dir="ltr">{err}</bdi></code>)}
   {note&&<p className="sj-err-text">{note}</p>}
   {diag&&<div className="sj-diag"><small>פרטים טכניים</small><code className="sj-code" dir="ltr"><bdi dir="ltr">{diag}</bdi></code></div>}
  </section>}
  <dl className="sj-facts">{facts.map(([k,v])=><div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
  {buttons.length>0&&<footer className="sj-actions">{buttons}</footer>}
 </div>;
}
