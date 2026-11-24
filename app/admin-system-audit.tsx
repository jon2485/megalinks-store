'use client';
import React,{useMemo,useRef,useState} from 'react';
import {Building2,Check,ChevronDown,ChevronUp,Copy,FileText,History,Loader2,RefreshCw,Search,Settings,ShoppingCart,Tags,Users,X} from 'lucide-react';
import {useData} from '@/lib/client';
import {money,stages,type Row} from '@/lib/shared';
import type {Ctx} from './workspace';
import {OrderPager,RecordPanel} from './order-list-parts';
import {OrdersAreaHead} from './orders-area-head';
import './supplier-v2.css';
import './admin-system-audit.css';

// 22.11.2026 (owner: "like the other admin pages"): the same look as "חיבורים והגדרות", the suppliers and
// the orders lists: one white card with the search and the category chips, then a table of rows under a
// day heading. Same data, same refresh, same categories, same open-row details and copy. Layout only.
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
// 24.11.2026 The customers-centre pages are recorded by their code; show their Hebrew names.
const agencyTabs:Record<string,string>={overview:'ראשי',customers:'לקוחות',publications:'פרסומים',tasks:'לטיפול',calendar:'לוח פרסומים',reports:'דוחות',settings:'הגדרות'};
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
 else if(raw.startsWith('צפייה במרכז הלקוחות של החשבון')){cat='customers';const tab=raw.match(/: ([a-z]+)$/);if(tab)label='צפייה במרכז הלקוחות של החשבון: '+(agencyTabs[tab[1]]||tab[1]);}
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

// One small icon per category for the row thumb (information only).
const catIcons:Record<Cat,React.ElementType>={orders:ShoppingCart,content:FileText,customers:Users,suppliers:Building2,catalog:Tags,system:Settings,other:History};
// Table columns on wide screens: action (icon, what, recorded text), who, details, category, time, open.
const cols={gridTemplateColumns:'minmax(200px,1.7fr) minmax(0,.8fr) minmax(0,1.3fr) 132px 52px 32px'};

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
 const find=(v:string)=>{setSearch(v);reset();};
 // Rows of the current page under a day heading (היום, אתמול, then the date).
 const groups:{key:string;title:string;items:Entry[]}[]=[];
 for(const e of slice){const d=new Date(e.row.created),key=valid(d)?dayKey(d):'none',last=groups[groups.length-1];if(last&&last.key===key)last.items.push(e);else groups.push({key,title:dayTitle(d),items:[e]});}
 return <section className="orders-match-screen sv2 sv2-orders sv2-fin sys-audit" dir="rtl">
  <OrdersAreaHead ctx={ctx} current="admin-audit" title="יומן פעילות" sub="מי עשה מה ומתי. הפעולה החדשה ביותר למעלה." action={<div className="om-top-actions"><button type="button" className="sa-refresh" onClick={ctx.refresh} disabled={busy} aria-busy={busy||undefined}>{busy?<Loader2 className="om-spin" size={17} aria-hidden="true"/>:<RefreshCw size={17} aria-hidden="true"/>}{busy?'מרענן…':'רענון'}</button></div>}/>
  {/* No blur on the card: a blurred parent would trap the phone sheet of an opened row inside the card. */}
  <section className="sv2-card sa-board" aria-label="פעולות ביומן" style={{backdropFilter:'none',WebkitBackdropFilter:'none'}}>
   <div className="sv2-tools sa-tools">
    <label className="sv2-search"><Search size={17} aria-hidden="true"/><input type="search" maxLength={120} aria-label="חיפוש לפי פעולה, מבצע או פרטים" placeholder="חיפוש לפי פעולה, מבצע או פרטים" value={search} onChange={e=>find(e.target.value)}/>{search&&<button type="button" className="sa-clear" aria-label="ניקוי חיפוש" onClick={()=>find('')}><X size={16} aria-hidden="true"/></button>}</label>
    {all.length>1?<div className="sv2-seg sa-seg" role="group" aria-label="סינון לפי סוג הפעולה">{views.map(([key,label,count])=><button key={key} type="button" className={cat===key?'on':''} aria-pressed={cat===key} onClick={()=>{setCat(key);reset();}}>{label}{count>0&&<b><bdi>{count}</bdi></b>}</button>)}</div>:null}
    {all.length>=400?<p className="sa-note">מוצגות 400 הפעולות האחרונות.</p>:null}
   </div>
   {state.loading&&!state.data?<p className="sv2-loading" role="status">טוען את היומן…</p>
   :state.error?<div className="sv2-empty" role="alert"><p>{state.error}</p><button type="button" className="sv2-btn tint sm" onClick={ctx.refresh}>ניסיון נוסף</button></div>
   :rows.length?<>
    <div className="sv2-th" style={cols} aria-hidden="true"><span>פעולה</span><span>מבצע</span><span>פרטים</span><span>סוג</span><span className="sa-end">שעה</span><span/></div>
    <div className={'sa-list'+(busy?' is-busy':'')} aria-busy={busy||undefined}>{groups.map(g=><React.Fragment key={g.key+g.items[0].row.id}>
     <div className="sv2-tr sa-day" role="heading" aria-level={3}>{g.title}</div>
     {g.items.map(e=>{const id=String(e.row.id);return <AuditRow key={id} e={e} open={open===id} toggle={()=>setOpen(open===id?'':id)}/>;})}
    </React.Fragment>)}</div>
   </>
   :<div className="sv2-empty"><h3>{filtered?'לא נמצאו פעולות':'היומן נקי'}</h3><p>{filtered?'נסו חיפוש אחר או סוג אחר.':'הפעולות החדשות יירשמו כאן באופן אוטומטי.'}</p>{filtered?<button type="button" className="sv2-btn tint sm" onClick={()=>{setSearch('');setCat('all');reset();}}>הצגת כל היומן</button>:null}</div>}
   <OrderPager page={shown} total={rows.length} size={20} onChange={v=>{setPage(v);setOpen('');}}/>
  </section>
 </section>;
}

// 24.11.2026 (owner: the customer file's history showed "סטטוס: approved" in tall cards) The same rows as this log,
// for the actions of one customer: readable names, the order or article each action was on (opens it), day headings.
export function ActivityList({rows,resolve}:{rows:Row[];resolve?:(resource:string)=>Res}){
 const [open,setOpen]=useState(''),[page,setPage]=useState(1),[cat,setCat]=useState<string>('all');
 const all=useMemo(()=>rows.map(describe),[rows]);
 const list=all.filter(e=>cat==='all'||e.cat===cat),pages=Math.max(1,Math.ceil(list.length/20)),shown=Math.min(page,pages),slice=list.slice((shown-1)*20,shown*20);
 const counts=(c:Cat)=>all.filter(e=>e.cat===c).length;
 const views:[string,string,number][]=[['all','הכול',all.length],...catOrder.filter(c=>counts(c)>0).map(c=>[c,catLabels[c],counts(c)] as [string,string,number])];
 const groups:{key:string;title:string;items:Entry[]}[]=[];
 for(const e of slice){const d=new Date(e.row.created),key=valid(d)?dayKey(d):'none',last=groups[groups.length-1];if(last&&last.key===key)last.items.push(e);else groups.push({key,title:dayTitle(d),items:[e]});}
 if(!all.length)return <div className="sv2-empty"><h3>עדיין אין פעולות מתועדות</h3><p>פעולות על הלקוח, ההזמנות והכתבות שלו יופיעו כאן.</p></div>;
 return <section className="orders-match-screen sv2 sv2-orders sv2-fin sys-audit cf-audit" dir="rtl">
  <section className="sv2-card sa-board" aria-label="היסטוריית הפעולות של הלקוח" style={{backdropFilter:'none',WebkitBackdropFilter:'none'}}>
   {views.length>2&&<div className="sv2-tools sa-tools"><div className="sv2-seg sa-seg" role="group" aria-label="סינון לפי סוג הפעולה">{views.map(([key,label,count])=><button key={key} type="button" className={cat===key?'on':''} aria-pressed={cat===key} onClick={()=>{setCat(key);setPage(1);setOpen('');}}>{label}<b><bdi>{count}</bdi></b></button>)}</div></div>}
   <div className="sv2-th" style={cols} aria-hidden="true"><span>פעולה</span><span>מבצע</span><span>על מה</span><span>סוג</span><span className="sa-end">שעה</span><span/></div>
   <div className="sa-list">{groups.map(g=><React.Fragment key={g.key+g.items[0].row.id}>
    <div className="sv2-tr sa-day" role="heading" aria-level={3}>{g.title}</div>
    {g.items.map(e=>{const id=String(e.row.id);return <AuditRow key={id} e={e} open={open===id} toggle={()=>setOpen(open===id?'':id)} res={resolve&&e.row.resource?resolve(String(e.row.resource)):undefined} plainOnly/>;})}
   </React.Fragment>)}</div>
   <OrderPager page={shown} total={list.length} size={20} onChange={v=>{setPage(v);setOpen('');}}/>
  </section>
 </section>;
}

// One action: what (with the recorded text when it differs), who, a short line of details and the record, category, time.
type Res={label:string;go?:()=>void}|null;
function AuditRow({e,open,toggle,res,plainOnly=false}:{e:Entry;open:boolean;toggle:()=>void;res?:Res;plainOnly?:boolean}){
 const id=String(e.row.id),d=new Date(e.row.created),sum=summary(e),Icon=catIcons[e.cat],label=e.label||'פעולה';
 return <article className={'sa-rec is-tone-'+e.tone+(open?' is-open':'')}>
  <div className="sv2-tr sa-row" style={cols} onClick={toggle}>
   <div className="sv2-who sa-what"><span className={'sv2-thumb sa-ico is-c-'+e.cat} aria-hidden="true"><Icon size={19}/></span><span><b dir="auto">{e.label||'פעולה ללא שם'}</b>{!plainOnly&&e.label!==e.raw&&e.raw?<small dir="auto" title={e.raw}>{e.raw}</small>:null}</span></div>
   <span className="sa-actor"><small className="sv2-ml">מבצע</small><span className="sa-line">{e.row.actor||<span className="sa-muted">לא ידוע</span>}</span></span>
   <span className="sa-sum"><small className="sv2-ml">פרטים</small><span className="sa-line" dir="auto" title={sum||undefined}>{sum||<span className="sa-muted">אין פרטים</span>}</span>{res?(res.go?<button type="button" className="sa-reslink" onClick={ev=>{ev.stopPropagation();res.go?.();}}>{res.label}</button>:<span className="sa-reslabel">{res.label}</span>):res===undefined&&e.row.resource?<bdi className="sa-res" dir="ltr" title={String(e.row.resource)}>{String(e.row.resource)}</bdi>:null}</span>
   <span className="sa-cat"><span className={'sv2-pill sa-pill is-c-'+e.cat}>{catLabels[e.cat]}</span></span>
   <span className="sa-time">{valid(d)?<time dateTime={e.row.created}><bdi>{clock(d)}</bdi></time>:'—'}</span>
   <span className="sa-exp"><button type="button" className="sa-expand" aria-label={(open?'סגירת פירוט ':'פירוט ')+label} aria-expanded={open} aria-controls={'record-'+id} onClick={ev=>{ev.stopPropagation();toggle();}}>{open?<ChevronUp size={18} aria-hidden="true"/>:<ChevronDown size={18} aria-hidden="true"/>}</button></span>
  </div>
  {open&&<RecordPanel id={'record-'+id} title={label} onClose={toggle}><AuditPanel e={e}/></RecordPanel>}
 </article>;
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
 return <button type="button" className={'sv2-btn quiet sm sa-copy'+(state==='done'?' is-done':'')} onClick={copy}>{state==='done'?<Check size={15} aria-hidden="true"/>:<Copy size={15} aria-hidden="true"/>}<span role="status">{state==='done'?'הועתק':state==='error'?'ההעתקה לא הצליחה':'העתקת הנתונים'}</span></button>;
}
