'use client';
// Agency centre (design/agency-dashboard/spec.md). A full page inside the personal area for accounts of type "סוכנות":
// header band, section tabs, and the customers page (list on the right, one customer's screen with tabs).
// Every action uses the existing records and routes, so nothing here is a copy of "הכתבות שלי" or "ההזמנות שלי".
import React,{useEffect,useMemo,useState} from 'react';
import {ArrowRight,ShoppingCart,Users,Globe,Search,UserPlus,FileText,IdCard,Download,ExternalLink,Archive,ArchiveRestore,Save,LoaderCircle,Plus,X} from 'lucide-react';
import {api,useData} from '@/lib/client';
import {type Row,stages} from '@/lib/shared';
import {purchaseStage,purchaseStages} from '@/lib/purchased-history';
import type {Ctx} from './workspace';
import './agency-center.css';

const SECTIONS=[['customers','לקוחות',Users],['publications','פרסומים',Globe]] as const;
const CUSTOMER_TABS=[['publications','פרסומים',Globe],['articles','כתבות',FileText],['details','פרטים',IdCard]] as const;
const COLORS=['#1673e6','#7c3aed','#0f9f8f','#ea580c','#b45309','#db2777','#0369a1','#16a34a','#0891b2','#65a30d','#c2410c','#be185d'];
const colorFor=(id:string)=>COLORS[[...String(id)].reduce((s,c)=>s+c.charCodeAt(0),0)%COLORS.length];
const ils=(cents:number)=>'₪'+(Math.round(Number(cents||0))/100).toLocaleString('he-IL',{maximumFractionDigits:2});
const day=(iso:string)=>iso?new Date(iso).toLocaleDateString('he-IL',{timeZone:'Asia/Jerusalem',day:'2-digit',month:'2-digit',year:'numeric'}):'—';
const norm=(v:unknown)=>String(v||'').trim().toLocaleLowerCase();
const plain=(e:React.MouseEvent)=>e.button===0&&!e.metaKey&&!e.ctrlKey&&!e.shiftKey&&!e.altKey;

// A site's logo, or the globe icon when there is none or it does not load.
function SiteLogo({src}:{src?:string}){const [failed,setFailed]=useState(false);return <span className="ag-logo">{src&&!failed?<img src={src} alt="" width={34} height={34} style={{borderRadius:10,objectFit:'contain'}} onError={()=>setFailed(true)}/>:<Globe size={17}/>}</span>;}
function Avatar({name,id,size=36}:{name:string;id:string;size?:number}){return <span className="ag-av" aria-hidden="true" style={{background:colorFor(id),width:size,height:size,fontSize:Math.round(size*.42)}}>{String(name||'?').trim().charAt(0)||'?'}</span>;}
function Link({ctx,to,className,children,label,current}:{ctx:Ctx;to:string;className?:string;children:React.ReactNode;label?:string;current?:boolean}){
 return <a href={'/'+to} className={className} aria-label={label} aria-current={current?'page':undefined} onClick={e=>{if(!plain(e))return;e.preventDefault();ctx.go(to);}}>{children}</a>;
}

export default function AgencyCenter({ctx,view}:{ctx:Ctx;view:string}){
 const rest=view.split('/').slice(2),section=rest[0]||'customers';
 const agency=ctx.user?.role==='agency';
 useEffect(()=>{if(ctx.user&&!agency)ctx.go('purchased/customers');},[agency,ctx]);
 if(!agency)return <section className="ag" dir="rtl"><div className="ag-card ag-empty"><Users size={34}/><h3>מרכז הסוכנות פתוח לחשבונות סוכנות</h3><p>מעבירים אתכם לרשימת הלקוחות שלכם.</p></div></section>;
 return <section className="ag" dir="rtl" aria-labelledby="ag-title">
  <header className="ag-band">
   <Link ctx={ctx} to="purchased" className="ag-btn ghost sm"><ArrowRight size={16}/>לאזור האישי</Link>
   <span className="sep"/>
   <img src="/brand/megalinks-logo-dark.png" alt="Mega Links" width={140} height={30}/>
   <span className="sep"/>
   <div className="grow"><h1 id="ag-title">מרכז הסוכנות</h1><p><bdi>{ctx.user?.company||ctx.user?.name}</bdi></p></div>
   <button type="button" className="ag-btn buy" onClick={()=>ctx.go('catalog')}><ShoppingCart size={18}/>רכישת פרסום</button>
  </header>
  <nav className="ag-tabs" aria-label="מרכז הסוכנות">{SECTIONS.map(([key,label,Icon])=><Link key={key} ctx={ctx} to={'purchased/agency/'+key} current={section===key} className=""><Icon size={18} aria-hidden="true"/>{label}</Link>)}</nav>
  {section==='publications'?<section className="ag-card ag-main"><h2 className="ag-page-title">כל הפרסומים</h2><Publications ctx={ctx} customer=""/></section>
   :<Customers ctx={ctx} customerId={rest[1]||''} tab={rest[2]||''}/>}
 </section>;
}

// ---------- customers ----------
function Customers({ctx,customerId,tab}:{ctx:Ctx;customerId:string;tab:string}){
 const state=useData('agency/customers',ctx.revision),all:Row[]=state.data?.customers||[];
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
    <Link ctx={ctx} to="purchased/agency/customers/new" className="ag-btn primary sm" label="לקוח חדש"><UserPlus size={17}/></Link>
   </div>
   <div className="ag-seg" role="group" aria-label="סינון לקוחות">{([['active','פעילים',counts.active],['archived','ארכיון',counts.archived],['all','הכול',all.length]] as const).map(([key,label,n])=><button key={key} type="button" aria-pressed={filter===key} onClick={()=>setFilter(key)}>{label} · <bdi>{n}</bdi></button>)}</div>
   <div className="ag-list-items" role="list">
    {state.error&&<p className="ag-alert" role="alert">{state.error}</p>}
    {state.loading&&!state.data?[0,1,2,3].map(i=><div key={i} className="ag-cust"><span className="ag-av" style={{background:'#e8eef5'}}/><span className="t"><span className="ag-skel" style={{width:'70%'}}/></span></div>)
     :!rows.length?<div className="ag-empty"><Users size={28}/><h3>{query?'לא נמצאו לקוחות':filter==='archived'?'אין לקוחות בארכיון':'עדיין אין לקוחות'}</h3><p>{query?'נסו חיפוש אחר.':'מוסיפים לקוח, ומשייכים אליו כתבות ופרסומים.'}</p></div>
     :rows.map(c=><div role="listitem" key={c.id}><Link ctx={ctx} to={'purchased/agency/customers/'+encodeURIComponent(c.id)} current={shown?.id===c.id} className={'ag-cust'+(shown?.id===c.id?' on':'')}><Avatar name={c.name} id={c.id}/><span className="t"><b>{c.name}</b><small>{c.company||c.domains?.[0]||' '}</small></span>{c.stats?.waiting>0&&<span className="ag-pending" aria-label={c.stats.waiting+' כתבות מחכות לכם'}>{c.stats.waiting}</span>}</Link></div>)}
   </div>
  </aside>
  <section className="ag-card ag-main" aria-live="polite">
   {open&&<Link ctx={ctx} to="purchased/agency/customers" className="ag-back"><ArrowRight size={16}/>כל הלקוחות</Link>}
   {isNew?<CustomerDetails ctx={ctx} customer={null}/>
    :shown?<CustomerScreen key={shown.id} ctx={ctx} customer={shown} tab={tab}/>
    :state.loading?<div className="ag-skel" style={{height:24,width:'40%'}}/>
    :customerId?<div className="ag-empty"><Users size={30}/><h3>הלקוח לא נמצא</h3><p>ייתכן שנמחק. בחרו לקוח מהרשימה.</p></div>
    :<div className="ag-empty"><UserPlus size={30}/><h3>הוסיפו את הלקוח הראשון</h3><p>שומרים את פרטי הלקוח, ואז רואים במקום אחד את כל מה שפורסם עבורו.</p><Link ctx={ctx} to="purchased/agency/customers/new" className="ag-btn primary"><Plus size={17}/>לקוח חדש</Link></div>}
  </section>
 </div>;
}

function CustomerScreen({ctx,customer,tab}:{ctx:Ctx;customer:Row;tab:string}){
 const current=CUSTOMER_TABS.some(([k])=>k===tab)?tab:'publications';
 const base='purchased/agency/customers/'+encodeURIComponent(customer.id);
 return <>
  <div className="ag-chead">
   <Avatar name={customer.name} id={customer.id} size={54}/>
   <div style={{flex:1,minWidth:0}}><h2>{customer.name}</h2>
    <div className="ag-chips">{customer.company&&<span className="ag-chip">{customer.company}</span>}{(customer.domains||[]).slice(0,2).map((d:string)=><span key={d} className="ag-chip"><Globe size={13}/><span className="ag-ltr">{d}</span></span>)}{(customer.tags||[]).map((t:string)=><span key={t} className="ag-chip tag">{t}</span>)}{customer.status==='archived'&&<span className="ag-chip">בארכיון</span>}</div>
   </div>
  </div>
  <div className="ag-ctabs" role="tablist" aria-label={'הלקוח '+customer.name}>{CUSTOMER_TABS.map(([key,label,Icon])=><button key={key} type="button" role="tab" aria-selected={current===key} className={current===key?'on':''} onClick={()=>ctx.go(base+'/'+key)}><Icon size={16} aria-hidden="true"/>{label}{key==='articles'&&customer.stats?.waiting>0&&<span className="ag-pending">{customer.stats.waiting}</span>}</button>)}</div>
  <div role="tabpanel">
   {current==='details'?<CustomerDetails ctx={ctx} customer={customer}/>:current==='articles'?<CustomerArticles ctx={ctx} customer={customer}/>:<Publications ctx={ctx} customer={customer.id}/>}
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
   const out=await ctx.run(()=>api(customer?'agency/customers/'+encodeURIComponent(customer.id):'agency/customers',customer?'PATCH':'POST',body),status==='archived'?'הלקוח הועבר לארכיון':status==='active'&&customer?.status==='archived'?'הלקוח הוחזר מהארכיון':'פרטי הלקוח נשמרו');
   if(!customer&&out?.id)ctx.go('purchased/agency/customers/'+encodeURIComponent(out.id)+'/details');else setSaved(true);
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
 const customers=useData(customer?'':'agency/customers',ctx.revision,!customer);
 const custom=year?{from:`${year}-${month||'01'}-01`,to:month?`${year}-${month}-${pad(new Date(Date.UTC(Number(year),Number(month),0)).getUTCDate())}`:`${year}-12-31`}:range;
 const q=new URLSearchParams({...(customer?{customer}:who?{customer:who}:{}),...(custom.from?{from:custom.from}:{}),...(custom.to?{to:custom.to}:{}),...(status?{status}:{})});
 const state=useData('agency/publications?'+q.toString(),ctx.revision),rows:Row[]=state.data?.publications||[],s=state.data?.summary;
 const years=useData('agency/publications?'+new URLSearchParams(customer?{customer}:{}).toString(),ctx.revision).data?.years||[];
 const exportCsv=()=>{const head=[...(customer?[]:['לקוח']),'אתר','כתובת האתר','תאריך פרסום','קישור לכתבה','עוגן','קישור יעד','הזמנה','עלות לפני מע"מ','סטטוס'];
  const lines=[head,...rows.map(a=>[...(customer?[]:[a.customer_name||'ללא לקוח']),a.website_name,a.website_url,a.published_at?day(a.published_at):'',a.published_url,a.anchor,a.target_url,a.number,(a.spend/100).toFixed(2),a.status==='published'?'פורסם':a.status==='cancelled'||a.publication_refunded?'זוכה':'בדרך'])];
  const blob=new Blob(['﻿'+lines.map(l=>l.map(csvCell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),link=document.createElement('a');
  link.href=url;link.download='publications-'+(custom.from||'all')+'.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),4000);};
 const statusOf=(a:Row)=>a.status==='cancelled'||a.publication_refunded?['זוכה','off']:a.status==='published'?['פורסם','']:['בדרך','way'];
 return <>
  <div className="ag-filters" role="group" aria-label="סינון פרסומים">
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
     <td className="ag-td-site"><div className="ag-site"><SiteLogo src={a.website_logo}/><span><b>{a.website_name}</b><small>{String(a.website_url||'').replace(/^https?:\/\/(www\.)?/,'').replace(/\/$/,'')}</small></span></div></td>
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
 const state=useData('agency/customers/'+encodeURIComponent(customer.id)+'/articles',ctx.revision),rows:Row[]=(state.data?.articles||[]).filter((a:Row)=>a.status!=='cancelled'&&!a.demo);
 const groups=purchaseStages.map(s=>({...s,items:rows.filter(a=>purchaseStage(a)===s.key)})).filter(g=>g.items.length);
 const tone=(a:Row)=>a.status==='published'?'':['draft','review','revisions'].includes(a.status)?'wait':'way';
 if(state.loading&&!state.data)return <div className="ag-skel" style={{height:120}}/>;
 if(state.error)return <p className="ag-alert" role="alert">{state.error}</p>;
 if(!rows.length)return <div className="ag-empty"><FileText size={30}/><h3>אין כתבות משויכות ללקוח</h3><p>כתבה משויכת ללקוח כשרוכשים עבורו, או מהמסך "הכתבות שלי" בבחירת לקוח לכתבה.</p></div>;
 return <>{groups.map(g=><section key={g.key} aria-label={g.label}><h3 className="ag-stage">{g.label}<span>{g.items.length}</span></h3>
  {g.items.map(a=><div key={a.id} className="ag-art"><SiteLogo src={a.website_logo}/><span className="t"><b>{a.title||a.topic||'כתבה ללא כותרת'}</b><small>{a.website_name} · הזמנה <bdi>{a.number}</bdi>{a.published_at?<> · פורסם <bdi>{day(a.published_at)}</bdi></>:null}</small></span><span className={'ag-status '+tone(a)}>{stages[a.status]||a.status}</span>
   {a.published_url?<a className="ag-link" href={a.published_url} target="_blank" rel="noreferrer">לכתבה<ExternalLink size={14}/></a>:<Link ctx={ctx} to={'article/'+a.id} className="ag-btn ghost sm">{['draft','review','revisions'].includes(a.status)?'לטיפול':'פתיחה'}</Link>}
  </div>)}</section>)}</>;
}
