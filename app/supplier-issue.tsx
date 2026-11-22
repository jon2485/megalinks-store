'use client';
import React,{useEffect,useRef,useState} from 'react';
import {Clock,Loader2,Lock,MessageSquareText} from 'lucide-react';
import {api} from '@/lib/client';
import './supplier-issue.css';

// Owner decision (22.11.2026): one personal link, three options. Adding the published link (today's form), asking
// for fixes, or asking to reject the article. A request only reaches the admin: nothing is cancelled or refunded,
// and the customer is not told. The e-mail's secondary link opens this page on "#issue" (request fixes).
export type Issue={open:boolean;type:'fix'|'reject';text?:string;answer?:string;at?:string};
type Mode='link'|'fix'|'reject';
const options:[Mode,string][]=[['link','הוספת קישור'],['fix','בקשת תיקונים'],['reject','דחיית הכתבה']];
const when=(s?:string)=>{const d=new Date(s||'');return Number.isNaN(+d)?'':new Intl.DateTimeFormat('he-IL',{timeZone:'Asia/Jerusalem',day:'numeric',month:'numeric',hour:'2-digit',minute:'2-digit'}).format(d);};

/** The three options. `linkForm` is today's paste form, shown on the first option. */
export function SupplierIssueChooser({token,issue,article,linkForm,onSent}:{token:string;issue:Issue|null;article:React.ReactNode;linkForm:React.ReactNode;onSent:(i:Issue)=>void}){
 const [mode,setMode]=useState<Mode>('link'),[text,setText]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),lock=useRef(false),area=useRef<HTMLTextAreaElement>(null);
 useEffect(()=>{if(window.location.hash==='#issue'){setMode('fix');requestAnimationFrame(()=>area.current?.focus());}},[]);
 const pick=(m:Mode)=>{setMode(m);setError('');if(m!=='link')requestAnimationFrame(()=>area.current?.focus());};
 const send=async(e:React.FormEvent)=>{e.preventDefault();if(lock.current||mode==='link')return;const value=text.trim();
  if(value.length<5){setError(mode==='fix'?'יש לכתוב מה צריך לתקן':'יש לכתוב למה אי אפשר לפרסם את הכתבה');area.current?.focus();return;}
  lock.current=true;setBusy(true);setError('');
  try{const r=await api('supplier/'+encodeURIComponent(token),'POST',{issue:mode,text:value});onSent(r.issue||{open:true,type:mode,text:value,at:new Date().toISOString()});}
  catch(err){setError((err as Error).message);}finally{lock.current=false;setBusy(false);}};
 const reject=mode==='reject';
 return <>
  <div className="srp-hero is-form"><span className="srp-pill is-check"><span className="srp-dot"/>קישור אישי לכתבה אחת</span><h1>מה תרצו לעשות עם הכתבה?</h1><p>שולחים קישור אחרי הפרסום, או כותבים לנו אם יש בעיה.</p></div>
  {article}
  {issue&&!issue.open&&issue.answer&&<div className="sxi-answer" role="status"><span><MessageSquareText size={15} aria-hidden="true"/>התשובה שלנו לבקשה שלכם{issue.at?' · '+when(issue.at):''}</span><p>{issue.answer}</p></div>}
  <div className="sxi-seg" role="radiogroup" aria-label="מה תרצו לעשות">{options.map(([m,label])=><button key={m} type="button" role="radio" aria-checked={mode===m} className={mode===m?'is-on'+(m==='reject'?' is-red':''):''} disabled={busy} onClick={()=>pick(m)}>{label}</button>)}</div>
  {mode==='link'?linkForm:<form className="srp-form" onSubmit={send} noValidate>
   <label className="sxi-field"><span>{reject?'למה לא ניתן לפרסם?':'מה צריך לתקן?'}</span>
    <textarea ref={area} dir="rtl" rows={4} maxLength={1500} value={text} disabled={busy} placeholder={reject?'למשל: הנושא לא מתאים לאתר שלנו':'למשל: הקישור השני מוביל לעמוד שלא קיים'} onChange={e=>{setText(e.target.value);setError('');}}/>
    <small>{reject?'זו בקשה בלבד. הכתבה לא מתבטלת עד שהמנהל מאשר.':'הבקשה עוברת למנהל. הוא יחליט ויחזור אליכם.'}</small></label>
   {error&&<p className="srp-alert" role="alert">{error}</p>}
   <button type="submit" className={'srp-button'+(reject?' sxi-red':'')} disabled={busy}>{busy?<><Loader2 className="srp-spin" size={19} aria-hidden="true"/>שולחים…</>:reject?'שליחת בקשת הדחייה למנהל':'שליחת הבקשה למנהל'}</button>
  </form>}
 </>;
}

/** After a request was sent: it waits for the admin, the options are hidden and nothing more can be sent. */
export function SupplierIssueWaiting({issue,article}:{issue:Issue;article:React.ReactNode}){
 return <>
  <div className="srp-hero"><div className="sxi-wait" aria-hidden="true"><Clock size={36}/></div><span className="srp-pill sxi-pill"><span className="srp-dot"/>ממתין לתשובת המנהל</span><h1>הבקשה נשלחה</h1><p>המנהל יבדוק את הבקשה ויחזור אליכם במייל. בינתיים לא לפרסם את הכתבה.</p></div>
  {article}
  <div className="sxi-sent"><span>{issue.type==='reject'?'ביקשתם לדחות את הכתבה':'ביקשתם תיקונים'}{issue.at?' · '+when(issue.at):''}</span><p>{issue.text}</p></div>
  <p className="srp-closed"><Lock size={15} aria-hidden="true"/>אפשר לשלוח בקשה אחת בכל פעם</p>
 </>;
}
