'use client';
import React,{useId,useState} from 'react';
import {Check,Info,Landmark,Loader2,Plug,Settings,SlidersHorizontal,TriangleAlert} from 'lucide-react';
import {api,useData} from '@/lib/client';
import type {Row} from '@/lib/shared';
import type {Ctx} from './workspace';
import {OrdersAreaHead} from './orders-area-head';
import {OrderSummary} from './order-list-parts';
import {ConnectionForm,KeyPlace,connectionMeta} from './screens';
import {BankSettings} from './admin-finance';
import './admin-system-connections.css';

// 16.11.2026: "חיבורים והגדרות" in the approved v2 look. Same data (admin/settings), same dialogs
// (ConnectionForm, BankSettings) and the same API calls as the old SettingsView. What needs setup
// comes first and carries an orange stripe; ready connections are calm with a green one.
const testable=['ai','wordpress','images'];
const providerLabels:Record<string,string>={openai:'OpenAI',gemini:'Google Gemini',groq:'Groq',grok:'xAI / Grok',resend:'Resend',webhook:'Webhook'};
const ready=(c:Row)=>!!(c.enabled&&c.has_secret);
const keyInEnvironment=(c:Row)=>c.secret_storage==='environment'&&!!c.has_environment_secret;
const shortUrl=(raw:string)=>{try{const u=new URL(raw);return u.host+(u.pathname==='/'?'':u.pathname.replace(/\/$/,''));}catch{return raw;}};

export function AdminConnectionsPage({ctx}:{ctx:Ctx}){
 const state=useData('admin/settings',ctx.revision),settings=state.data;
 const keys=Object.keys(connectionMeta),connections:Row=settings?.connections||{},of=(k:string)=>connections[k]||{};
 const need=keys.filter(k=>!ready(of(k))),done=keys.filter(k=>ready(of(k))),inEnvironment=keys.filter(k=>keyInEnvironment(of(k))).length;
 const setup=(key:string)=>{const meta=connectionMeta[key],c=of(key);ctx.open({kind:'connection',title:'הגדרת '+meta.name,description:meta.description,render:(close:()=>void)=><ConnectionForm ctx={ctx} name={key} connection={c} close={close}/>});};
 const group=(title:string,list:string[])=>list.length>0&&<section className="scx-group" aria-label={title}>
  <h3 className="scx-group-title">{title}<span><bdi>{list.length}</bdi></span></h3>
  <div className="scx-grid">{list.map(k=><ConnectionCard key={k} ctx={ctx} name={k} c={of(k)} setup={()=>setup(k)}/>)}</div>
 </section>;
 return <section className="orders-match-screen sv2 sv2-orders sv2-fin sys-connections" dir="rtl">
  <OrdersAreaHead ctx={ctx} current="admin-connections" title="חיבורים והגדרות" sub="מפתחות נשמרים מוצפנים בצד השרת. כל חיבור מופעל בנפרד."/>
  {!settings?(state.error
   ?<div className="orders-reference-error" role="alert"><p>{state.error}</p><button type="button" onClick={ctx.refresh}>ניסיון נוסף</button></div>
   :<div className="orders-reference-loading" role="status">טוען חיבורים…</div>)
  :<div className="scx-body">
   {state.error&&<div className="orders-reference-error" role="alert"><p>{state.error}</p><button type="button" onClick={ctx.refresh}>ניסיון נוסף</button></div>}
   <OrderSummary items={[
    ['פעילים',<bdi key="d">{done.length}</bdi>,done.length?'ok':undefined,<>מתוך <bdi>{keys.length}</bdi> חיבורים</>],
    ['דורשים הגדרה',<bdi key="n">{need.length}</bdi>,need.length?'report':undefined,need.length?need.map(k=>connectionMeta[k].name).join(', '):'הכול מוגדר'],
    ['מפתח במשתנה סביבה',<bdi key="e">{inEnvironment}</bdi>,undefined,<>מתוך <bdi>{keys.length}</bdi> חיבורים</>],
   ]}/>
   {group('דורשים הגדרה',need)}
   {group('פעילים',done)}
   <p className="scx-notice"><Info size={16} aria-hidden="true"/><span>חיבור דורש חשבון והרשאות משלכם אצל הספק. פרסום ישיר יבוצע רק לאתר שהוגדר לו חיבור מאומת ולאחר אישור הכתבה.</span></p>
   <section className="scx-group" aria-label="הגדרות כלליות">
    <h3 className="scx-group-title">הגדרות כלליות</h3>
    <div className="scx-grid">
     <SystemCard ctx={ctx} settings={settings}/>
     <article className="scx-card is-plain">
      <header className="scx-card-head"><span className="scx-icon" aria-hidden="true"><Landmark size={20}/></span><h4>פרטי בנק להעברות לקוחות</h4></header>
      <p className="scx-desc">עדכון פרטי החשבון שמופיעים בחלונית הטענת יתרה.</p>
      <div className="scx-foot"><div className="scx-actions"><button type="button" className="om-btn" onClick={()=>ctx.open({kind:'admin-finance',title:'פרטי הבנק להעברה',render:(close:()=>void)=><BankSettings ctx={ctx} close={close}/>})}><Landmark size={16} aria-hidden="true"/>עדכון פרטי הבנק</button></div></div>
     </article>
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
 if(name==='wordpress'&&c.username)list.push(<span key="n">משתמש <bdi dir="ltr">{c.username}</bdi></span>);
 if(name==='wordpress'&&c.url&&c.auto_publish!==undefined)list.push(<span key="a">{c.auto_publish?'פרסום חי אחרי אישור':'נשמר כטיוטה ב־WordPress'}</span>);
 return list;
}

function ConnectionCard({ctx,name,c,setup}:{ctx:Ctx;name:string;c:Row;setup:()=>void}){
 const meta=connectionMeta[name],Icon=meta.icon,ok=ready(c),id=useId(),details=facts(name,c);
 const [test,setTest]=useState<{busy?:boolean;ok?:boolean;text?:string}>({});
 const runTest=()=>{if(test.busy)return;setTest({busy:true});ctx.run(()=>api('admin/integration/'+name+'/test','POST',{}),'החיבור אומת').then(()=>setTest({ok:true,text:'החיבור אומת עכשיו'})).catch(e=>setTest({ok:false,text:(e as Error).message||'הבדיקה נכשלה'}));};
 return <article className={'scx-card '+(ok?'is-ok':'is-need')} aria-labelledby={id}>
  <header className="scx-card-head">
   <span className="scx-icon" aria-hidden="true"><Icon size={20}/></span>
   <h4 id={id}>{meta.name}</h4>
   <span className={'om-pill'+(ok?' is-ok':'')}>{ok?'מוגדר':'דורש הגדרה'}</span>
  </header>
  <p className="scx-desc">{meta.description}</p>
  {details.length>0&&<p className="scx-facts">{details.map((d,i)=><React.Fragment key={i}>{i>0&&<i aria-hidden="true">·</i>}{d}</React.Fragment>)}</p>}
  {c.has_secret&&!c.enabled&&<p className="scx-hint"><TriangleAlert size={15} aria-hidden="true"/><span>יש מפתח, אבל החיבור כבוי. מפעילים אותו בהגדרת החיבור.</span></p>}
  {name==='email'&&c.provider==='resend'&&c.test_to&&<p className="scx-hint"><TriangleAlert size={15} aria-hidden="true"/><span>מצב בדיקה: כל המיילים נשלחים רק אל <bdi dir="ltr">{c.test_to}</bdi></span></p>}
  <div className="scx-foot">
   <KeyPlace c={c}/>
   <div className="scx-actions">
    <button type="button" className={'om-btn'+(ok?'':' is-primary')} onClick={setup}><Settings size={16} aria-hidden="true"/>הגדרת חיבור</button>
    {testable.includes(name)&&<button type="button" className="om-btn is-quiet" disabled={!c.has_secret} aria-busy={test.busy||undefined} title={c.has_secret?undefined:'אפשר לבדוק אחרי שמגדירים מפתח'} onClick={runTest}>{test.busy?<Loader2 className="om-spin" size={16} aria-hidden="true"/>:<Plug size={16} aria-hidden="true"/>}{test.busy?'בודק…':'בדיקת חיבור'}</button>}
   </div>
   {test.text&&!test.busy&&<p className={'scx-result '+(test.ok?'is-ok':'is-fail')} role="status">{test.ok?<Check size={15} aria-hidden="true"/>:<TriangleAlert size={15} aria-hidden="true"/>}<span>{test.text}</span></p>}
  </div>
 </article>;
}

// System name and VAT: same PATCH admin/settings as SystemSettings in screens.tsx.
function SystemCard({ctx,settings}:{ctx:Ctx;settings:Row}){
 const [brand,setBrand]=useState(settings.brand),[vat,setVat]=useState(String(settings.vat)),[busy,setBusy]=useState(false),id=useId();
 const dirty=brand!==settings.brand||vat!==String(settings.vat);
 const save=(e:React.FormEvent)=>{e.preventDefault();if(busy)return;setBusy(true);ctx.run(()=>api('admin/settings','PATCH',{brand,vat:Number(vat)})).catch(()=>{}).finally(()=>setBusy(false));};
 return <article className="scx-card is-plain">
  <header className="scx-card-head"><span className="scx-icon" aria-hidden="true"><SlidersHorizontal size={20}/></span><h4>הגדרות מערכת</h4></header>
  <form className="scx-form" onSubmit={save}>
   <div className="scx-fields">
    <label className="scx-field" htmlFor={id+'b'}><span>שם המערכת</span><input id={id+'b'} value={brand} onChange={e=>setBrand(e.target.value)}/></label>
    <label className="scx-field" htmlFor={id+'v'}><span>אחוז מע״מ</span><span className="scx-suffix"><input id={id+'v'} type="number" inputMode="decimal" min={0} max={50} value={vat} onChange={e=>setVat(e.target.value)}/><i aria-hidden="true">%</i></span></label>
   </div>
   <div className="scx-foot"><div className="scx-actions"><button type="submit" className={'om-btn'+(dirty?' is-primary':'')} aria-busy={busy||undefined}>{busy?<Loader2 className="om-spin" size={16} aria-hidden="true"/>:<Check size={16} aria-hidden="true"/>}{busy?'שומר…':'שמירת הגדרות'}</button>{dirty&&!busy&&<small className="scx-dirty" role="status">יש שינויים שלא נשמרו</small>}</div></div>
  </form>
 </article>;
}
