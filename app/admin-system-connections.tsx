'use client';
import React,{useId,useState} from 'react';
import {Check,Landmark,Loader2,Plug,Settings,SlidersHorizontal,TriangleAlert} from 'lucide-react';
import {api,useData} from '@/lib/client';
import type {Row} from '@/lib/shared';
import type {Ctx} from './workspace';
import {OrdersAreaHead} from './orders-area-head';
import {ConnectionForm,KeyPlace,connectionMeta} from './screens';
import {BankSettings} from './admin-finance';
import './supplier-v2.css';
import './admin-system-connections.css';

// 22.11.2026 (owner: "like the other admin pages"): "חיבורים והגדרות" in the same look as the suppliers,
// orders and content lists: one white card with filter chips, a table of rows and a blue action per row.
// Same data (admin/settings), same dialogs (ConnectionForm, BankSettings) and the same API calls as before.
const testable=['ai','wordpress','images','pixabay','invoices'];
const providerLabels:Record<string,string>={anthropic:'Claude (Anthropic)',openai:'OpenAI',gemini:'Google Gemini',groq:'Groq',grok:'xAI / Grok',resend:'Resend',webhook:'Webhook'};
const ready=(c:Row)=>!!(c.enabled&&c.has_secret);
const shortUrl=(raw:string)=>{try{const u=new URL(raw);return u.host+(u.pathname==='/'?'':u.pathname.replace(/\/$/,''));}catch{return raw;}};
// Flexible columns so "הגדרה" and "בדיקה" stay inside the card from 1100px up (owner 23.11.2026).
// The buttons column has a fixed width so the header titles stay above their values.
const cols={gridTemplateColumns:'minmax(170px,1.7fr) minmax(80px,.9fr) minmax(120px,1fr) 100px 172px'};
type Filter='all'|'need'|'ok';

export function AdminConnectionsPage({ctx}:{ctx:Ctx}){
 const state=useData('admin/settings',ctx.revision),settings=state.data;
 const [filter,setFilter]=useState<Filter>('all');
 const keys=Object.keys(connectionMeta),connections:Row=settings?.connections||{},of=(k:string)=>connections[k]||{};
 const need=keys.filter(k=>!ready(of(k))),done=keys.filter(k=>ready(of(k)));
 const shown=filter==='need'?need:filter==='ok'?done:[...need,...done];
 const setup=(key:string)=>{const meta=connectionMeta[key],c=of(key);ctx.open({kind:'connection',title:'הגדרת '+meta.name,description:meta.description,render:(close:()=>void)=><ConnectionForm ctx={ctx} name={key} connection={c} close={close}/>});};
 const chips:[Filter,string,number][]=[['all','הכל',keys.length],['need','דורשים הגדרה',need.length],['ok','פעילים',done.length]];
 return <section className="orders-match-screen sv2 sv2-orders sv2-fin sys-connections" dir="rtl">
  <OrdersAreaHead ctx={ctx} current="admin-connections" title="חיבורים והגדרות" sub="מפתחות נשמרים מוצפנים בצד השרת. כל חיבור מופעל בנפרד."/>
  {!settings?(state.error
   ?<div className="orders-reference-error" role="alert"><p>{state.error}</p><button type="button" onClick={ctx.refresh}>ניסיון נוסף</button></div>
   :<div className="orders-reference-loading" role="status">טוען חיבורים…</div>)
  :<div className="scx-body">
   {state.error&&<div className="orders-reference-error" role="alert"><p>{state.error}</p><button type="button" onClick={ctx.refresh}>ניסיון נוסף</button></div>}
   <section className="sv2-card" aria-label="חיבורים">
    <div className="sv2-tools">
     <div className="sv2-seg" role="group" aria-label="סינון חיבורים">{chips.map(([key,label,count])=><button key={key} type="button" className={filter===key?'on':''} aria-pressed={filter===key} onClick={()=>setFilter(key)}>{label}<b><bdi>{count}</bdi></b></button>)}</div>
    </div>
    <div className="sv2-th" style={cols} aria-hidden="true"><span>חיבור</span><span>פרטים שמורים</span><span>מפתח</span><span>מצב</span><span/></div>
    {shown.length?shown.map(k=><ConnectionRow key={k} ctx={ctx} name={k} c={of(k)} setup={()=>setup(k)}/>)
     :<div className="sv2-empty"><h3>{filter==='need'?'כל החיבורים מוגדרים':'עדיין אין חיבור פעיל'}</h3><p>{filter==='need'?'אין כרגע חיבור שדורש הגדרה.':'חיבור נעשה פעיל אחרי שמגדירים לו מפתח ומפעילים אותו.'}</p></div>}
    <div className="sv2-foot"><span>חיבור דורש חשבון והרשאות משלכם אצל הספק. פרסום ישיר יבוצע רק לאתר שהוגדר לו חיבור מאומת ולאחר אישור הכתבה.</span></div>
   </section>
   <section className="sv2-card" aria-labelledby="scx-general">
    <div className="sv2-tools"><h3 id="scx-general" className="scx-title">הגדרות כלליות</h3></div>
    <SystemRow ctx={ctx} settings={settings}/>
    <div className="sv2-tr scx-plain">
     <div className="sv2-who"><span className="sv2-thumb scx-ico" aria-hidden="true"><Landmark size={20}/></span><span><b>פרטי בנק להעברות לקוחות</b><small>החשבון שמופיע ללקוח בחלונית הטענת יתרה</small></span></div>
     <span className="sv2-rowact"><button type="button" className="sv2-btn tint sm" onClick={()=>ctx.open({kind:'admin-finance',title:'פרטי הבנק להעברה',render:(close:()=>void)=><BankSettings ctx={ctx} close={close}/>})}><Landmark size={15} aria-hidden="true"/>עדכון פרטי הבנק</button></span>
    </div>
   </section>
  </div>}
 </section>;
}

// Saved details worth seeing without opening the dialog (all from admin/settings).
function facts(name:string,c:Row){
 const list:React.ReactNode[]=[];
 if((name==='ai'||name==='email')&&c.provider&&providerLabels[c.provider])list.push(<span key="p">{providerLabels[c.provider]}</span>);
 if(name==='ai'&&c.model)list.push(<bdi key="m" dir="ltr">{c.model}</bdi>);
 if(name==='email'&&c.provider==='resend'&&c.from)list.push(<span key="f">שולח <bdi dir="ltr">{c.from}</bdi></span>);
 if(c.url&&!(name==='email'&&c.provider==='resend'))list.push(<bdi key="u" dir="ltr" title={c.url}>{shortUrl(c.url)}</bdi>);
 if(name==='invoices'&&c.environment)list.push(<span key="e">{c.environment==='sandbox'?'סביבת ניסיון':'חשבון אמיתי'}</span>);
 if(name==='wordpress'&&c.username)list.push(<span key="n">משתמש <bdi dir="ltr">{c.username}</bdi></span>);
 if(name==='wordpress'&&c.url&&c.auto_publish!==undefined)list.push(<span key="a">{c.auto_publish?'פרסום חי אחרי אישור':'נשמר כטיוטה ב־WordPress'}</span>);
 return list;
}

function ConnectionRow({ctx,name,c,setup}:{ctx:Ctx;name:string;c:Row;setup:()=>void}){
 const meta=connectionMeta[name],Icon=meta.icon,ok=ready(c),details=facts(name,c);
 const [test,setTest]=useState<{busy?:boolean;ok?:boolean;text?:string}>({});
 const runTest=()=>{if(test.busy)return;setTest({busy:true});ctx.run(()=>api('admin/integration/'+name+'/test','POST',{}),'החיבור אומת').then(()=>setTest({ok:true,text:'החיבור אומת עכשיו'})).catch(e=>setTest({ok:false,text:(e as Error).message||'הבדיקה נכשלה'}));};
 return <div className="sv2-tr scx-row" style={cols}>
  <div className="sv2-who"><span className="sv2-thumb scx-ico" aria-hidden="true"><Icon size={20}/></span><span><b>{meta.name}</b><small title={meta.description}>{meta.description}</small></span></div>
  <span className="scx-facts"><small className="sv2-ml">פרטים שמורים</small>{details.length?details.map((d,i)=><React.Fragment key={i}>{i>0&&<i aria-hidden="true">·</i>}{d}</React.Fragment>):<em>—</em>}</span>
  <span className="scx-key"><small className="sv2-ml">מפתח</small><KeyPlace c={c} compact/></span>
  <span className={'sv2-state '+(ok?'on':'wait')}><i/>{ok?'פעיל':'דורש הגדרה'}</span>
  <span className="sv2-rowact">
   <button type="button" className={'sv2-btn sm '+(ok?'tint':'primary')} onClick={setup}><Settings size={15} aria-hidden="true"/>הגדרה</button>
   {testable.includes(name)&&<button type="button" className="sv2-btn quiet sm" disabled={!c.has_secret} aria-busy={test.busy||undefined} title={c.has_secret?undefined:'אפשר לבדוק אחרי שמגדירים מפתח'} onClick={runTest}>{test.busy?<Loader2 className="om-spin" size={15} aria-hidden="true"/>:<Plug size={15} aria-hidden="true"/>}{test.busy?'בודק…':'בדיקה'}</button>}
  </span>
  {(c.has_secret&&!c.enabled||name==='email'&&c.provider==='resend'&&c.test_to||test.text&&!test.busy)&&<div className="scx-notes">
   {c.has_secret&&!c.enabled&&<p className="scx-hint"><TriangleAlert size={15} aria-hidden="true"/><span>יש מפתח, אבל החיבור כבוי. מפעילים אותו בהגדרת החיבור.</span></p>}
   {name==='email'&&c.provider==='resend'&&c.test_to&&<p className="scx-hint"><TriangleAlert size={15} aria-hidden="true"/><span>מצב בדיקה: כל המיילים נשלחים רק אל <bdi dir="ltr">{c.test_to}</bdi></span></p>}
   {test.text&&!test.busy&&<p className={'scx-result '+(test.ok?'is-ok':'is-fail')} role="status">{test.ok?<Check size={15} aria-hidden="true"/>:<TriangleAlert size={15} aria-hidden="true"/>}<span>{test.text}</span></p>}
  </div>}
 </div>;
}

// System name and VAT: same PATCH admin/settings as SystemSettings in screens.tsx.
function SystemRow({ctx,settings}:{ctx:Ctx;settings:Row}){
 const [brand,setBrand]=useState(settings.brand),[vat,setVat]=useState(String(settings.vat)),[busy,setBusy]=useState(false),id=useId();
 const dirty=brand!==settings.brand||vat!==String(settings.vat);
 const save=(e:React.FormEvent)=>{e.preventDefault();if(busy)return;setBusy(true);ctx.run(()=>api('admin/settings','PATCH',{brand,vat:Number(vat)})).catch(()=>{}).finally(()=>setBusy(false));};
 return <form className="sv2-tr scx-plain scx-system" onSubmit={save}>
  <div className="sv2-who"><span className="sv2-thumb scx-ico" aria-hidden="true"><SlidersHorizontal size={20}/></span><span><b>הגדרות מערכת</b><small>שם המערכת ואחוז המע״מ בחשבונות</small></span></div>
  <div className="scx-fields">
   <label className="scx-field" htmlFor={id+'b'}><span>שם המערכת</span><input id={id+'b'} value={brand} onChange={e=>setBrand(e.target.value)}/></label>
   <label className="scx-field is-vat" htmlFor={id+'v'}><span>אחוז מע״מ</span><span className="scx-suffix"><input id={id+'v'} type="number" inputMode="decimal" min={0} max={50} value={vat} onChange={e=>setVat(e.target.value)}/><i aria-hidden="true">%</i></span></label>
  </div>
  <span className="sv2-rowact">{dirty&&!busy&&<small className="scx-dirty" role="status">יש שינויים שלא נשמרו</small>}<button type="submit" className={'sv2-btn sm '+(dirty?'primary':'tint')} aria-busy={busy||undefined}>{busy?<Loader2 className="om-spin" size={15} aria-hidden="true"/>:<Check size={15} aria-hidden="true"/>}{busy?'שומר…':'שמירה'}</button></span>
 </form>;
}
