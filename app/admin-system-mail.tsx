'use client';
import React,{useState} from 'react';
import {AlertTriangle,Check,ChevronLeft,ExternalLink,FileText,Info,Loader2,Mail,Megaphone,Paperclip,Plug,RefreshCw,Search,X} from 'lucide-react';
import {useData,api} from '@/lib/client';
import {when,type Row} from '@/lib/shared';
import {takeAdminViewState} from '@/lib/admin-view-state';
import type {Ctx} from './workspace';
import {OrderPager,RecordPanel,plainClick} from './order-list-parts';
import {OrdersAreaHead} from './orders-area-head';
import AdminMarketingList from './admin-marketing-list';
import './supplier-v2.css';
import './admin-system-mail.css';

// 22.11.2026 (owner: "like the other admin pages"): "דיוור" in the same look as the suppliers, orders, content and
// connections lists: one white card with search and filter chips, a table of rows, the open message under its row
// (a bottom sheet on phones) and the marketing list as its own card. Same data (admin/mail), same retry
// (POST admin/mail/<id>) and the same marketing list as before; only the presentation changed.
// 16.11.2026: the admin page itself; the customer page keeps NoticesView.

// Status label (unchanged wording) and its sv2 state per job status. Not sent = red (sv2-state late, row is-late).
const LOOK:Record<string,{label:string;state:string;row?:string}>={
 blocked:{label:'ממתין לחיבור דיוור',state:'late',row:'is-late'},
 failed:{label:'שליחה נכשלה',state:'late',row:'is-late'},
 succeeded:{label:'נמסר לשירות הדיוור',state:'on'},
 demo:{label:'הדגמה',state:'off'},
 writing:{label:'בשליחה',state:'work'},
};
const look=(s:string)=>LOOK[s]||{label:'ממתין',state:'wait',row:'is-wait'};
const RETRY=['blocked','failed','requested'];
const canRetry=(r:Row)=>RETRY.includes(r.status);
// What the retry call answered, said in plain words next to the button.
const RESULT:Record<string,{tone:string;text:string}>={
 succeeded:{tone:'ok',text:'נמסר לשירות הדיוור.'},
 blocked:{tone:'wait',text:'לא נשלח: חיבור הדוא״ל עדיין לא פעיל.'},
 failed:{tone:'red',text:'השליחה נכשלה שוב. הסיבה מופיעה בפירוט ההודעה.'},
 demo:{tone:'info',text:'זו הודעת הדגמה, לא נשלח מייל.'},
 writing:{tone:'info',text:'ההודעה כבר בשליחה.'},
};
const plural=(n:number,one:string,many:string)=>n===1?one:n+' '+many;
// A supplier follow-up gets its final subject only when it is sent; until then the list names what it is.
const FOLLOW:Record<string,string>={hold:'בקשה מהספק להמתין עם הפרסום',update:'הנחיות מעודכנות לספק',answer:'תשובה לספק'};
const subjectOf=(r:Row)=>String(r.subject||'')||(r.supplier_followup?(FOLLOW[r.supplier_followup]||'הודעת המשך לספק')+' · הנושא ייקבע בשליחה':'הודעה ללא נושא');
const firstLine=(text:unknown)=>String(text||'').split('\n').map(s=>s.trim()).find(Boolean)||'';
const cols={gridTemplateColumns:'minmax(0,1.8fr) minmax(0,1.1fr) 190px 104px 140px 32px'};

// The files an email carries, read from the same flags lib/mail.ts uses (an article replaces the others,
// writing details replace the order summary).
function mailFiles(r:Row){
 if(r.attach_article)return ['קובץ Word של הכתבה',...(r.attach_images?['תמונות הכתבה והמסמך המקורי, אם קיימים']:[])];
 if(r.attach_writing_brief)return ['פרטי הכתיבה (PDF)'];
 if(r.attach_order_statement)return ['סיכום ההזמנה (PDF)'];
 return [] as string[];
}
function rowLine(r:Row){
 if(r.status==='failed')return {text:r.delivery_error||'השליחה נכשלה',error:true};
 if(r.status==='blocked')return {text:'מחכה לחיבור הדוא״ל',error:false};
 return {text:firstLine(r.text)||'ללא תוכן טקסט',error:false};
}

type Result={tone:string;text:string};
export function AdminMailPage({ctx}:{ctx:Ctx}){
 const state=useData('admin/mail',ctx.revision),all:Row[]=state.data?.messages||[];
 // A lobby link may preset the view ('mail-status'); otherwise open on what needs handling when there is any.
 const [picked,setPicked]=useState<string|null>(()=>{const v=takeAdminViewState<string>('mail-status');return v&&['attention','all','succeeded','demo','writing'].includes(v)?v:null;});
 const [search,setSearch]=useState(''),[open,setOpen]=useState(''),[page,setPage]=useState(1);
 const [busy,setBusy]=useState(''),[results,setResults]=useState<Record<string,Result>>({}),[kept,setKept]=useState<string[]>([]);
 const count=(s:string)=>all.filter(r=>r.status===s).length;
 const attention=all.filter(canRetry).length,failed=count('failed'),blocked=count('blocked'),requested=count('requested'),writing=count('writing');
 const view=picked??(attention?'attention':'all'),query=search.trim().toLocaleLowerCase('he');
 const inView=(r:Row)=>view==='all'||(view==='attention'?canRetry(r):r.status===view)||kept.includes(r.id);
 const rows=all.filter(r=>inView(r)&&[r.subject,r.to,r.text,r.delivery_error,r.id].some(v=>String(v||'').toLocaleLowerCase('he').includes(query)));
 const shown=Math.min(page,Math.max(1,Math.ceil(rows.length/20)));
 const reset=()=>{setPage(1);setOpen('');setKept([]);setResults({});};
 const pick=(v:string)=>{setPicked(v);reset();};
 const find=(v:string)=>{setSearch(v);reset();};
 const retry=async(r:Row)=>{
  if(busy)return;setBusy(r.id);setKept(k=>k.includes(r.id)?k:[...k,r.id]);setResults(x=>{const next={...x};delete next[r.id];return next;});
  // Empty success text: the answer shows next to the button instead of a generic toast.
  try{const out=await ctx.run(()=>api('admin/mail/'+encodeURIComponent(r.id),'POST',{}),'');setResults(x=>({...x,[r.id]:RESULT[out?.status]||{tone:'info',text:'מצב ההודעה עודכן.'}}));}
  catch(e){setResults(x=>({...x,[r.id]:{tone:'red',text:(e as Error).message||'הניסיון לא הצליח. אפשר לנסות שוב.'}}));}
  finally{setBusy('');}
 };
 const toMarketing=()=>{const el=document.getElementById('sys-mail-marketing');if(!el)return;const calm=window.matchMedia('(prefers-reduced-motion: reduce)').matches;el.scrollIntoView({behavior:calm?'auto':'smooth',block:'start'});el.focus({preventScroll:true});};
 const views:[string,string,number?][]=[['attention','לטיפול',attention],['all','הכול',all.length],['succeeded','נמסרו',count('succeeded')],['demo','הדגמה',count('demo')],...(writing?[['writing','בשליחה',writing] as [string,string,number]]:[])];
 const empty=view==='attention'&&!query?{title:'אין הודעות לטיפול',text:'כל ההודעות נמסרו לשירות הדיוור או סומנו כהדגמה.'}:query||view!=='all'?{title:'לא נמצאו הודעות',text:'נסו חיפוש אחר או תצוגה אחרת.'}:{title:'עדיין אין הודעות',text:'מיילים שהמערכת שולחת יופיעו כאן.'};
 const label='חיפוש לפי נושא, נמען או תוכן';
 return <section className="orders-match-screen sv2 sv2-orders sv2-fin sys-mail" dir="rtl">
  <OrdersAreaHead ctx={ctx} current="admin-notifications" title="דיוור" sub="כל מייל שהמערכת שולחת ללקוחות, לספקים ולצוות. מה שלא נשלח מסומן באדום. הודעות הדגמה לא יוצאות החוצה." action={<div className="om-top-actions"><button type="button" onClick={toMarketing}><Megaphone size={17} aria-hidden="true"/>רשימת דיוור שיווקי</button></div>}/>
  <section className="sv2-card sm-card" aria-label="הודעות דיוור">
   {attention>0&&<div className="sm-alert" role="note">
    <span className="sm-alert-icon" aria-hidden="true"><AlertTriangle size={18}/></span>
    <div className="sm-alert-text"><b>{attention===1?'הודעה אחת לא נשלחה':attention+' הודעות לא נשלחו'}</b><p>{[failed&&plural(failed,'אחת נכשלה','נכשלו'),blocked&&plural(blocked,'אחת מחכה לחיבור הדוא״ל','מחכות לחיבור הדוא״ל'),requested&&plural(requested,'אחת ממתינה לשליחה','ממתינות לשליחה')].filter(Boolean).join(' · ')}. {blocked?'קודם מחברים את הדוא״ל, ואז ״ניסיון שליחה״.':'פותחים הודעה, בודקים את הסיבה ולוחצים ״ניסיון שליחה״.'}</p></div>
    <div className="sm-alert-actions">{view!=='attention'&&<button type="button" className="sv2-btn tint sm" onClick={()=>pick('attention')}>הצגת ההודעות</button>}{blocked>0&&<ConnectionLink ctx={ctx} small/>}</div>
   </div>}
   <div className="sv2-tools">
    <label className="sv2-search"><Search size={17} aria-hidden="true"/><input type="search" maxLength={120} aria-label={label} placeholder={label} value={search} onChange={e=>find(e.target.value)}/>{search&&<button type="button" className="sv2-clear" aria-label="ניקוי חיפוש" onClick={()=>find('')}><X size={15}/></button>}</label>
    <div className="sv2-seg sm-seg" role="group" aria-label="סינון לפי מצב ההודעה">{views.map(([key,text,n])=><button key={key} type="button" className={(view===key?'on ':'')+'is-'+key} aria-pressed={view===key} onClick={()=>pick(key)}>{text}{Number(n)>0&&<b><bdi>{n}</bdi></b>}</button>)}</div>
   </div>
   {state.loading&&!state.data?<p className="sv2-loading" role="status">טוען הודעות…</p>
   :state.error&&!state.data?<div className="sv2-error" role="alert"><p>{state.error}</p><button type="button" className="sv2-btn quiet sm" onClick={ctx.refresh}>ניסיון נוסף</button></div>
   :rows.length?<>
    <div className="sv2-th" style={cols} aria-hidden="true"><span>הודעה</span><span>נמען</span><span>מצב</span><span>נוצרה</span><span/><span/></div>
    <div className="sm-list" aria-label="הודעות דיוור">{rows.slice((shown-1)*20,shown*20).map(r=>{const l=look(r.status),line=rowLine(r),files=mailFiles(r),isOpen=open===r.id,result=results[r.id],subject=subjectOf(r),toggle=()=>setOpen(isOpen?'':r.id);
     return <article key={r.id} className={'sm-item'+(isOpen?' is-open':'')}>
      <div className={'sv2-tr sm-row'+(l.row?' '+l.row:'')} style={cols} onClick={toggle}>
       <div className="sv2-who sm-who"><span className="sv2-thumb sm-ico" aria-hidden="true"><Mail size={19}/></span><span><b title={subject}>{subject}</b><small className={line.error?'is-error':undefined}>{line.text}</small></span></div>
       <span className="sm-to"><small className="sv2-ml">נמען</small><bdi dir="ltr" title={r.to||undefined}>{r.to||'—'}</bdi></span>
       <span className="sm-state"><small className="sv2-ml">מצב</small><span className="sm-state-line"><span className={'sv2-state '+l.state}><i/>{l.label}</span>{files.length>0&&<span className="sm-clip" title={'קבצים: '+files.join(', ')}><Paperclip size={14} aria-hidden="true"/><span className="sr-only">יש קבצים</span></span>}</span></span>
       <span className="sm-time"><small className="sv2-ml">נוצרה</small><bdi>{when(r.created)}</bdi></span>
       <span className="sv2-rowact sm-act">{canRetry(r)&&<RetryButton small busy={busy===r.id} disabled={!!busy} onClick={()=>retry(r)}/>}</span>
       <span className="sm-exp">{isOpen?<button type="button" className="sv2-dots is-close" aria-label={'סגירת פירוט '+subject} aria-expanded={true} aria-controls={'record-'+r.id} onClick={e=>{e.stopPropagation();toggle();}}><X size={16} aria-hidden="true"/></button>:<button type="button" className="sv2-chevbtn sm-chev" aria-label={'פירוט '+subject} aria-expanded={false} aria-controls={'record-'+r.id} onClick={e=>{e.stopPropagation();toggle();}}><ChevronLeft size={17} aria-hidden="true"/></button>}</span>
       {result&&!isOpen&&<ResultLine result={result}/>}
      </div>
      {isOpen&&<RecordPanel id={'record-'+r.id} title={subject} badge={<span className={'sv2-state '+l.state}><i/>{l.label}</span>} onClose={toggle}><MailPanel ctx={ctx} r={r} busy={busy} result={result} retry={retry}/></RecordPanel>}
     </article>;})}</div>
   </>
   :<div className="sv2-empty"><h3>{empty.title}</h3><p>{empty.text}</p>{search?<button type="button" className="sv2-btn tint sm" onClick={()=>find('')}>ניקוי החיפוש</button>:view!=='all'&&all.length?<button type="button" className="sv2-btn tint sm" onClick={()=>pick('all')}>הצגת כל ההודעות</button>:null}</div>}
   <OrderPager page={shown} total={rows.length} size={20} onChange={v=>{setPage(v);setOpen('');}}/>
   {all.length>=400&&<div className="sv2-foot"><span>מוצגות 400 ההודעות האחרונות.</span></div>}
  </section>
  <div id="sys-mail-marketing" className="sv2-card sm-marketing" tabIndex={-1}><AdminMarketingList ctx={ctx}/></div>
 </section>;
}

function ConnectionLink({ctx,small}:{ctx:Ctx;small?:boolean}){return <a className={'sv2-btn quiet'+(small?' sm':'')} href="/admin-connections" onClick={e=>{e.stopPropagation();if(!plainClick(e))return;e.preventDefault();ctx.go('admin-connections');}}><Plug size={15} aria-hidden="true"/>הגדרת חיבור הדוא״ל</a>;}

function RetryButton({busy,disabled,small,onClick}:{busy:boolean;disabled:boolean;small?:boolean;onClick:()=>void}){
 return <button type="button" className={'sv2-btn primary sm-retry'+(small?' sm':'')+(busy?' is-busy':'')} disabled={disabled} aria-busy={busy||undefined} onClick={e=>{e.stopPropagation();onClick();}}>{busy?<Loader2 className="om-spin" size={15} aria-hidden="true"/>:<RefreshCw size={15} aria-hidden="true"/>}<span>{busy?'שולח…':'ניסיון שליחה'}</span></button>;
}

function ResultLine({result}:{result:Result}){
 const Icon=result.tone==='ok'?Check:result.tone==='info'?Info:AlertTriangle;
 return <p className={'sm-result is-'+result.tone} role="status"><Icon size={15} aria-hidden="true"/><span>{result.text}</span></p>;
}

function MailPanel({ctx,r,busy,result,retry}:{ctx:Ctx;r:Row;busy:string;result?:Result;retry:(r:Row)=>void}){
 const files=mailFiles(r),html=typeof r.html==='string'&&r.html.trim()?r.html:'';
 const openArticle=(e:React.MouseEvent)=>{if(!plainClick(e))return;e.preventDefault();ctx.go('admin-article/'+r.article_id);};
 return <div className="sm-panel">
  {r.status==='failed'&&<section className="sm-note is-red"><AlertTriangle size={17} aria-hidden="true"/><div><b>סיבת הכישלון</b><p>{r.delivery_error||'שירות הדיוור לא החזיר סיבה.'}</p></div></section>}
  {r.status==='blocked'&&<section className="sm-note is-wait"><Plug size={17} aria-hidden="true"/><div><b>חיבור הדוא״ל לא פעיל</b><p>ההודעה לא יצאה. אחרי שמחברים את הדוא״ל, לוחצים ״ניסיון שליחה״.</p></div></section>}
  {r.status==='demo'&&<section className="sm-note"><Info size={17} aria-hidden="true"/><div><b>הודעת הדגמה</b><p>לא נשלח מייל אמיתי.</p></div></section>}
  {r.status!=='failed'&&r.delivery_error&&<p className="sm-prev-error">שגיאה מניסיון קודם: {r.delivery_error}</p>}
  <section className="sm-mail" aria-label="תוכן המייל">
   <dl className="sm-fields"><div><dt>אל</dt><dd><bdi dir="ltr">{r.to||'—'}</bdi></dd></div><div><dt>נושא</dt><dd>{subjectOf(r)}</dd></div></dl>
   <p className="sm-text" dir="rtl">{r.text||'אין תוכן טקסט.'}</p>
   {r.button?.url&&<div className="sm-link"><a className="sv2-btn tint sm-mail-button" href={r.button.url} target="_blank" rel="noopener noreferrer"><span>{r.button.label||'קישור'}</span><ExternalLink size={15} aria-hidden="true"/></a><bdi dir="ltr" className="sm-url" title={r.button.url}>{r.button.url}</bdi></div>}
   {files.length>0&&<div className="sm-files"><h4><Paperclip size={15} aria-hidden="true"/>קבצים במייל</h4><ul>{files.map(f=><li key={f}><FileText size={15} aria-hidden="true"/>{f}</li>)}</ul>{r.file_token&&<small>במייל נשלחו גם קישורי הורדה, בתוקף 45 יום.</small>}</div>}
   {r.attach_article&&<p className="sm-hint">במייל לספק, הנושא והתוכן נבנים מחדש מפרטי הכתבה בכל שליחה.</p>}
   {html&&<details className="sm-html"><summary>תצוגת המייל המעוצב</summary><iframe sandbox="" srcDoc={html} title={'תצוגת המייל: '+(r.subject||'')} loading="lazy"/></details>}
  </section>
  <p className="sm-meta">נוצרה <bdi>{when(r.created)}</bdi>{r.updated&&r.updated!==r.created&&<> · עודכנה <bdi>{when(r.updated)}</bdi></>}{r.article_id&&<> · <a href={'/admin-article/'+r.article_id} onClick={openArticle}>פתיחת הכתבה</a></>}</p>
  {result&&<ResultLine result={result}/>}
  {canRetry(r)&&<footer className="sm-actions"><RetryButton busy={busy===r.id} disabled={!!busy} onClick={()=>retry(r)}/>{['blocked','failed'].includes(r.status)&&<ConnectionLink ctx={ctx}/>}</footer>}
 </div>;
}
