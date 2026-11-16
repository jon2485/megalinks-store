'use client';
import React,{useState} from 'react';
import {AlertTriangle,ExternalLink,FileText,Loader2,Megaphone,Paperclip,Plug,RefreshCw} from 'lucide-react';
import {useData,api} from '@/lib/client';
import {when,type Row} from '@/lib/shared';
import {takeAdminViewState} from '@/lib/admin-view-state';
import type {Ctx} from './workspace';
import {OrderPager,OrderRecord,OrderSearch,OrderViews,plainClick} from './order-list-parts';
import {OrdersAreaHead} from './orders-area-head';
import AdminMarketingList from './admin-marketing-list';
import './admin-system-mail.css';

// 16.11.2026: the admin "דיוור" page in the approved orders look. Same data (admin/mail), same retry
// (POST admin/mail/<id>) and the same marketing list as the old NoticesView; the customer page keeps NoticesView.

// Status label (unchanged wording), side stripe and pill per job status. Not sent = red stripe.
const LOOK:Record<string,{label:string;tone?:string;pill:string}>={
 blocked:{label:'ממתין לחיבור דיוור',tone:'red',pill:''},
 failed:{label:'שליחה נכשלה',tone:'red',pill:'red'},
 succeeded:{label:'נמסר לשירות הדיוור',tone:'ok',pill:'ok'},
 demo:{label:'הדגמה',tone:'cancelled',pill:'cancelled'},
 writing:{label:'בשליחה',tone:'work',pill:'work'},
};
const look=(s:string)=>LOOK[s]||{label:'ממתין',pill:''};
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
const firstLine=(text:unknown)=>String(text||'').split('\n').map(s=>s.trim()).find(Boolean)||'';

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
 return <section className="orders-match-screen om-finance om-content sys-mail sv2 sv2-orders sv2-fin" dir="rtl">
  <OrdersAreaHead ctx={ctx} current="admin-notifications" title="דיוור" sub="כל מייל שהמערכת שולחת ללקוחות, לספקים ולצוות. מה שלא נשלח מסומן באדום. הודעות הדגמה לא יוצאות החוצה." action={<div className="om-top-actions"><button type="button" onClick={toMarketing}><Megaphone size={17} aria-hidden="true"/>רשימת דיוור שיווקי</button></div>}/>
  <div className="orders-reference-panel">
   {attention>0&&<div className="sm-alert" role="note">
    <span className="sm-alert-icon" aria-hidden="true"><AlertTriangle size={19}/></span>
    <div className="sm-alert-text"><b>{attention===1?'הודעה אחת לא נשלחה':attention+' הודעות לא נשלחו'}</b><p>{[failed&&plural(failed,'אחת נכשלה','נכשלו'),blocked&&plural(blocked,'אחת מחכה לחיבור הדוא״ל','מחכות לחיבור הדוא״ל'),requested&&plural(requested,'אחת ממתינה לשליחה','ממתינות לשליחה')].filter(Boolean).join(' · ')}. {blocked?'קודם מחברים את הדוא״ל, ואז ״ניסיון שליחה״.':'פותחים הודעה, בודקים את הסיבה ולוחצים ״ניסיון שליחה״.'}</p></div>
    <div className="sm-alert-actions">{view!=='attention'&&<button type="button" className="sm-btn" onClick={()=>pick('attention')}>הצגת ההודעות</button>}{blocked>0&&<ConnectionLink ctx={ctx}/>}</div>
   </div>}
   <div className="orders-reference-toolbar om-toolbar is-search"><OrderSearch label="חיפוש לפי נושא, נמען או תוכן" value={search} onChange={v=>{setSearch(v);reset();}}/></div>
   <OrderViews label="סינון לפי מצב ההודעה" value={view} onChange={pick} views={views}/>
   {state.loading&&!state.data?<div className="orders-reference-loading" role="status">טוען הודעות…</div>
   :state.error&&!state.data?<div className="orders-reference-error" role="alert"><p>{state.error}</p><button type="button" className="sm-btn" onClick={ctx.refresh}>ניסיון נוסף</button></div>
   :rows.length?<>
    <div className="om-head sm-head" aria-hidden="true"><span>הודעה</span><span>נמען</span><span>מצב</span><span>נוצרה</span><span/><span/></div>
    <div className="om-list" aria-label="הודעות דיוור">{rows.slice((shown-1)*20,shown*20).map(r=>{const l=look(r.status),line=rowLine(r),files=mailFiles(r),isOpen=open===r.id,result=results[r.id];
     return <OrderRecord key={r.id} id={r.id} tone={l.tone} label={r.subject||'הודעה ללא נושא'} open={isOpen} onToggle={()=>setOpen(isOpen?'':r.id)} panel={<MailPanel ctx={ctx} r={r} busy={busy} result={result} retry={retry}/>}>
      <div className="sm-msg"><b>{r.subject||'הודעה ללא נושא'}</b><span className={line.error?'is-error':undefined}>{line.text}</span></div>
      <div className="sm-to"><small className="om-phone-label">נמען</small><bdi dir="ltr">{r.to||'—'}</bdi></div>
      <div className="sm-state"><span className={'om-pill'+(l.pill?' is-'+l.pill:'')}>{l.label}</span>{files.length>0&&<span className="sm-clip" title={'קבצים: '+files.join(', ')}><Paperclip size={15} aria-hidden="true"/><span className="sm-sr">יש קבצים</span></span>}</div>
      <div className="sm-time"><bdi>{when(r.created)}</bdi></div>
      <div className="sm-act">{canRetry(r)&&<RetryButton busy={busy===r.id} disabled={!!busy} onClick={()=>retry(r)}/>}</div>
      {result&&!isOpen&&<p className={'sm-result is-'+result.tone} role="status">{result.text}</p>}
     </OrderRecord>;})}</div>
   </>
   :<div className="orders-reference-empty"><h3>{empty.title}</h3><p>{empty.text}</p>{search?<button type="button" className="sm-btn" onClick={()=>{setSearch('');reset();}}>ניקוי החיפוש</button>:view!=='all'&&all.length?<button type="button" className="sm-btn" onClick={()=>pick('all')}>הצגת כל ההודעות</button>:null}</div>}
   <OrderPager page={shown} total={rows.length} size={20} onChange={v=>{setPage(v);setOpen('');}}/>
   {all.length>=400&&<p className="om-note">מוצגות 400 ההודעות האחרונות.</p>}
  </div>
  <div id="sys-mail-marketing" className="sm-marketing" tabIndex={-1}><AdminMarketingList ctx={ctx}/></div>
 </section>;
}

function ConnectionLink({ctx}:{ctx:Ctx}){return <a className="sm-btn" href="/admin-connections" onClick={e=>{e.stopPropagation();if(!plainClick(e))return;e.preventDefault();ctx.go('admin-connections');}}><Plug size={16} aria-hidden="true"/>הגדרת חיבור הדוא״ל</a>;}

function RetryButton({busy,disabled,onClick}:{busy:boolean;disabled:boolean;onClick:()=>void}){
 return <button type="button" className={'om-btn om-action is-primary sm-retry'+(busy?' is-busy':'')} disabled={disabled} aria-busy={busy||undefined} onClick={e=>{e.stopPropagation();onClick();}}>{busy?<Loader2 className="om-spin" size={16} aria-hidden="true"/>:<RefreshCw size={16} aria-hidden="true"/>}<span>{busy?'שולח…':'ניסיון שליחה'}</span></button>;
}

function MailPanel({ctx,r,busy,result,retry}:{ctx:Ctx;r:Row;busy:string;result?:Result;retry:(r:Row)=>void}){
 const files=mailFiles(r),html=typeof r.html==='string'&&r.html.trim()?r.html:'';
 const openArticle=(e:React.MouseEvent)=>{if(!plainClick(e))return;e.preventDefault();ctx.go('admin-article/'+r.article_id);};
 return <div className="sm-panel">
  {r.status==='failed'&&<section className="sm-note is-red"><AlertTriangle size={18} aria-hidden="true"/><div><b>סיבת הכישלון</b><p>{r.delivery_error||'שירות הדיוור לא החזיר סיבה.'}</p></div></section>}
  {r.status==='blocked'&&<section className="sm-note is-wait"><Plug size={18} aria-hidden="true"/><div><b>חיבור הדוא״ל לא פעיל</b><p>ההודעה לא יצאה. אחרי שמחברים את הדוא״ל, לוחצים ״ניסיון שליחה״.</p></div></section>}
  {r.status==='demo'&&<section className="sm-note"><div><b>הודעת הדגמה</b><p>לא נשלח מייל אמיתי.</p></div></section>}
  {r.status!=='failed'&&r.delivery_error&&<p className="sm-prev-error">שגיאה מניסיון קודם: {r.delivery_error}</p>}
  <section className="sm-mail" aria-label="תוכן המייל">
   <dl className="sm-fields"><div><dt>אל</dt><dd><bdi dir="ltr">{r.to||'—'}</bdi></dd></div><div><dt>נושא</dt><dd>{r.subject||'ללא נושא'}</dd></div></dl>
   <p className="sm-text" dir="rtl">{r.text||'אין תוכן טקסט.'}</p>
   {r.button?.url&&<div className="sm-link"><a className="sm-mail-button" href={r.button.url} target="_blank" rel="noopener noreferrer"><span>{r.button.label||'קישור'}</span><ExternalLink size={15} aria-hidden="true"/></a><bdi dir="ltr" className="sm-url">{r.button.url}</bdi></div>}
   {files.length>0&&<div className="sm-files"><h4><Paperclip size={15} aria-hidden="true"/>קבצים במייל</h4><ul>{files.map(f=><li key={f}><FileText size={15} aria-hidden="true"/>{f}</li>)}</ul>{r.file_token&&<small>במייל נשלחו גם קישורי הורדה, בתוקף 45 יום.</small>}</div>}
   {r.attach_article&&<p className="sm-hint">במייל לספק, הנושא והתוכן נבנים מחדש מפרטי הכתבה בכל שליחה.</p>}
   {html&&<details className="sm-html"><summary>תצוגת המייל המעוצב</summary><iframe sandbox="" srcDoc={html} title={'תצוגת המייל: '+(r.subject||'')} loading="lazy"/></details>}
  </section>
  <p className="sm-meta">נוצרה <bdi>{when(r.created)}</bdi>{r.updated&&r.updated!==r.created&&<> · עודכנה <bdi>{when(r.updated)}</bdi></>}{r.article_id&&<> · <a href={'/admin-article/'+r.article_id} onClick={openArticle}>פתיחת הכתבה</a></>}</p>
  {result&&<p className={'sm-result is-'+result.tone} role="status">{result.text}</p>}
  {canRetry(r)&&<footer className="om-panel-foot">{canRetry(r)&&<RetryButton busy={busy===r.id} disabled={!!busy} onClick={()=>retry(r)}/>}{['blocked','failed'].includes(r.status)&&<ConnectionLink ctx={ctx}/>}</footer>}
 </div>;
}
