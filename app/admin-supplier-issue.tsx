'use client';
import React,{useState} from 'react';
import {RotateCw,Send,X,XCircle} from 'lucide-react';
import {Textarea} from '@/components/ui/textarea';
import {api} from '@/lib/client';
import {openCancelFocus} from './cancel-focus';
import type {AdminStudio} from './admin-article-decision';
import './admin-supplier-issue.css';

// Owner decision (22.11.2026): the supplier asked for fixes or asked to reject the article. Nothing changed in the
// order; the admin decides here. Fixes: return the article to the customer (the "החזרה לעריכה" action below opens
// with the supplier's words) or let the supplier publish as is. Rejection: the existing cancel-and-refund window, or
// refuse. "Publish as is" and "refuse" need a note, which the supplier receives by e-mail.
export const REOPEN_OPEN_EVENT='ar-reopen-open';
const when=(s?:string)=>{const d=new Date(s||'');return Number.isNaN(+d)?'':new Intl.DateTimeFormat('he-IL',{timeZone:'Asia/Jerusalem',day:'numeric',month:'numeric',hour:'2-digit',minute:'2-digit'}).format(d);};

export function SupplierIssueBox({s}:{s:AdminStudio}){
 const {ctx,id,a,busy}=s,r=a.issue_request,[answering,setAnswering]=useState(false),[note,setNote]=useState('');
 if(!r)return null;
 const reject=r.type==='reject';
 const reopen=()=>window.dispatchEvent(new CustomEvent(REOPEN_OPEN_EVENT,{detail:{note:'הספק ביקש תיקונים:\n'+r.text}}));
 const answer=()=>s.act(async()=>{const res=await api('articles/'+id+'/supplier-issue','POST',{note:note.trim()});setAnswering(false);setNote('');return res;},
  (res:any)=>(reject?'הבקשה סורבה':'הבקשה נסגרה')+(res?.supplier_mail==='failed'?'. המייל לספק לא נשלח, אפשר לבדוק בדיוור.':res?.supplier_mail==='blocked'?'. המייל לספק ממתין להגדרות הדיוור.':', והספק קיבל את ההערה במייל'));
 return <div className={'ar-sect sxa'+(reject?' is-reject':'')} role="region" aria-label="בקשה מהספק">
  <span className="sxa-pill">{reject?'הספק ביקש לדחות':'הספק ביקש תיקונים'}</span>
  <p className="sxa-head"><b>{reject?'הכתבה עדיין פעילה.':'הספק לא פרסם עדיין.'}</b> {reject?'אין ביטול ואין זיכוי עד שתאשר. הלקוח לא יודע על הבקשה.':'הספק מחכה לתשובה שלך. שום דבר לא השתנה בהזמנה.'}</p>
  <div className="sxa-quote"><small>מה הספק כתב{r.at?' · '+when(r.at):''}</small><p>{r.text}</p></div>
  {answering?<div className="sxa-answer">
   <label htmlFor="sxa-note">{reject?'למה הבקשה נדחתה?':'מה לכתוב לספק?'} <small>נשלח אליו במייל</small></label>
   <Textarea id="sxa-note" dir="rtl" className="ar-textarea" maxLength={1500} autoFocus value={note} onChange={e=>setNote(e.target.value)} placeholder={reject?'למשל: הנושא אושר מול בעל האתר, אפשר לפרסם':'למשל: הקישור תקין, אפשר לפרסם כמו שהיא'}/>
   <div className="ar-row"><button type="button" className="ar-btn ar-primary" disabled={busy||note.trim().length<2} onClick={answer}><Send size={15} aria-hidden="true"/>{reject?'סירוב ושליחה לספק':'סגירה ושליחה לספק'}</button><button type="button" className="ar-btn" disabled={busy} onClick={()=>{setAnswering(false);setNote('');}}><X size={15} aria-hidden="true"/>ביטול</button></div>
  </div>:<div className="ar-row">
   {reject?<button type="button" className="ar-btn sxa-danger" disabled={busy} onClick={()=>openCancelFocus(ctx,a.id)}><XCircle size={15} aria-hidden="true"/>אישור ביטול וזיכוי</button>
    :<button type="button" className="ar-btn ar-warn" disabled={busy} onClick={reopen}><RotateCw size={15} aria-hidden="true"/>החזרה לעריכה של הלקוח</button>}
   <button type="button" className="ar-btn" disabled={busy} onClick={()=>setAnswering(true)}>{reject?'סירוב, הספק יפרסם':'הספק יפרסם כמו שהיא'}</button>
  </div>}
  {!answering&&<p className="sxa-fine">{reject?'"אישור" פותח את חלון הביטול והזיכוי הקיים. "סירוב" מבקש הערה, והספק מקבל אותה במייל ויכול לפרסם.':'"החזרה לעריכה" שולחת ללקוח את בקשת הספק. "יפרסם כמו שהיא" סוגר את הבקשה, והספק מקבל מייל עם ההערה שלך.'}</p>}
 </div>;
}
