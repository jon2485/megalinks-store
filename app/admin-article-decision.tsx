'use client';
import React,{useState} from 'react';
import {ArrowRight,Bell,Check,ChevronLeft,Download,ExternalLink,FileText,Info,Pencil,RotateCw,Send,Upload,X} from 'lucide-react';
import {Textarea} from '@/components/ui/textarea';
import {Input} from '@/components/ui/input';
import {api} from '@/lib/client';
import {displayPublicationDay,publicationDay,israelDay} from '@/lib/publication-date';
import {writingCode} from '@/lib/writing-workflow';
import type {Row} from '@/lib/shared';
import type {Ctx} from './workspace';
import {openCancelFocus} from './cancel-focus';
import './admin-article-review.css';

// The admin's article page answers two questions first: who holds the article now,
// and what the admin can do about it. Every action calls the same API as before.

type StudioCheck={key:string;label:string;done:boolean;optional?:boolean};
export type AdminStage='review'|'writer'|'customer'|'scheduled'|'waiting_day'|'delivery'|'supplier'|'published'|'cancel_pending'|'cancelled';
export type AdminStudio={ctx:Ctx;id:string;a:Row;w?:Row;o?:Row;busy:boolean;dirty:boolean;note:string;setNote:(v:string)=>void;
 status:(next:string)=>void;act:(fn:()=>Promise<any>,message:string|((r:Row)=>string))=>void;save:()=>Promise<any>;
 editArticle:()=>void;checks:StudioCheck[];validated:boolean;validate:()=>void;professionalPending:boolean;
 finishWriting:(action:'return'|'publish')=>void;importFile:(f:File)=>void;hasContent:boolean;canSend:boolean;sendLabel:string;
 downloadWord:()=>void;saving:boolean};

const future=(day?:string)=>!!day&&publicationDay(day)>israelDay();
const dayText=(day?:string)=>day?displayPublicationDay(day):'';
const ago=(stamp?:string)=>{const t=Date.parse(stamp||'');if(!Number.isFinite(t))return '';const d=Math.floor((Date.now()-t)/864e5);return d<=0?'היום':d===1?'אתמול':'לפני '+d+' ימים';};
const site=(s:AdminStudio)=>s.w?.name||s.a.website_name||'האתר';
const fullDate=(stamp?:string)=>{const t=Date.parse(stamp||'');return Number.isFinite(t)?new Date(t).toLocaleDateString('he-IL',{timeZone:'Asia/Jerusalem',day:'2-digit',month:'2-digit',year:'numeric'}):'';};
/** When the supplier gets (or got) the article, in plain words. */
function sendDate(a:Row,stage:AdminStage):[string,string]{
 const day=dayText(a.scheduled),sent=fullDate(a.supplier_sent_at||a.dispatch_attempted_at);
 if(stage==='cancelled')return ['—','הכתבה בוטלה'];
 if(stage==='published'||stage==='supplier')return [sent||'נשלחה',stage==='published'?'פורסמה'+(a.published_at?' ב־'+fullDate(a.published_at):''):'נשלחה לספק'];
 if(stage==='waiting_day')return [day+', 7:00','אושרה, תישלח אוטומטית'];
 if(stage==='delivery')return ['עוד לא נשלחה','השליחה לספק לא הושלמה'];
 if(day)return [day+', 7:00',future(a.scheduled)?'התאריך שהלקוח בחר, אחרי האישור':'התאריך שבחר עבר, תישלח מיד אחרי האישור'];
 return ['מיד אחרי האישור','הלקוח לא בחר תאריך'];
}

export function adminStage(a:Row,professionalPending:boolean):AdminStage{
 if(a.status==='cancelled'||a.publication_refunded)return 'cancelled';
 if(a.cancel_pending)return 'cancel_pending';
 if(a.status==='published'||a.status==='demo_completed'||a.published_url)return 'published';
 if(a.status==='sent')return 'supplier';
 if(a.status==='approved')return a.dispatch_at&&Date.parse(a.dispatch_at)>Date.now()?'waiting_day':'delivery';
 if(a.status==='admin_review')return 'review';
 if(a.status==='scheduled')return 'scheduled';
 if(professionalPending||(a.editorial&&a.writing_requested_at&&['writing','revisions'].includes(a.status)))return 'writer';
 return 'customer';
}

/** The status pill next to the title: the same stage as the sentence below, in two or three words. */
const pills:Record<AdminStage,[string,string]>={review:['ממתינה לאישור שלך','blue'],writer:['אצל הכותב','blue'],customer:['אצל הלקוח','gray'],scheduled:['מתוזמנת','blue'],waiting_day:['אושרה, ממתינה לתאריך','green'],delivery:['לא הגיעה לספק','red'],supplier:['אצל הספק','orange'],published:['פורסמה','green'],cancel_pending:['בקשת ביטול','red'],cancelled:['בוטלה','gray']};

/** One header card: title and status, four facts that open the customer, the site and the order,
 *  and who holds the article as one sentence and a four-step track. */
export function AdminArticleHeader({s,stage}:{s:AdminStudio;stage:AdminStage}){
 const {ctx,a,w,o}=s,sent=ago(a.review_requested_at||a.submitted_at);
 const now:Record<AdminStage,React.ReactNode>={
  review:<><b>הכתבה אצלך.</b> הלקוח שלח אותה לבדיקה{sent?' '+sent:''}.</>,
  writer:<><b>הכתבה אצל הכותב.</b> כשהמאמר מוכן, מצרפים אותו כאן וממשיכים לפי מה שהלקוח בחר.</>,
  customer:<><b>הכתבה אצל הלקוח.</b> הוא עורך או בודק אותה. אין צורך בפעולה ממך כרגע.</>,
  scheduled:<><b>הכתבה ממתינה לתאריך שהלקוח בחר.</b> היא תעבור לאישור שלך בקרוב.</>,
  waiting_day:<><b>אישרת את הכתבה.</b> היא תישלח ל־{site(s)} ב־{dayText(a.scheduled)} ב־7:00 בבוקר.</>,
  delivery:<><b>אישרת את הכתבה, אבל היא עוד לא הגיעה לספק.</b> אפשר לנסות לשלוח שוב.</>,
  supplier:<><b>הכתבה אצל הספק.</b> כשהיא תפורסם, הקישור יגיע לכאן.</>,
  published:<><b>הכתבה פורסמה.</b></>,
  cancel_pending:<><b>הלקוח ביקש לבטל.</b> הטיפול והתזכורות מושהים עד שתחליט.</>,
  cancelled:<><b>הכתבה בוטלה.</b></>,
 };
 const first=a.editorial?'הכותב':'הלקוח',at=stage==='published'?4:['supplier','waiting_day','delivery'].includes(stage)?2:stage==='review'?1:['cancel_pending','cancelled'].includes(stage)?-1:0;
 const steps:[string,string][]=[[first,a.editorial?'כותב את המאמר':'כותב ושולח'],['אתה','בודק ומאשר'],['הספק',stage==='waiting_day'?'ב־'+dayText(a.scheduled)+', 7:00':stage==='delivery'?'עוד לא קיבל':'מפרסם באתר'],['פורסם','הקישור מגיע אליך']];
 const customer=a.user_name||o?.name||'לקוח',email=a.user_email||o?.email||'',domain=w?.url?String(w.url).replace(/^https?:\/\/(www\.)?/,'').replace(/\/$/,''):'';
 const [sendMain,sendSub]=sendDate(a,stage),[pill,tone]=pills[stage];
 const who=<><span className="ar-k">לקוח</span><span className="ar-v"><span>{customer}</span>{a.user_id&&<ChevronLeft size={15} aria-hidden="true"/>}</span>{email&&<span className="ar-s"><bdi>{email}</bdi></span>}</>;
 const where=<><span className="ar-k">האתר</span><span className="ar-v"><span>{site(s)}</span>{w?.url&&<ExternalLink size={15} aria-hidden="true"/>}</span>{domain&&<span className="ar-s"><bdi>{domain}</bdi></span>}</>;
 return <header className="ar-head">
  <div className="ar-head-top">
   <button type="button" className="ar-back" onClick={()=>ctx.go(ctx.adminMode?'admin-articles':'purchased')}><ArrowRight size={18} aria-hidden="true"/>כל הכתבות</button>
   <span className="ar-save" role="status" data-state={s.saving?'busy':s.dirty?'dirty':'saved'}>{s.saving?'שומר…':s.dirty?'שינויים נשמרים אוטומטית':<><Check size={14} aria-hidden="true"/>הכול נשמר</>}</span>
  </div>
  <div className="ar-title">{w?.logo_url?<img src={w.logo_url} alt="" className="ar-logo"/>:<span className="ar-logo" aria-hidden="true"><FileText size={20}/></span>}
   <h1>{a.title||'כתבה ללא כותרת'}</h1>
   <span className="ar-pill" data-tone={tone}>{pill}</span>
  </div>
  <div className="ar-facts" role="group" aria-label="פרטי הכתבה">
   {a.user_id?<button type="button" className="ar-fact is-go" title="פתיחת תיק הלקוח" onClick={()=>ctx.go('admin-customer-account/'+a.user_id)}>{who}</button>:<div className="ar-fact">{who}</div>}
   {w?.url?<a className="ar-fact is-go" href={w.url} target="_blank" rel="noreferrer" title="פתיחת האתר בלשונית חדשה">{where}</a>:<div className="ar-fact">{where}</div>}
   {a.order_id?<button type="button" className="ar-fact is-go" title="פתיחת ההזמנה" onClick={()=>ctx.go('admin-order/'+a.order_id)}><span className="ar-k">הזמנה</span><span className="ar-v"><span><bdi>{o?.number?String(o.number).replace(/^#/,''):'פתיחה'}</bdi></span><ChevronLeft size={15} aria-hidden="true"/></span><span className="ar-s">פתיחת ההזמנה</span></button>:<div className="ar-fact"><span className="ar-k">הזמנה</span><span className="ar-v"><span>—</span></span></div>}
   <div className="ar-fact"><span className="ar-k">שליחה לספק</span><span className="ar-v"><span><bdi>{sendMain}</bdi></span></span><span className="ar-s">{sendSub}</span></div>
  </div>
  <div className="ar-where">
   <p>{now[stage]}</p>
   {at>=0&&<ol className="ar-track" aria-label="אצל מי הכתבה">{steps.map(([name,what],i)=>{const done=i<at||at===4,cur=i===at;return <li key={name} data-state={done?'done':cur?'current':'todo'} aria-current={cur?'step':undefined}><span className="ar-dot" aria-hidden="true">{done?<Check size={15}/>:i+1}</span><b>{cur&&i===1?'אתה כאן':name}</b><small>{what}</small></li>;})}</ol>}
  </div>
 </header>;
}

/** The decision card: what the system checked, what to check by eye, and the actions of the current stage.
 *  On a phone the two main actions of the review stage also float in a bar above the admin dock. */
export function AdminDecision({s,stage}:{s:AdminStudio;stage:AdminStage}){
 const {ctx,id,a,w,busy,dirty}=s,[returning,setReturning]=useState(false),[url,setUrl]=useState(''),[urlError,setUrlError]=useState('');
 const demo=!!s.o?.demo;
 const notes=[w?.public_notes,typeof w?.publishing_restrictions==='string'?w.publishing_restrictions:'',w?.customer_notes].filter(Boolean) as string[];
 const savedHint=dirty&&<p className="ar-dirty"><Info size={15} aria-hidden="true"/>יש שינויים שעוד לא נשמרו. <button type="button" disabled={busy} onClick={()=>s.act(s.save,'השינויים נשמרו')}>שמירה עכשיו</button></p>;
 const remind=()=>s.act(()=>api('articles/'+id+'/remind','POST',{}),(r:Row)=>r.status==='failed'?'התזכורת נשמרה אך השליחה נכשלה. אפשר לבדוק בדיוור.':r.status==='blocked'?'התזכורת ממתינה להשלמת הגדרות הדיוור.':'התזכורת נרשמה לשליחה לספק.');
 const report=(e:React.FormEvent)=>{e.preventDefault();if(!demo&&!url.trim()){setUrlError('יש להזין את הקישור לכתבה שפורסמה.');return;}setUrlError('');s.act(()=>api('supplier-inbox/'+encodeURIComponent('publication:'+a.id),'POST',{url:url.trim()}),demo?'הדגמת הפרסום הושלמה':'קישור הפרסום נשמר');};
 const startReturn=()=>{setReturning(true);requestAnimationFrame(()=>document.getElementById('ar-note')?.scrollIntoView({behavior:'smooth',block:'center'}));};
 // The site's publishing requirements, the internal note and the demo note: the same block in every stage.
 const reqs=<div className="ar-sect">
  <p className="ar-label">{stage==='review'?'לבדוק בעין, לפי ':'דרישות הפרסום של '}{site(s)}</p>
  {notes.length?<ul className="ar-reqs">{notes.map(n=><li key={n}>{n}</li>)}</ul>:<p className="ar-muted">אין דרישות מיוחדות לאתר הזה.</p>}
  {a.admin_notes&&<p className="ar-memo"><b>הערה פנימית:</b> {a.admin_notes}</p>}
  {demo&&<p className="ar-memo">הזמנת הדגמה: ניתן לבדוק כתיבה, אישור ומסירה לספק. לא יתבצע פרסום חיצוני.</p>}
 </div>;
 const edit=<div className="ar-sect ar-self"><span><b>רוצה לתקן בעצמך?</b>הכתבה נשארת באותו שלב.</span><button type="button" className="ar-btn ar-sm" onClick={s.editArticle}><Pencil size={15} aria-hidden="true"/>עריכת הכתבה</button></div>;

 if(stage==='review')return <>
  <section className="ar-panel" aria-label="ההחלטה שלך">
   <h2>ההחלטה שלך</h2>
   <div className="ar-sect">
    <p className="ar-label">המערכת בדקה</p>
    <ul className="ar-res">{s.checks.map(c=><li key={c.key} data-state={c.done?'ok':c.optional?'opt':'warn'}>{c.done?<Check size={17} aria-hidden="true"/>:<Info size={17} aria-hidden="true"/>}<span>{c.key==='check'&&!c.done?(a.validation?'בדיקת הקישורים לא עדכנית':'עוד לא נבדקו קישורים'):c.label}{!c.done&&c.optional?'. לא חובה':''}</span>{c.key==='check'&&!s.validated&&<button type="button" className="ar-btn ar-tint ar-sm" aria-label="בדיקת קישורים ותוכן" disabled={busy} onClick={s.validate}>בדיקה</button>}</li>)}</ul>
    {a.validation&&!a.validation.ok&&a.validation.article_version===a.version&&!dirty&&a.validation.errors?.length>0&&<ul className="ar-errors">{a.validation.errors.map((e:string)=><li key={e}>{e}</li>)}</ul>}
   </div>
   {reqs}
   <div className={'ar-sect ar-acts'+(dirty||returning?' has-body':'')}>
    {savedHint}
    <div className="ar-acts-main">
     <button type="button" className="ar-btn ar-primary ar-lg" disabled={busy||dirty} onClick={()=>s.status('approved')}><Check size={18} aria-hidden="true"/>אישור ושליחה לספק</button>
     <p className="ar-after">{future(a.scheduled)?<>הכתבה תישלח ל־{site(s)} ב־{dayText(a.scheduled)} ב־7:00 בבוקר.</>:<>הכתבה תישלח ל־{site(s)} מיד.</>}</p>
    </div>
    {returning?<div className="ar-return">
     <label htmlFor="ar-note">מה צריך לתקן? <small>נשלח ללקוח במייל</small></label>
     <Textarea id="ar-note" dir="rtl" className="ar-textarea" maxLength={3000} autoFocus value={s.note} onChange={e=>s.setNote(e.target.value)} placeholder="למשל: הכתבה צריכה להיות באנגלית לפי דרישות האתר"/>
     <div className="ar-row"><button type="button" className="ar-btn ar-warn" disabled={busy||dirty||!s.note.trim()} onClick={()=>s.status('revisions')}>החזרה ללקוח לתיקון</button><button type="button" className="ar-btn" disabled={busy} onClick={()=>setReturning(false)}><X size={15} aria-hidden="true"/>ביטול</button></div>
     <p className="ar-after">הלקוח יקבל מייל עם מה שכתבת, והכתבה תחזור אליו.</p>
    </div>:<div className="ar-acts-main">
     <button type="button" className="ar-btn ar-warn ar-lg" disabled={busy} onClick={()=>setReturning(true)}><RotateCw size={18} aria-hidden="true"/>החזרה ללקוח לתיקון</button>
     <p className="ar-after">הלקוח יקבל מייל עם מה שתכתוב, והכתבה תחזור אליו.</p>
    </div>}
   </div>
   {edit}
  </section>
  {!returning&&<div className="ar-bar" role="group" aria-label="פעולות מהירות">
   <button type="button" className="ar-btn ar-primary" disabled={busy||dirty} onClick={()=>s.status('approved')}><Check size={18} aria-hidden="true"/>אישור ושליחה לספק</button>
   <button type="button" className="ar-btn ar-warn" disabled={busy} onClick={startReturn}>החזרה לתיקון</button>
  </div>}
 </>;

 const box=(title:string,body:React.ReactNode,tail?:React.ReactNode)=><section className="ar-panel ar-state" aria-label={title}><h2>{title}</h2><div className="ar-sect">{body}</div>{reqs}{tail}</section>;
 if(stage==='writer')return box('המאמר מהכותב',<>
  <p>מזהה הקובץ: <bdi dir="ltr">{writingCode(s.o?.number,a.id)}</bdi></p>
  {a.anchor&&a.target_url&&<p className="ar-muted">לפני ההמשך ודאו שהביטוי ״{a.anchor}״ מקושר אל <bdi dir="ltr">{a.target_url}</bdi>.</p>}
  {s.professionalPending&&<>
   <label className={'ar-btn ar-primary ar-lg'+(busy?' is-disabled':'')}><Upload size={18} aria-hidden="true"/>{s.hasContent?'החלפת המאמר מקובץ Word':'צירוף המאמר מקובץ Word'}<input type="file" hidden accept=".docx,.txt,.html,.htm,.md" disabled={busy} onChange={e=>{const f=e.target.files?.[0];e.target.value='';if(f)void s.importFile(f);}}/></label>
   <button type="button" className="ar-btn ar-lg" disabled={busy||!s.hasContent} onClick={()=>s.finishWriting(a.publish_without_review?'publish':'return')}><Send size={18} aria-hidden="true"/>{a.publish_without_review?'פרסום מיידי':'החזרה ללקוח לצפייה'}</button>
   <p className="ar-after">{a.publish_without_review?'הלקוח ביקש פרסום בלי לראות לפני. הכתבה תאושר ותישלח לספק'+(future(a.scheduled)?' ב־'+dayText(a.scheduled)+' ב־7:00.':' מיד.'):'הלקוח ביקש לראות לפני הפרסום. הוא יקבל מייל עם קישור לכתבה.'}</p>
  </>}
  <div className="ar-row"><a className="ar-btn" href={'/api/articles/'+a.id+'/writing-brief.pdf'}><Download size={15} aria-hidden="true"/>הורדת הנחיות PDF</a><a className="ar-btn" href={'/api/articles/'+a.id+'/writing-brief.docx'}><Download size={15} aria-hidden="true"/>קובץ Word לכותב</a></div>
 </>);
 if(stage==='customer')return box('ממתינים ללקוח',<>
  <p>הלקוח עורך או בודק את הכתבה. כשהוא ישלח, היא תגיע אליך לאישור.</p>
  <div className="ar-row"><button type="button" className="ar-btn" onClick={s.editArticle}><Pencil size={15} aria-hidden="true"/>עריכת הכתבה</button>{s.canSend&&<button type="button" className="ar-btn ar-tint" disabled={busy} onClick={()=>s.status('admin_review')}><Send size={15} aria-hidden="true"/>שליחה לאישור בשם הלקוח</button>}</div>
 </>);
 if(stage==='scheduled')return box('מתוזמנת',<p>הכתבה תעבור לאישור שלך בקרוב, והתאריך שהלקוח בחר נשמר.</p>);
 if(stage==='waiting_day')return box('אושרה, ממתינה לתאריך',<p>הכתבה תישלח ל־{site(s)} ב־<b>{dayText(a.scheduled)}</b> ב־7:00 בבוקר, אוטומטית.</p>,edit);
 if(stage==='delivery')return box('הכתבה לא הגיעה לספק',<>
  <p>אישרת את הכתבה, אבל השליחה לספק לא הושלמה. לפעמים חסר מלאי באתר או פרטי ספק.</p>
  <div className="ar-row"><button type="button" className="ar-btn ar-primary" disabled={busy} onClick={()=>s.act(()=>api('articles/'+id+'/dispatch','POST',{}),'מצב המסירה לספק עודכן')}><Send size={15} aria-hidden="true"/>שליחה חוזרת לספק</button>{a.website_id&&<button type="button" className="ar-btn" onClick={()=>ctx.go('admin-supplier-stock/'+a.website_id)}>הוספת מלאי</button>}</div>
 </>,edit);
 if(stage==='supplier')return box('ממתינים לפרסום אצל הספק',<>
  <form noValidate className="ar-report" onSubmit={report}>
   {!demo&&<><label htmlFor="ar-url">קישור לכתבה שפורסמה</label><Input id="ar-url" type="url" dir="ltr" maxLength={2000} placeholder="https://" value={url} disabled={busy} aria-invalid={!!urlError} onChange={e=>setUrl(e.target.value)}/></>}
   {urlError&&<p className="ar-error" role="alert">{urlError}</p>}
   <button type="submit" className="ar-btn ar-primary" disabled={busy}><Check size={15} aria-hidden="true"/>{demo?'סיום הדגמת פרסום':'דיווח על פרסום'}</button>
  </form>
  <div className="ar-row"><button type="button" className="ar-btn" disabled={busy} onClick={remind}><Bell size={15} aria-hidden="true"/>שליחת תזכורת לספק</button></div>
 </>);
 if(stage==='published')return box('פורסמה',a.published_url?<div className="ar-row"><a className="ar-btn" href={a.published_url} target="_blank" rel="noreferrer"><ExternalLink size={15} aria-hidden="true"/>לכתבה שפורסמה</a></div>:<p className="ar-muted">הכתבה פורסמה. אין כאן פעולה נוספת.</p>);
 if(stage==='cancel_pending')return box('בקשת ביטול',<>
  <p>הלקוח ביקש לבטל את הכתבה. מאשרים עצירת פרסום מול הספק ואז מזכים.</p>
  <button type="button" className="ar-btn ar-primary ar-lg" onClick={()=>openCancelFocus(ctx,a.id)}>טיפול בביטול וזיכוי</button>
 </>);
 return box('בוטלה',<p className="ar-muted">{a.cancel_reason||a.refund_reason||'הכתבה בוטלה ואינה בטיפול.'}</p>);
}
