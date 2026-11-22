'use client';
import React,{useState} from 'react';
import {Check,ExternalLink,Send,X} from 'lucide-react';
import {Textarea} from '@/components/ui/textarea';
import {api} from '@/lib/client';
import type {AdminStudio} from './admin-article-decision';
import './admin-supplier-issue.css';
import './admin-link-review.css';

// Owner decision (23.11.2026): the supplier sent the published link, but the site did not let our automatic check
// read the page. The admin opens the link, checks by eye that the article and its links are online, and decides:
// "אישור הקישור" -> the normal published flow (the customer gets the published e-mail only now);
// "דחייה" -> back to the supplier with the admin's reason (link page and e-mail), who can send a corrected link.
const when=(s?:string)=>{const d=new Date(s||'');return Number.isNaN(+d)?'':new Intl.DateTimeFormat('he-IL',{timeZone:'Asia/Jerusalem',day:'numeric',month:'numeric',hour:'2-digit',minute:'2-digit'}).format(d);};

export function LinkReviewBox({s}:{s:AdminStudio}){
 const {id,a,busy}=s,r=a.link_review,[rejecting,setRejecting]=useState(false),[note,setNote]=useState('');
 if(!r)return null;
 const approve=()=>s.act(()=>api('articles/'+id+'/link-review','POST',{decision:'approve'}),'הקישור אושר. הכתבה סומנה כפורסמה, והלקוח קיבל עדכון');
 const reject=()=>s.act(async()=>{const res=await api('articles/'+id+'/link-review','POST',{decision:'reject',note:note.trim()});setRejecting(false);setNote('');return res;},
  (res:any)=>'הקישור הוחזר לספק'+(res?.supplier_mail==='failed'?'. המייל לספק לא נשלח, אפשר לבדוק בדיוור.':res?.supplier_mail==='blocked'?'. המייל לספק ממתין להגדרות הדיוור.':', והוא קיבל את ההסבר במייל'));
 return <div className="ar-sect sxa lrv" role="region" aria-label="קישור ממתין לבדיקה ידנית">
  <span className="sxa-pill lrv-pill">ממתין לבדיקה ידנית</span>
  <p className="sxa-head"><b>הספק שלח קישור, והמערכת לא הצליחה לבדוק אותו.</b> {r.reason||'האתר לא אפשר לבדוק את הדף אוטומטית.'}</p>
  <a className="lrv-link" href={r.url} target="_blank" rel="noopener noreferrer"><span className="lrv-link-text"><small>הקישור מהספק{r.at?' · '+when(r.at):''}</small><bdi dir="ltr">{r.url}</bdi></span><ExternalLink size={17} aria-hidden="true"/></a>
  <p className="sxa-fine">פותחים את הקישור ובודקים שהכתבה עלתה באתר הנכון ושהקישורים של הלקוח מופיעים בה.</p>
  {rejecting?<div className="sxa-answer">
   <label htmlFor="lrv-note">מה לא תקין בקישור? <small>נשלח לספק במייל</small></label>
   <Textarea id="lrv-note" dir="rtl" className="ar-textarea" maxLength={1500} autoFocus value={note} onChange={e=>setNote(e.target.value)} placeholder="למשל: הכתבה עדיין לא מופיעה באתר, או שחסר הקישור ללקוח"/>
   <div className="ar-row"><button type="button" className="ar-btn sxa-danger" disabled={busy||note.trim().length<2} onClick={reject}><Send size={15} aria-hidden="true"/>דחייה ושליחה לספק</button><button type="button" className="ar-btn" disabled={busy} onClick={()=>{setRejecting(false);setNote('');}}><X size={15} aria-hidden="true"/>ביטול</button></div>
  </div>:<div className="ar-row">
   <button type="button" className="ar-btn ar-primary" disabled={busy} onClick={approve}><Check size={15} aria-hidden="true"/>אישור הקישור</button>
   <button type="button" className="ar-btn" disabled={busy} onClick={()=>setRejecting(true)}><X size={15} aria-hidden="true"/>דחייה</button>
  </div>}
  {!rejecting&&<p className="sxa-fine">"אישור" מסמן את הכתבה כפורסמה ושולח ללקוח את המייל שהכתבה פורסמה. "דחייה" מחזירה את הקישור לספק עם ההסבר שלך.</p>}
 </div>;
}
