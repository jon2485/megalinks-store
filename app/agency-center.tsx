'use client';
// Agency centre (design/agency-dashboard/spec.md). A full page inside the personal area for accounts of type "סוכנות":
// header band, section tabs, and the customers page (list on the right, one customer's screen with tabs).
// Every action uses the existing records and routes, so nothing here is a copy of "הכתבות שלי" or "ההזמנות שלי".
import React,{useEffect,useMemo,useRef,useState} from 'react';
import {ArrowRight,ShoppingCart,Users,Globe,Search,UserPlus,FileText,IdCard,Download,ExternalLink,Archive,ArchiveRestore,Save,LoaderCircle,Plus,X,ShieldBan,ClipboardPaste,Upload,Trash2,LayoutDashboard,ListChecks,Wallet,PencilLine,RotateCcw,CreditCard,CalendarClock,Trophy,ChartColumn,FilePen,Link2,NotebookPen,Pin,PinOff,Printer,Settings as SettingsIcon,FileSpreadsheet,CalendarDays,ChevronRight,ChevronLeft,PackageOpen,ArrowLeft,Eye} from 'lucide-react';
import {api,useData} from '@/lib/client';
import {type Row,stages} from '@/lib/shared';
import {purchaseStage,purchaseStages} from '@/lib/purchased-history';
import type {Ctx} from './workspace';
import {setBuyingFor} from './agency-buying';
import './agency-center.css';
import {hasAgencyCentre,agencyCentreName} from '@/lib/agency-shared';

const SECTIONS=[['overview','סקירה',LayoutDashboard],['customers','לקוחות',Users],['publications','פרסומים',Globe],['tasks','לטיפול',ListChecks],['calendar','לוח פרסומים',CalendarDays],['reports','דוחות',ChartColumn],['settings','הגדרות',SettingsIcon]] as const;
const CUSTOMER_TABS=[['publications','פרסומים',Globe],['articles','כתבות',FileText],['used-sites','אתרים שכבר שימשו',ShieldBan],['links','קישורים ועוגנים',Link2],['notes','הערות',NotebookPen],['details','פרטים',IdCard]] as const;
const COLORS=['#1673e6','#7c3aed','#0f9f8f','#ea580c','#b45309','#db2777','#0369a1','#16a34a','#0891b2','#65a30d','#c2410c','#be185d'];
const colorFor=(id:string)=>COLORS[[...String(id)].reduce((s,c)=>s+c.charCodeAt(0),0)%COLORS.length];
const ils=(cents:number)=>'₪'+(Math.round(Number(cents||0))/100).toLocaleString('he-IL',{maximumFractionDigits:2});
const day=(iso:string)=>iso?new Date(iso).toLocaleDateString('he-IL',{timeZone:'Asia/Jerusalem',day:'2-digit',month:'2-digit',year:'numeric'}):'—';
const norm=(v:unknown)=>String(v||'').trim().toLocaleLowerCase();
const plain=(e:React.MouseEvent)=>e.button===0&&!e.metaKey&&!e.ctrlKey&&!e.shiftKey&&!e.altKey;

// A site's logo, or the globe icon when there is none or it does not load.
// The site's logo; if there is none or it does not load, the site's name in the same tile (as on the catalog cards).
function SiteLogo({src,name}:{src?:string;name?:string}){const [failed,setFailed]=useState(false);const label=String(name||'').trim();return <span className="ag-logo">{src&&!failed?<img src={src} alt="" style={{width:'100%',height:'100%',borderRadius:9,objectFit:'contain'}} onError={()=>setFailed(true)}/>:label?<span className="nm" aria-hidden="true">{label.split(/\s+/)[0].slice(0,8)}</span>:<Globe size={17}/>}</span>;}
function Avatar({name,id,size=36}:{name:string;id:string;size?:number}){return <span className="ag-av" aria-hidden="true" style={{background:colorFor(id),width:size,height:size,fontSize:Math.round(size*.42)}}>{String(name||'?').trim().charAt(0)||'?'}</span>;}
// Phone: a row that scrolls sideways fades on the side that still hides items, and brings the current item into view.
function useScrollHint<T extends HTMLElement>(current?:string){
 const ref=useRef<T>(null);
 useEffect(()=>{const el=ref.current;if(!el)return;
  const mark=()=>{const max=el.scrollWidth-el.clientWidth,x=Math.abs(el.scrollLeft);el.dataset.more=max<4?'':(x>4?'s':'')+(x<max-4?'e':'');};
  const on=el.querySelector('[aria-current],[aria-selected=true]');
  if(on){const a=on.getBoundingClientRect(),r=el.getBoundingClientRect();if(a.left<r.left+28)el.scrollLeft-=r.left+28-a.left;else if(a.right>r.right-28)el.scrollLeft+=a.right-(r.right-28);}
  mark();el.addEventListener('scroll',mark,{passive:true});const ro=new ResizeObserver(mark);ro.observe(el);
  return()=>{el.removeEventListener('scroll',mark);ro.disconnect();};
 },[current]);
 return ref;
}
function useNarrow(){
 const [narrow,setNarrow]=useState(false);
 useEffect(()=>{const m=window.matchMedia('(max-width:760px)'),f=()=>setNarrow(m.matches);f();m.addEventListener('change',f);return()=>m.removeEventListener('change',f);},[]);
 return narrow;
}
function Link({ctx,to,className,children,label,current}:{ctx:Ctx;to:string;className?:string;children:React.ReactNode;label?:string;current?:boolean}){
 return <a href={'/'+to} className={className} aria-label={label} aria-current={current?'page':undefined} onClick={e=>{if(!plain(e))return;e.preventDefault();ctx.go(to);}}>{children}</a>;
}

// Where the centre reads its data and where its links go. The admin's read-only view (owner's decision 4) reads through
// /api/admin/agency-view/<user>/... (GET only on the server) and stays under /admin-agency-view/<user>/...
let AP='agency',RP='purchased/agency';
export default function AgencyCenter({ctx,view,viewAs}:{ctx:Ctx;view:string;viewAs?:string}){
 const rest=view.split('/').slice(2),section=rest[0]||'overview';
 const owner=useData(viewAs?'admin/agency-view/'+encodeURIComponent(viewAs):'',0,!!viewAs);
 const who=viewAs?owner.data?.user:ctx.user;
 AP=viewAs?'admin/agency-view/'+encodeURIComponent(viewAs):'agency';RP=viewAs?'admin-agency-view/'+encodeURIComponent(viewAs):'purchased/agency';
 const agency=viewAs?ctx.user?.role==='admin':hasAgencyCentre(ctx.user),name=agencyCentreName(who);
 const tabsRef=useScrollHint<HTMLElement>(section+(who?'1':'0'));
 useEffect(()=>{if(ctx.user&&!agency&&!viewAs)ctx.go('purchased/customers');},[agency,ctx,viewAs]);
 if(!agency)return <section className="ag" dir="rtl"><div className="ag-card ag-empty"><Users size={34}/><h3>ניהול הלקוחות פתוח לחשבונות לקוח</h3><p>מעבירים אתכם לרשימת הלקוחות שלכם.</p></div></section>;
 if(viewAs&&owner.error)return <section className="ag" dir="rtl"><p className="ag-alert" role="alert">{owner.error}</p></section>;
 if(viewAs&&!who)return <section className="ag" dir="rtl"><div className="ag-skel" style={{height:160}}/></section>;
 return <section className={'ag'+(viewAs?' readonly':'')} dir="rtl" aria-labelledby="ag-title">
  {viewAs&&<div className="ag-viewas" role="status"><Eye size={17} aria-hidden="true"/><span><b>צפייה בלבד</b> · כך <bdi>{who.company||who.name}</bdi> רואה את {name}. אי אפשר לשנות דבר, והצפייה נרשמה ביומן הפעולות.</span><Link ctx={ctx} to={'admin-customer-account/'+encodeURIComponent(viewAs)+'/agency'} className="ag-btn ghost sm"><ArrowRight size={15} aria-hidden="true"/>חזרה לכרטיס</Link></div>}
  <header className="ag-band">
   {!viewAs&&<><Link ctx={ctx} to="purchased" className="ag-btn ghost sm"><ArrowRight size={16}/>לאזור האישי</Link><span className="sep"/></>}
   <img src="/brand/megalinks-logo-dark.png" alt="Mega Links" width={140} height={30}/>
   <span className="sep"/>
   <div className="grow"><h1 id="ag-title">{name}</h1><p><bdi>{who?.company||who?.name}</bdi></p></div>
   {!viewAs&&<button type="button" className="ag-btn buy" onClick={()=>ctx.go('catalog')}><ShoppingCart size={18}/>רכישת פרסום</button>}
  </header>
  <nav className="ag-tabs" ref={tabsRef} aria-label={name}>{SECTIONS.map(([key,label,Icon])=><Link key={key} ctx={ctx} to={RP+'/'+key} current={section===key} className=""><Icon size={18} aria-hidden="true"/>{label}</Link>)}</nav>
  {section==='overview'?<Overview ctx={ctx}/>:section==='reports'?<section className="ag-card ag-main"><h2 className="ag-page-title">דוחות</h2><Reports ctx={ctx}/></section>:section==='calendar'?<section className="ag-card ag-main"><h2 className="ag-page-title">לוח פרסומים</h2><Calendar ctx={ctx}/></section>:section==='settings'?<section className="ag-card ag-main"><h2 className="ag-page-title">{who?.role==='agency'?'הגדרות הסוכנות':'הגדרות'}</h2><AgencySettings ctx={ctx}/></section>:section==='tasks'?<section className="ag-card ag-main"><h2 className="ag-page-title">לטיפול</h2><Tasks ctx={ctx}/></section>
   :section==='publications'?<section className="ag-card ag-main"><h2 className="ag-page-title">כל הפרסומים</h2><Publications ctx={ctx} customer=""/></section>
   :<Customers ctx={ctx} customerId={rest[1]||''} tab={rest[2]||''}/>}
 </section>;
}

// ---------- customers ----------
function Customers({ctx,customerId,tab}:{ctx:Ctx;customerId:string;tab:string}){
 const state=useData(AP+'/customers',ctx.revision),all:Row[]=state.data?.customers||[];
 const [query,setQuery]=useState(''),[filter,setFilter]=useState<'active'|'archived'|'all'>('active');
 const counts={active:all.filter(c=>c.status!=='archived').length,archived:all.filter(c=>c.status==='archived').length};
 const rows=all.filter(c=>(filter==='all'||(filter==='archived')===(c.status==='archived'))&&(!query||[c.name,c.company,c.email,c.phone,c.contact_name,...(c.domains||[])].some(v=>norm(v).includes(norm(query)))));
 const isNew=customerId==='new';
 // On a wide screen the first customer opens by itself; on a phone the list comes first.
 const shown=isNew?null:all.find(c=>c.id===customerId)||(!customerId?rows[0]||all[0]:null);
 const open=!!customerId;
 return <div className="ag-split" data-open={open}>
  <aside className="ag-card ag-list" aria-label="הלקוחות שלי">
   <div className="ag-list-top">
    <label className="ag-search"><Search size={17} aria-hidden="true"/><input type="search" placeholder="חיפוש לקוח או דומיין" aria-label="חיפוש לקוח לפי שם, חברה, מייל, טלפון או דומיין" value={query} onChange={e=>setQuery(e.target.value)}/>{query&&<button type="button" className="ag-icon-btn" aria-label="ניקוי החיפוש" onClick={()=>setQuery('')}><X size={16}/></button>}</label>
    <Link ctx={ctx} to={RP+'/customers/new'} className="ag-btn primary sm" label="לקוח חדש"><UserPlus size={17}/></Link>
   </div>
   <div className="ag-seg" role="group" aria-label="סינון לקוחות">{([['active','פעילים',counts.active],['archived','ארכיון',counts.archived],['all','הכול',all.length]] as const).map(([key,label,n])=><button key={key} type="button" aria-pressed={filter===key} onClick={()=>setFilter(key)}>{label} · <bdi>{n}</bdi></button>)}</div>
   <div className="ag-list-items" role="list">
    {state.error&&<p className="ag-alert" role="alert">{state.error}</p>}
    {state.loading&&!state.data?[0,1,2,3].map(i=><div key={i} className="ag-cust"><span className="ag-av" style={{background:'#e8eef5'}}/><span className="t"><span className="ag-skel" style={{width:'70%'}}/></span></div>)
     :!rows.length?<div className="ag-empty"><Users size={28}/><h3>{query?'לא נמצאו לקוחות':filter==='archived'?'אין לקוחות בארכיון':'עדיין אין לקוחות'}</h3><p>{query?'נסו חיפוש אחר.':'מוסיפים לקוח, ומשייכים אליו כתבות ופרסומים.'}</p></div>
     :rows.map(c=><div role="listitem" key={c.id}><Link ctx={ctx} to={RP+'/customers/'+encodeURIComponent(c.id)} current={shown?.id===c.id} className={'ag-cust'+(shown?.id===c.id?' on':'')}><Avatar name={c.name} id={c.id}/><span className="t"><b>{c.name}</b><small>{c.company||c.domains?.[0]||' '}</small></span>{c.stats?.waiting>0&&<span className="ag-pending" aria-label={c.stats.waiting+' כתבות מחכות לכם'}>{c.stats.waiting}</span>}</Link></div>)}
   </div>
  </aside>
  <section className="ag-card ag-main" aria-live="polite">
   {open&&<Link ctx={ctx} to={RP+'/customers'} className="ag-back"><ArrowRight size={16}/>כל הלקוחות</Link>}
   {isNew?<CustomerDetails ctx={ctx} customer={null}/>
    :shown?<CustomerScreen key={shown.id} ctx={ctx} customer={shown} tab={tab}/>
    :state.loading?<div className="ag-skel" style={{height:24,width:'40%'}}/>
    :customerId?<div className="ag-empty"><Users size={30}/><h3>הלקוח לא נמצא</h3><p>ייתכן שנמחק. בחרו לקוח מהרשימה.</p></div>
    :<div className="ag-empty"><UserPlus size={30}/><h3>הוסיפו את הלקוח הראשון</h3><p>שומרים את פרטי הלקוח, ואז רואים במקום אחד את כל מה שפורסם עבורו.</p><Link ctx={ctx} to={RP+'/customers/new'} className="ag-btn primary"><Plus size={17}/>לקוח חדש</Link></div>}
  </section>
 </div>;
}

function CustomerScreen({ctx,customer,tab}:{ctx:Ctx;customer:Row;tab:string}){
 const current=CUSTOMER_TABS.some(([k])=>k===tab)?tab:'publications';
 const base=RP+'/customers/'+encodeURIComponent(customer.id);
 const ctabsRef=useScrollHint<HTMLDivElement>(current);
 return <>
  <div className="ag-chead">
   <Avatar name={customer.name} id={customer.id} size={54}/>
   <div style={{flex:1,minWidth:0}}><h2>{customer.name}</h2>
    <div className="ag-chips">{customer.company&&<span className="ag-chip">{customer.company}</span>}{(customer.domains||[]).slice(0,2).map((d:string)=><span key={d} className="ag-chip"><Globe size={13}/><span className="ag-ltr">{d}</span></span>)}{(customer.tags||[]).map((t:string)=><span key={t} className="ag-chip tag">{t}</span>)}{customer.status==='archived'&&<span className="ag-chip">בארכיון</span>}</div>
   </div>
   {customer.status!=='archived'&&<div className="ag-head-actions"><button type="button" className="ag-btn buy" onClick={()=>{setBuyingFor({id:customer.id,name:customer.name});ctx.go('catalog');}}><Plus size={17}/>רכישה עבור הלקוח</button></div>}
  </div>
  {customer.stats?.unused>0&&current!=='articles'&&<button type="button" className="ag-unused-banner" onClick={()=>ctx.go(base+'/articles')}><PackageOpen size={18} aria-hidden="true"/><span><b><bdi>{customer.stats.unused}</bdi> {customer.stats.unused===1?'כתבה נרכשה':'כתבות נרכשו'} ללקוח ועוד לא {customer.stats.unused===1?'נוצלה':'נוצלו'}</b></span><span className="go">לצפייה<ArrowLeft size={15} aria-hidden="true"/></span></button>}
  <div className="ag-ctabs" ref={ctabsRef} role="tablist" aria-label={'הלקוח '+customer.name}>{CUSTOMER_TABS.map(([key,label,Icon])=><button key={key} type="button" role="tab" aria-selected={current===key} className={current===key?'on':''} onClick={()=>ctx.go(base+'/'+key)}><Icon size={16} aria-hidden="true"/>{label}{key==='articles'&&customer.stats?.waiting>0&&<span className="ag-pending">{customer.stats.waiting}</span>}</button>)}</div>
  <div role="tabpanel">
   {current==='details'?<CustomerDetails ctx={ctx} customer={customer}/>:current==='used-sites'?<UsedSites ctx={ctx} customer={customer}/>:current==='links'?<CustomerLinks ctx={ctx} customer={customer}/>:current==='notes'?<CustomerNotes ctx={ctx} customer={customer}/>:current==='articles'?<CustomerArticles ctx={ctx} customer={customer}/>:<Publications ctx={ctx} customer={customer.id}/>}
  </div>
 </>;
}

// ---------- details ----------
function CustomerDetails({ctx,customer}:{ctx:Ctx;customer:Row|null}){
 const initial=()=>({name:customer?.name||'',company:customer?.company||'',contact_name:customer?.contact_name||'',email:customer?.email||'',phone:customer?.phone||'',domains:(customer?.domains||[]).join('\n'),tags:(customer?.tags||[]).join(', '),monthly_budget_ils:customer?.monthly_budget_cents?String(customer.monthly_budget_cents/100):'',notes:customer?.notes||''});
 const [v,setV]=useState(initial),[busy,setBusy]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState(false);
 const set=(k:string,value:string)=>{setV(x=>({...x,[k]:value}));setSaved(false);};
 const save=async(status?:string)=>{if(busy)return;if(!v.name.trim()){setError('יש להזין את שם הלקוח');return;}setBusy(true);setError('');try{
   const body={...v,name:v.name.trim(),domains:v.domains.split(/[\n,]+/),tags:v.tags.split(','),status:status||customer?.status||'active'};
   const out=await ctx.run(()=>api(customer?AP+'/customers/'+encodeURIComponent(customer.id):AP+'/customers',customer?'PATCH':'POST',body),status==='archived'?'הלקוח הועבר לארכיון':status==='active'&&customer?.status==='archived'?'הלקוח הוחזר מהארכיון':'פרטי הלקוח נשמרו');
   if(!customer&&out?.id)ctx.go(RP+'/customers/'+encodeURIComponent(out.id)+'/details');else setSaved(true);
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}};
 const field=(k:keyof ReturnType<typeof initial>,label:string,opts:{type?:string;wide?:boolean;area?:boolean;hint?:string;ltr?:boolean;required?:boolean}={})=><label className={opts.wide?'wide':''}>{label}{opts.hint&&<small>{opts.hint}</small>}{opts.area?<textarea value={v[k]} disabled={busy} dir={opts.ltr?'ltr':undefined} onChange={e=>set(k,e.target.value)}/>:<input type={opts.type||'text'} value={v[k]} required={opts.required} disabled={busy} dir={opts.ltr?'ltr':undefined} style={opts.ltr?{textAlign:'right'}:undefined} inputMode={opts.type==='number'?'decimal':undefined} onChange={e=>set(k,e.target.value)}/>}</label>;
 return <form onSubmit={e=>{e.preventDefault();save();}} noValidate>
  {!customer&&<h2 className="ag-page-title">לקוח חדש</h2>}
  <div className="ag-form">
   {field('name','שם הלקוח *',{required:true,hint:'השם שיופיע אצלכם ברשימה'})}
   {field('company','שם החברה')}
   {field('contact_name','איש קשר')}
   {field('phone','טלפון',{type:'tel',ltr:true})}
   {field('email','מייל',{type:'email',ltr:true})}
   {field('monthly_budget_ils','תקציב חודשי לפני מע״מ, בש״ח',{type:'number',hint:'לא חובה'})}
   {field('domains','האתרים של הלקוח',{area:true,ltr:true,hint:'דומיין בכל שורה, למשל example.co.il'})}
   {field('tags','תגיות',{hint:'מופרדות בפסיק, למשל ריטיינר, חד פעמי'})}
   {field('notes','הערות',{area:true,wide:true})}
  </div>
  {error&&<p className="ag-alert" role="alert">{error}</p>}
  {saved&&<p className="ag-ok" role="status">השינויים נשמרו</p>}
  <div className="ag-actions">
   <button type="submit" className="ag-btn primary" disabled={busy}>{busy?<LoaderCircle size={17} className="animate-spin"/>:<Save size={17}/>}{customer?'שמירת שינויים':'שמירת הלקוח'}</button>
   <span className="grow"/>
   {customer&&(customer.status==='archived'
    ?<button type="button" className="ag-btn ghost" disabled={busy} onClick={()=>save('active')}><ArchiveRestore size={17}/>החזרה מהארכיון</button>
    :<button type="button" className="ag-btn ghost" disabled={busy} onClick={()=>save('archived')}><Archive size={17}/>העברה לארכיון</button>)}
  </div>
 </form>;
}

// ---------- publications (one customer, or all) ----------
type Range={label:string;from:string;to:string};
const pad=(n:number)=>String(n).padStart(2,'0');
function israelToday(){const [y,m,d]=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jerusalem'}).format(new Date()).split('-').map(Number);return {y,m,d};}
function ranges():Range[]{const {y,m}=israelToday(),last=(yy:number,mm:number)=>new Date(Date.UTC(yy,mm,0)).getUTCDate();const pm=m===1?12:m-1,py=m===1?y-1:y;
 const start12=new Date(Date.UTC(y,m-12,1));
 return [{label:'החודש',from:`${y}-${pad(m)}-01`,to:`${y}-${pad(m)}-${pad(last(y,m))}`},{label:'החודש הקודם',from:`${py}-${pad(pm)}-01`,to:`${py}-${pad(pm)}-${pad(last(py,pm))}`},{label:'השנה',from:`${y}-01-01`,to:`${y}-12-31`},{label:'12 חודשים',from:`${start12.getUTCFullYear()}-${pad(start12.getUTCMonth()+1)}-01`,to:`${y}-${pad(m)}-${pad(last(y,m))}`},{label:'הכול',from:'',to:''}];}
const MONTHS=['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
const csvCell=(v:unknown)=>{const t=String(v??'').replace(/^[=+\-@\t\r]/,"'$&");return /[",\n]/.test(t)?'"'+t.replace(/"/g,'""')+'"':t;};

function Publications({ctx,customer}:{ctx:Ctx;customer:string}){
 const quick=useMemo(ranges,[]);
 const [range,setRange]=useState<Range>(quick[2]),[year,setYear]=useState(''),[month,setMonth]=useState(''),[status,setStatus]=useState(''),[who,setWho]=useState('');
 const customers=useData(customer?'':AP+'/customers',ctx.revision,!customer);
 const custom=year?{from:`${year}-${month||'01'}-01`,to:month?`${year}-${month}-${pad(new Date(Date.UTC(Number(year),Number(month),0)).getUTCDate())}`:`${year}-12-31`}:range;
 const q=new URLSearchParams({...(customer?{customer}:who?{customer:who}:{}),...(custom.from?{from:custom.from}:{}),...(custom.to?{to:custom.to}:{}),...(status?{status}:{})});
 const state=useData(AP+'/publications?'+q.toString(),ctx.revision),rows:Row[]=state.data?.publications||[],s=state.data?.summary;
 const years=useData(AP+'/publications?'+new URLSearchParams(customer?{customer}:{}).toString(),ctx.revision).data?.years||[];
 const exportCsv=()=>{const head=[...(customer?[]:['לקוח']),'אתר','כתובת האתר','תאריך פרסום','קישור לכתבה','עוגן','קישור יעד','הזמנה','עלות לפני מע"מ','סטטוס'];
  const lines=[head,...rows.map(a=>[...(customer?[]:[a.customer_name||'ללא לקוח']),a.website_name,a.website_url,a.published_at?day(a.published_at):'',a.published_url,a.anchor,a.target_url,a.number,(a.spend/100).toFixed(2),a.status==='published'?'פורסם':a.status==='cancelled'||a.publication_refunded?'זוכה':'בדרך'])];
  const blob=new Blob(['﻿'+lines.map(l=>l.map(csvCell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),link=document.createElement('a');
  link.href=url;link.download='publications-'+(custom.from||'all')+'.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),4000);};
 const statusOf=(a:Row)=>a.status==='cancelled'||a.publication_refunded?['זוכה','off']:a.status==='published'?['פורסם','']:['בדרך','way'];
 return <>
  <div className="ag-filters pubs" role="group" aria-label="סינון פרסומים">
   {quick.map(r=><button key={r.label} type="button" className={'ag-pill'+(!year&&range.label===r.label?' on':'')} aria-pressed={!year&&range.label===r.label} onClick={()=>{setRange(r);setYear('');setMonth('');}}>{r.label}</button>)}
   <label className="ag-select"><small>שנה</small><select value={year} onChange={e=>{setYear(e.target.value);if(!e.target.value)setMonth('');}}><option value="">—</option>{years.map((y:string)=><option key={y} value={y}>{y}</option>)}</select></label>
   <label className="ag-select"><small>חודש</small><select value={month} disabled={!year} onChange={e=>setMonth(e.target.value)}><option value="">הכול</option>{MONTHS.map((m,i)=><option key={m} value={pad(i+1)}>{m}</option>)}</select></label>
   <label className="ag-select"><small>סטטוס</small><select value={status} onChange={e=>setStatus(e.target.value)}><option value="">הכול</option><option value="published">פורסם</option><option value="on_the_way">בדרך</option><option value="refunded">זוכה</option></select></label>
   {!customer&&<label className="ag-select"><small>לקוח</small><select value={who} onChange={e=>setWho(e.target.value)}><option value="">כל הלקוחות</option><option value="none">ללא לקוח</option>{(customers.data?.customers||[]).map((c:Row)=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>}
   <span className="grow"/>
   <button type="button" className="ag-btn ghost sm" disabled={!rows.length} onClick={exportCsv}><Download size={16}/>ייצוא CSV</button>
  </div>
  <div className="ag-stats" aria-live="polite">
   <div className="ag-stat"><small>פרסומים</small><b><bdi>{s?s.count:'…'}</bdi></b><em>{s?`${s.published} פורסמו · ${s.on_the_way} בדרך`:' '}</em></div>
   <div className="ag-stat"><small>אתרים שונים</small><b><bdi>{s?s.sites:'…'}</bdi></b><em>מתוך מה שפורסם</em></div>
   <div className="ag-stat"><small>הוצאה לפני מע״מ</small><b><bdi>{s?ils(s.spend):'…'}</bdi></b><em>{custom.from?`${day(custom.from)} עד ${day(custom.to)}`:'מההתחלה'}</em></div>
  </div>
  {state.error&&<p className="ag-alert" role="alert">{state.error}</p>}
  {state.loading&&!state.data?<div className="ag-skel" style={{height:120}}/>
   :!rows.length?<div className="ag-empty"><Globe size={30}/><h3>אין פרסומים בתקופה הזו</h3><p>{customer?'אפשר לבחור תקופה אחרת, או לרכוש פרסום עבור הלקוח.':'אפשר לבחור תקופה או לקוח אחר.'}</p></div>
   :<div className="ag-table-wrap"><table className="ag-table"><thead><tr>{!customer&&<th scope="col">לקוח</th>}<th scope="col">אתר</th><th scope="col">פורסם</th><th scope="col">עוגן</th><th scope="col">קישור יעד</th><th scope="col">עלות</th><th scope="col">סטטוס</th><th scope="col"><span className="sr-only">קישור</span></th></tr></thead>
    <tbody>{rows.map(a=>{const [label,tone]=statusOf(a);return <tr key={a.id}>
     {!customer&&<td data-label="לקוח">{a.customer_name||<span className="ag-muted">ללא לקוח</span>}</td>}
     <td className="ag-td-site"><div className="ag-site"><SiteLogo src={a.website_logo} name={a.website_name}/><span><b>{a.website_name}</b><small>{String(a.website_url||'').replace(/^https?:\/\/(www\.)?/,'').replace(/\/$/,'')}</small></span></div></td>
     <td data-label="פורסם"><bdi>{a.published_at?day(a.published_at):'—'}</bdi></td>
     <td data-label="עוגן">{a.anchor||<span className="ag-muted">—</span>}</td>
     <td data-label="קישור יעד"><span className="ag-ltr ag-muted">{String(a.target_url||'').replace(/^https?:\/\/(www\.)?/,'')||'—'}</span></td>
     <td data-label="עלות"><bdi>{ils(a.spend)}</bdi></td>
     <td data-label="סטטוס"><span className={'ag-status '+tone}>{label}</span></td>
     <td data-label="קישור">{a.published_url?<a className="ag-link" href={a.published_url} target="_blank" rel="noreferrer">לכתבה<ExternalLink size={14}/></a>:<span className="ag-muted">—</span>}</td>
    </tr>;})}</tbody></table>{rows.length>=1000&&<p className="ag-muted">מוצגים 1,000 הראשונים. צמצמו את התקופה.</p>}</div>}
 </>;
}

// ---------- articles of one customer ----------
function CustomerArticles({ctx,customer}:{ctx:Ctx;customer:Row}){
 const state=useData(AP+'/customers/'+encodeURIComponent(customer.id)+'/articles',ctx.revision),rows:Row[]=(state.data?.articles||[]).filter((a:Row)=>a.status!=='cancelled'&&!a.demo);
 // Bought for the customer and not used yet (paid, no content sent): shown first, apart from the rest.
 const unused=rows.filter(a=>a.status==='draft'&&(a.paid||a.on_account)),rest=rows.filter(a=>!unused.includes(a));
 const groups=purchaseStages.map(s=>({...s,items:rest.filter(a=>purchaseStage(a)===s.key)})).filter(g=>g.items.length);
 const tone=(a:Row)=>a.status==='published'?'':['draft','review','revisions'].includes(a.status)?'wait':'way';
 if(state.loading&&!state.data)return <div className="ag-skel" style={{height:120}}/>;
 if(state.error)return <p className="ag-alert" role="alert">{state.error}</p>;
 if(!rows.length)return <div className="ag-empty"><FileText size={30}/><h3>אין כתבות משויכות ללקוח</h3><p>כתבה משויכת ללקוח כשרוכשים עבורו, או מהמסך "הכתבות שלי" בבחירת לקוח לכתבה.</p></div>;
 return <>{unused.length>0&&<section className="ag-unused" aria-labelledby="ag-unused-title">
  <header><span className="ic" aria-hidden="true"><PackageOpen size={20}/></span><div><h3 id="ag-unused-title">נרכשו ועוד לא נוצלו<span>{unused.length}</span></h3><p>כתבות ששולמו עבור {customer.name} ועדיין מחכות לתוכן. פותחים כתבה וממלאים את התוכן, כמו ב"הכתבות שלי".</p></div></header>
  <div className="ag-unused-list">{unused.map(a=><div key={a.id} className="ag-unused-item"><SiteLogo src={a.website_logo} name={a.website_name}/><span className="t"><b>{a.website_name}</b><small>נרכשה <bdi>{day(a.purchased_at)}</bdi> · הזמנה <bdi>{a.number}</bdi></small></span><Link ctx={ctx} to={'article/'+a.id} className="ag-btn primary sm">לעריכת הכתבה<ArrowLeft size={15} aria-hidden="true"/></Link></div>)}</div>
 </section>}
 {groups.map(g=><section key={g.key} aria-label={g.label}><h3 className="ag-stage">{g.label}<span>{g.items.length}</span></h3>
  {g.items.map(a=><div key={a.id} className="ag-art"><SiteLogo src={a.website_logo} name={a.website_name}/><span className="t"><b>{a.title||a.topic||'כתבה ללא כותרת'}</b><small>{a.website_name} · הזמנה <bdi>{a.number}</bdi>{a.published_at?<> · פורסם <bdi>{day(a.published_at)}</bdi></>:null}</small></span><span className={'ag-status '+tone(a)}>{stages[a.status]||a.status}</span>
   {a.published_url?<a className="ag-link" href={a.published_url} target="_blank" rel="noreferrer">לכתבה<ExternalLink size={14}/></a>:<Link ctx={ctx} to={'article/'+a.id} className="ag-btn ghost sm">{['draft','review','revisions'].includes(a.status)?'לטיפול':'פתיחה'}</Link>}
  </div>)}</section>)}</>;
}

// ---------- sites already used for this customer (spec section 7) ----------
function UsedSites({ctx,customer}:{ctx:Ctx;customer:Row}){
 const base=AP+'/customers/'+encodeURIComponent(customer.id)+'/used-sites';
 const state=useData(base,ctx.revision),data=state.data;
 const [text,setText]=useState(''),[busy,setBusy]=useState(''),[error,setError]=useState(''),[result,setResult]=useState<Row|null>(null),[query,setQuery]=useState('');
 const run=async(kind:string,fn:()=>Promise<any>,done:string)=>{if(busy)return;setBusy(kind);setError('');try{return await ctx.run(fn,done);}catch(e){setError((e as Error).message);}finally{setBusy('');}};
 const add=async(value:string)=>{if(!value.trim())return;const out=await run('import',()=>api(base+'/import','POST',{text:value}),'הרשימה עודכנה');if(out){setResult(out);setText('');}};
 const readFile=async(file?:File|null)=>{if(!file)return;if(file.size>2_000_000){setError('הקובץ גדול מדי. אפשר עד 2MB.');return;}add(await file.text());};
 const rows:Row[]=[...(data?.system||[]).map((s:Row)=>({key:'s:'+s.website_id,source:'system',name:s.website_name,domain:String(s.website_url||'').replace(/^https?:\/\/(www\.)?/,'').replace(/\/$/,''),date:s.last,catalog:true})),
  ...(data?.manual||[]).map((m:Row)=>({key:'m:'+m.domain+m.path,source:'manual',name:m.catalog?.[0]?.name||'',domain:m.domain+m.path,date:m.added_at,catalog:!!m.catalog?.length,entry:m,more:Math.max(0,(m.catalog?.length||0)-1)}))]
  .filter(r=>!query||norm(r.domain+' '+r.name).includes(norm(query)));
 const exportCsv=()=>{const lines=[['דומיין','שם באתר מגה לינקס','מקור','תאריך'],...rows.map(r=>[r.domain,r.name,r.source==='system'?'פורסם דרך המערכת':'נוסף ידנית',r.date?day(r.date):''])];const blob=new Blob(['\ufeff'+lines.map(l=>l.map(csvCell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='used-sites.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),4000);};
 if(state.loading&&!data)return <div className="ag-skel" style={{height:120}}/>;
 return <>
  <p className="ag-muted" style={{margin:'0 0 12px',fontSize:14.5}}>אתרים שהלקוח כבר קיבל בהם פרסום. מה שפורסם דרך המערכת נכנס לבד. אתרים מבחוץ מוסיפים כאן.</p>
  <div className="ag-mode" role="radiogroup" aria-label="מה קורה ברכישה עבור הלקוח">
   {([['warn','להציג עם סימון','במחירון של '+customer.name+' האתרים יופיעו עם שורה ירוקה "שומש עבור '+customer.name+'"'],['hide','להסתיר מהמחירון','במחירון של '+customer.name+' האתרים האלה לא יוצגו']] as const).map(([mode,title,sub])=><button key={mode} type="button" role="radio" aria-checked={data?.mode===mode} className={'ag-opt'+(data?.mode===mode?' on':'')} disabled={!!busy} onClick={()=>data?.mode!==mode&&run('mode',()=>api(base,'PATCH',{mode}),'ההגדרה נשמרה')}><span className="ag-radio"/><span><b>{title}</b><small>{sub}</small></span></button>)}
  </div>
  <div className="ag-paste">
   <label htmlFor="ag-used-text" style={{display:'flex',alignItems:'center',gap:7,fontSize:15,fontWeight:700}}><ClipboardPaste size={17}/>הוספת רשימה</label>
   <p className="ag-muted" style={{margin:'4px 0 10px',fontSize:13}}>מדביקים דומיינים או כתובות, אחד בשורה או מופרדים בפסיק. אפשר גם להעלות קובץ CSV או TXT.</p>
   <textarea id="ag-used-text" value={text} disabled={!!busy} placeholder={'example.co.il\nhttps://www.example.com/section'} onChange={e=>setText(e.target.value)}/>
   <div className="ag-result" style={{alignItems:'center'}}>
    <button type="button" className="ag-btn primary sm" disabled={!!busy||!text.trim()} onClick={()=>add(text)}>{busy==='import'?<LoaderCircle size={16} className="animate-spin"/>:<Plus size={16}/>}הוספה לרשימה</button>
    <label className="ag-btn ghost sm" style={{cursor:'pointer'}}><Upload size={16}/>העלאת קובץ<input type="file" accept=".csv,.txt,text/csv,text/plain" hidden onChange={e=>{readFile(e.target.files?.[0]);e.target.value='';}}/></label>
    {result&&<span role="status" style={{display:'contents'}}><span className="ag-src cat">{result.added} נקלטו</span><span className="ag-src sys">{result.in_catalog} נמצאו בקטלוג של מגה לינקס</span>{result.duplicates>0&&<span className="ag-src out">{result.duplicates} כבר היו ברשימה</span>}{result.invalid_count>0&&<span className="ag-src man" title={result.invalid.join(', ')}>{result.invalid_count} לא תקינים</span>}{result.over_limit>0&&<span className="ag-src man">{result.over_limit} מעבר למגבלה של 5,000</span>}</span>}
   </div>
  </div>
  {(error||state.error)&&<p className="ag-alert" role="alert">{error||state.error}</p>}
  <div className="ag-filters" style={{margin:'18px 0 6px'}}><b style={{fontSize:16}}>{(data?.system?.length||0)+(data?.manual?.length||0)} אתרים ברשימה</b><span className="grow"/><label className="ag-search" style={{flex:'0 1 240px',height:38}}><Search size={16}/><input type="search" placeholder="חיפוש ברשימה" aria-label="חיפוש ברשימת האתרים" value={query} onChange={e=>setQuery(e.target.value)}/></label><button type="button" className="ag-btn ghost sm" disabled={!rows.length} onClick={exportCsv}><Download size={16}/>ייצוא</button></div>
  {!rows.length?<div className="ag-empty"><ShieldBan size={30}/><h3>{query?'לא נמצא':'הרשימה ריקה'}</h3><p>{query?'נסו חיפוש אחר.':'אתרים שפורסם בהם עבור הלקוח דרך המערכת יופיעו כאן לבד.'}</p></div>
   :<div className="ag-table-wrap"><table className="ag-table"><thead><tr><th scope="col">אתר</th><th scope="col">מקור</th><th scope="col">מתי</th><th scope="col">בקטלוג</th><th scope="col"><span className="sr-only">פעולות</span></th></tr></thead><tbody>
    {rows.map(r=><tr key={r.key}><td className="ag-td-site"><div className="ag-site"><span className="ag-logo"><Globe size={16}/></span><span>{r.name?<><b>{r.name}{r.more?` +${r.more}`:''}</b><small>{r.domain}</small></>:<b className="ag-ltr">{r.domain}</b>}</span></div></td>
     <td data-label="מקור"><span className={'ag-src '+(r.source==='system'?'sys':'man')}>{r.source==='system'?'פורסם דרך המערכת':'נוסף ידנית'}</span></td>
     <td data-label="מתי"><bdi>{r.date?day(r.date):'—'}</bdi></td>
     <td data-label="בקטלוג">{r.catalog?<span className="ag-src cat">{data?.mode==='warn'?'כן · יסומן':'כן · יוסתר'}</span>:<span className="ag-src out">לא בקטלוג</span>}</td>
     <td data-label="פעולות">{r.source==='manual'&&<button type="button" className="ag-btn ghost sm" aria-label={'הסרת '+r.domain+' מהרשימה'} disabled={!!busy} onClick={()=>run('remove',()=>api(base+'/remove','POST',{domain:r.entry.domain,path:r.entry.path}),'האתר הוסר מהרשימה')}><Trash2 size={15}/></button>}</td>
    </tr>)}</tbody></table></div>}
 </>;
}

// ---------- overview (spec 5.1) ----------
const MONTH_SHORT=['ינו׳','פבר׳','מרץ','אפר׳','מאי','יוני','יולי','אוג׳','ספט׳','אוק׳','נוב׳','דצמ׳'];
function MonthChart({rows,field}:{rows:Row[];field:'published'|'spend'}){
 const narrow=useNarrow(),max=Math.max(1,...rows.map(r=>r[field])),W=narrow?340:640,H=narrow?190:220,base=H-35,step=W/rows.length,bar=Math.min(30,step*.6);
 return <><svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label={field==='published'?'פרסומים לפי חודש, 12 חודשים':'הוצאה לפי חודש, 12 חודשים'} style={{fontFamily:'Heebo,Arial',overflow:'visible'}}>
  {rows.map((r,i)=>{const x=W-(i+1)*step+(step-bar)/2,h=Math.round((r[field]/max)*(H-70)),last=i===rows.length-1,label=field==='spend'?(r.spend?Math.round(r.spend/100).toLocaleString('he-IL'):''):String(r.published||'');
   return <g key={r.month}><rect x={x} y={base-h} width={bar} height={Math.max(h,2)} rx={narrow?5:7} fill={last?'#1673e6':'#cfe0f8'}/><text x={x+bar/2} y={base+22} textAnchor="middle" fontSize={narrow?10.5:12} fill="#5b6b82">{MONTH_SHORT[Number(r.month.slice(5))-1]}</text>{label&&<text x={x+bar/2} y={base-8-h} textAnchor="middle" fontSize={field==='spend'?(narrow?9:10.5):12} fontWeight={700} fill={last?'#1460c4':'#7b8796'}>{label}</text>}</g>;})}
 </svg><table className="sr-only"><caption>{field==='published'?'פרסומים לפי חודש':'הוצאה לפי חודש'}</caption><tbody>{rows.map(r=><tr key={r.month}><th scope="row">{r.month}</th><td>{field==='spend'?ils(r.spend):r.published}</td></tr>)}</tbody></table></>;
}
function Overview({ctx}:{ctx:Ctx}){
 const state=useData(AP+'/overview',ctx.revision),d=state.data,[field,setField]=useState<'published'|'spend'>('published');
 if(state.error)return <p className="ag-alert" role="alert">{state.error}</p>;
 if(!d)return <div className="ag-kpis">{[0,1,2,3].map(i=><div key={i} className="ag-card ag-kpi"><span className="ag-skel" style={{width:'60%'}}/></div>)}</div>;
 const k=d.kpis,diff=k.published_month-k.published_prev;
 if(!k.customers&&!d.recent.length)return <section className="ag-card ag-main"><div className="ag-empty"><LayoutDashboard size={32}/><h3>ברוכים הבאים ל{agencyCentreName(ctx.user)}</h3><p>שלושה צעדים כדי להתחיל:</p>
  <div className="ag-start">{[['1','הוסיפו לקוח',RP+'/customers/new'],['2','רכשו פרסום עבורו',RP+'/customers'],['3','שייכו כתבות קיימות','purchased/articles']].map(([n,l,to])=><Link key={n} ctx={ctx} to={to} className="ag-start-step"><span>{n}</span>{l}</Link>)}</div></div></section>;
 const kpis:[React.ElementType,string,React.ReactNode,string,string,string][]=[[Users,'לקוחות פעילים',k.customers,k.customers_new_month?`+${k.customers_new_month} החודש`:'\u00a0','',RP+'/customers'],[Globe,'פרסומים החודש',k.published_month,diff?`${diff>0?'+':''}${diff} מהחודש הקודם`:'כמו בחודש הקודם','',RP+'/publications'],[Wallet,'הוצאה החודש · לפני מע״מ',<bdi key="s">{ils(k.spend_month)}</bdi>,'מתחילת החודש','',RP+'/publications'],[ListChecks,'כתבות שמחכות לך',k.waiting,k.urgent?`${k.urgent} דחופות`:'אין דחופות',k.urgent?'warn':'',RP+'/tasks']];
 return <>
  <div className="ag-kpis">{kpis.map(([Icon,label,value,note,tone,to])=><Link key={label} ctx={ctx} to={to} className="ag-card ag-kpi"><span className="ic"><Icon size={20}/></span><small>{label.split(' · ').map((part,i)=>i?<span key={i} className="sub"><i> · </i>{part}</span>:part)}</small><b>{value}</b><em className={tone}>{note}</em></Link>)}</div>
  <div className="ag-grid2">
   <section className="ag-card ag-sec"><h3><ChartColumn size={19}/>{field==='published'?'פרסומים לפי חודש':'הוצאה לפי חודש · ₪ לפני מע״מ'}<button type="button" className="more" onClick={()=>setField(field==='published'?'spend':'published')}>{field==='published'?'הוצאה לפי חודש':'פרסומים לפי חודש'}</button></h3><MonthChart rows={d.chart} field={field}/></section>
   <section className="ag-card ag-sec"><h3><ListChecks size={19}/>לטיפול עכשיו{d.tasks_total>0&&<Link ctx={ctx} to={RP+'/tasks'} className="more">לכל המשימות · {d.tasks_total}</Link>}</h3>{d.tasks.length?d.tasks.map((t:Row,i:number)=><TaskRow key={i} ctx={ctx} t={t}/>):<div className="ag-empty" style={{padding:'24px 8px'}}><ListChecks size={26}/><p>אין כרגע משימות פתוחות.</p></div>}</section>
  </div>
  <div className="ag-grid2 even">
   <section className="ag-card ag-sec"><h3><Trophy size={19}/>הלקוחות הפעילים החודש</h3>{d.top.length?d.top.map((c:Row)=><Link key={c.id} ctx={ctx} to={RP+'/customers/'+encodeURIComponent(c.id)} className="ag-task"><Avatar name={c.name} id={c.id} size={34}/><span className="t"><b>{c.name}</b><small>{c.published} פרסומים</small></span><b><bdi>{ils(c.spend)}</bdi></b></Link>):<p className="ag-muted">עדיין אין פעילות החודש.</p>}</section>
   <section className="ag-card ag-sec"><h3><Globe size={19}/>פרסומים אחרונים<Link ctx={ctx} to={RP+'/publications'} className="more">לכל הפרסומים</Link></h3>{d.recent.length?d.recent.map((a:Row)=><div key={a.id} className="ag-task"><SiteLogo src={a.website_logo} name={a.website_name}/><span className="t"><b>{a.website_name}</b><small>{a.customer_name||'ללא לקוח'} · <bdi>{day(a.published_at)}</bdi></small></span>{a.published_url&&<a className="ag-link" href={a.published_url} target="_blank" rel="noreferrer">לכתבה<ExternalLink size={14}/></a>}</div>):<p className="ag-muted">עדיין לא פורסמו כתבות.</p>}</section>
  </div>
 </>;
}
// ---------- to-do (spec 5.4) ----------
const TASK_LOOK:Record<string,[React.ElementType,string,string,string]>={review:[PencilLine,'#eef5ff','#1673e6','לבדיקה'],revisions:[RotateCcw,'#fff4e5','#b45309','לתיקון'],draft:[FilePen,'#f3f0ff','#6d28d9','להשלמה'],payment:[CreditCard,'#fdecec','#c2262e','לתשלום'],scheduled:[CalendarClock,'#eefbf6','#0f7a55','לפרטים']};
function TaskRow({ctx,t}:{ctx:Ctx;t:Row}){
 const [Icon,bg,fg,action]=TASK_LOOK[t.kind]||TASK_LOOK.review;
 const to=t.kind==='payment'?'purchased/orders':'article/'+t.article_id;
 const sub=t.kind==='payment'?<>הזמנה <bdi>{t.number}</bdi> · <bdi>{day(t.date)}</bdi></>:<>{t.customer_name||'ללא לקוח'} · {t.title||t.website_name}{t.kind==='scheduled'&&t.date?<> · <bdi>{day(t.date)}</bdi></>:null}</>;
 return <div className="ag-task"><span className="dot" style={{background:bg,color:fg}}><Icon size={17}/></span><span className="t"><b>{t.label}</b><small>{sub}</small></span><Link ctx={ctx} to={to} className="ag-btn ghost sm">{action}</Link></div>;
}
function Tasks({ctx}:{ctx:Ctx}){
 const state=useData(AP+'/tasks',ctx.revision),tasks:Row[]=state.data?.tasks||[];
 if(state.error)return <p className="ag-alert" role="alert">{state.error}</p>;
 if(state.loading&&!state.data)return <div className="ag-skel" style={{height:120}}/>;
 if(!tasks.length)return <div className="ag-empty"><ListChecks size={30}/><h3>הכול מטופל</h3><p>כשכתבה תחכה לאישור שלכם, תחזור לתיקון או תחכה לתשלום, היא תופיע כאן.</p></div>;
 const groups=new Map<string,Row[]>();for(const t of tasks){const key=t.kind==='payment'?'תשלומים':t.customer_name||'ללא לקוח';groups.set(key,[...(groups.get(key)||[]),t]);}
 return <>{[...groups].map(([name,items])=><section key={name} aria-label={name}><h3 className="ag-stage">{name}<span>{items.length}</span></h3>{items.map((t,i)=><TaskRow key={i} ctx={ctx} t={t}/>)}</section>)}</>;
}

// ---------- links and anchors ----------
function CustomerLinks({ctx,customer}:{ctx:Ctx;customer:Row}){
 const state=useData(AP+'/customers/'+encodeURIComponent(customer.id)+'/links',ctx.revision),rows:Row[]=state.data?.links||[];
 if(state.error)return <p className="ag-alert" role="alert">{state.error}</p>;
 if(state.loading&&!state.data)return <div className="ag-skel" style={{height:120}}/>;
 if(!rows.length)return <div className="ag-empty"><Link2 size={30}/><h3>עדיין אין קישורים</h3><p>קישורי היעד והעוגנים מהכתבות של הלקוח יופיעו כאן, כדי לגוון עוגנים ולא לחזור על אותו עוגן.</p></div>;
 return <><p className="ag-muted" style={{margin:'0 0 12px',fontSize:14.5}}>כל קישור יעד שנשלח עבור הלקוח, כמה פעמים ובאילו עוגנים. עוגן שחוזר הרבה מסומן.</p>
  {rows.map(l=><section key={l.target_url} className="ag-linkcard"><div className="ag-linkhead"><span className="ag-ltr ag-linkurl">{String(l.target_url).replace(/^https?:\/\/(www\.)?/,'')}</span><span className="ag-chip">{l.count} פעמים</span>{l.last&&<span className="ag-muted" style={{fontSize:12.5}}>אחרון <bdi>{day(l.last)}</bdi></span>}</div>
   <div className="ag-chips">{l.anchors.map((a:Row)=><span key={a.anchor} className={'ag-chip'+(a.count>=3?' hot':'')} title={a.count>=3?'העוגן הזה חוזר הרבה':undefined}>{a.anchor} · {a.count}</span>)}</div>
   <p className="ag-muted" style={{margin:'8px 0 0',fontSize:12.5}}>באתרים: {l.sites.join(', ')}</p></section>)}</>;
}
// ---------- notes ----------
function CustomerNotes({ctx,customer}:{ctx:Ctx;customer:Row}){
 const base=AP+'/customers/'+encodeURIComponent(customer.id)+'/notes';
 const state=useData(base,ctx.revision),notes:Row[]=state.data?.notes||[];
 const [text,setText]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const run=async(fn:()=>Promise<any>,done:string)=>{if(busy)return;setBusy(true);setError('');try{await ctx.run(fn,done);return true;}catch(e){setError((e as Error).message);return false;}finally{setBusy(false);}};
 return <>
  <form className="ag-paste" style={{marginTop:0}} onSubmit={async e=>{e.preventDefault();if(text.trim()&&await run(()=>api(base,'POST',{text}),'ההערה נשמרה'))setText('');}}>
   <label htmlFor="ag-note" style={{display:'flex',alignItems:'center',gap:7,fontSize:15,fontWeight:700}}><NotebookPen size={17}/>הערה חדשה</label>
   <textarea id="ag-note" value={text} maxLength={4000} disabled={busy} placeholder="מה סוכם עם הלקוח, ממה לא לפרסם, איש קשר..." onChange={e=>setText(e.target.value)} style={{direction:'rtl',fontFamily:'inherit',marginTop:8}}/>
   <div className="ag-result"><button type="submit" className="ag-btn primary sm" disabled={busy||!text.trim()}><Plus size={16}/>שמירת הערה</button></div>
  </form>
  {(error||state.error)&&<p className="ag-alert" role="alert">{error||state.error}</p>}
  {state.loading&&!state.data?<div className="ag-skel" style={{height:80,marginTop:14}}/>:!notes.length?<div className="ag-empty"><NotebookPen size={28}/><h3>אין הערות</h3><p>הערות נשמרות רק אצלכם, עם תאריך.</p></div>
   :<div className="ag-notes">{notes.map(n=><article key={n.id} className={'ag-note'+(n.pinned?' pinned':'')}><p>{n.text}</p><footer><bdi>{day(n.created)}</bdi>{n.pinned&&<span className="ag-chip">מוצמדת</span>}<span className="grow"/>
    <button type="button" className="ag-btn ghost sm" disabled={busy} aria-label={n.pinned?'ביטול הצמדה':'הצמדה למעלה'} onClick={()=>run(()=>api(base+'/'+encodeURIComponent(n.id),'PATCH',{pinned:!n.pinned}),n.pinned?'ההצמדה בוטלה':'ההערה הוצמדה')}>{n.pinned?<PinOff size={15}/>:<Pin size={15}/>}</button>
    <button type="button" className="ag-btn ghost sm" disabled={busy} aria-label="מחיקת ההערה" onClick={()=>{if(window.confirm('למחוק את ההערה?'))run(()=>api(base+'/'+encodeURIComponent(n.id),'DELETE'),'ההערה נמחקה');}}><Trash2 size={15}/></button></footer></article>)}</div>}
 </>;
}

// ---------- reports (spec 5.7) ----------
const esc=(v:unknown)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'} as Record<string,string>)[c]);
function reportHtml({agency,color,customer,from,to,rows,costs,logo}:{agency:string;color:string;customer:string;from:string;to:string;rows:Row[];costs:boolean;logo?:string}){
 const published=rows.filter(a=>a.status==='published'),sites=new Set(published.map(a=>a.website_id)).size,total=rows.reduce((s,a)=>s+a.spend,0);
 const font=window.location.origin+'/brand/heebo-variable.ttf';
 return `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><title>${esc('דוח פרסומים · '+customer)}</title><style>@font-face{font-family:H;src:url(${font})}body{margin:0;font-family:H,Arial,sans-serif;color:#0b1b2f;font-variant-numeric:tabular-nums}main{max-width:900px;margin:0 auto;padding:36px 28px}
header{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;padding-bottom:16px;border-bottom:3px solid ${esc(color)}}h1{margin:0;font-size:26px;letter-spacing:-.02em}header p{margin:4px 0 0;color:#5b6b82}.agency{display:flex;align-items:center;gap:12px;font-weight:800;font-size:18px;color:${esc(color)}}.agency img{max-height:56px;max-width:160px;object-fit:contain}
.stats{display:flex;gap:12px;margin:20px 0}.stats div{flex:1;padding:12px 14px;border-radius:12px;background:#f4f8fe}.stats small{display:block;color:#5b6b82;font-size:12.5px}.stats b{font-size:22px}
table{width:100%;border-collapse:collapse;font-size:13px}th{text-align:right;padding:8px;border-bottom:1px solid #d6e2ee;color:#5b6b82;font-size:12px}td{padding:9px 8px;border-bottom:1px solid #eef2f6;vertical-align:top}td a{color:#0a5fc2;word-break:break-all}.ltr{direction:ltr;unicode-bidi:isolate}
footer{margin-top:24px;color:#7b8796;font-size:12px}@media print{main{padding:0}.noprint{display:none}}</style></head><body><main>
<header><div><h1>דוח פרסומים · ${esc(customer)}</h1><p>תקופה: <span class="ltr">${esc(from?day(from):'מההתחלה')}</span> עד <span class="ltr">${esc(to?day(to):day(new Date().toISOString()))}</span></p></div><div class="agency">${logo&&/^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(logo)?`<img src="${logo}" alt="">`:''}<span>${esc(agency)}</span></div></header>
<div class="stats"><div><small>פרסומים</small><b>${published.length}</b></div><div><small>אתרים שונים</small><b>${sites}</b></div>${costs?`<div><small>עלות לפני מע״מ</small><b class="ltr">${esc(ils(total))}</b></div>`:''}</div>
<table><thead><tr><th>אתר</th><th>תאריך פרסום</th><th>קישור לכתבה</th><th>עוגן</th><th>קישור יעד</th>${costs?'<th>עלות</th>':''}</tr></thead><tbody>
${published.map(a=>`<tr><td><b>${esc(a.website_name)}</b></td><td class="ltr">${esc(day(a.published_at))}</td><td>${a.published_url?`<a class="ltr" href="${esc(a.published_url)}">${esc(String(a.published_url).replace(/^https?:\/\//,''))}</a>`:'—'}</td><td>${esc(a.anchor||'—')}</td><td class="ltr">${esc(String(a.target_url||'').replace(/^https?:\/\//,'')||'—')}</td>${costs?`<td class="ltr">${esc(ils(a.spend))}</td>`:''}</tr>`).join('')||'<tr><td colspan="6">אין פרסומים בתקופה הזו.</td></tr>'}
</tbody></table><footer>הופק ב-<span class="ltr">${esc(day(new Date().toISOString()))}</span></footer>
<p class="noprint" style="margin-top:20px"><button onclick="window.print()" style="font:inherit;padding:10px 18px;border-radius:10px;border:0;background:${esc(color)};color:#fff;cursor:pointer">הדפסה או שמירה כ-PDF</button></p></main></body></html>`;
}
// The report window is written from here, so the logo goes in as data (it also stays in a saved PDF).
async function logoData(url?:string){if(!url)return '';try{const r=await fetch(url,{credentials:'same-origin'});if(!r.ok)return '';const blob=await r.blob();if(!['image/png','image/jpeg','image/webp'].includes(blob.type))return '';return await new Promise<string>(ok=>{const f=new FileReader();f.onload=()=>ok(String(f.result||''));f.onerror=()=>ok('');f.readAsDataURL(blob);});}catch{return '';}}
function Reports({ctx}:{ctx:Ctx}){
 const quick=useMemo(ranges,[]);
 const customers=useData(AP+'/customers',ctx.revision),settings=useData(AP+'/settings',ctx.revision);
 const list:Row[]=(customers.data?.customers||[]).filter((c:Row)=>c.status!=='archived');
 const [who,setWho]=useState(''),[range,setRange]=useState<Range>(quick[1]),[costs,setCosts]=useState<boolean|null>(null),[busy,setBusy]=useState(''),[error,setError]=useState(''),[spend,setSpend]=useState<Row[]|null>(null);
 const showCosts=costs??!!settings.data?.show_amounts;
 const q=(extra:Record<string,string>={})=>new URLSearchParams({...(range.from?{from:range.from}:{}),...(range.to?{to:range.to}:{}),...extra}).toString();
 const customerReport=async()=>{if(!who){setError('בחרו לקוח');return;}setError('');const win=window.open('','_blank');if(!win){setError('הדפדפן חסם חלון חדש. אפשרו חלונות קופצים לאתר.');return;}win.document.write('<p dir="rtl" style="font-family:Arial;padding:24px">מכין את הדוח…</p>');setBusy('customer');
  try{const d=await api(AP+'/publications?'+q({customer:who}));const c=list.find(x=>x.id===who),logo=await logoData(settings.data?.logo_url);win.document.open();win.document.write(reportHtml({agency:settings.data?.report_name||'',color:settings.data?.report_color||'#1673e6',customer:c?.name||'',from:range.from,to:range.to,rows:d.publications||[],costs:showCosts,logo}));win.document.close();}
  catch(e){win.close();setError((e as Error).message);}finally{setBusy('');}};
 const spendReport=async()=>{setBusy('spend');setError('');try{const d=await api(AP+'/publications?'+q());const by=new Map<string,Row>();for(const a of d.publications||[]){const key=a.customer_id||'';const r=by.get(key)||{name:a.customer_name||'ללא לקוח',count:0,published:0,spend:0};r.count++;if(a.status==='published')r.published++;r.spend+=a.spend;by.set(key,r);}setSpend([...by.values()].sort((x,y)=>y.spend-x.spend));}catch(e){setError((e as Error).message);}finally{setBusy('');}};
 const spendCsv=()=>{if(!spend)return;const lines=[['לקוח','פרסומים','פורסמו','הוצאה לפני מע"מ'],...spend.map(r=>[r.name,r.count,r.published,(r.spend/100).toFixed(2)])];const blob=new Blob(['\ufeff'+lines.map(l=>l.map(csvCell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='spend-'+(range.from||'all')+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),4000);};
 return <>
  <div className="ag-filters" role="group" aria-label="תקופת הדוח">{quick.map(r=><button key={r.label} type="button" className={'ag-pill'+(range.label===r.label?' on':'')} aria-pressed={range.label===r.label} onClick={()=>{setRange(r);setSpend(null);}}>{r.label}</button>)}</div>
  {error&&<p className="ag-alert" role="alert">{error}</p>}
  <div className="ag-reports">
   <section className="ag-report"><span className="ic"><Printer size={22}/></span><h3>דוח ללקוח</h3><p>רשימת הפרסומים של לקוח אחד בתקופה: אתר, תאריך, קישור לכתבה, עוגן וקישור יעד. בלי השם של מגה לינקס. מדפיסים או שומרים כ-PDF.</p>
    <label className="ag-select" style={{width:'100%'}}><small>לקוח</small><select value={who} onChange={e=>setWho(e.target.value)} style={{flex:1}}><option value="">בחרו לקוח</option>{list.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
    <label className="ag-check"><input type="checkbox" checked={showCosts} onChange={e=>setCosts(e.target.checked)}/>להציג עלויות בדוח</label>
    <button type="button" className="ag-btn primary" disabled={!!busy} onClick={customerReport}>{busy==='customer'?<LoaderCircle size={17} className="animate-spin"/>:<Printer size={17}/>}הפקת דוח ללקוח</button></section>
   <section className="ag-report"><span className="ic"><FileSpreadsheet size={22}/></span><h3>דוח הוצאות</h3><p>כמה פורסם וכמה הוצאתם עבור כל לקוח בתקופה, לפני מע״מ. עוזר לחייב את הלקוחות.</p>
    <button type="button" className="ag-btn primary" disabled={!!busy} onClick={spendReport}>{busy==='spend'?<LoaderCircle size={17} className="animate-spin"/>:<ChartColumn size={17}/>}הצגת דוח הוצאות</button>
    {spend&&(spend.length?<><table className="ag-table" style={{marginTop:12}}><thead><tr><th scope="col">לקוח</th><th scope="col">פרסומים</th><th scope="col">פורסמו</th><th scope="col">הוצאה</th></tr></thead><tbody>{spend.map(r=><tr key={r.name}><td data-label="לקוח">{r.name}</td><td data-label="פרסומים">{r.count}</td><td data-label="פורסמו">{r.published}</td><td data-label="הוצאה"><bdi>{ils(r.spend)}</bdi></td></tr>)}</tbody></table><button type="button" className="ag-btn ghost sm" style={{marginTop:10}} onClick={spendCsv}><Download size={16}/>ייצוא CSV</button></>:<p className="ag-muted">אין פרסומים בתקופה הזו.</p>)}</section>
  </div>
 </>;
}
// ---------- agency settings (spec 5.8) ----------
function AgencySettings({ctx}:{ctx:Ctx}){
 const state=useData(AP+'/settings',ctx.revision);
 const [v,setV]=useState<Row|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState(false);
 useEffect(()=>{if(state.data&&!v)setV(state.data);},[state.data,v]);
 if(state.error)return <p className="ag-alert" role="alert">{state.error}</p>;
 if(!v)return <div className="ag-skel" style={{height:120}}/>;
 const set=(k:string,value:unknown)=>{setV({...v,[k]:value});setSaved(false);};
 const save=async(e:React.FormEvent)=>{e.preventDefault();if(busy)return;setBusy(true);setError('');try{await ctx.run(()=>api(AP+'/settings','PATCH',v),'ההגדרות נשמרו');setSaved(true);}catch(err){setError((err as Error).message);}finally{setBusy(false);}};
 // The report logo is saved right away: upload the image, then store it in the settings.
 const setLogo=async(file?:File|null)=>{if(!file||busy)return;setError('');setSaved(false);
  if(!['image/png','image/jpeg','image/webp'].includes(file.type)){setError('הלוגו צריך להיות תמונה מסוג PNG, JPG או WEBP.');return;}
  if(file.size>1024*1024){setError('הלוגו גדול מדי. אפשר עד 1MB.');return;}
  setBusy(true);try{const form=new FormData();form.append('file',file);const up=await api('files','POST',form);const out=await ctx.run(()=>api(AP+'/settings','PATCH',{...v,logo_file_id:up.id}),'הלוגו נשמר');setV({...v,logo_file_id:out.logo_file_id,logo_url:out.logo_url});}catch(err){setError((err as Error).message);}finally{setBusy(false);}};
 const dropLogo=async()=>{if(busy)return;setBusy(true);setError('');try{const out=await ctx.run(()=>api(AP+'/settings','PATCH',{...v,logo_file_id:''}),'הלוגו הוסר');setV({...v,logo_file_id:out.logo_file_id,logo_url:''});}catch(err){setError((err as Error).message);}finally{setBusy(false);}};
 return <form onSubmit={save}><div className="ag-form">
  <label>השם שיופיע בדוחות<small>למשל שם העסק שלכם</small><input value={v.report_name} maxLength={120} disabled={busy} onChange={e=>set('report_name',e.target.value)}/></label>
  <label>צבע הדוחות<small>הצבע של הכותרת בדוח ללקוח</small><input type="color" value={v.report_color} disabled={busy} onChange={e=>set('report_color',e.target.value)} style={{height:46,padding:4}}/></label>
  <div className="wide ag-logo-set"><span className="pic">{v.logo_url?<img src={v.logo_url} alt="הלוגו לדוחות"/>:<span>לוגו</span>}</span><span className="t"><b>לוגו לדוחות</b><small>מופיע בראש הדוח ללקוח. קובץ תמונה עד <bdi>1MB</bdi>.</small></span>
   <label className={'ag-btn ghost sm'+(busy?' off':'')}><Upload size={15} aria-hidden="true"/>{v.logo_url?'החלפה':'העלאת לוגו'}<input type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={e=>{setLogo(e.target.files?.[0]);e.target.value='';}} className="sr-only"/></label>
   {v.logo_url&&<button type="button" className="ag-btn ghost sm" disabled={busy} onClick={dropLogo}><Trash2 size={15} aria-hidden="true"/>הסרה</button>}</div>
  <fieldset className="wide ag-fieldset"><legend>אתרים שכבר שימשו, לכל לקוח חדש</legend><div className="ag-mode">{([['warn','להציג עם סימון "שומש עבור הלקוח"','מומלץ'],['hide','להסתיר מהמחירון','']] as const).map(([mode,title,sub])=><button key={mode} type="button" role="radio" aria-checked={v.used_mode===mode} className={'ag-opt'+(v.used_mode===mode?' on':'')} onClick={()=>set('used_mode',mode)}><span className="ag-radio"/><span><b>{title}</b>{sub&&<small>{sub}</small>}</span></button>)}</div><p className="ag-muted" style={{fontSize:13,margin:'8px 0 0'}}>אפשר לשנות לכל לקוח בלשונית "אתרים שכבר שימשו".</p></fieldset>
  <label className="ag-check wide"><input type="checkbox" checked={!!v.show_amounts} onChange={e=>set('show_amounts',e.target.checked)}/>להציג עלויות בדוח ללקוח כברירת מחדל</label>
 </div>{error&&<p className="ag-alert" role="alert">{error}</p>}{saved&&<p className="ag-ok" role="status">ההגדרות נשמרו</p>}
 <div className="ag-actions"><button type="submit" className="ag-btn primary" disabled={busy}>{busy?<LoaderCircle size={17} className="animate-spin"/>:<Save size={17}/>}שמירת הגדרות</button></div></form>;
}

// ---------- publication calendar (spec 5.5) ----------
const WEEKDAYS=['א׳','ב׳','ג׳','ד׳','ה׳','ו׳','ש׳'];
function Calendar({ctx}:{ctx:Ctx}){
 const today=israelToday(),[ym,setYm]=useState({y:today.y,m:today.m}),[who,setWho]=useState(''),[open,setOpen]=useState('');
 const month=`${ym.y}-${pad(ym.m)}`,state=useData(AP+'/calendar?month='+month,ctx.revision),customers=useData(AP+'/customers',ctx.revision);
 // While another month loads, the previous month's items are not shown on this month's grid.
 const items:Row[]=(state.data?.month===month?state.data.items:[]).filter((i:Row)=>!who||(who==='none'?!i.customer_id:i.customer_id===who));
 const days=new Date(Date.UTC(ym.y,ym.m,0)).getUTCDate(),first=new Date(Date.UTC(ym.y,ym.m-1,1)).getUTCDay();
 const byDay=new Map<string,Row[]>();for(const i of items)byDay.set(i.date,[...(byDay.get(i.date)||[]),i]);
 const move=(d:number)=>{setOpen('');setYm(({y,m})=>{const t=new Date(Date.UTC(y,m-1+d,1));return {y:t.getUTCFullYear(),m:t.getUTCMonth()+1};});};
 const todayKey=`${today.y}-${pad(today.m)}-${pad(today.d)}`,openItems=open?byDay.get(open)||[]:[];
 return <>
  <div className="ag-filters"><button type="button" className="ag-btn ghost sm" aria-label="החודש הקודם" onClick={()=>move(-1)}><ChevronRight size={17}/></button><b style={{fontSize:17,minWidth:120,textAlign:'center'}}>{MONTHS[ym.m-1]} {ym.y}</b><button type="button" className="ag-btn ghost sm" aria-label="החודש הבא" onClick={()=>move(1)}><ChevronLeft size={17}/></button>
   <label className="ag-select"><small>לקוח</small><select value={who} onChange={e=>setWho(e.target.value)}><option value="">כל הלקוחות</option><option value="none">ללא לקוח</option>{(customers.data?.customers||[]).filter((c:Row)=>c.status!=='archived').map((c:Row)=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
   <span className="grow"/><span className="ag-legend"><i className="pub"/>פורסם</span><span className="ag-legend"><i className="sch"/>מתוכנן</span></div>
  {state.error&&<p className="ag-alert" role="alert">{state.error}</p>}
  <div className="ag-cal" role="grid" aria-label={'לוח פרסומים '+MONTHS[ym.m-1]+' '+ym.y}>
   {WEEKDAYS.map(w=><div key={w} className="ag-cal-head" role="columnheader">{w}</div>)}
   {Array.from({length:first},(_,i)=><div key={'e'+i} className="ag-cal-day empty"/>)}
   {Array.from({length:days},(_,i)=>{const key=`${month}-${pad(i+1)}`,list=byDay.get(key)||[];return <button key={key} type="button" role="gridcell" className={'ag-cal-day'+(key===todayKey?' today':'')+(open===key?' on':'')} disabled={!list.length} aria-label={`${i+1} ${MONTHS[ym.m-1]}: ${list.length} פרסומים`} onClick={()=>setOpen(open===key?'':key)}><span className="n">{i+1}</span><span className="dots">{list.slice(0,6).map(x=><i key={x.id} className={x.kind==='published'?'pub':'sch'} style={x.customer_id?{background:x.kind==='published'?colorFor(x.customer_id):undefined,borderColor:colorFor(x.customer_id)}:undefined}/>)}{list.length>6&&<small>+{list.length-6}</small>}</span></button>;})}
  </div>
  {open&&<section className="ag-cal-list" aria-live="polite"><h3 className="ag-stage">{day(open+'T12:00:00Z')}<span>{openItems.length}</span></h3>{openItems.map(i=><div key={i.id} className="ag-task"><span className="ag-av" style={{background:i.customer_id?colorFor(i.customer_id):'#9fb0c4',width:30,height:30,fontSize:13}}>{(i.customer_name||'?').charAt(0)}</span><span className="t"><b>{i.website_name}</b><small>{i.customer_name||'ללא לקוח'} · {i.kind==='published'?'פורסם':'מתוכנן'}</small></span>{i.published_url?<a className="ag-link" href={i.published_url} target="_blank" rel="noreferrer">לכתבה<ExternalLink size={14}/></a>:<Link ctx={ctx} to={'article/'+i.id} className="ag-btn ghost sm">פתיחה</Link>}</div>)}</section>}
  {!items.length&&!state.loading&&<p className="ag-muted" style={{marginTop:12}}>אין פרסומים בחודש הזה.</p>}
 </>;
}
