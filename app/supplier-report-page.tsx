'use client';
import React,{useRef,useState} from 'react';
import {Check,Clock,ExternalLink,Globe,Link2,Loader2,Lock,TriangleAlert} from 'lucide-react';
import {api,useData} from '@/lib/client';
import BrandLogo from './brand-logo';
import './supplier-report-page.css';
import {SupplierIssueChooser,SupplierIssueWaiting,type Issue} from './supplier-issue';

// Owner decision (11.11.2026): the supplier gets all details and files by email. This page only takes the
// published address, the system checks it, and after a valid link the page (and the link) is closed.
// Look: the site's Apple-style customer area and the "paid" confirmation screen (same animated tick).
function Tick(){return <div className="srp-mark" aria-hidden="true"><svg viewBox="0 0 84 84"><circle className="srp-ring" cx="42" cy="42" r="38"/><circle className="srp-disc" cx="42" cy="42" r="30"/><path className="srp-tick" d="M29 43l9 9 17-19"/></svg></div>;}
// Owner request (22.11.2026): the card shows the full article title and a link to the site where it must be published.
function siteLink(value:string){try{const u=new URL(/^https?:\/\//i.test(value)?value:'https://'+value);return ['http:','https:'].includes(u.protocol)?{href:u.href,host:u.hostname.replace(/^www\./,'')}:null;}catch{return null;}}
function ArticleCard({a}:{a:{title?:string,website_name?:string,website_url?:string}}){
 const site=siteLink(a.website_url||'');
 return <div className="srp-article"><span>נושא הכתבה</span><strong>{a.title}</strong>
  {site?<a className="srp-site" href={site.href} target="_blank" rel="noopener noreferrer"><span className="srp-site-icon" aria-hidden="true"><Globe size={18}/></span><span className="srp-site-text"><small>האתר שבו מפרסמים</small><b>{a.website_name||site.host}</b><span dir="ltr">{site.host}</span></span><ExternalLink className="srp-site-go" size={17} aria-hidden="true"/></a>
  :a.website_name&&<p className="srp-site is-plain"><span className="srp-site-text"><small>האתר שבו מפרסמים</small><b>{a.website_name}</b></span></p>}
 </div>;
}
const checks=['הדף נפתח באתר','הקישורים מהכתבה מופיעים בדף','נושא הדף תואם לכתבה'];
export default function SupplierReportPage({token}:{token:string}){
 const state=useData('supplier/'+encodeURIComponent(token));
 const [url,setUrl]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[sent,setSent]=useState(''),lock=useRef(false);
 const a=state.data?.article,closed=!!state.data?.closed||!!sent,published=sent||a?.published_url||'';
 const submit=async(e:React.FormEvent)=>{e.preventDefault();if(lock.current)return;const value=url.trim();if(!value){setError('יש להדביק את הקישור לכתבה שפורסמה');return;}lock.current=true;setBusy(true);setError('');try{await api('supplier/'+encodeURIComponent(token),'POST',{url:value});setSent(value);}catch(err){setError((err as Error).message);}finally{lock.current=false;setBusy(false);}};
 const [sentIssue,setSentIssue]=useState<Issue|null>(null),issue:Issue|null=sentIssue||a?.issue||null;
 const article=a&&<ArticleCard a={a}/>;
 let body:React.ReactNode;
 if(state.loading&&!state.data&&!state.error)body=<p className="srp-loading" role="status"><Loader2 className="srp-spin" size={20} aria-hidden="true"/>טוען…</p>;
 else if(!a&&!sent)body=<div className="srp-hero"><div className="srp-alert-mark" aria-hidden="true"><TriangleAlert size={34}/></div><h1>לא ניתן לפתוח את הקישור</h1><p>{state.error||'הקישור אינו תקין.'}</p></div>;
 else if(closed)body=<>
  <div className="srp-hero"><Tick/><span className="srp-pill is-ok"><span className="srp-dot"/>אושר · הכתבה פורסמה</span><h1>הקישור אושר. תודה!</h1><p>בדקנו את הכתבה באתר והכול תקין. הכתבה סומנה כפורסמה, ואין צורך לעשות דבר נוסף.</p></div>
  {article}
  <ol className="srp-steps">{['הקישור התקבל ונבדק','הכתבה סומנה כפורסמה','הלקוח קיבל עדכון'].map(t=><li key={t}><span className="srp-node"><Check size={15} strokeWidth={3}/></span><b>{t}</b></li>)}</ol>
  {published&&<a className="srp-published" href={published} target="_blank" rel="noopener noreferrer" dir="ltr">{published}</a>}
  <p className="srp-closed"><Lock size={15} aria-hidden="true"/>הקישור האישי הזה סגור</p>
 </>;
 else if(a.waiting_fixes)body=<SupplierHold article={article}/>;
 else if(issue?.open)body=<SupplierIssueWaiting issue={issue} article={article}/>;
 else{const linkForm=<form className="srp-form" onSubmit={submit} noValidate>
  {a.cancel_pending&&<>
  <div className="srp-hero is-form"><span className="srp-pill is-check"><span className="srp-dot"/>קישור אישי לכתבה אחת</span><h1>הכתבה עלתה? שלחו לנו את הקישור.</h1><p>מדביקים את הכתובת של הכתבה באתר, ואנחנו בודקים ומאשרים תוך כמה שניות.</p></div>
  {article}
  <p className="srp-alert" role="alert">התקבלה בקשת ביטול לכתבה הזו. אין לפרסם אותה עד שנחזור אליכם.</p></>}
  <label className="srp-field"><span>הקישור לכתבה באתר</span><span className="srp-input"><Link2 size={19} aria-hidden="true"/><input type="url" dir="ltr" inputMode="url" autoComplete="off" placeholder="https://" value={url} disabled={busy||!!a.cancel_pending} onChange={e=>{setUrl(e.target.value);setError('');}}/></span></label>
  {error&&<p className="srp-alert" role="alert">{error}</p>}
  <button type="submit" className="srp-button" disabled={busy||!!a.cancel_pending}>{busy?<><Loader2 className="srp-spin" size={19} aria-hidden="true"/>בודקים את הקישור…</>:'שליחת הקישור לבדיקה'}</button>
  <ul className={'srp-checks'+(busy?' is-busy':'')} aria-label="מה נבדק">{checks.map(t=><li key={t}><span className="srp-check-dot" aria-hidden="true"/>{t}</li>)}</ul>
  <p className="srp-hint">כל פרטי הכתבה והקבצים נמצאים במייל שקיבלתם.</p>
 </form>;
 // Owner decision (22.11.2026): next to the link, the supplier can ask for fixes or ask to reject (supplier-issue.tsx).
 // While a cancellation is pending only today's form shows: nothing should be published or requested then.
 body=a.cancel_pending?linkForm:<div className="srp-form"><SupplierIssueChooser token={token} issue={issue} article={article} linkForm={linkForm} onSent={setSentIssue}/></div>;}
 return <main className="srp" dir="rtl"><div className="srp-card"><header className="srp-head"><BrandLogo className="srp-logo"/></header><div className="srp-body">{body}</div></div><p className="srp-foot">Mega Links · בניית קישורים וכתבות</p></main>;
}

// Owner decision (22.11.2026): the article went back to the customer for fixes ("waiting_fixes": a key with "supplier" in it is hidden by the privacy filter). The link stays alive and,
// instead of the paste field, asks the supplier to wait; the field comes back with the updated version.
function SupplierHold({article}:{article:React.ReactNode}){
 const steps:[string,boolean][]=[['הלקוח מתקן את הכתבה',true],['אנחנו שולחים לכם הנחיות מעודכנות',false],['מפרסמים ושולחים את הקישור כאן',false]];
 return <>
  <div className="srp-hero"><div className="srp-alert-mark is-wait" aria-hidden="true"><Clock size={34}/></div><span className="srp-pill is-wait"><span className="srp-dot"/>ממתינה לתיקונים של הלקוח</span><h1>נא להמתין עם פרסום הכתבה</h1><p>הכתבה חזרה ללקוח לתיקונים. כשהתיקונים יאושרו, נשלח לכם הנחיות מעודכנות במייל, והדף הזה ייפתח שוב לשליחת הקישור.</p></div>
  {article}
  <ol className="srp-wait-steps">{steps.map(([t,on],i)=><li key={t} data-on={on||undefined}><span>{i+1}</span><b>{t}</b></li>)}</ol>
  <p className="srp-closed">אין צורך לעשות דבר כרגע</p>
 </>;
}
