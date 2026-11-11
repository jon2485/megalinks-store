'use client';
import React,{useRef,useState} from 'react';
import {CheckCircle2,Link2,Loader2,TriangleAlert} from 'lucide-react';
import {api,useData} from '@/lib/client';
import BrandLogo from './brand-logo';
import './supplier-report-page.css';

// Owner decision (11.11.2026): the supplier gets all details and files by email. This page only takes the
// published address, the system checks it, and after a valid link the page (and the link) is closed.
export default function SupplierReportPage({token}:{token:string}){
 const state=useData('supplier/'+encodeURIComponent(token));
 const [url,setUrl]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[sent,setSent]=useState(''),lock=useRef(false);
 const a=state.data?.article,closed=!!state.data?.closed||!!sent,published=sent||a?.published_url||'';
 const submit=async(e:React.FormEvent)=>{e.preventDefault();if(lock.current)return;const value=url.trim();if(!value){setError('יש להדביק את הקישור לכתבה שפורסמה');return;}lock.current=true;setBusy(true);setError('');try{await api('supplier/'+encodeURIComponent(token),'POST',{url:value});setSent(value);}catch(err){setError((err as Error).message);}finally{lock.current=false;setBusy(false);}};
 let body:React.ReactNode;
 if(state.loading&&!state.data&&!state.error)body=<p className="srp-status" role="status"><Loader2 className="srp-spin" size={20} aria-hidden="true"/>טוען…</p>;
 else if(!a&&!sent)body=<div className="srp-message is-error" role="alert"><TriangleAlert size={34} aria-hidden="true"/><h1>לא ניתן לפתוח את הקישור</h1><p>{state.error||'הקישור אינו תקין.'}</p></div>;
 else if(closed)body=<div className="srp-message is-done" role="status"><CheckCircle2 size={44} aria-hidden="true"/><h1>הכתבה סומנה כפורסמה</h1><p>הקישור נבדק ונמצא תקין. תודה! אין צורך לעשות דבר נוסף, והקישור הזה סגור.</p>{a&&<div className="srp-article"><span>{a.website_name}</span><strong>{a.title}</strong></div>}{published&&<a className="srp-published" href={published} target="_blank" rel="noopener noreferrer" dir="ltr">{published}</a>}</div>;
 else body=<form className="srp-form" onSubmit={submit} noValidate>
  <h1>שליחת הקישור לכתבה שפורסמה</h1>
  <div className="srp-article"><span>{a.website_name}</span><strong>{a.title}</strong></div>
  {a.cancel_pending&&<p className="srp-alert" role="alert">התקבלה בקשת ביטול לכתבה הזו. אין לפרסם אותה עד שנחזור אליכם.</p>}
  <label className="srp-field"><span>הקישור לכתבה באתר</span><span className="srp-input"><Link2 size={19} aria-hidden="true"/><input type="url" dir="ltr" inputMode="url" autoComplete="off" placeholder="https://" value={url} disabled={busy||!!a.cancel_pending} onChange={e=>{setUrl(e.target.value);setError('');}}/></span></label>
  {error&&<p className="srp-alert" role="alert">{error}</p>}
  <button type="submit" className="srp-button" disabled={busy||!!a.cancel_pending}>{busy?<><Loader2 className="srp-spin" size={19} aria-hidden="true"/>בודקים את הקישור…</>:'שליחת הקישור לבדיקה'}</button>
  <p className="srp-hint">המערכת בודקת שהדף נפתח, שהקישורים מהכתבה מופיעים בו ושהנושא תואם. כל פרטי הכתבה והקבצים נמצאים במייל שקיבלתם.</p>
 </form>;
 return <main className="srp" dir="rtl"><div className="srp-card"><header className="srp-head"><BrandLogo light className="srp-logo"/></header><div className="srp-body">{body}</div></div><p className="srp-foot">Mega Links · קישור אישי לכתבה אחת</p></main>;
}
