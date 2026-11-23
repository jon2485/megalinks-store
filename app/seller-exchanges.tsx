'use client';
// "החלפות" for an exchange supplier (owner 23.11.2026, spec docs/exchange-suppliers-spec.md): how many exchanges are
// waiting, every publication with what was taken in return, and picking a site. No prices anywhere: the server sends none.
import React,{useMemo,useRef,useState} from 'react';
import {ArrowLeftRight,Check,ChevronLeft,ExternalLink,Plus,Search} from 'lucide-react';
import {api,useData} from '@/lib/client';
import type {Row} from '@/lib/shared';
import {type Ctx,ErrorBox} from './workspace';
import './seller-exchanges.css';

const day=(v:unknown)=>{const d=new Date(String(v||''));return isNaN(+d)?'':new Intl.DateTimeFormat('he-IL',{timeZone:'Asia/Jerusalem',day:'2-digit',month:'2-digit',year:'numeric'}).format(d);};
const host=(u:unknown)=>{try{return new URL(String(u)).host.replace(/^www\./,'');}catch{return String(u||'');}};
function targetState(x:Row){
 if(x.status==='open')return ['ממתינה לבחירה','open'];
 if(x.target_status==='published')return ['הושלמה','ok'];
 if(['draft','writing','customer_review','awaiting_brief','with_customer'].includes(String(x.target_status)))return ['ממתין לתוכן שלכם','wait'];
 if(x.target_status==='sent'||x.target_status==='approved')return ['אצל האתר לפרסום','wait'];
 return ['בבדיקה','wait'];
}

export function SellerExchanges({ctx,data}:{ctx:Ctx;data:Row}){
 const picker=()=>ctx.open({title:'בחירת אתר בתמורה',description:'האתרים שאפשר לקחת בהחלפה',kind:'seller',sky:true,render:(close:()=>void)=><ExchangePicker ctx={ctx} balance={data.balance} next={(data.exchanges||[]).filter((x:Row)=>x.status==='open').slice(-1)[0]} close={close}/>});
 const rows:Row[]=data.exchanges||[];
 return <section className="sx" dir="rtl" aria-label="החלפות">
  <div className="sx-card sx-bal">
   <div className="sx-big"><b>{Math.max(0,data.balance)}</b><span>{data.balance===1?'החלפה זמינה לבחירה':'החלפות זמינות לבחירה'}</span></div>
   <div className="sx-stats"><div><small>פרסמתם אצלכם</small><b>{data.published}</b></div><div><small>קיבלתם בתמורה</small><b>{data.taken}</b></div></div>
   <button type="button" className="sx-btn" disabled={data.balance<1} onClick={picker}><Plus size={18} aria-hidden="true"/>בחירת אתר בתמורה</button>
   {data.balance<0?<p className="sx-hint">כתבה שפרסמתם בוטלה אחרי שכבר קיבלתם קישור בתמורה לה. הפרסום הבא שלכם יכסה את הקישור הזה.</p>:data.balance<1&&<p className="sx-hint">החלפה חדשה נפתחת אחרי שכתבה שפרסמתם מאושרת.</p>}
  </div>
  <p className="sx-note">כל כתבה שפרסמתם אצלכם ואושרה שווה קישור אחד בתמורה, באתר שתבחרו מהרשימה.</p>
  <h3 className="sx-h">ההחלפות שלי</h3>
  {!rows.length&&<div className="sx-card sx-empty"><ArrowLeftRight size={22} aria-hidden="true"/><p>עדיין אין החלפות. אחרי שתפרסמו כתבה שקיבלתם מאיתנו והקישור יאושר, היא תופיע כאן.</p></div>}
  {rows.map(x=>{const [label,tone]=targetState(x);return <article key={x.id} className="sx-card sx-pair">
   <div className="sx-hd"><span>החלפה {x.n}</span><span className={'sx-pill is-'+tone}>{tone==='ok'&&<Check size={13} aria-hidden="true"/>}{label}</span></div>
   <div className="sx-row"><span className="sx-k">פרסמתם</span><span className="sx-v">{x.source_title?<><b>{x.source_title}</b><small>{host(x.source_site_url||x.source_url)} · {day(x.earned_at)}</small></>:<b>החלפה שנוספה ידנית</b>}</span></div>
   <div className="sx-row"><span className="sx-k">בתמורה</span><span className="sx-v">{x.status==='open'?<button type="button" className="sx-btn is-quiet" onClick={picker}>בחירת אתר</button>:<>
    <b>{x.target_site}</b><small>{x.target_url?<a href={x.target_url} target="_blank" rel="noreferrer">{host(x.target_site_url)} · פורסם <ExternalLink size={12} aria-hidden="true"/></a>:host(x.target_site_url)}</small>
    {tone==='wait'&&x.target_article_id&&<button type="button" className="sx-btn is-quiet" onClick={()=>ctx.go('article/'+x.target_article_id)}>המשך לכתבה<ChevronLeft size={16} aria-hidden="true"/></button>}</>}</span></div>
  </article>;})}
 </section>;
}

function ExchangePicker({ctx,balance,next,close}:{ctx:Ctx;balance:number;next?:Row;close:()=>void}){
 const state=useData('selling/exchanges/sites'),[q,setQ]=useState(''),[pick,setPick]=useState<Row|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),request=useRef(crypto.randomUUID());
 const sites:Row[]=useMemo(()=>{const t=q.trim().toLowerCase();return (state.data?.sites||[]).filter((s:Row)=>!t||(s.name+' '+s.url+' '+(s.category||'')).toLowerCase().includes(t));},[state.data,q]);
 const take=async()=>{if(!pick||busy)return;setBusy(true);setError('');try{const res=await api('selling/exchanges/take','POST',{website_id:pick.id,request_id:request.current});close();ctx.refresh();
   const order=await api('orders/'+res.order_id).catch(()=>null);const article=order?.articles?.[0]?.id;ctx.go(article?'article/'+article:'purchased/orders');}catch(e){setError((e as Error).message);request.current=crypto.randomUUID();}finally{setBusy(false);}};
 if(pick)return <div className="sx-sheet">
  <h2>לקחת את "{pick.name}" בתמורה?</h2>
  <p>ההחלפה תנוצל{balance>1?', ותישארו עם '+(balance-1===1?'החלפה אחת נוספת':(balance-1)+' החלפות נוספות')+' לבחירה':''}.</p>
  <dl className="sx-facts">{next?.source_title&&<div><dt>פרסמתם אצלכם</dt><dd>{next.source_title}</dd></div>}<div><dt>תקבלו בתמורה</dt><dd>כתבה עם קישור באתר <bdi>{host(pick.url)}</bdi></dd></div><div><dt>תשלום</dt><dd>ללא תשלום · החלפה</dd></div></dl>
  <ErrorBox error={error}/>
  <button type="button" className="sx-btn" disabled={busy} onClick={take}>{busy?'פותחים את ההזמנה…':'אישור והמשך לכתבה'}</button>
  <button type="button" className="sx-btn is-grey" disabled={busy} onClick={()=>setPick(null)}>חזרה לרשימה</button>
  <p className="sx-hint">במסך הבא מעלים או כותבים את תוכן הכתבה (כתיבה עם AI בחינם). תקבלו מייל כשהיא תפורסם.</p>
 </div>;
 return <div className="sx-pick">
  {next?.source_title&&<p className="sx-for">בתמורה לפרסום: <b>{next.source_title}</b>{next.earned_at?' ('+day(next.earned_at)+')':''}</p>}
  <label className="sx-search"><Search size={17} aria-hidden="true"/><input className="sx-q" value={q} onChange={e=>setQ(e.target.value)} placeholder="חיפוש אתר או תחום" aria-label="חיפוש אתר או תחום"/></label>
  <ErrorBox error={state.error}/>{state.loading&&<p role="status">טוען אתרים…</p>}
  {!state.loading&&!sites.length&&<p className="sx-hint">{q?'לא נמצאו אתרים בחיפוש הזה.':'עדיין אין אתרים פתוחים להחלפה.'}</p>}
  <ul className="sx-sites">{sites.map(s=><li key={s.id} className="sx-card sx-site">
   <span className="sx-logo" aria-hidden="true">{s.logo_url?<img src={s.logo_url} alt=""/>:String(s.name||'?').slice(0,1)}</span>
   <span className="sx-sn"><b>{s.name}</b><small dir="ltr">{host(s.url)}</small>{(s.category||s.dr)&&<span className="sx-chips">{s.dr?<span>DR {s.dr}</span>:null}</span>}</span>
   <button type="button" className="sx-take" onClick={()=>setPick(s)}>לקחת בהחלפה</button></li>)}</ul>
 </div>;
}
