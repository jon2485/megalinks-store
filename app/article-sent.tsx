'use client';
// The screen a customer sees right after sending an article from the editor (owner 22.11.2026): a green check, what was
// sent (title, site, date), what happens next in the right order, and two actions: view the article, download it.
import React,{useEffect,useRef,useState} from 'react';
import {Check,Eye,Download,Globe,ArrowRight,LoaderCircle} from 'lucide-react';
import {type Row} from '@/lib/shared';
import {displayPublicationDay} from '@/lib/publication-date';
import './article-sent.css';

const dateLabel=(iso:string)=>{try{return new Intl.DateTimeFormat('he-IL',{timeZone:'Asia/Jerusalem',day:'numeric',month:'long',year:'numeric'}).format(new Date(iso));}catch{return '';}};
const timeLabel=(iso:string)=>{try{return new Intl.DateTimeFormat('he-IL',{timeZone:'Asia/Jerusalem',hour:'2-digit',minute:'2-digit'}).format(new Date(iso));}catch{return '';}};

export default function ArticleSent({article:a,site:w,sentAt,scheduled,onView,onDownload,onList,downloading}:{article:Row;site?:Row|null;sentAt:string;scheduled?:string;onView:()=>void;onDownload:()=>void;onList:()=>void;downloading?:boolean}){
 const title=useRef<HTMLHeadingElement>(null),[logoFailed,setLogoFailed]=useState(false);
 useEffect(()=>{title.current?.focus({preventScroll:true});window.scrollTo({top:0,behavior:'auto'});},[]);
 const siteName=a.website_name||w?.name||'האתר',siteUrl=String(w?.url||a.website_url||''),logo=a.website_logo||w?.logo_url||'';
 const shortUrl=siteUrl.replace(/^https?:\/\/(www\.)?/,'').replace(/\/$/,'');
 const later=!!scheduled;
 const steps=later
  ?[['המאמר שמור ומחכה לתאריך שבחרתם',true],['ב־'+displayPublicationDay(scheduled!)+' הוא עובר לבדיקה של הצוות שלנו',false],['אחרי האישור הוא נשלח לפרסום באתר',false],['כשהכתבה עולה לאוויר, תקבלו מייל עם הקישור',false]]
  :[['המאמר התקבל אצלנו',true],['הצוות שלנו בודק אותו לפני הפרסום',false],['אחרי האישור הוא נשלח לפרסום באתר',false],['כשהכתבה עולה לאוויר, תקבלו מייל עם הקישור',false]];
 return <section dir="rtl" className="article-sent" aria-labelledby="article-sent-title">
  <div className="article-sent-card">
   <div className="article-sent-check" aria-hidden="true"><Check size={40} strokeWidth={3}/></div>
   <h1 id="article-sent-title" ref={title} tabIndex={-1}>{later?'המאמר נקבע לפרסום':'המאמר נשלח לפרסום'}</h1>
   <p className="article-sent-lead">{later?'שמרנו את המאמר, והוא יעבור לבדיקה ולפרסום בתאריך שבחרתם.':'קיבלנו את המאמר. מעכשיו אנחנו מטפלים בשאר.'}</p>
   <dl className="article-sent-facts">
    <div className="article-sent-fact is-title"><dt>כותרת המאמר</dt><dd>{a.title||'כתבה ללא כותרת'}</dd></div>
    <div className="article-sent-fact is-site"><dt>האתר</dt><dd><span className="article-sent-logo">{logo&&!logoFailed?<img src={logo} alt="" loading="lazy" onError={()=>setLogoFailed(true)}/>:<Globe size={18} aria-hidden="true"/>}</span><span><b>{siteName}</b>{shortUrl&&<small dir="ltr">{shortUrl}</small>}</span></dd></div>
    <div className="article-sent-fact"><dt>{later?'תאריך הפרסום שנבחר':'נשלח בתאריך'}</dt><dd>{later?displayPublicationDay(scheduled!):<>{dateLabel(sentAt)}<small> · {timeLabel(sentAt)}</small></>}</dd></div>
   </dl>
   <ol className="article-sent-steps" aria-label="מה קורה עכשיו">{steps.map(([label,done],i)=><li key={i} data-done={done?'true':undefined}><span aria-hidden="true">{done?<Check size={14} strokeWidth={3}/>:i+1}</span>{label as string}</li>)}</ol>
   <p className="article-sent-note">נעדכן אתכם במייל ובאזור האישי בכל שלב. אם נצטרך שינוי במאמר לפני הפרסום, נחזיר אותו אליכם עם הסבר.</p>
   <div className="article-sent-actions">
    <button type="button" className="article-sent-primary" onClick={onView}><Eye size={18} aria-hidden="true"/>צפייה במאמר</button>
    <button type="button" className="article-sent-secondary" onClick={onDownload} disabled={downloading}>{downloading?<LoaderCircle size={18} className="animate-spin" aria-hidden="true"/>:<Download size={18} aria-hidden="true"/>}הורדת המאמר (Word)</button>
   </div>
   <button type="button" className="article-sent-back" onClick={onList}><ArrowRight size={16} aria-hidden="true"/>לכל הכתבות שלי</button>
  </div>
 </section>;
}
