'use client';
import React,{useMemo,useRef,useState} from 'react';
import {Check,Copy,Loader2,RefreshCw} from 'lucide-react';
import {useData} from '@/lib/client';
import {money,stages,type Row} from '@/lib/shared';
import type {Ctx} from './workspace';
import {OrderPager,OrderRecord,OrderSearch,OrderViews} from './order-list-parts';
import {OrdersAreaHead} from './orders-area-head';
import './admin-system-audit.css';

// 16.11.2026: activity log in the approved v2 look. Same data as the old LogsView
// (GET admin/activity: id, user_id, resource, action, data, created, actor) and the same refresh.
// The action text is already written in Hebrew where it is recorded (audit() in lib/server.ts and
// direct INSERT INTO activity rows); only the few built from a code ("סטטוס: draft",
// "נוצרה רשומת supplier") get a plain name, and the recorded text stays visible small.

type Cat='orders'|'content'|'customers'|'suppliers'|'catalog'|'system'|'other';
const catLabels:Record<Cat,string>={orders:'הזמנות ותשלומים',content:'תוכן ופרסום',customers:'לקוחות ופניות',suppliers:'ספקים',catalog:'קטלוג ומחירים',system:'מערכת',other:'אחר'};
const catOrder:Cat[]=['orders','content','customers','suppliers','catalog','system','other'];

// Every action text found where activity rows are written, by category.
const actionCats:Record<Cat,string[]>={
 orders:['תשלום אומת באמצעות הספק','מסמך חשבונית צורף להזמנה','הבקשה אושרה במחיר שהוזמן','תשלום אומת ידנית','הזמנה בוטלה','תנועת יתרה','הלקוח ביקש לבטל אתר בהזמנה','הלקוח ביקש לבטל את ההזמנה','בקשת הביטול נדחתה','פרטי בנק עודכנו','בקשת הטענת יתרה נשלחה','הטענת יתרה אושרה','בקשת הטענה בוטלה','הטענת יתרה נדחתה','חודש נסגר והופק סיכום לתשלום','נוספו כתבות להזמנה חודשית','נוצרה הזמנה בשם הלקוח','נוצרה הזמנה','הזמנה נסגרה לרכישות והופק סיכום PDF','הלקוח דיווח על תשלום','דיווח תשלום אושר','דיווח תשלום נדחה','תשלום הזמנה חודשית התקבל ואושר','הרשאת חשבון חודשי עודכנה','חשבון חודשי סומן כשולם','תשלום בכרטיס שלא זוכה סומן כטופל','התקבל תשלום בכרטיס על הזמנה שכבר שולמה. הסכום לא זוכה, נדרש טיפול','התקבל תשלום בכרטיס בסכום שאינו תואם להזמנה. הסכום לא זוכה, נדרש טיפול','התקבל תשלום בכרטיס על הזמנה שאינה זמינה לתשלום. הסכום לא זוכה, נדרש טיפול','ביטול ממתין לאישור עצירת פרסום','כתבה בוטלה וזוכתה','מחיר הפרסום בהזמנה עודכן'],
 content:['הספק דיווח על פרסום','מנהל דיווח על פרסום','הספק השלים הדגמת פרסום','פרטי הכתיבה נשלחו לכותב','תוכן נשמר','השליחה המתוזמנת בוטלה; הכתבה חזרה לטיוטה','נוצר קישור ספק','נוצרה טיוטת AI','נשלח ל-WordPress','נבחרה תמונה מ-Pexels','שיוך הכתבה ללקוח עודכן','הכתבה הועברה לתור הדגמה של הספק','הכתבה הועברה אוטומטית לפורטל הספק','המאמר המוכן הוחזר ללקוח','כתיבה מקצועית אושרה ותישלח לספק ביום שנבחר','כתיבה מקצועית אושרה לפרסום ללא החזרה','הכתבה המוכנה ממתינה למועד אישור המנהל','הלקוח ביקש תיקונים מהכותב'],
 customers:['צפייה במרכז הלקוחות של החשבון (קריאה בלבד)','צפייה בלקוחות הסוכנות','ייצוא רשימת הדיוור השיווקי','נשלחה תשובה לפנייה','הלקוח הוסיף הודעה לפנייה','הפנייה נסגרה','תפקיד עודכן','לקוח הועבר לארכיון','לקוח הוחזר מהארכיון','פרטי לקוח עודכנו','לקוח נוסף','נוספו אתרים לרשימת "כבר שימשו"','הגדרות מרכז הסוכנות עודכנו','הצטרפות לדיוור שיווקי','הסרה מדיוור שיווקי'],
 suppliers:['בקשת ספק טופלה','סיכום ספק חושב מחדש','התחשבנות ספק עודכנה','נשלחה לספק בקשת חשבונית חודשית','נשלח לספק פירוט הזמנה','נשלח לספק מצב חבילה','עודכנו פרטי תשלום של חבילה','נוספה חבילת מלאי','תשלום חודשי לספק תועד','הספק צירף חשבונית'],
 catalog:['העלאת לוגו לקטלוג','אתר עודכן','קופון עודכן','עדכון מחיר נבדק','מחיר רמה בקטלוג','עדכון מחירי אתר','עריכת קטלוג מרוכזת','עדכון רמת מחיר','שיוך משתמש לרמת מחיר','מחיקת רמת מחיר','עדכון מחירים קבועים','סנכרון דו־כיווני — ממתין לשיטס','סנכרון קטלוג משיטס','הצגת מפתח חיבור לשיטס','הפעלת סנכרון אוטומטי','השהיית סנכרון אוטומטי'],
 system:['הגדרות עודכנו','חיבור עודכן','התראה סומנה כטופלה','התראה הוחזרה לטיפול'],
 other:[]
};
const catOf=new Map<string,Cat>();for(const c of catOrder)for(const a of actionCats[c])catOf.set(a,c);
// Record kinds (records/<kind> in route.ts) with the names the admin screens already use.
const kindNames:Record<string,string>={customer:'לקוח',supplier:'ספק',instruction:'הנחיה',ticket:'פנייה',strategy:'תכנית',payout:'פרטי תשלום'};
const kindCats:Record<string,Cat>={customer:'customers',ticket:'customers',strategy:'customers',supplier:'suppliers',payout:'suppliers',instruction:'content',bundle:'catalog',package:'catalog'};
// Side stripe: calm by default. Red only for a cancellation, a rejected payment or a charge that needs handling.
const redActions=new Set(['הזמנה בוטלה','כתבה בוטלה וזוכתה','דיווח תשלום נדחה','הטענת יתרה נדחתה','הלקוח ביקש לבטל אתר בהזמנה','הלקוח ביקש לבטל את ההזמנה']);
const okActions=new Set(['תשלום אומת באמצעות הספק','תשלום אומת ידנית','דיווח תשלום אושר','הטענת יתרה אושרה','תשלום הזמנה חודשית התקבל ואושר','חשבון חודשי סומן כשולם','הספק דיווח על פרסום','מנהל דיווח על פרסום']);

type Entry={row:Row;raw:string;label:string;cat:Cat;tone:string;parsed:unknown;ok:boolean;text:string};
function kindName(kind:string){return kindNames[kind]||kind;}
function describe(row:Row):Entry{
 const raw=String(row.action||''),text=typeof row.data==='string'?row.data:row.data==null?'':JSON.stringify(row.data);
 let parsed:unknown=null,ok=false;try{parsed=text?JSON.parse(text):{};ok=true;}catch{}
 const data:Row=ok&&parsed&&typeof parsed==='object'&&!Array.isArray(parsed)?parsed as Row:{};
 let label=raw,cat:Cat=catOf.get(raw)||'other';
 const status=raw.match(/^סטטוס: (.+)$/),created=raw.match(/^נוצרה רשומת (.+)$/),updated=raw.match(/^עודכנה רשומת (.+)$/);
 if(status){label='הכתבה עברה למצב: '+(stages[status[1]]||status[1]);cat='content';}
 else if(created){label='נוספה רשומה: '+kindName(created[1]);cat=kindCats[created[1]]||'system';}
 else if(updated){label='עודכנה רשומה: '+kindName(updated[1]);cat=kindCats[updated[1]]||'system';}
 else if((raw==='רשומה עודכנה'||raw==='רשומה נמחקה')&&data.kind){label=(raw==='רשומה עודכנה'?'עודכנה רשומה: ':'נמחקה רשומה: ')+kindName(String(data.kind));cat=kindCats[String(data.kind)]||'system';}
 else if(raw.startsWith('צפייה במרכז הלקוחות של החשבון'))cat='customers';
 const tone=redActions.has(raw)||raw.endsWith('נדרש טיפול')?'red':okActions.has(raw)?'ok':raw==='רשומה נמחקה'?'cancelled':'neutral';
 return {row,raw,label,cat,tone,parsed,ok,text};
}

// Readable names for the fields found in the recorded data. Unknown keys show as written.
const keyNames:Record<string,string>={amount:'סכום',amount_cents:'סכום',total:'סכום',total_cents:'סכום כולל',unit_cents:'מחיר ליחידה',price:'מחיר',cost:'עלות',before_price:'מחיר קודם',after_price:'מחיר חדש',before_cost:'עלות קודמת',after_cost:'עלות חדשה',net:'סכום נטו',old_net:'סכום נטו קודם',before:'לפני',after:'אחרי',reason:'סיבה',note:'הערה',overpaid_note:'הערה על תשלום עודף',reference:'אסמכתא',url:'כתובת',customer_id:'מזהה לקוח',article_id:'מזהה כתבה',order_id:'מזהה הזמנה',order_number:'מספר הזמנה',event_id:'מזהה אירוע',request_id:'מזהה בקשה',payment_id:'מזהה תשלום',file_id:'מזהה קובץ',previous_file_id:'קובץ קודם',document_number:'מספר מסמך',month:'חודש',number:'מספר',count:'כמות',quantity:'כמות',words:'מילים',version:'גרסה',expires:'תוקף',provider:'ספק',model:'מודל',method:'אמצעי תשלום',role:'תפקיד',enabled:'פעיל',status:'מצב',decision:'החלטה',name:'שם',email:'דוא״ל',source:'מקור',added:'נוספו',saved:'נשמרו',scanned:'נבדקו',missing:'חסרים',limit:'תקרה',demo:'הדגמה',supplier_name:'ספק',stock_total:'סך המלאי',stock_after:'מלאי אחרי ההוספה',publications:'פרסומים',kind:'סוג רשומה',site:'אתר',photographer:'צלם',photo_id:'מזהה תמונה',wordpress_id:'מזהה ב־WordPress',publish_without_review:'פרסום בלי החזרה ללקוח',created_customer:'נוצר לקוח חדש',pricing_warning_acknowledged:'אזהרת מחיר אושרה',warnings:'אזהרות',ids:'מזהים'};
const moneyKeys=new Set(['amount','amount_cents','total','total_cents','unit_cents','price','cost','before_price','after_price','before_cost','after_cost','net','old_net']);
const summaryKeys=['amount','amount_cents','total','total_cents','reason','note','url','month','number','reference','name','email','role','enabled','quantity','count','words','provider'];
const isEmpty=(v:unknown)=>v===null||v===undefined||v==='';
const isMoney=(key:string,v:unknown,raw:string)=>typeof v==='number'&&Number.isFinite(v)&&(moneyKeys.has(key)||(raw==='מחיר הפרסום בהזמנה עודכן'&&(key==='before'||key==='after')));
const isoStamp=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
const latin=/^[\x21-\x7e]+$/;

const zone='Asia/Jerusalem';
const dayKey=(d:Date)=>new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
const clock=(d:Date)=>new Intl.DateTimeFormat('he-IL',{timeZone:zone,hour:'2-digit',minute:'2-digit'}).format(d);
const fullStamp=(d:Date)=>new Intl.DateTimeFormat('he-IL',{timeZone:zone,weekday:'long',day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(d);
const valid=(d:Date)=>!Number.isNaN(d.getTime());
function dayTitle(d:Date){
 if(!valid(d))return 'ללא תאריך';
 const now=new Date(),key=dayKey(d);
 if(key===dayKey(now))return 'היום';
 if(key===dayKey(new Date(now.getTime()-864e5)))return 'אתמול';
 const sameYear=key.slice(0,4)===dayKey(now).slice(0,4);
 return new Intl.DateTimeFormat('he-IL',{timeZone:zone,weekday:'long',day:'numeric',month:'long',...(sameYear?{}:{year:'numeric'})}).format(d);
}

function plain(key:string,v:unknown,raw:string):string{
 if(isMoney(key,v,raw))return money(v as number);
 if(typeof v==='boolean')return v?'כן':'לא';
 if(typeof v==='string'&&isoStamp.test(v)){const d=new Date(v);if(valid(d))return fullStamp(d);}
 if(typeof v==='object')return JSON.stringify(v);
 return String(v);
}
function Value({k,v,raw}:{k:string;v:unknown;raw:string}){
 const text=plain(k,v,raw);
 if(isMoney(k,v,raw))return <bdi className="sa-num">{text}</bdi>;
 if(v&&typeof v==='object')return <code className="sa-code" dir="ltr">{text}</code>;
 if(typeof v==='string'&&/^https?:\/\//i.test(v))return <a className="sa-link" href={v} target="_blank" rel="noopener noreferrer" dir="ltr" onClick={e=>e.stopPropagation()}>{v}</a>;
 if(typeof v==='number'||latin.test(text))return <bdi dir="ltr" className="sa-ltr">{text}</bdi>;
 return <span dir="auto">{text}</span>;
}
function summary(e:Entry){
 if(!e.ok||!e.parsed||typeof e.parsed!=='object'||Array.isArray(e.parsed))return e.text&&!e.ok?e.text:'';
 const data=e.parsed as Row;
 return summaryKeys.filter(k=>!isEmpty(data[k])&&typeof data[k]!=='object').slice(0,2).map(k=>(keyNames[k]||k)+': '+plain(k,data[k],e.raw)).join(' · ');
}

export function AdminAuditPage({ctx}:{ctx:Ctx}){
 const state=useData('admin/activity',ctx.revision);
 const [search,setSearch]=useState(''),[cat,setCat]=useState<string>('all'),[open,setOpen]=useState(''),[page,setPage]=useState(1);
 const all=useMemo(()=>((state.data?.activity||[]) as Row[]).map(describe),[state.data]);
 const query=search.trim().toLocaleLowerCase('he');
 const rows=all.filter(e=>(cat==='all'||e.cat===cat)&&(!query||[e.label,e.raw,e.row.actor,e.text,e.row.resource,catLabels[e.cat]].some(v=>String(v||'').toLocaleLowerCase('he').includes(query))));
 const pages=Math.max(1,Math.ceil(rows.length/20)),shown=Math.min(page,pages),slice=rows.slice((shown-1)*20,shown*20),filtered=!!query||cat!=='all';
 const counts=(c:Cat)=>all.filter(e=>e.cat===c).length;
 const views:[string,string,number][]=[['all','הכול',all.length],...catOrder.filter(c=>counts(c)>0||cat===c).map(c=>[c,catLabels[c],counts(c)] as [string,string,number])];
 const busy=state.loading&&!!state.data;
 const reset=()=>{setPage(1);setOpen('');};
 // Rows of the current page under a day heading (היום, אתמול, then the date).
 const groups:{key:string;title:string;items:Entry[]}[]=[];
 for(const e of slice){const d=new Date(e.row.created),key=valid(d)?dayKey(d):'none',last=groups[groups.length-1];if(last&&last.key===key)last.items.push(e);else groups.push({key,title:dayTitle(d),items:[e]});}
 return <section className="orders-match-screen om-content sv2 sv2-orders sv2-fin sys-audit" dir="rtl">
  <OrdersAreaHead ctx={ctx} current="admin-audit" title="יומן פעילות" sub="מי עשה מה ומתי. הפעולה החדשה ביותר למעלה." action={<div className="om-top-actions"><button type="button" className="sa-refresh" onClick={ctx.refresh} disabled={busy} aria-busy={busy||undefined}>{busy?<Loader2 className="om-spin" size={17} aria-hidden="true"/>:<RefreshCw size={17} aria-hidden="true"/>}{busy?'מרענן…':'רענון'}</button></div>}/>
  <div className="orders-reference-panel">
   <div className="orders-reference-toolbar om-toolbar is-search"><OrderSearch label="חיפוש לפי פעולה, מבצע או פרטים" value={search} onChange={v=>{setSearch(v);reset();}}/></div>
   {all.length>1?<OrderViews label="סינון לפי סוג הפעולה" value={cat} onChange={v=>{setCat(v);reset();}} views={views}/>:null}
   {all.length>=400?<p className="om-note">מוצגות 400 הפעולות האחרונות.</p>:null}
   {state.loading&&!state.data?<div className="orders-reference-loading" role="status">טוען את היומן…</div>
   :state.error?<div className="orders-reference-error" role="alert"><p>{state.error}</p><button type="button" className="sa-retry" onClick={ctx.refresh}>ניסיון נוסף</button></div>
   :rows.length?<>
    <div className="om-head" aria-hidden="true"><span>פעולה</span><span>מבצע</span><span>פרטים</span><span>סוג</span><span>שעה</span><span/></div>
    <div className={'om-list'+(busy?' is-busy':'')} aria-label="פעולות ביומן" aria-busy={busy||undefined}>{groups.map(g=><React.Fragment key={g.key+g.items[0].row.id}>
     <div className="sa-day" role="heading" aria-level={3}>{g.title}</div>
     {g.items.map(e=>{const id=String(e.row.id),isOpen=open===id,d=new Date(e.row.created),sum=summary(e);return <OrderRecord key={id} id={id} tone={e.tone} label={e.label||'פעולה'} open={isOpen} onToggle={()=>setOpen(isOpen?'':id)} panel={<AuditPanel e={e}/>}>
      <div className="sa-what"><b dir="auto">{e.label||'פעולה ללא שם'}</b>{e.label!==e.raw&&e.raw?<small dir="auto">{e.raw}</small>:null}</div>
      <div className="sa-actor">{e.row.actor||<span className="om-muted">לא ידוע</span>}</div>
      <div className="sa-sum" dir="auto">{sum||<span className="om-muted">אין פרטים</span>}</div>
      <div className="sa-cat"><span className={'om-pill sa-pill is-c-'+e.cat}>{catLabels[e.cat]}</span></div>
      <div className="sa-time">{valid(d)?<time dateTime={e.row.created}><bdi>{clock(d)}</bdi></time>:'—'}</div>
     </OrderRecord>;})}
    </React.Fragment>)}</div>
   </>
   :<div className="orders-reference-empty"><h3>{filtered?'לא נמצאו פעולות':'היומן נקי'}</h3><p>{filtered?'נסו חיפוש אחר או סוג אחר.':'הפעולות החדשות יירשמו כאן באופן אוטומטי.'}</p>{filtered?<button type="button" className="sa-retry" onClick={()=>{setSearch('');setCat('all');reset();}}>הצגת כל היומן</button>:null}</div>}
   <OrderPager page={shown} total={rows.length} size={20} onChange={v=>{setPage(v);setOpen('');}}/>
  </div>
 </section>;
}

// The opened row: who, when and on what; the recorded fields as readable rows; the full data as saved.
function AuditPanel({e}:{e:Entry}){
 const d=new Date(e.row.created),data=e.ok&&e.parsed&&typeof e.parsed==='object'&&!Array.isArray(e.parsed)?e.parsed as Row:null;
 const fields=data?Object.entries(data).filter(([,v])=>!isEmpty(v)):[];
 const pretty=e.ok&&e.text?JSON.stringify(e.parsed,null,2):e.text;
 return <div className="sa-panel">
  <section className="sa-card">
   <h3>הפעולה</h3>
   <dl className="sa-facts">
    <div><dt>מה נעשה</dt><dd><span dir="auto">{e.label||'פעולה ללא שם'}</span>{e.label!==e.raw&&e.raw?<small className="sa-rawcode">נרשם כ: <bdi dir="auto">{e.raw}</bdi></small>:null}</dd></div>
    <div><dt>סוג</dt><dd>{catLabels[e.cat]}</dd></div>
    <div><dt>מבצע</dt><dd>{e.row.actor||'לא ידוע'}</dd></div>
    <div><dt>מתי</dt><dd>{valid(d)?<bdi>{fullStamp(d)}</bdi>:'לא ידוע'}</dd></div>
    {e.row.resource?<div><dt>פריט</dt><dd><bdi dir="ltr" className="sa-ltr">{String(e.row.resource)}</bdi></dd></div>:null}
   </dl>
  </section>
  <section className="sa-card">
   <h3>מה נשמר</h3>
   {data?fields.length?<dl className="sa-facts">{fields.map(([k,v])=><div key={k}><dt>{keyNames[k]||<bdi dir="ltr" className="sa-key">{k}</bdi>}</dt><dd><Value k={k} v={v} raw={e.raw}/></dd></div>)}</dl>:<p className="sa-quiet">לא נשמרו פרטים נוספים לפעולה הזו.</p>
   :e.text?<><p className="sa-quiet">הפרטים לא נשמרו במבנה קריא. כך הם נשמרו:</p><pre className="sa-pre" dir="ltr">{e.text}</pre></>
   :<p className="sa-quiet">לא נשמרו פרטים נוספים לפעולה הזו.</p>}
  </section>
  {data&&e.text?<details className="sa-raw"><summary>הנתונים המלאים כפי שנשמרו</summary><pre className="sa-pre" dir="ltr">{pretty}</pre><CopyButton text={e.text}/></details>:null}
 </div>;
}

function CopyButton({text}:{text:string}){
 const [state,setState]=useState<'idle'|'done'|'error'>('idle'),timer=useRef<ReturnType<typeof setTimeout>>(undefined);
 const copy=async()=>{clearTimeout(timer.current);try{await navigator.clipboard.writeText(text);setState('done');}catch{setState('error');}timer.current=setTimeout(()=>setState('idle'),1800);};
 return <button type="button" className={'sa-copy'+(state==='done'?' is-done':'')} onClick={copy}>{state==='done'?<Check size={16} aria-hidden="true"/>:<Copy size={16} aria-hidden="true"/>}<span role="status">{state==='done'?'הועתק':state==='error'?'ההעתקה לא הצליחה':'העתקת הנתונים'}</span></button>;
}
