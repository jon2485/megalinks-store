'use client';
import React,{useMemo,useRef,useState} from 'react';
import {ArrowRight,Bell,Box,Check,ChevronLeft,CreditCard,Download,ExternalLink,FileText,Globe,Link2,Mail,MoreHorizontal,Pencil,Plus,Search,Send,UserRound,X} from 'lucide-react';
import {Input} from '@/components/ui/input';
import {Textarea} from '@/components/ui/textarea';
import {DropdownMenu,DropdownMenuContent,DropdownMenuItem,DropdownMenuSeparator,DropdownMenuTrigger} from '@/components/ui/dropdown-menu';
import {api,useData} from '@/lib/client';
import {money,type Row} from '@/lib/shared';
import {contentTime,contentUrl} from '@/lib/content-presentation';
import {adminViewState,saveAdminViewState} from '@/lib/admin-view-state';
import {supplierPaymentMethods,supplierRequestKinds,supplierRequestStates,supplierStatementStates} from '@/lib/supplier-presentation';
import {openAddStock,supplierKinds} from './supplier-pages';
import type {Ctx} from './workspace';
import './supplier-v2.css';
import {areaIcons} from './orders-area-head';

// Pieces that live in the suppliers workspace, passed in to avoid a circular import.
export type SupplierKit={
 SiteQuickEdit:React.ComponentType<{ctx:Ctx;site:Row;close:()=>void}>;
 SiteAttach:React.ComponentType<{ctx:Ctx;supplier:Row;close:()=>void}>;
 SiteDetach:React.ComponentType<{ctx:Ctx;site:Row;supplier:Row;close:()=>void}>;
 SupplierProfileForm:React.ComponentType<{ctx:Ctx;supplier:Row;onDirty:(v:boolean)=>void;saved:(id:string)=>void}>;
 SupplierPayout:React.ComponentType<{supplier:Row}>;
 CatalogWebsiteForm:React.ComponentType<any>;
 openPayment:(ctx:Ctx,r:Row)=>void;
 canPay:(r:Row)=>boolean;
};
type Guard={confirm:(run:()=>void)=>void;mark:(key:string,dirty:boolean)=>void};

const plain=(e:React.MouseEvent)=>!(e.button||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey);
const d2=(v?:string)=>v?new Date(String(v).length===10?v+'T12:00:00Z':v).toLocaleDateString('he-IL',{day:'2-digit',month:'2-digit',year:'2-digit'}):'—';
const dm=(v?:string)=>v?new Date(String(v).length===10?v+'T12:00:00Z':v).toLocaleDateString('he-IL',{day:'2-digit',month:'2-digit'}):'—';
const monthName=(m:string)=>{const [y,n]=m.split('-').map(Number);return new Date(Date.UTC(y,n-1,15)).toLocaleDateString('he-IL',{month:'long',year:'numeric'});};
const linkText=(u?:string)=>String(u||'').replace(/^https?:\/\//,'').replace(/^www\./,'').replace(/\/$/,'');
const shortHost=(u?:string)=>linkText(u).split('/')[0].split('.')[0].slice(0,5);
const orderNo=(n:any)=>n?(String(n).startsWith('#')?String(n):'#'+n):'';
const avatarColors=['#0071e3','#30a46c','#bf5af2','#ff9f0a','#ff375f','#0a84ff','#5e5ce6'];
const avatarColor=(s:string)=>avatarColors[[...String(s||'')].reduce((n,c)=>n+c.charCodeAt(0),0)%avatarColors.length];
export function Av({name,size}:{name?:string;size?:'lg'}){return <span className={'sv2-av'+(size?' is-lg':'')} style={{background:avatarColor(name||'')}} aria-hidden="true">{String(name||'?').trim().slice(0,1)}</span>;}
function Stock({used,total,tone}:{used:number;total:number;tone?:string}){return <span className={'sv2-stock'+(tone?' is-'+tone:'')}><span>{used}</span><i>/</i><b>{total}</b></span>;}
export const billingPill=(b:string)=>b==='stock'?<span className="sv2-pill p-stock"><i/>מלאי · חבילה מראש</span>:b==='monthly'?<span className="sv2-pill p-month"><i/>התחשבנות חודשית</span>:<span className="sv2-muted">אין אתרים</span>;
export const kindPill=(k:string)=><span className={'sv2-pill '+(k==='account'?'p-acc':k==='partial'?'p-part':'p-man')}>{supplierKinds[k]||'ספק ידני'}</span>;
const orderPill:Record<string,[string,string]>={open:['p-open','הזמנה פתוחה'],awaiting:['p-wait','ממתינה לחשבונית'],invoice:['p-inv','התקבלה חשבונית'],paid:['p-paid','שולמה']};
const packPill=(p:Row)=>p.status==='done'?<span className="sv2-pill p-paid"><i/>נוצלה במלואה</span>:p.status==='queued'?<span className="sv2-pill p-man"><i/>ממתינה לשימוש</span>:p.status==='low'?<span className="sv2-pill p-inv"><i/>עומדת להיגמר · {p.left}</span>:<span className="sv2-pill p-open"><i/>בשימוש{p.paid?' · שולמה':''}</span>;

/* ---------- Supplier page shell: crumb, hero, four tabs ---------- */
export type SupplierTab='sites'|'articles'|'billing'|'details';
export function SupplierV2({ctx,id,tab,guard,kit}:{ctx:Ctx;id:string;tab:SupplierTab;guard:Guard;kit:SupplierKit}){
 const params=new URLSearchParams({page:'1',q:'',all:'0',selected:''}),state=useData('admin/suppliers/'+encodeURIComponent(id)+'?'+params,ctx.revision),s:Row|undefined=state.data?.supplier;
 const bill=useData('admin/supplier-billing/'+encodeURIComponent(id),ctx.revision),b:Row|undefined=bill.data;
 const arts=useData('admin/suppliers/'+encodeURIComponent(id)+'/articles',ctx.revision),articles:Row[]=arts.data?.articles||[];
 const go=(page:string,before?:()=>void)=>guard.confirm(()=>{before?.();ctx.go(page);});
 const toTab=(t:SupplierTab)=>t==='articles'?go('admin-supplier-articles/'+id):t==='billing'?go('admin-supplier-billing/'+id):go('admin-supplier/'+id,()=>saveAdminViewState('supplier-editor:'+id,{site:'',tab:t,all:false}));
 if(state.error&&!s)return <div className="sv2"><div className="sv2-empty"><h3>הספק לא נטען</h3><p>{state.error}</p><button type="button" className="sv2-btn quiet" onClick={()=>ctx.go('admin-suppliers')}>חזרה לכל הספקים</button></div></div>;
 if(!s)return <div className="sv2"><p className="sv2-loading" role="status">טוען את הספק…</p></div>;
 const month=new Date().toISOString().slice(0,7),sentMonth=articles.filter(a=>String(a.supplier_sent_at||'').startsWith(month)).length,orders=b?(s.billing==='stock'?b.stock.packages.length:b.orders.length):0,billing=s.billing;
 const tabTitle:Record<SupplierTab,string>={sites:'',articles:'כתבות שנשלחו',billing:'התחשבנות',details:'פרטים'};
 return <div className="sv2" dir="rtl">
  <nav className="sv2-crumb" aria-label="מיקום"><a href="/admin-suppliers" onClick={e=>{if(!plain(e))return;e.preventDefault();go('admin-suppliers');}}>כל הספקים</a><ChevronLeft size={14} aria-hidden="true"/>{tab==='sites'?<span>{s.name}</span>:<><a href={'/admin-supplier/'+s.id} onClick={e=>{if(!plain(e))return;e.preventDefault();toTab('sites');}}>{s.name}</a><ChevronLeft size={14} aria-hidden="true"/><span>{tabTitle[tab]}</span></>}</nav>
  {(tab==='sites'||tab==='details')&&<header className="sv2-card sv2-hero"><Av name={s.name} size="lg"/><div><h2>{s.name}</h2><div className="sv2-meta">{kindPill(s.kind)}{billingPill(billing)}{s.contact&&<span>{s.contact}</span>}{s.email&&<a href={'mailto:'+s.email}><bdi>{s.email}</bdi></a>}{s.phone&&<a href={'tel:'+s.phone}><bdi>{s.phone}</bdi></a>}</div></div><div className="sv2-kpis"><button type="button" className="sv2-kpi" onClick={()=>toTab('sites')}><span>אתרים</span><b>{s.site_count}</b></button><button type="button" className="sv2-kpi" onClick={()=>toTab('articles')}><span>כתבות החודש</span><b>{sentMonth}</b></button><button type="button" className="sv2-kpi" onClick={()=>toTab('billing')}><span>{billing==='stock'?'מלאי שנותר':'לתשלום'}</span><b><bdi>{!b?'—':billing==='stock'?b.stock.left:money(b.summary.due.amount)}</bdi></b></button></div></header>}
  <nav className="sv2-tabs" aria-label="חלקי עמוד הספק">
   {([['sites',Globe,'אתרים',s.site_count+' אתרים'+(state.data?.total?'':'')],['articles',FileText,'כתבות שנשלחו',articles.length+' כתבות'],['billing',CreditCard,'התחשבנות',orders?orders+' הזמנות':'הזמנות לפי חודש'],['details',UserRound,'פרטים','אנשי קשר ואופן התנהלות']] as [SupplierTab,React.ElementType,string,string][]).map(([key,Icon,label,sub])=><button key={key} type="button" className={'sv2-tab'+(tab===key?' on':'')} aria-current={tab===key?'page':undefined} onClick={()=>tab!==key&&toTab(key)}><span className="ic"><Icon size={19} aria-hidden="true"/></span><span><b>{label}</b><small>{sub}</small></span></button>)}
  </nav>
  {tab==='sites'&&<SitesTab ctx={ctx} supplier={s} guard={guard} kit={kit}/>}
  {tab==='articles'&&<ArticlesTab ctx={ctx} supplier={s} state={arts}/>}
  {tab==='billing'&&<BillingTab ctx={ctx} supplier={s} state={bill}/>}
  {tab==='details'&&<DetailsTab ctx={ctx} supplier={s} guard={guard} kit={kit} go={go}/>}
 </div>;
}

/* ---------- Sites ---------- */
function SitesTab({ctx,supplier:s,guard,kit}:{ctx:Ctx;supplier:Row;guard:Guard;kit:SupplierKit}){
 const[initial]=useState(()=>adminViewState('supplier-editor:'+s.id,{site:'',tab:'sites',all:false})),[editing,setEditing]=useState<string>(initial.site||''),[page,setPage]=useState(1),[query,setQuery]=useState('');
 const params=new URLSearchParams({page:String(page),q:query,all:'0',selected:editing&&editing!=='new'?editing:''}),state=useData('admin/suppliers/'+encodeURIComponent(s.id)+'?'+params,ctx.revision),current=state.data?.request_key===params.toString(),sites:Row[]=current?state.data.sites:[];
 const go=(page:string,before?:()=>void)=>guard.confirm(()=>{before?.();ctx.go(page);});
 const edit=(id:string)=>guard.confirm(()=>{saveAdminViewState('supplier-editor:'+s.id,{site:id,tab:'sites',all:false});setEditing(id);});
 const close=()=>{guard.mark('supplier-site',false);saveAdminViewState('supplier-editor:'+s.id,{site:'',tab:'sites',all:false});setEditing('');ctx.refresh();};
 if(editing){const site=editing==='new'?null:state.data?.selected_site||sites.find(w=>w.id===editing);return <section className="sv2-card sv2-editor"><header><h3>{editing==='new'?'אתר חדש לספק':'עריכה מלאה · '+(site?.name||'')}</h3><button type="button" className="sv2-btn quiet" onClick={()=>guard.confirm(close)}><ArrowRight size={16} aria-hidden="true"/>חזרה לאתרים</button></header>{editing!=='new'&&!site?<p className="sv2-loading" role="status">טוען…</p>:<kit.CatalogWebsiteForm key={editing} ctx={ctx} site={site} defaultSupplier={s.id} presentation="supplier" onDirtyChange={(dirty:boolean)=>guard.mark('supplier-site',dirty)} close={close}/>}</section>;}
 const quick=(w:Row)=>ctx.open({kind:'admin-finance',title:'עריכה מהירה',description:w.name+' · המחירים לפני מע״מ',render:(c:()=>void)=><kit.SiteQuickEdit ctx={ctx} site={w} close={c}/>});
 const cols={gridTemplateColumns:'minmax(220px,2fr) 110px 110px 100px 120px 96px 150px'};
 return <section className="sv2-card">
  <div className="sv2-tools"><label className="sv2-search"><Search size={17} aria-hidden="true"/><input value={query} placeholder="חיפוש באתרי הספק" aria-label="חיפוש באתרי הספק" onChange={e=>{setQuery(e.target.value);setPage(1);}}/></label><button type="button" className="sv2-btn tint" onClick={()=>ctx.open({kind:'admin-finance',title:'צירוף אתרים לספק',description:'בחר אתרים מהקטלוג שיעברו לספק '+s.name+'.',render:(c:()=>void)=><kit.SiteAttach ctx={ctx} supplier={s} close={c}/>})}><Link2 size={16} aria-hidden="true"/>צירוף אתרים</button><button type="button" className="sv2-btn primary" onClick={()=>edit('new')}><Plus size={16} aria-hidden="true"/>אתר חדש</button></div>
  {!current?<p className="sv2-loading" role="status">טוען אתרים…</p>:!sites.length?<div className="sv2-empty"><h3>{query?'לא נמצאו אתרים לחיפוש':'עדיין אין אתרים אצל הספק'}</h3><p>אפשר לצרף אתרים קיימים מהקטלוג או להוסיף אתר חדש.</p></div>:<>
   <div className="sv2-th" style={cols} aria-hidden="true"><span>אתר</span><span>מחיר באתר</span><span>עלות</span><span>רווח</span><span>כתבות החודש</span><span>מצב</span><span/></div>
   {sites.map(w=>{const margin=w.cost_cents==null?null:Number(w.price)-Number(w.cost_cents);return <div key={w.id} className="sv2-tr" style={cols}>
    <div className="sv2-who"><SiteBadge site={w}/><span><b>{w.name}</b><small><bdi>{linkText(w.url)}</bdi></small></span></div>
    <span className="sv2-num"><small className="sv2-ml">מחיר באתר</small>{money(w.price)}</span>
    <span className="sv2-num"><small className="sv2-ml">עלות</small>{w.cost_cents==null?<em className="sv2-warn">לא הוגדרה</em>:money(w.cost_cents)}</span>
    <span className="sv2-num" style={{color:margin==null?undefined:margin<0?'var(--sv-red)':'var(--sv-green)'}}><small className="sv2-ml">רווח</small>{margin==null?'—':money(margin)}</span>
    <span className="sv2-num"><small className="sv2-ml">כתבות החודש</small>{w.month_count||0}</span>
    <span className={'sv2-state '+(w.active?'on':'off')}><i/>{w.active?'פעיל':'מושהה'}</span>
    <span className="sv2-rowact"><button type="button" className="sv2-btn tint sm" onClick={()=>quick(w)}><Pencil size={14} aria-hidden="true"/>עריכה</button><DropdownMenu dir="rtl"><DropdownMenuTrigger asChild><button type="button" className="sv2-dots" aria-label={'עוד פעולות עבור '+w.name}><MoreHorizontal size={16}/></button></DropdownMenuTrigger><DropdownMenuContent className="sv2-menu" align="end">
     <DropdownMenuItem onSelect={()=>edit(w.id)}><Pencil size={15}/>עריכה מלאה של האתר</DropdownMenuItem>
     <DropdownMenuItem onSelect={()=>go('admin-supplier-articles/'+s.id,()=>saveAdminViewState('supplier-articles:'+s.id,{site:w.id}))}><FileText size={15}/>כתבות באתר הזה</DropdownMenuItem>
     {s.billing==='stock'&&<DropdownMenuItem onSelect={()=>go('admin-supplier-stock/'+w.id)}><Box size={15}/>{w.stock_total==null?'ניהול מלאי · אין עדיין חבילה':'ניהול מלאי · נותרו '+w.stock_remaining}</DropdownMenuItem>}
     {s.billing==='stock'&&<DropdownMenuItem onSelect={()=>openAddStock(ctx,{...w,total:w.stock_total,used:w.stock_sent},ctx.refresh)}><Plus size={15}/>הוספת מלאי</DropdownMenuItem>}
     <DropdownMenuItem onSelect={()=>window.open(contentUrl(w.url),'_blank','noopener')}><ExternalLink size={15}/>פתיחת האתר</DropdownMenuItem>
     <DropdownMenuSeparator/>
     <DropdownMenuItem className="sv2-danger" onSelect={()=>ctx.open({kind:'admin-finance',title:'הסרת אתר מהספק',description:w.name+' · '+s.name,render:(c:()=>void)=><kit.SiteDetach ctx={ctx} site={w} supplier={s} close={c}/>})}><X size={15}/>הסרה מהספק</DropdownMenuItem>
    </DropdownMenuContent></DropdownMenu></span>
   </div>;})}
   <div className="sv2-foot"><span>המחירים לפני מע״מ · בתפריט ⋯: עריכה מלאה, כתבות באתר, מלאי, פתיחת האתר, הסרה מהספק</span><span className="sv2-pager">{state.data.total>20&&<><button type="button" disabled={page<=1} onClick={()=>setPage(page-1)} aria-label="עמוד קודם">‹</button><span>עמוד {page} מתוך {Math.ceil(state.data.total/20)}</span><button type="button" disabled={page*20>=state.data.total} onClick={()=>setPage(page+1)} aria-label="עמוד הבא">›</button></>}{state.data.total<=20&&<span>{sites.length} מתוך {state.data.total}</span>}</span></div>
  </>}
 </section>;
}
function SiteBadge({site:w}:{site:Row}){const[broken,setBroken]=useState(false);return w.logo_url&&!broken?<img className="sv2-thumb" src={w.logo_url} alt="" loading="lazy" onError={()=>setBroken(true)}/>:<span className="sv2-thumb" aria-hidden="true">{shortHost(w.url)||String(w.name||'').slice(0,2)}</span>;}

/* ---------- Articles sent to the supplier ---------- */
function ArticlesTab({ctx,supplier:s,state}:{ctx:Ctx;supplier:Row;state:Row}){
 const all:Row[]=state.data?.articles||[],[site,setSiteRaw]=useState(()=>adminViewState('supplier-articles:'+s.id,{site:'all'}).site||'all'),[q,setQ]=useState(''),[more,setMore]=useState(30);
 const setSite=(v:string)=>{setSiteRaw(v);setMore(30);saveAdminViewState('supplier-articles:'+s.id,{site:v});};
 const sites=useMemo(()=>[...new Map(all.map(a=>[a.website_id,a.website_name||linkText(a.website_url)])).entries()],[all]);
 const term=q.trim().toLowerCase(),rows=all.filter(a=>(site==='all'||a.website_id===site)&&(!term||[a.title,a.topic,a.anchor,a.number,a.website_name].join(' ').toLowerCase().includes(term)));
 const waiting=rows.filter(a=>a.stage!=='published'),published=rows.filter(a=>a.stage==='published');
 const open=(a:Row)=>(e:React.MouseEvent)=>{if(!plain(e))return;e.preventDefault();saveAdminViewState('content-parent','admin-articles');ctx.go('admin-article/'+a.id);};
 const cols={gridTemplateColumns:'36px minmax(220px,2fr) 110px 100px minmax(170px,1.3fr) minmax(170px,1.3fr) 100px'};
 const row=(a:Row,n:number)=>{const pairs=[[a.anchor,a.target_url],[a.anchor_2,a.target_url_2]].filter(([t,u])=>t||u);return <div key={a.id} className="sv2-tr" style={cols}>
  <span className="sv2-n">{n}</span>
  <div className="sv2-title"><a href={'/admin-article/'+a.id} onClick={open(a)} title="פתיחת הכתבה המלאה בעורך">{a.title||a.topic||'כתבה ללא כותרת'}</a><small>הזמנה <bdi>{orderNo(a.number)}</bdi></small></div>
  <span><small className="sv2-ml">אתר</small>{a.website_name||linkText(a.website_url)}</span>
  <span className="sv2-num"><small className="sv2-ml">נשלחה</small>{d2(a.supplier_sent_at)}</span>
  <div className="sv2-anchor"><small className="sv2-ml">ביטוי וקישור</small>{pairs.length?pairs.map(([t,u],i)=><span key={i}><b>{t||'ללא ביטוי'}</b>{contentUrl(u)?<a className="sv2-lk" href={contentUrl(u)} target="_blank" rel="noreferrer"><bdi>{linkText(u)}</bdi></a>:<small>ללא קישור</small>}</span>):<span className="sv2-muted">—</span>}</div>
  <div><small className="sv2-ml">הכתבה שפורסמה</small>{a.stage==='published'?(contentUrl(a.published_url)?<a className="sv2-lk" href={contentUrl(a.published_url)} target="_blank" rel="noreferrer"><bdi>{linkText(a.published_url)}</bdi></a>:<span className="sv2-muted">לא נשמר קישור</span>):a.stage==='delivery_failed'?<span className="sv2-state off"><i/>טרם נשלחה לספק</span>:<span className="sv2-state off"><i/>נשלחה · טרם פורסמה</span>}</div>
  <span className="sv2-num"><small className="sv2-ml">פורסמה</small>{a.stage==='published'?d2(a.published_at):'—'}</span>
 </div>;};
 if(state.error&&!state.data)return <section className="sv2-card"><div className="sv2-empty"><h3>הכתבות לא נטענו</h3><p>{state.error}</p></div></section>;
 if(!state.data)return <section className="sv2-card"><p className="sv2-loading" role="status">טוען כתבות…</p></section>;
 const shownPublished=published.slice(0,more);
 return <section className="sv2-card">
  <div className="sv2-tools"><div className="sv2-seg" role="tablist" aria-label="סינון לפי אתר"><button type="button" role="tab" aria-selected={site==='all'} className={site==='all'?'on':''} onClick={()=>setSite('all')}>כל האתרים<b>{all.length}</b></button>{sites.map(([id,name])=><button key={id} type="button" role="tab" aria-selected={site===id} className={site===id?'on':''} onClick={()=>setSite(id)}>{name}<b>{all.filter(a=>a.website_id===id).length}</b></button>)}</div><label className="sv2-search"><Search size={17} aria-hidden="true"/><input value={q} placeholder="חיפוש כתבה" aria-label="חיפוש כתבה" onChange={e=>setQ(e.target.value)}/></label></div>
  {!rows.length?<div className="sv2-empty"><h3>אין כתבות{site!=='all'||term?' לסינון הזה':' שנשלחו לספק'}</h3><p>כתבות יופיעו כאן מרגע שהן נשלחות לספק לפרסום.</p></div>:<>
   <div className="sv2-th" style={cols} aria-hidden="true"><span>#</span><span>כתבה</span><span>אתר</span><span>נשלחה</span><span>ביטוי וקישור</span><span>הכתבה שפורסמה</span><span>פורסמה</span></div>
   {waiting.length>0&&<><div className="sv2-grp n0"><span className="n">{waiting.length}</span>נשלחו לספק, טרם פורסמו</div>{waiting.map((a,i)=>row(a,i+1))}</>}
   {published.length>0&&<><div className="sv2-grp p"><span className="n">{published.length}</span>פורסמו</div>{shownPublished.map((a,i)=>row(a,i+1))}</>}
   <div className="sv2-foot"><span>כתבות שעוד אצל הלקוח לא מוצגות כאן · לחיצה על שם כתבה פותחת אותה בעורך</span>{published.length>more?<button type="button" className="sv2-lk" onClick={()=>setMore(more+30)}>הצגת עוד {Math.min(30,published.length-more)}</button>:<span>{rows.length} כתבות</span>}</div>
  </>}
 </section>;
}

/* ---------- Details ---------- */
function DetailsTab({ctx,supplier:s,guard,kit,go}:{ctx:Ctx;supplier:Row;guard:Guard;kit:SupplierKit;go:(p:string,b?:()=>void)=>void}){
 const req=useData('admin/seller-requests',ctx.revision,!!s.account_user_id),requests:Row[]=(req.data?.requests||[]).filter((r:Row)=>r.user_id===s.account_user_id).sort((a:Row,b:Row)=>b.created.localeCompare(a.created));
 return <div className="sv2-layout">
  <section className="sv2-card sv2-pad"><h3>פרטי הספק</h3><kit.SupplierProfileForm key={s.id+':'+s.updated} ctx={ctx} supplier={s} onDirty={dirty=>guard.mark('supplier-profile',dirty)} saved={()=>guard.mark('supplier-profile',false)}/></section>
  <aside className="sv2-side">
   <section className="sv2-card sv2-pad"><h3>איך הספק עובד איתנו</h3><dl className="sv2-facts"><div><dt>סוג</dt><dd>{supplierKinds[s.kind]||'ספק ידני'}</dd></div><div><dt>קבלת כתבות</dt><dd>מייל עם קובץ, תמונות וקרדיט</dd></div><div><dt>חשבוניות</dt><dd>{s.account_user_id?'מעלה מתוך החשבון':'קישור במייל בסוף החודש'}</dd></div></dl></section>
   {s.workflow&&<section className="sv2-card sv2-pad"><h3>אופן ההתנהלות</h3><p className="sv2-text">{s.workflow}</p></section>}
   {s.notes&&<section className="sv2-card sv2-pad"><h3>הסכם והערות פנימיות</h3><p className="sv2-text">{s.notes}</p></section>}
   <kit.SupplierPayout supplier={s}/>
   {s.account_user_id&&<section className="sv2-card sv2-pad" id="requests"><h3>בקשות הספק</h3>{req.loading&&!req.data?<p className="sv2-loading">טוען…</p>:!requests.length?<p className="sv2-muted">אין בקשות מהספק.</p>:<div className="sv2-stack">{requests.slice(0,8).map(r=><button key={r.id} type="button" className={'sv2-btn '+(r.status==='pending'?'primary':'quiet')} onClick={()=>go('admin-seller-request/'+r.id)}><Bell size={15} aria-hidden="true"/>{supplierRequestKinds[r.kind]}<span className="grow">{supplierRequestStates[r.status]} · {contentTime(r.created)}</span></button>)}</div>}</section>}
  </aside>
 </div>;
}

/* ---------- Billing: monthly orders and stock packages ---------- */
function BillingTab({ctx,supplier:s,state}:{ctx:Ctx;supplier:Row;state:Row}){
 const b:Row|undefined=state.data;
 if(state.error&&!b)return <section className="sv2-card"><div className="sv2-empty"><h3>ההתחשבנות לא נטענה</h3><p>{state.error}</p></div></section>;
 if(!b)return <section className="sv2-card"><p className="sv2-loading" role="status">טוען התחשבנות…</p></section>;
 const openOrder=(key:string)=>ctx.go('admin-supplier-order/'+encodeURIComponent(key));
 const openPack=(p:Row)=>ctx.go('admin-supplier-package/'+encodeURIComponent(p.site_id+'~'+p.number));
 const monthly=s.billing!=='stock',stock=b.stock.packages.length>0;
 const cols={gridTemplateColumns:'minmax(170px,1.3fr) 130px 140px 200px minmax(150px,1fr) 170px'},pcols={gridTemplateColumns:'minmax(200px,1.4fr) 150px 140px 150px 190px 160px'};
 return <>
  {monthly&&<>
   <div className="sv2-sum">
    <div className="sv2-card sv2-pad"><span className="lbl">לתשלום עכשיו</span><b className="big">{money(b.summary.due.amount)}</b><span className="hint">{b.summary.due.orders?(b.summary.due.first?monthName(b.summary.due.first.month).split(' ')[0]+' · ':'')+(b.summary.due.orders>1?b.summary.due.orders+' הזמנות':'חשבונית התקבלה'):'אין תשלום פתוח'}</span></div>
    <div className="sv2-card sv2-pad"><span className="lbl">הזמנה פתוחה</span><b className="big">{b.summary.open?b.summary.open.count+' פרסומים':'—'}</b><span className="hint">{b.summary.open?monthName(b.summary.open.month).split(' ')[0]+' · נסגרת ב־'+dm(b.summary.open.closes):'אין פרסומים החודש'}</span></div>
    <div className="sv2-card sv2-pad"><span className="lbl">שולם השנה</span><b className="big" style={{color:'var(--sv-green)'}}>{money(b.summary.paid.amount)}</b><span className="hint">{b.summary.paid.count} הזמנות</span></div>
   </div>
   <section className="sv2-card">
    {!b.orders.length?<div className="sv2-empty"><h3>עדיין אין הזמנות</h3><p>כל חודש שבו מתפרסמות כתבות אצל הספק יהפוך להזמנה.</p></div>:<>
     <div className="sv2-th" style={cols} aria-hidden="true"><span>חודש ההזמנה</span><span>פרסומים</span><span>סכום</span><span>סטטוס</span><span>חשבונית</span><span/></div>
     {b.orders.map((o:Row)=>{const [cls,label]=orderPill[o.status];return <div key={o.key} className={'sv2-tr'+(o.status==='invoice'?' is-wait':'')} style={cols}>
      <div><b className="sv2-strong">{monthName(o.month)}</b><small className="sv2-sub">הזמנה {o.code}</small></div>
      <span><small className="sv2-ml">פרסומים</small><b className="sv2-num lg">{o.count}</b> <small className="sv2-muted">פרסומים</small></span>
      <span className="sv2-num"><small className="sv2-ml">סכום</small>{o.total==null?<em className="sv2-warn">חסרה עלות</em>:money(o.total)}</span>
      <span><span className={'sv2-pill '+cls}><i/>{label}{o.status==='paid'&&o.paid_on?' · '+dm(o.paid_on):''}</span></span>
      <span><small className="sv2-ml">חשבונית</small>{o.invoice?<a className="sv2-lk" href={o.invoice.url} target="_blank" rel="noreferrer"><FileText size={14} aria-hidden="true"/> <bdi>{o.invoice.number}</bdi></a>:o.status==='open'?<span className="sv2-muted">תתבקש ב־{dm(o.request_on)}</span>:<span className="sv2-muted">טרם התקבלה</span>}</span>
      <span><button type="button" className={'sv2-btn sm '+(o.status==='paid'?'tint':'primary')} onClick={()=>openOrder(o.key)}>פתיחת ההזמנה<ChevronLeft size={15} aria-hidden="true"/></button></span>
     </div>;})}
     <div className="sv2-foot"><span>כל חודש שבו פורסמו כתבות אצל הספק הוא הזמנה אחת · סכומים לפני מע״מ</span><span>{b.orders.length} הזמנות</span></div>
    </>}
   </section>
  </>}
  {!monthly&&<>
   <div className="sv2-card sv2-pad sv2-stockbar"><div><span className="lbl">מלאי פעיל בכל האתרים</span><div className="row">{b.stock.total?<Stock used={b.stock.used} total={b.stock.total}/>:<b className="big">אין מלאי</b>}<span>נותרו <b>{b.stock.left}</b> פרסומים · כל אתר עם חבילות משלו</span></div></div><button type="button" className="sv2-btn primary lg" onClick={()=>openAddStockFor(ctx,s)}><Box size={17} aria-hidden="true"/>הוספת מלאי (הזמנה חדשה)</button></div>
   <section className="sv2-card">
    {!stock?<div className="sv2-empty"><h3>עדיין אין חבילות מלאי</h3><p>כשמוסיפים מלאי לאתר, החבילה נרשמת כאן כהזמנה.</p></div>:<>
     <div className="sv2-th" style={pcols} aria-hidden="true"><span>הזמנה</span><span>שומשו מתוך</span><span>נוספה למערכת</span><span>עלות החבילה</span><span>סטטוס</span><span/></div>
     {b.stock.packages.map((p:Row)=><div key={p.site_id+':'+p.number} className="sv2-tr" style={pcols}>
      <div><b className="sv2-strong">{p.site_name} · חבילה {p.number} · {p.quantity} פרסומים</b><small className="sv2-sub">{p.opening?'מלאי שהוגדר לפני רישום חבילות':'הזמנה '+p.code}</small></div>
      <span><small className="sv2-ml">שומשו מתוך</small><Stock used={p.used} total={p.quantity} tone={p.status==='low'?'low':undefined}/></span>
      <span className="sv2-num"><small className="sv2-ml">נוספה</small>{p.created?d2(p.created):'—'}</span>
      <span><small className="sv2-ml">עלות</small>{p.total_cents==null?<span className="sv2-muted">לא נרשמה</span>:<><b className="sv2-num">{money(p.total_cents)}</b><small className="sv2-sub">{money(p.unit_cents)} ליחידה</small></>}</span>
      <span>{packPill(p)}</span>
      <span><button type="button" className={'sv2-btn sm '+(p.status==='done'?'tint':'primary')} onClick={()=>openPack(p)}>פתיחת ההזמנה<ChevronLeft size={15} aria-hidden="true"/></button></span>
     </div>)}
     <div className="sv2-foot"><span>לכל אתר חבילות משלו, וחבילה חדשה מתחילה רק כשהקודמת באותו אתר נגמרת · אפשר רק להוסיף מלאי</span><span>{b.stock.packages.length} הזמנות</span></div>
    </>}
   </section>
  </>}
 </>;
}

// Add stock from the supplier level: pick the site first when there are several.
export function openAddStockFor(ctx:Ctx,s:Row){ctx.open({kind:'admin-finance',title:'הוספת מלאי',description:'בחירת האתר שאליו נוספת החבילה · '+s.name,render:(close:()=>void)=><PickSite ctx={ctx} supplier={s} close={close}/>});}
function PickSite({ctx,supplier:s,close}:{ctx:Ctx;supplier:Row;close:()=>void}){
 const state=useData('admin/suppliers/'+encodeURIComponent(s.id)+'?'+new URLSearchParams({page:'1',q:'',all:'0',selected:''}),ctx.revision),sites:Row[]=state.data?.sites||[];
 return <div className="om-pay-form"><div className="sv2-pick">{!state.data?<p className="sv2-loading">טוען אתרים…</p>:!sites.length?<p className="sv2-muted">לספק אין אתרים. צרפו אתר קודם.</p>:sites.map(w=><button key={w.id} type="button" onClick={()=>{close();setTimeout(()=>openAddStock(ctx,{...w,total:w.stock_total,used:w.stock_sent},ctx.refresh),50);}}><SiteBadge site={w}/><span><b>{w.name}</b><small>{w.stock_total==null?'התחשבנות חודשית · יעבור לחבילה':'נותרו '+w.stock_remaining+' מתוך '+w.stock_total}</small></span><ChevronLeft size={16} aria-hidden="true"/></button>)}</div><div className="om-pay-actions"><span className="om-foot-status">בחרו אתר</span><button type="button" className="om-btn" onClick={close}>ביטול</button></div></div>;
}

/* ---------- One monthly order ---------- */
export function SupplierOrderPage({ctx,orderKey,kit}:{ctx:Ctx;orderKey:string;kit:SupplierKit}){
 const state=useData('admin/supplier-order?'+new URLSearchParams({key:orderKey}),ctx.revision),d:Row|undefined=state.data,[all,setAll]=useState(false),[busy,setBusy]=useState('');
 if(state.error&&!d)return <div className="sv2"><div className="sv2-empty"><h3>ההזמנה לא נמצאה</h3><p>{state.error}</p><button type="button" className="sv2-btn quiet" onClick={()=>ctx.go('admin-suppliers')}>חזרה לכל הספקים</button></div></div>;
 if(!d)return <div className="sv2"><p className="sv2-loading" role="status">טוען הזמנה…</p></div>;
 const s=d.supplier,o=d.order,row=d.row,statement=o.source==='statement',[cls,label]=orderPill[o.status];
 const send=async()=>{setBusy('send');try{await ctx.run(()=>api('admin/supplier-order/send','POST',{key:o.key}),'פירוט ההזמנה נשלח לספק');}catch{}finally{setBusy('');}};
 const vat=o.vat==null?null:Number(o.vat),gross=o.total==null?null:Number(o.total),net=o.net==null?null:Number(o.net);
 const primary=o.status==='open'?<p className="sv2-note b">ההזמנה תיסגר ב־{d2(o.request_on)}, ואז תישלח לספק בקשת חשבונית.</p>:statement&&row.status==='invoice_review'?<button type="button" className="sv2-btn primary lg wide" onClick={()=>ctx.go('admin-supplier-invoice/'+row.statement_id)}><FileText size={17} aria-hidden="true"/>בדיקת החשבונית</button>:kit.canPay(row)&&o.status!=='paid'?<button type="button" className="sv2-btn primary lg wide" onClick={()=>kit.openPayment(ctx,row)}><CreditCard size={17} aria-hidden="true"/>דיווח תשלום לספק</button>:o.status==='paid'?<p className="sv2-note g"><Check size={15} aria-hidden="true"/> שולם ב־{d2(o.paid_on)}</p>:o.status==='awaiting'?<button type="button" className="sv2-btn primary lg wide" disabled={!!busy||statement} onClick={send}><Send size={17} aria-hidden="true"/>{statement?'ממתינה לחשבונית מהחשבון של הספק':'שליחת בקשת חשבונית'}</button>:null;
 const list=all?o.articles:o.articles.slice(0,8),cols={gridTemplateColumns:'26px minmax(150px,2fr) 90px 60px minmax(110px,1.2fr) 96px'};
 return <div className="sv2 sv2-print" dir="rtl">
  <nav className="sv2-crumb" aria-label="מיקום"><a href={'/admin-supplier/'+s.id} onClick={e=>{if(!plain(e))return;e.preventDefault();ctx.go('admin-supplier/'+s.id);}}>{s.name}</a><ChevronLeft size={14} aria-hidden="true"/><a href={'/admin-supplier-billing/'+s.id} onClick={e=>{if(!plain(e))return;e.preventDefault();ctx.go('admin-supplier-billing/'+s.id);}}>התחשבנות</a><ChevronLeft size={14} aria-hidden="true"/><span>{monthName(o.month)}</span></nav>
  <header className="sv2-card sv2-ordhead"><div><span className={'sv2-pill '+cls}><i/>{label}{o.status==='invoice'&&!statement?' · ממתינה לתשלום':o.status==='invoice'&&row.status==='approved'?' · מאושרת לתשלום':''}</span><h2>הזמנה {o.code} · {monthName(o.month)}</h2><div className="sub">{s.name} · {o.count} פרסומים ב־{o.sites} אתרים{o.status!=='open'?' · נסגרה ב־'+d2(o.request_on):''}</div>
   <ol className="sv2-steps">{o.steps.map((st:Row,i:number)=>{const now=!st.done&&(i===0||o.steps[i-1].done);return <li key={st.key} className={st.done?'done':now?'now':''}>{i>0&&<span className={'bar'+(st.done?' done':'')} aria-hidden="true"/>}<span className="dot" aria-hidden="true">{st.done?<Check size={14}/>:i+1}</span>{st.label}</li>;})}</ol></div>
   <div className="sv2-total"><span>{vat!=null?'סה״כ לתשלום כולל מע״מ':'סה״כ לפני מע״מ'}</span><b>{gross==null?'חסרה עלות':money(vat!=null&&!statement?(net||0)+vat:gross)}</b><div className="row"><span>{o.count} פרסומים לפני מע״מ</span><span className="sv2-num">{net==null?'—':money(net)}</span></div>{vat!=null&&<div className="row"><span>מע״מ לפי החשבונית</span><span className="sv2-num">{money(vat)}</span></div>}{primary}</div>
  </header>
  <div className="sv2-layout">
   <section className="sv2-card">
    <div className="sv2-tools"><b className="sv2-h">הכתבות שפורסמו בהזמנה</b><span className="sv2-muted" style={{marginInlineStart:'auto'}}>מהחדשה לישנה</span></div>
    {!o.articles.length?<div className="sv2-empty"><h3>אין כתבות בהזמנה</h3></div>:<>
     <div className="sv2-th" style={cols} aria-hidden="true"><span>#</span><span>כתבה</span><span>אתר</span><span>פורסמה</span><span>קישור</span><span>עלות</span></div>
     {list.map((a:Row,i:number)=><div key={a.id} className="sv2-tr compact" style={cols}><span className="sv2-n">{i+1}</span><div className="sv2-title"><a href={'/admin-article/'+a.id} onClick={e=>{if(!plain(e))return;e.preventDefault();saveAdminViewState('content-parent','admin-articles');ctx.go('admin-article/'+a.id);}}>{a.title||'כתבה'}</a>{a.order_number&&<small>הזמנת לקוח <bdi>{orderNo(a.order_number)}</bdi></small>}</div><span><small className="sv2-ml">אתר</small>{a.site_name||linkText(a.website_url)}</span><span className="sv2-num"><small className="sv2-ml">פורסמה</small>{dm(a.date)}</span><span>{contentUrl(a.url)?<a className="sv2-lk" href={contentUrl(a.url)} target="_blank" rel="noreferrer"><bdi>{linkText(a.url)}</bdi></a>:<span className="sv2-muted">—</span>}</span><span className="sv2-num"><small className="sv2-ml">עלות</small>{a.cost_cents==null?<em className="sv2-warn">חסרה</em>:money(a.cost_cents)}</span></div>)}
     <div className="sv2-foot"><span>{o.articles.length>8&&!all?'ועוד '+(o.articles.length-8)+' כתבות':o.articles.length+' כתבות'}</span>{o.articles.length>8&&<button type="button" className="sv2-lk" onClick={()=>setAll(!all)}>{all?'הצגת פחות':'הצגת הכול'}</button>}</div>
    </>}
   </section>
   <aside className="sv2-side">
    <section className="sv2-card sv2-pad"><h3>החשבונית</h3>{o.invoice?<div className="sv2-doc"><span className="pdf">PDF</span><span><b><bdi>{o.invoice.number}</bdi></b><small>{statement?'הועלתה מהחשבון':'התקבלה במייל'} · {d2(o.invoice.at)}</small></span></div>:<p className="sv2-muted">{o.status==='open'?'תתבקש אחרי סגירת החודש.':'טרם התקבלה חשבונית.'}</p>}
     <div className="sv2-stack" style={{marginTop:10}}>{o.invoice&&<a className="sv2-btn tint" href={o.invoice.url} target="_blank" rel="noreferrer"><ExternalLink size={16} aria-hidden="true"/>צפייה בחשבונית</a>}{statement&&row.statement_id&&o.invoice&&<button type="button" className="sv2-btn quiet" onClick={()=>ctx.go('admin-supplier-invoice/'+row.statement_id)}><FileText size={16} aria-hidden="true"/>{row.status==='invoice_review'?'בדיקת החשבונית':'אישור והחזרה לתיקון'}</button>}{!statement&&o.status!=='open'&&o.status!=='paid'&&<button type="button" className="sv2-btn quiet" disabled={!!busy} onClick={send}><Send size={16} aria-hidden="true"/>{o.invoice?'בקשת חשבונית מתוקנת':'שליחה חוזרת של בקשת חשבונית'}</button>}</div></section>
    <section className="sv2-card sv2-pad"><h3>טיפול מול הספק</h3><div className="sv2-stack">
     <button type="button" className="sv2-btn quiet" disabled={!!busy||o.status==='open'} title={o.status==='open'?'אפשר לשלוח אחרי סגירת החודש':undefined} onClick={send}><Mail size={16} aria-hidden="true"/>שליחת פירוט ההזמנה לספק</button>
     <button type="button" className="sv2-btn quiet" onClick={()=>{setAll(true);setTimeout(()=>window.print(),80);}}><Download size={16} aria-hidden="true"/>הורדת פירוט PDF</button>
     <button type="button" className="sv2-btn quiet" onClick={()=>ctx.go('admin-supplier-articles/'+s.id)}><FileText size={16} aria-hidden="true"/>כל הכתבות של הספק</button>
     <button type="button" className="sv2-btn quiet" onClick={()=>{saveAdminViewState('supplier-editor:'+s.id,{site:'',tab:'details',all:false});ctx.go('admin-supplier/'+s.id);}}><UserRound size={16} aria-hidden="true"/>פרטי הספק ואופן התנהלות</button>
    </div></section>
    <section className="sv2-card sv2-pad"><h3>היסטוריה</h3>{!o.history.length?<p className="sv2-muted">ההזמנה עדיין פתוחה.</p>:<dl className="sv2-facts">{o.history.map((h:Row,i:number)=><div key={i}><dt>{dm(h.at)} · {h.title}</dt><dd>{h.by}</dd></div>)}</dl>}</section>
   </aside>
  </div>
 </div>;
}

/* ---------- One stock package ---------- */
export function SupplierPackagePage({ctx,site,number}:{ctx:Ctx;site:string;number:number}){
 const state=useData('admin/supplier-package/'+encodeURIComponent(site)+'/'+number,ctx.revision),d:Row|undefined=state.data,[all,setAll]=useState(false),[busy,setBusy]=useState('');
 if(state.error&&!d)return <div className="sv2"><div className="sv2-empty"><h3>החבילה לא נמצאה</h3><p>{state.error}</p></div></div>;
 if(!d)return <div className="sv2"><p className="sv2-loading" role="status">טוען חבילה…</p></div>;
 const w=d.site,p=d.package,waiting=p.slots.filter((x:Row)=>x.status==='sent'),title=w.name+' · חבילה '+p.number+' · '+p.quantity+' פרסומים';
 const remind=async()=>{setBusy('remind');try{await ctx.run(async()=>{for(const x of waiting)await api('articles/'+x.article_id+'/remind','POST',{});},waiting.length===1?'נשלחה תזכורת לספק':'נשלחו '+waiting.length+' תזכורות לספק');}catch{}finally{setBusy('');}};
 const sendStatus=async()=>{setBusy('send');try{await ctx.run(()=>api('admin/supplier-package/'+encodeURIComponent(site)+'/'+number+'/send','POST',{}),'מצב החבילה נשלח לספק');}catch{}finally{setBusy('');}};
 const editPay=()=>ctx.open({kind:'admin-finance',title:'פרטי התשלום על החבילה',description:title,render:(close:()=>void)=><PackagePayment ctx={ctx} site={site} number={number} pack={p} close={close}/>});
 const cells=Math.min(p.quantity,100),scale=p.quantity/cells,published=p.published,atSupplier=p.used-p.published;
 const list=all?p.slots:p.slots.slice(0,8),cols={gridTemplateColumns:'56px minmax(150px,2fr) 80px 60px minmax(100px,1fr) 104px'};
 return <div className="sv2 sv2-print" dir="rtl">
  <nav className="sv2-crumb" aria-label="מיקום">{w.supplier_id&&<><a href={'/admin-supplier/'+w.supplier_id} onClick={e=>{if(!plain(e))return;e.preventDefault();ctx.go('admin-supplier/'+w.supplier_id);}}>{w.supplier_name}</a><ChevronLeft size={14} aria-hidden="true"/><a href={'/admin-supplier-billing/'+w.supplier_id} onClick={e=>{if(!plain(e))return;e.preventDefault();ctx.go('admin-supplier-billing/'+w.supplier_id);}}>התחשבנות</a><ChevronLeft size={14} aria-hidden="true"/></>}<span>{w.name} · חבילה {p.number}</span></nav>
  <header className="sv2-card sv2-ordhead"><div>{packPill({...p,paid:!!p.paid_on})}<h2>{title}</h2><div className="sub">{w.supplier_name}{p.prev_number?' · התחילה אחרי שחבילה '+p.prev_number+' נגמרה':''}{p.created?' · נוספה למערכת ב־'+d2(p.created):''}{p.actor?' על ידי '+p.actor:''}</div>
   <div className="sv2-meter" style={{gridTemplateColumns:`repeat(${cells},1fr)`}} aria-label={'פורסמו '+published+', אצל הספק '+atSupplier+', פנויים '+p.left}>{Array.from({length:cells},(_,i)=>{const n=(i+1)*scale;return <i key={i} className={n<=published?'u':n<=p.used?'w':''}/>;})}</div>
   <div className="sv2-legend"><span><i style={{background:'var(--sv-blue)'}}/>פורסמו · {published}</span><span><i style={{background:'#9cc7f7'}}/>נשלחו, טרם פורסמו · {atSupplier}</span><span><i style={{background:'#e3e8f0'}}/>פנויים · {p.left}</span></div></div>
   <div className="sv2-total"><span>שומשו מתוך החבילה</span><div className="sv2-big"><span>{p.used}</span><i>/</i><b>{p.quantity}</b></div>{!p.opening&&<><div className="row"><span>עלות החבילה לפני מע״מ</span><span className="sv2-num">{p.total_cents==null?'—':money(p.total_cents)}</span></div><div className="row"><span>מחיר ליחידה</span><span className="sv2-num">{p.unit_cents==null?'—':money(p.unit_cents)}</span></div></>}<button type="button" className="sv2-btn primary lg wide" onClick={()=>openAddStock(ctx,{...w,total:d.stock.total,used:d.stock.used},ctx.refresh)}><Box size={17} aria-hidden="true"/>הוספת מלאי</button></div>
  </header>
  <div className="sv2-layout">
   <section className="sv2-card">
    <div className="sv2-tools"><b className="sv2-h">הכתבות שתפסו מקום בחבילה</b><span className="sv2-muted" style={{marginInlineStart:'auto'}}>טרם פורסמו למעלה</span></div>
    {!p.slots.length?<div className="sv2-empty"><h3>עדיין לא נשלחו כתבות מהחבילה</h3><p>כל כתבה שתישלח לספק תתפוס מקום כאן.</p></div>:<>
     <div className="sv2-th" style={cols} aria-hidden="true"><span>מקום</span><span>כתבה</span><span>אתר</span><span>נשלחה</span><span>קישור</span><span>מצב</span></div>
     {list.map((x:Row)=><div key={x.article_id} className="sv2-tr compact" style={cols}><span className="sv2-slot"><bdi>{x.position}/{p.quantity}</bdi></span><div className="sv2-title"><a href={'/admin-article/'+x.article_id} onClick={e=>{if(!plain(e))return;e.preventDefault();saveAdminViewState('content-parent','admin-articles');ctx.go('admin-article/'+x.article_id);}}>{x.title||'כתבה'}</a>{x.order_number&&<small>הזמנת לקוח <bdi>{orderNo(x.order_number)}</bdi></small>}</div><span><small className="sv2-ml">אתר</small>{w.name}</span><span className="sv2-num"><small className="sv2-ml">נשלחה</small>{dm(x.created)}</span><span>{x.status==='published'&&contentUrl(x.published_url)?<a className="sv2-lk" href={contentUrl(x.published_url)} target="_blank" rel="noreferrer"><bdi>{linkText(x.published_url)}</bdi></a>:<span className="sv2-muted">—</span>}</span><span>{x.status==='published'?<span className="sv2-pill p-paid"><i/>פורסמה</span>:x.status==='cancelled'?<span className="sv2-pill p-man"><i/>בוטלה</span>:<span className="sv2-pill p-man"><i/>נשלחה · טרם פורסמה</span>}</span></div>)}
     <div className="sv2-foot"><span>{p.releases.length?p.releases.map((r:Row)=>'מקום '+r.position).join(', ')+' הוחזר לחבילה אחרי ביטול לפני פרסום':'כתבה שמבוטלת לפני פרסום מחזירה את המקום לחבילה'}</span>{p.slots.length>8&&<button type="button" className="sv2-lk" onClick={()=>setAll(!all)}>{all?'הצגת פחות':'הצגת כל '+p.slots.length}</button>}</div>
    </>}
   </section>
   <aside className="sv2-side">
    <section className="sv2-card sv2-pad"><h3>התשלום על החבילה</h3>{p.opening?<p className="sv2-muted">המלאי הזה הוגדר לפני שנרשמו חבילות, ולכן אין לו פרטי תשלום.</p>:<><dl className="sv2-facts"><div><dt>מתי שולם</dt><dd>{p.paid_on?d2(p.paid_on):'לא נרשם'}</dd></div><div><dt>איך שולם</dt><dd>{supplierPaymentMethods[p.method]||'לא נרשם'}</dd></div><div><dt>סכום</dt><dd>{p.total_cents==null?'—':money(p.total_cents)+' + מע״מ'}</dd></div>{p.note&&<div><dt>הערה</dt><dd>{p.note}</dd></div>}</dl><p className="sv2-note b">את הפרטים האלה מזינים בחלון "הוספת מלאי".</p></>}</section>
    <section className="sv2-card sv2-pad"><h3>בדיקות מול הספק</h3><div className="sv2-stack">
     <button type="button" className="sv2-btn quiet" disabled={!!busy||!waiting.length} onClick={remind}><Bell size={16} aria-hidden="true"/>{waiting.length?'תזכורת לספק על '+(waiting.length===1?'כתבה שטרם פורסמה':waiting.length+' כתבות שטרם פורסמו'):'כל הכתבות פורסמו'}</button>
     <button type="button" className="sv2-btn quiet" disabled={!!busy} onClick={sendStatus}><Mail size={16} aria-hidden="true"/>שליחת מצב החבילה לספק</button>
     <button type="button" className="sv2-btn quiet" onClick={()=>{setAll(true);setTimeout(()=>window.print(),80);}}><Download size={16} aria-hidden="true"/>הורדת פירוט החבילה</button>
     {w.supplier_id&&<button type="button" className="sv2-btn quiet" onClick={()=>ctx.go('admin-supplier-articles/'+w.supplier_id)}><FileText size={16} aria-hidden="true"/>כל הכתבות של הספק</button>}
     {!p.opening&&<button type="button" className="sv2-btn quiet" onClick={editPay}><Pencil size={16} aria-hidden="true"/>עריכת פרטי התשלום</button>}
    </div></section>
   </aside>
  </div>
 </div>;
}
function PackagePayment({ctx,site,number,pack:p,close}:{ctx:Ctx;site:string;number:number;pack:Row;close:()=>void}){
 const[f,setF]=useState({paid_on:p.paid_on||'',method:p.method||'bank_transfer',note:p.note||'',total_ils:p.total_cents==null?'':String(p.total_cents/100),unit_ils:''}),[busy,setBusy]=useState(false),[error,setError]=useState(''),lock=useRef(false);
 const set=(k:string,v:string)=>setF(o=>({...o,[k]:v}));
 return <form noValidate className="om-pay-form" onSubmit={async e=>{e.preventDefault();if(lock.current)return;lock.current=true;setBusy(true);setError('');try{await ctx.run(()=>api('admin/supplier-package/'+encodeURIComponent(site)+'/'+number+'/payment','POST',f),'פרטי התשלום נשמרו');close();}catch(err){setError((err as Error).message);}finally{lock.current=false;setBusy(false);}}}>
  <fieldset disabled={busy} className="om-steps">
   <section className="om-step"><span className="om-step-node" aria-hidden="true">1</span><h4>מתי ואיך שולם</h4><div className="om-pay-grid"><label>תאריך תשלום<Input type="date" value={f.paid_on} onChange={e=>set('paid_on',e.target.value)}/></label><label>אופן התשלום<select value={f.method} onChange={e=>set('method',e.target.value)}>{Object.entries(supplierPaymentMethods).map(([k,l])=><option key={k} value={k}>{l}</option>)}</select></label></div></section>
   <section className="om-step"><span className="om-step-node" aria-hidden="true">2</span><h4>סכום</h4><div className="om-pay-grid"><label>עלות החבילה (לפני מע״מ)<Input inputMode="decimal" value={f.total_ils} onChange={e=>set('total_ils',e.target.value.replace(/[^\d.]/g,''))}/></label><label>או מחיר ליחידה<Input inputMode="decimal" value={f.unit_ils} placeholder="מחושב אוטומטית" onChange={e=>set('unit_ils',e.target.value.replace(/[^\d.]/g,''))}/></label></div><label>הערה<Textarea className="resize-none" rows={2} value={f.note} maxLength={1000} onChange={e=>set('note',e.target.value)}/></label></section>
  </fieldset>
  {error&&<p role="alert" className="supplier-error">{error}</p>}
  <div className="om-pay-actions"><span className="om-foot-status is-ready">מוכן לשמירה</span><button type="submit" className="om-btn is-primary" disabled={busy}>{busy?'שומר…':'שמירת פרטי התשלום'}</button><button type="button" className="om-btn" disabled={busy} onClick={close}>ביטול</button></div>
 </form>;
}

/* ---------- Shared head for every page of the suppliers area ---------- */
export const supplierAreaPages:[string,string][]=[['admin-supplier-overview','סקירה'],['admin-suppliers','כל הספקים'],['admin-seller-requests','בקשות וחשבוניות'],['admin-supplier-finance','התחשבנות כללית']];
export function SupplierAreaHead({current,title,sub,action,go}:{current:string;title:string;sub:string;action?:React.ReactNode;go:(page:string)=>void}){
 return <>
  <nav className="sv2-areas" aria-label="אזור הספקים">{supplierAreaPages.map(([page,label])=>{const Icon=areaIcons[page];const inner=<>{Icon&&<Icon size={18} aria-hidden="true"/>}<span className="lbl">{label}</span></>;return page===current?<span key={page} aria-current="page">{inner}</span>:<a key={page} href={'/'+page} onClick={e=>{if(!plain(e))return;e.preventDefault();go(page);}}>{inner}</a>;})}</nav>
  <div className="sv2-ph"><div><h2>{title}</h2><p>{sub}</p></div>{action}</div>
 </>;
}
export function SupplierFrame({ctx,crumbs,children}:{ctx:Ctx;crumbs:[string,string?][];children:React.ReactNode}){
 return <div className="sv2 sv2-legacy" dir="rtl"><nav className="sv2-crumb" aria-label="מיקום">{crumbs.map(([label,page],i)=><React.Fragment key={i}>{i>0&&<ChevronLeft size={14} aria-hidden="true"/>}{page?<a href={'/'+page} onClick={e=>{if(!plain(e))return;e.preventDefault();ctx.go(page);}}>{label}</a>:<span>{label}</span>}</React.Fragment>)}</nav><div className="sv2-legacy-body">{children}</div></div>;
}

/* ---------- General billing: every supplier, every month ---------- */
const setDefaults={search:'',q:'',stage:'all',status:'all',kind:'all',supplier:'all',page:1,open:'',tab:'requests',month:'',history:false,pay:'unpaid'};
const setPill:Record<string,string>={paid:'p-paid',approved:'p-open',invoice_review:'p-inv',awaiting_invoice:'p-wait',rejected:'p-wait',awaiting_payment:'p-inv',open_period:'p-man',missing_cost:'p-wait',cancelled:'p-man',demo:'p-man'};
const supplierStatementLabel=(s:string)=>s==='awaiting_invoice'?'ממתינה לחשבונית':s==='open_period'?'הזמנה פתוחה':supplierStatementStates[s]||s;
export function SettlementsV2({ctx,guard,kit,invoices=false,embedded=false}:{ctx:Ctx;guard:Guard;kit:SupplierKit;invoices?:boolean;embedded?:boolean}){
 const key='suppliers:'+(invoices?'invoices':'settlements'),[v,setV]=useState(()=>({...setDefaults,...adminViewState(key,setDefaults)})),set=(patch:Partial<typeof setDefaults>)=>guard.confirm(()=>setV(o=>{const n={...o,...patch};saveAdminViewState(key,n);return n;}));
 const params=new URLSearchParams({q:v.q,month:v.month,status:'all',stage:v.stage||'all',supplier:v.supplier,history:'0',invoices:invoices?'1':'0',pay:invoices?'all':v.pay||'unpaid',page:String(v.page)}),state=useData('admin/supplier-settlements?'+params,ctx.revision),current=state.data?.request_key===params.toString(),rows:Row[]=current?state.data.rows:[],sum:Row=state.data?.summary||{},names:Row=state.data?.supplier_options||{};
 const go=(page:string)=>guard.confirm(()=>ctx.go(page));
 const cards:[string,string,Row|undefined,string][]=[['invoice','לתשלום עכשיו',sum.invoice,'התקבלה חשבונית'],['awaiting','ממתינים לחשבונית',sum.awaiting,'החודש נסגר, אין חשבונית'],['open','הזמנות פתוחות',sum.open,'החודש עדיין רץ'],['paid','שולמו',sum.paid_stage,'כל התשלומים שבוצעו']];
 const cols={gridTemplateColumns:'minmax(200px,1.6fr) 100px 130px minmax(140px,1fr) 170px 210px'};
 const body=<>
  {!invoices&&<div className="sv2-sum is-4">{cards.map(([k,label,c,hint])=><button key={k} type="button" className={'sv2-card sv2-pad sv2-sumbtn'+(v.stage===k?' on':'')} aria-pressed={v.stage===k} onClick={()=>set({stage:v.stage===k?'all':k,pay:'all',page:1})}><span className="lbl">{label}</span><b className="big">{money(Number(c?.amount||0))}</b><span className="hint">{Number(c?.count||0)} הזמנות · {hint}</span></button>)}</div>}
  <section className="sv2-card">
   <div className="sv2-tools">
    {!invoices&&<div className="sv2-seg" role="tablist" aria-label="מצב תשלום">{([['unpaid','לא שולמו'],['paid','שולמו'],['all','הכול']] as [string,string][]).map(([k,l])=><button key={k} type="button" role="tab" aria-selected={(v.pay||'unpaid')===k} className={(v.pay||'unpaid')===k?'on':''} onClick={()=>set({pay:k,page:1})}>{l}</button>)}</div>}
    <label className="sv2-search"><Search size={17} aria-hidden="true"/><input value={v.search} placeholder="חיפוש ספק, חודש או כתבה" aria-label="חיפוש ספק, חודש או כתבה" onChange={e=>{const x=e.target.value;setV(o=>{const n={...o,search:x,q:x.trim(),page:1};saveAdminViewState(key,n);return n;});}}/></label>
    {v.supplier!=='all'&&<button type="button" className="sv2-chip" onClick={()=>set({supplier:'all',page:1})}>ספק: {names[v.supplier]||'נבחר'}<X size={14} aria-hidden="true"/></button>}
    {v.stage&&v.stage!=='all'&&<button type="button" className="sv2-chip" onClick={()=>set({stage:'all',page:1})}>{cards.find(c=>c[0]===v.stage)?.[1]}<X size={14} aria-hidden="true"/></button>}
   </div>
   {state.error&&!current?<div className="sv2-empty"><h3>ההתחשבנות לא נטענה</h3><p>{state.error}</p></div>:!current?<p className="sv2-loading" role="status">טוען…</p>:!rows.length?<div className="sv2-empty"><h3>{invoices?'אין חשבוניות':'אין הזמנות בתצוגה הזו'}</h3><p>נסו לשנות את הסינון.</p></div>:<>
    <div className="sv2-th" style={cols} aria-hidden="true"><span>ספק וחודש</span><span>פרסומים</span><span>סכום</span><span>חשבונית</span><span>סטטוס</span><span/></div>
    {rows.map(r=>{const total=r.source==='statement'?(r.total??r.net):r.net,inv=r.source==='statement'?(r.invoice_file_id?{n:r.invoice_number||'חשבונית',u:'/api/selling/invoice?'+new URLSearchParams({id:r.statement_id})}:null):r.manual_invoice?{n:r.manual_invoice.number,u:'/api/admin/supplier-invoice-file?'+new URLSearchParams({key:r.id})}:null;
     const primary=r.stage==='invoice'&&kit.canPay(r)?<button type="button" className="sv2-btn primary sm" onClick={()=>kit.openPayment(ctx,r)}><CreditCard size={15} aria-hidden="true"/>דיווח תשלום</button>:null;
     return <div key={r.id} className={'sv2-tr'+(primary?' is-wait':'')} style={cols}>
      <div className="sv2-title">{r.supplier_id?<a href={'/admin-supplier/'+r.supplier_id} onClick={e=>{if(!plain(e))return;e.preventDefault();go('admin-supplier/'+r.supplier_id);}}>{r.supplier_name}</a>:<b>{r.supplier_name}</b>}<small>{monthName(r.month)}{r.account?' · ספק עם חשבון':' · ספק ידני'}</small></div>
      <span><small className="sv2-ml">פרסומים</small><b className="sv2-num lg">{r.count}</b></span>
      <span className="sv2-num"><small className="sv2-ml">סכום</small>{total==null?<em className="sv2-warn">חסרה עלות</em>:money(total)}</span>
      <span><small className="sv2-ml">חשבונית</small>{inv?<a className="sv2-lk" href={inv.u} target="_blank" rel="noreferrer"><FileText size={14} aria-hidden="true"/> <bdi>{inv.n}</bdi></a>:r.month_mail?<span className="sv2-muted">בקשה נשלחה {dm(r.month_mail.sent_at)}</span>:<span className="sv2-muted">—</span>}</span>
      <span><span className={'sv2-pill '+(orderPill[r.stage]||['p-man'])[0]}><i/>{(orderPill[r.stage]||['','—'])[1]}</span></span>
      <span className="sv2-rowact">{primary}{r.supplier_id&&<button type="button" className={'sv2-btn sm '+(primary?'quiet':'tint')} onClick={()=>go('admin-supplier-order/'+encodeURIComponent(r.id))}>{primary?'פירוט':'פתיחת ההזמנה'}{!primary&&<ChevronLeft size={15} aria-hidden="true"/>}</button>}</span>
     </div>;})}
    <div className="sv2-foot"><span>{state.data.total} הזמנות</span>{state.data.total>20&&<span className="sv2-pager"><button type="button" disabled={state.data.page<=1} onClick={()=>set({page:state.data.page-1})} aria-label="עמוד קודם">‹</button><span>עמוד {state.data.page} מתוך {Math.ceil(state.data.total/20)}</span><button type="button" disabled={state.data.page*20>=state.data.total} onClick={()=>set({page:state.data.page+1})} aria-label="עמוד הבא">›</button></span>}</div>
   </>}
  </section>
 </>;
 if(embedded)return body;
 return <div className="sv2" dir="rtl"><SupplierAreaHead current="admin-supplier-finance" title="התחשבנות כללית" sub="כל ההזמנות מכל הספקים. לחיצה על כרטיס מסננת את הרשימה." go={go}/>{body}</div>;
}

/* ---------- Requests and invoices ---------- */
const reqDefaults={search:'',q:'',status:'pending',kind:'all',tab:'requests'};
const reqPill:Record<string,string>={pending:'p-inv',approved:'p-paid',rejected:'p-wait',cancelled:'p-man'};
export function RequestsV2({ctx,guard,kit}:{ctx:Ctx;guard:Guard;kit:SupplierKit}){
 const[v,setV]=useState(()=>({...reqDefaults,...adminViewState('suppliers:requests-v2',reqDefaults)})),set=(patch:Partial<typeof reqDefaults>)=>setV(o=>{const n={...o,...patch};saveAdminViewState('suppliers:requests-v2',n);return n;});
 const state=useData('admin/seller-requests',ctx.revision),all:Row[]=state.data?.requests||[],pending=all.filter(r=>r.status==='pending').length;
 const rows=all.filter(r=>(v.status==='all'||r.status===v.status)&&(v.kind==='all'||r.kind===v.kind)&&JSON.stringify([r.id,r.user_name,r.user_email,r.proposal,r.note]).toLocaleLowerCase('he').includes(v.q.toLocaleLowerCase('he'))).sort((a,b)=>b.created.localeCompare(a.created));
 const[more,setMore]=useState(30),go=(page:string)=>guard.confirm(()=>ctx.go(page));
 const cols={gridTemplateColumns:'minmax(170px,1.2fr) minmax(200px,1.5fr) 140px 140px 170px'};
 return <div className="sv2" dir="rtl">
  <SupplierAreaHead current="admin-seller-requests" title="בקשות וחשבוניות" sub="בקשות של ספקים עם חשבון, וחשבוניות שהספקים העלו." go={go} action={<button type="button" className="sv2-btn quiet" onClick={ctx.refresh}>רענון</button>}/>
  <div className="sv2-seg sv2-bigseg" role="tablist" aria-label="בקשות או חשבוניות"><button type="button" role="tab" aria-selected={v.tab==='requests'} className={v.tab==='requests'?'on':''} onClick={()=>set({tab:'requests'})}>בקשות ספקים{pending>0&&<b className="hot">{pending}</b>}</button><button type="button" role="tab" aria-selected={v.tab==='invoices'} className={v.tab==='invoices'?'on':''} onClick={()=>set({tab:'invoices'})}>חשבוניות ספקים</button></div>
  {v.tab==='invoices'?<SettlementsV2 ctx={ctx} guard={guard} kit={kit} invoices embedded/>:<section className="sv2-card">
   <div className="sv2-tools"><div className="sv2-seg" role="tablist" aria-label="מצב בקשה">{([['pending','ממתינות',pending],['approved','אושרו'],['rejected','נדחו'],['all','הכול',all.length]] as [string,string,number?][]).map(([k,l,n])=><button key={k} type="button" role="tab" aria-selected={v.status===k} className={v.status===k?'on':''} onClick={()=>set({status:k})}>{l}{n!=null&&<b>{n}</b>}</button>)}</div><label className="sv2-search"><Search size={17} aria-hidden="true"/><input value={v.search} placeholder="חיפוש בקשה, ספק או אתר" aria-label="חיפוש בקשה, ספק או אתר" onChange={e=>set({search:e.target.value,q:e.target.value.trim()})}/></label><label className="sv2-select"><span className="sr-only">סוג בקשה</span><select value={v.kind} onChange={e=>set({kind:e.target.value})}><option value="all">כל סוגי הבקשות</option>{Object.entries(supplierRequestKinds).map(([k,l])=><option key={k} value={k}>{l}</option>)}</select></label></div>
   {state.error&&!state.data?<div className="sv2-empty"><h3>הבקשות לא נטענו</h3><p>{state.error}</p></div>:!state.data?<p className="sv2-loading" role="status">טוען בקשות…</p>:!rows.length?<div className="sv2-empty"><h3>{v.status==='pending'?'אין בקשות שממתינות לך':'אין בקשות בתצוגה הזו'}</h3><p>בקשות להוספת אתר, שינוי מחיר, השהיה או פרטי תשלום יופיעו כאן.</p></div>:<>
    <div className="sv2-th" style={cols} aria-hidden="true"><span>בקשה</span><span>ספק ואתר</span><span>תאריך</span><span>מצב</span><span/></div>
    {rows.slice(0,more).map(r=><div key={r.id} className={'sv2-tr'+(r.status==='pending'?' is-wait':'')} style={cols}>
     <div className="sv2-title"><b>{supplierRequestKinds[r.kind]||r.kind}</b><small>בקשה <bdi>#{String(r.id).slice(-8)}</bdi></small></div>
     <div className="sv2-title"><b>{r.user_name}</b><small><bdi>{linkText(r.proposal?.url)||r.user_email}</bdi></small></div>
     <span className="sv2-num"><small className="sv2-ml">תאריך</small>{d2(r.created)}</span>
     <span><span className={'sv2-pill '+(reqPill[r.status]||'p-man')}><i/>{supplierRequestStates[r.status]}</span></span>
     <span className="sv2-rowact"><button type="button" className={'sv2-btn sm '+(r.status==='pending'?'primary':'tint')} onClick={()=>go('admin-seller-request/'+r.id)}>{r.status==='pending'?'בדיקת הבקשה':'פירוט'}<ChevronLeft size={15} aria-hidden="true"/></button></span>
    </div>)}
    <div className="sv2-foot"><span>{rows.length} בקשות</span>{rows.length>more&&<button type="button" className="sv2-lk" onClick={()=>setMore(more+30)}>הצגת עוד</button>}</div>
   </>}
  </section>}
 </div>;
}
