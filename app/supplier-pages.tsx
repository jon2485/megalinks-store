'use client';
import React,{useRef,useState} from 'react';
import {Search,AlertTriangle,ArrowRight,Bell,Boxes,CalendarClock,CheckCircle2,ChevronLeft,Clock3,CreditCard,ExternalLink,FileText,Globe,Mail,MoreHorizontal,PackagePlus,PauseCircle,Plus,Receipt,SlidersHorizontal,UserRoundPen} from 'lucide-react';
import {Input} from '@/components/ui/input';
import {Textarea} from '@/components/ui/textarea';
import {DropdownMenu,DropdownMenuContent,DropdownMenuItem,DropdownMenuSeparator,DropdownMenuTrigger} from '@/components/ui/dropdown-menu';
import {api,useData} from '@/lib/client';
import {money,type Row} from '@/lib/shared';
import {contentTime,contentUrl} from '@/lib/content-presentation';
import {adminViewState,saveAdminViewState} from '@/lib/admin-view-state';
import {supplierPaymentMethods,supplierReadiness} from '@/lib/supplier-presentation';
import {OrderFilter,OrderPager,OrderSearch,OrderViews} from './order-list-parts';
import type {Ctx} from './workspace';
import {toast} from 'sonner';
import './supplier-hub.css';
import {Av,billingPill,kindPill,openAddStockFor,SupplierAreaHead} from './supplier-v2';

// Shared with the suppliers workspace view state (same keys and defaults).
const listDefaults={search:'',q:'',status:'all',kind:'all',supplier:'all',page:1,open:'',tab:'requests',month:'',history:false,pay:'unpaid'};
export const supplierKinds:Record<string,string>={account:'ספק עם חשבון',manual:'ספק ידני',partial:'ספק להשלמה'};
const kindTone:Record<string,string>={account:'month',manual:'unreported',partial:'report'};
const stockWord:Record<string,string>={ok:'תקין',low:'עומד להיגמר',empty:'אזל'};
const plain=(e:React.MouseEvent)=>!(e.button||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey);
const todayLocal=()=>{const d=new Date();return new Date(d.getTime()-d.getTimezoneOffset()*6e4).toISOString().slice(0,10);};
const dateOnly=(v?:string)=>v?new Date(v.length===10?v+'T12:00:00Z':v).toLocaleDateString('he-IL',{day:'2-digit',month:'2-digit',year:'2-digit'}):'—';
const linkText=(u?:string)=>String(u||'').replace(/^https?:\/\//,'').replace(/\/$/,'');
const plural=(n:number,one:string,many:string)=>n===1?one:n+' '+many;

function StockFigure({used,total,state,size='md'}:{used:number;total:number;state?:string;size?:'md'|'lg'}){
 return <span className={'om-stock'+(state==='empty'?' is-empty':state==='low'?' is-low':'')+(size==='lg'?' is-lg':'')} title={'שומשו '+used+' מתוך '+total}><span>{used}</span><i>/</i><b>{total}</b></span>;
}
function Avatar({name}:{name?:string}){return <span className="sh-avatar" aria-hidden="true">{String(name||'?').trim().slice(0,1)}</span>;}

/* ---------- Add stock: a package bought in advance ---------- */
export const openAddStock=(ctx:Ctx,site:Row,after?:()=>void)=>ctx.open({kind:'admin-finance',title:'הוספת מלאי',description:site.name+' · חבילת פרסומים שנקנתה מראש',render:(close:()=>void)=><AddStock ctx={ctx} site={site} close={()=>{close();after?.();}}/>});
function AddStock({ctx,site,close}:{ctx:Ctx;site:Row;close:()=>void}){
 const[f,setF]=useState({quantity:'',total_ils:'',unit_ils:'',paid_on:todayLocal(),method:'bank_transfer',note:''}),[busy,setBusy]=useState(false),[error,setError]=useState(''),lock=useRef(false);
 const set=(k:string,v:string)=>setF(o=>({...o,[k]:v})),qty=Number(f.quantity),validQty=Number.isInteger(qty)&&qty>0;
 const total=f.total_ils!==''?Number(f.total_ils):f.unit_ils!==''&&validQty?Number(f.unit_ils)*qty:null,unit=f.unit_ils!==''?Number(f.unit_ils):f.total_ils!==''&&validQty?Number(f.total_ils)/qty:null;
 const hasTotal=site.total!==null&&site.total!==undefined,before=hasTotal?Number(site.total):0,left=hasTotal?Math.max(0,Number(site.total)-Number(site.used||0)):0;
 const missing=!validQty?'כמות פרסומים':total===null?'עלות החבילה או מחיר ליחידה':'';
 return <form noValidate className="om-pay-form" onSubmit={async e=>{e.preventDefault();if(lock.current)return;setError('');if(missing){setError('יש להזין '+missing+'.');return;}lock.current=true;setBusy(true);try{const r=await ctx.run(()=>api('admin/supplier-stock/'+encodeURIComponent(site.id),'POST',f),'המלאי נוסף');if(r?.resent)toast.success(plural(r.resent,'כתבה אחת שחיכתה למלאי נשלחה לספק','כתבות שחיכו למלאי נשלחו לספק'));close();}catch(err){setError((err as Error).message);}finally{lock.current=false;setBusy(false);}}}>
  <div className="om-pay-summary"><div><span>אתר</span><b>{site.name}</b></div><div><span>מצב היום</span><b>{hasTotal?<><bdi>{Number(site.used||0)} / {site.total}</bdi> · נותרו {left}</>:'התחשבנות חודשית'}</b></div><div className="is-total"><span>אחרי ההוספה</span><b><bdi>{validQty?(hasTotal?before+qty:Number(site.used||0)+qty):'—'}</bdi> פרסומים בסך הכול</b></div></div>
  <fieldset disabled={busy} className="om-steps">
   <section className="om-step"><span className="om-step-node" aria-hidden="true">1</span><h4>כמה פרסומים נקנו</h4>
    <label>כמות פרסומים בחבילה<Input inputMode="numeric" value={f.quantity} placeholder="לדוגמה 50" onChange={e=>set('quantity',e.target.value.replace(/[^\d]/g,''))} autoFocus/></label>
    <p className="om-pay-note">{hasTotal&&left>0?`החבילה הנוכחית תסתיים קודם (נותרו ${left}), ואז המספור יתחיל מ־1 בחבילה החדשה.`:'הכתבה הבאה שתישלח לספק תקבל את מספר 1 בחבילה הזו.'}</p>
   </section>
   <section className="om-step"><span className="om-step-node" aria-hidden="true">2</span><h4>עלות ותשלום</h4>
    <div className="om-pay-grid"><label>עלות החבילה (לפני מע״מ)<Input inputMode="decimal" value={f.total_ils} placeholder={f.unit_ils&&validQty?String(Math.round(Number(f.unit_ils)*qty*100)/100):'₪'} onChange={e=>set('total_ils',e.target.value.replace(/[^\d.]/g,''))}/></label><label>מחיר ליחידה (לפני מע״מ)<Input inputMode="decimal" value={f.unit_ils} placeholder={f.total_ils&&validQty?String(Math.round(Number(f.total_ils)/qty*100)/100):'מחושב אוטומטית'} onChange={e=>set('unit_ils',e.target.value.replace(/[^\d.]/g,''))}/></label></div>
    {total!==null&&unit!==null&&validQty&&<p className="om-pay-note">סה״כ <bdi>{money(Math.round(total*100))}</bdi> · <bdi>{money(Math.round(unit*100))}</bdi> לפרסום</p>}
    <div className="om-pay-grid"><label>תאריך תשלום<Input type="date" value={f.paid_on} max={todayLocal()} onChange={e=>set('paid_on',e.target.value)}/></label><label>אופן התשלום<select value={f.method} onChange={e=>set('method',e.target.value)}>{Object.entries(supplierPaymentMethods).map(([k,l])=><option key={k} value={k}>{l}</option>)}</select></label></div>
   </section>
   <section className="om-step"><span className="om-step-node" aria-hidden="true">3</span><h4>הערה</h4>
    <label>הערה פנימית <small className="supplier-field-hint">לא נשלחת לספק. אפשר להשאיר ריק.</small><Textarea className="resize-none" rows={2} value={f.note} maxLength={1000} onChange={e=>set('note',e.target.value)}/></label>
    <p className="om-pay-note">אפשר רק להוסיף מלאי. כתבות שחיכו למלאי יישלחו לספק מיד אחרי השמירה.</p>
   </section>
  </fieldset>
  {error&&<p role="alert" className="supplier-error">{error}</p>}
  <div className="om-pay-actions"><span className={'om-foot-status'+(missing?'':' is-ready')}>{missing?'חסר: '+missing:'מוכן לשמירה'}</span><button type="submit" className="om-btn is-primary" disabled={busy}><PackagePlus size={17} aria-hidden="true"/>{busy?'שומר…':'הוספת המלאי'}</button><button type="button" className="om-btn" disabled={busy} onClick={close}>ביטול</button></div>
 </form>;
}

/* ---------- Overview: what needs me today ---------- */
export function SupplierOverview({ctx}:{ctx:Ctx}){
 const state=useData('admin/supplier-overview',ctx.revision),d:Row|undefined=state.data;
 const settle=(status:string)=>()=>{saveAdminViewState('suppliers:settlements',{...listDefaults,status,pay:'unpaid'});ctx.go('admin-supplier-finance');};
 const hub=(patch:Row)=>()=>{saveAdminViewState('suppliers:hub',{...hubDefaults,...patch});ctx.go('admin-suppliers');};
 const supplierArticles=(id:string)=>ctx.go('admin-supplier-articles/'+id);
 if(state.error&&!d)return <div className="orders-reference-empty"><h3>הסקירה לא נטענה</h3><p>{state.error}</p><button type="button" className="om-btn" onClick={ctx.refresh}>ניסיון נוסף</button></div>;
 if(!d)return <div className="orders-reference-loading" role="status">טוען סקירה…</div>;
 const s=d.summary||{},stockNeed=d.waiting.count+d.stock.count;
 const cards:[string,React.ReactNode,string,string,React.ElementType,()=>void,boolean][]=[
  ['לתשלום עכשיו',money(Number(s.pay?.amount||0)),s.pay?.count?plural(s.pay.count,'התחשבנות אחת מאושרת','התחשבנויות מאושרות'):'אין תשלומים מאושרים','pay',CreditCard,settle('approved'),!!s.pay?.count],
  ['חשבוניות לבדיקה',s.review?.count||0,s.review?.count?'לאשר או להחזיר לתיקון':'הכול נבדק','review',Receipt,settle('invoice_review'),!!s.review?.count],
  ['בקשות מספקים',d.requests,d.requests?'מחכות להחלטה שלך':'אין בקשות פתוחות','req',Bell,()=>ctx.go('admin-seller-requests'),!!d.requests],
  ['באיחור אצל ספקים',d.late.count,d.late.count?'מעל 3 ימים בלי קישור':'כולם בזמן','late',Clock3,hub({status:'attention'}),!!d.late.count],
  ['דרוש מלאי',stockNeed,d.waiting.count?plural(d.waiting.count,'כתבה אחת מחכה למלאי','כתבות מחכות למלאי'):d.stock.count?plural(d.stock.count,'אתר אחד עומד להיגמר','אתרים עומדים להיגמר'):'המלאי תקין','stock',Boxes,hub({billing:'stock'}),!!stockNeed],
  ['ספקים להשלמה',d.partial,d.partial?'חסרים שם, איש קשר או טלפון':'כל הפרטים מלאים','partial',UserRoundPen,hub({type:'partial'}),!!d.partial],
 ];
 return <div className="orders-match-screen om-finance om-content om-suppliers sv2 sh-overview" dir="rtl">
  <SupplierAreaHead current="admin-supplier-overview" title="מה צריך ממך היום" sub={d.suppliers+' ספקים במערכת. כל כרטיס מוביל ישר לרשימה המסוננת.'} go={ctx.go} action={<button type="button" className="sv2-btn primary lg" onClick={()=>ctx.go('admin-supplier/new')}><Plus size={17} aria-hidden="true"/>הוספת ספק</button>}/>
  <div className="sh-cards">{cards.map(([title,value,hint,key,Icon,go,hot])=><button key={key} type="button" className={'sh-card is-'+key+(hot?' is-hot':' is-calm')} onClick={go}><span className="sh-card-icon"><Icon size={18} aria-hidden="true"/></span><span className="sh-card-title">{title}</span><b className="sh-card-value"><bdi>{value}</bdi></b><span className="sh-card-hint">{hot?hint:<><CheckCircle2 size={14} aria-hidden="true"/>{hint}</>}</span></button>)}</div>
  <div className="sh-columns">
   <section className="sh-block"><header><h3><Clock3 size={17} aria-hidden="true"/>באיחור אצל ספקים</h3>{d.late.count>5&&<span>מוצגות 5 מתוך {d.late.count}</span>}</header>
    {!d.late.rows.length?<p className="sh-calm"><CheckCircle2 size={16} aria-hidden="true"/>אין כתבות באיחור. כל הספקים מחזירים קישורים בזמן.</p>:<ul className="sh-list">{d.late.rows.map((r:Row)=><li key={r.id}><div><b>{r.title||'כתבה'}</b><span>{r.supplier_name} · {r.site_name}</span></div><span className="sh-tag is-late">{r.days} ימים</span><button type="button" className="om-btn om-btn-sm" onClick={()=>supplierArticles(r.supplier_id)}>לכתבות הספק<ChevronLeft size={14} aria-hidden="true"/></button></li>)}</ul>}
   </section>
   <section className="sh-block"><header><h3><Boxes size={17} aria-hidden="true"/>מלאי שדורש תשומת לב</h3><span>עומד להיגמר = {d.stock.low_limit} או פחות</span></header>
    {d.waiting.rows.length>0&&<ul className="sh-list">{d.waiting.rows.map((r:Row)=><li key={r.id} className="is-waiting"><div><b>{r.title||'כתבה'}</b><span>מחכה למלאי · {r.site_name} · {r.supplier_name}</span></div><span className="sh-tag is-empty">מחכה</span><button type="button" className="om-btn om-btn-sm is-primary" onClick={()=>ctx.go('admin-supplier-stock/'+r.site_id)}>הוספת מלאי<ChevronLeft size={14} aria-hidden="true"/></button></li>)}</ul>}
    {!d.stock.rows.length&&!d.waiting.rows.length?<p className="sh-calm"><CheckCircle2 size={16} aria-hidden="true"/>לכל האתרים שבחבילה יש מספיק מלאי.</p>:<ul className="sh-list">{d.stock.rows.map((w:Row)=><li key={w.id}><div><b>{w.name}</b><span>{w.supplier_name} · נותרו {w.left}</span></div><StockFigure used={w.used} total={w.total} state={w.state}/><button type="button" className="om-btn om-btn-sm" onClick={()=>ctx.go('admin-supplier-stock/'+w.id)}>ניהול מלאי<ChevronLeft size={14} aria-hidden="true"/></button></li>)}</ul>}
   </section>
   {d.paused.count>0&&<section className="sh-block is-admin-only"><header><h3><PauseCircle size={17} aria-hidden="true"/>אתרים מושהים עם כתבות פתוחות</h3><span>מוצג רק למנהל · הלקוח לא נחסם</span></header>
    <ul className="sh-list">{d.paused.rows.map((w:Row)=><li key={w.id}><div><b>{w.name}</b><span>{w.supplier_name} · {plural(Number(w.n),'כתבה אחת פתוחה','כתבות פתוחות')}</span></div><span className="sh-tag is-paused">מושהה</span><button type="button" className="om-btn om-btn-sm" onClick={()=>ctx.go('admin-supplier/'+w.supplier_id)}>לדף הספק<ChevronLeft size={14} aria-hidden="true"/></button></li>)}</ul>
   </section>}
   <section className="sh-block"><header><h3><CalendarClock size={17} aria-hidden="true"/>פעילות אחרונה</h3></header>
    {!d.activity.length?<p className="sh-calm">עדיין אין פעילות ספקים.</p>:<ul className="sh-feed">{d.activity.map((a:Row)=><li key={a.id}><span className="sh-dot" aria-hidden="true"/><b>{a.action}</b><span>{a.actor||'הספק'} · {contentTime(a.created)}</span></li>)}</ul>}
   </section>
  </div>
 </div>;
}

/* ---------- All suppliers in one list ---------- */
const hubDefaults={search:'',q:'',type:'all',billing:'all',status:'all',page:1};
export function SupplierHub({ctx,confirm}:{ctx:Ctx;confirm:(run:()=>void)=>void}){
 const[v,setV]=useState(()=>adminViewState('suppliers:hub',hubDefaults)),set=(patch:Partial<typeof hubDefaults>)=>setV(o=>{const next={...o,...patch};saveAdminViewState('suppliers:hub',next);return next;});
 const params=new URLSearchParams({q:v.q,type:v.type,billing:v.billing,status:v.status==='attention'?'all':v.status,attention:v.status==='attention'?'1':'0',page:String(v.page)}),state=useData('admin/suppliers?'+params,ctx.revision),current=state.data?.request_key===params.toString(),rows:Row[]=current?state.data.suppliers:[],counts:Row=state.data?.counts||{};
 const go=(page:string,before?:()=>void)=>confirm(()=>{before?.();ctx.go(page);});
 const tab=(s:Row,t:string)=>()=>go('admin-supplier/'+s.id,()=>saveAdminViewState('supplier-editor:'+s.id,{site:'',tab:t,all:false}));
 const open=(s:Row)=>(e:React.MouseEvent)=>{if(!plain(e))return;e.preventDefault();tab(s,'sites')();};
 const cols={gridTemplateColumns:'minmax(260px,2fr) 150px 220px 120px 150px'};
 return <div className="orders-match-screen om-finance om-content om-suppliers sv2 sv2-hub" dir="rtl">
  <SupplierAreaHead current="admin-suppliers" title="כל הספקים" sub='לחיצה על ספק פותחת את האתרים שלו. כל השאר בכפתור "פעולות".' go={go} action={<button type="button" className="sv2-btn primary lg" onClick={()=>go('admin-supplier/new')}><Plus size={17} aria-hidden="true"/>הוספת ספק</button>}/>
  <section className="sv2-card">
   <div className="sv2-tools">
    <div className="sv2-seg" role="tablist" aria-label="סוג ספק">{([['all','הכול',counts.all],['account','עם חשבון',counts.account],['manual','ידניים',counts.manual],['partial','להשלמה',counts.partial]] as [string,string,number][]).map(([k,l,n])=><button key={k} type="button" role="tab" aria-selected={v.type===k} className={v.type===k?'on':''} onClick={()=>set({type:k,page:1})}>{l}{n!=null&&<b>{n}</b>}</button>)}</div>
    <label className="sv2-search"><Search size={17} aria-hidden="true"/><input value={v.search} placeholder="חיפוש ספק, מייל או אתר" aria-label="חיפוש ספק, מייל או אתר" onChange={e=>set({search:e.target.value,q:e.target.value.trim(),page:1})}/></label>
    <div className="sv2-seg" role="tablist" aria-label="סוג תשלום">{([['all','כל סוגי התשלום'],['monthly','חודשי'],['stock','מלאי']] as [string,string][]).map(([k,l])=><button key={k} type="button" role="tab" aria-selected={v.billing===k} className={v.billing===k?'on':''} onClick={()=>set({billing:k,page:1})}>{l}</button>)}</div>
   </div>
   {state.error&&!current?<div className="sv2-empty"><h3>הרשימה לא נטענה</h3><p>{state.error}</p></div>:!current?<p className="sv2-loading" role="status">טוען ספקים…</p>:!rows.length?<div className="sv2-empty"><h3>לא נמצאו ספקים</h3><p>{v.q||v.type!=='all'||v.billing!=='all'?'נסו לנקות את הסינון.':'הוסיפו ספק ראשון.'}</p></div>:<>
    <div className="sv2-th" style={cols} aria-hidden="true"><span>ספק</span><span>סוג ספק</span><span>סוג תשלום</span><span>אתרים</span><span/></div>
    {rows.map(s=><div key={s.id} className="sv2-tr" style={cols}>
     <a className="sv2-who" href={'/admin-supplier/'+s.id} onClick={open(s)}><Av name={s.name}/><span><b dir="auto">{s.name}</b><small>{s.contact?<>{s.contact} · </>:s.kind==='partial'?'חסרים שם ואיש קשר · ':''}<bdi>{s.email}</bdi></small></span></a>
     <span><small className="sv2-ml">סוג ספק</small>{kindPill(s.kind)}</span>
     <span><small className="sv2-ml">סוג תשלום</small>{billingPill(s.billing)}</span>
     <span className="sv2-sites"><small className="sv2-ml">אתרים</small><b>{s.site_count}</b><small>{!s.site_count?'אין אתרים':s.paused_count?<><bdi>{s.active_count}</bdi> פעילים</>:s.site_count===1?'פעיל':'כולם פעילים'}</small></span>
     <span className="sv2-actcell"><DropdownMenu dir="rtl"><DropdownMenuTrigger asChild><button type="button" className="sv2-act" aria-label={'פעולות עבור '+s.name}>פעולות<span className="chev" aria-hidden="true"><ChevronLeft size={15}/></span></button></DropdownMenuTrigger><DropdownMenuContent className="sv2-menu" align="end" sideOffset={8}>
      <DropdownMenuItem className="is-first" onSelect={tab(s,'sites')}><Globe size={17}/>האתרים של הספק<small>{s.site_count}</small></DropdownMenuItem>
      <DropdownMenuItem onSelect={()=>go('admin-supplier-articles/'+s.id)}><FileText size={17}/>כתבות שנשלחו אליו{s.open>0&&<small>{s.open} ממתינות</small>}</DropdownMenuItem>
      <DropdownMenuItem onSelect={()=>go('admin-supplier-billing/'+s.id)}><CreditCard size={17}/>התחשבנות והזמנות</DropdownMenuItem>
      <DropdownMenuItem onSelect={()=>openAddStockFor(ctx,s)}><Boxes size={17}/>הוספת מלאי</DropdownMenuItem>
      <DropdownMenuSeparator/>
      <DropdownMenuItem onSelect={tab(s,'details')}><UserRoundPen size={17}/>פרטים ואופן התנהלות</DropdownMenuItem>
      {s.account_user_id&&<DropdownMenuItem onSelect={tab(s,'details')}><Bell size={17}/>בקשות הספק{s.requests>0&&<small className="is-hot">{s.requests}</small>}</DropdownMenuItem>}
      {s.email&&<DropdownMenuItem onSelect={()=>{window.location.href='mailto:'+s.email;}}><Mail size={17}/>שליחת מייל לספק</DropdownMenuItem>}
     </DropdownMenuContent></DropdownMenu></span>
    </div>)}
    <div className="sv2-foot"><span>מציג {(state.data.page-1)*20+1}–{Math.min(state.data.page*20,state.data.total)} מתוך {state.data.total}</span>{state.data.total>20?<span className="sv2-pager"><button type="button" disabled={state.data.page<=1} onClick={()=>set({page:state.data.page-1})} aria-label="עמוד קודם">‹</button><span>עמוד {state.data.page} מתוך {Math.ceil(state.data.total/20)}</span><button type="button" disabled={state.data.page*20>=state.data.total} onClick={()=>set({page:state.data.page+1})} aria-label="עמוד הבא">›</button></span>:<span/>}</div>
   </>}
  </section>
 </div>;
}

/* ---------- One site's stock: packages and the number each article took ---------- */
export function SiteStockPage({ctx,id}:{ctx:Ctx;id:string}){
 const state=useData('admin/supplier-stock/'+encodeURIComponent(id),ctx.revision),d:Row|undefined=state.data;
 if(state.error&&!d)return <div className="orders-reference-empty"><h3>המלאי לא נטען</h3><p>{state.error}</p></div>;
 if(!d)return <div className="orders-reference-loading" role="status">טוען מלאי…</div>;
 const w=d.site,stock=d.total!==null,add=()=>openAddStock(ctx,{...w,total:d.total,used:d.used},ctx.refresh);
 const open=(articleId:string)=>(e:React.MouseEvent)=>{if(!plain(e))return;e.preventDefault();saveAdminViewState('content-parent','admin-articles');ctx.go('admin-article/'+articleId);};
 const usedIn=(p:Row)=>d.slots.filter((s:Row)=>s.place?.package===p.number).length;
 return <div className="orders-match-screen om-finance om-content om-suppliers sh-stock" dir="rtl">
  <div className="om-top-actions"><button type="button" className="om-btn" onClick={()=>ctx.go(w.supplier_id?'admin-supplier/'+w.supplier_id:'admin-suppliers')}><ArrowRight size={17} aria-hidden="true"/>{w.supplier_name?'חזרה ל'+w.supplier_name:'כל הספקים'}</button></div>
  <div className="orders-reference-panel">
   <header className="sh-stock-hero">
    <div className="sh-stock-id"><Avatar name={w.name}/><div><h2>{w.name}</h2><p>{contentUrl(w.url)&&<a href={contentUrl(w.url)} target="_blank" rel="noreferrer"><ExternalLink size={14} aria-hidden="true"/><bdi>{linkText(w.url)}</bdi></a>}{w.supplier_id&&<a href={'/admin-supplier/'+w.supplier_id} onClick={e=>{if(!plain(e))return;e.preventDefault();ctx.go('admin-supplier/'+w.supplier_id);}}>ספק: {w.supplier_name}</a>}</p></div></div>
    {stock?<div className={'sh-stock-figure is-'+d.state}><span>שומשו מתוך סה״כ</span><StockFigure used={d.used} total={d.total} state={d.state} size="lg"/><small>נותרו <b>{d.left}</b> · {stockWord[d.state]}</small></div>:<div className="sh-stock-figure is-monthly"><span>סוג אתר</span><b>התחשבנות חודשית</b><small>{d.used} כתבות נשלחו עד היום · ללא הגבלה</small></div>}
    <button type="button" className="om-btn is-primary" onClick={add}><PackagePlus size={17} aria-hidden="true"/>{stock?'הוספת מלאי':'מעבר לחבילה מראש'}</button>
   </header>
   {!w.active&&<p className="sh-admin-note" role="status"><PauseCircle size={17} aria-hidden="true"/><span><b>האתר מושהה.</b> ההודעה הזו מוצגת רק לך. הלקוח לא נחסם, וכתבות שכבר אושרו ימשיכו לעבור לספק.</span></p>}
   {d.waiting.length>0&&<div className="sh-admin-note is-stock" role="alert"><AlertTriangle size={17} aria-hidden="true"/><span><b>{plural(d.waiting.length,'כתבה אחת מחכה','כתבות מחכות')} למלאי.</b> הלקוח לא רואה עיכוב. אחרי הוספת מלאי הן יישלחו לספק מיד.</span><button type="button" className="om-btn om-btn-sm is-primary" onClick={add}>הוספת מלאי</button></div>}
   {stock&&<section className="sh-section"><h3>חבילות</h3>{!d.packages.length?<p className="sh-calm">עדיין לא נרשמו חבילות.</p>:<div className="sh-pack-table"><div className="sh-pack-cols" aria-hidden="true"><span>חבילה</span><span>כמות</span><span>נוצלו</span><span>עלות החבילה</span><span>ליחידה</span><span>תשלום</span></div>{d.packages.map((p:Row)=><div key={p.id} className="sh-pack-row"><b>חבילה {p.number}{p.opening&&<small>מלאי קודם</small>}</b><div><small className="om-phone-label">כמות</small><bdi>{p.quantity}</bdi></div><div><small className="om-phone-label">נוצלו</small><StockFigure used={usedIn(p)} total={Number(p.quantity)} state={usedIn(p)>=Number(p.quantity)?'ok':Number(p.quantity)-usedIn(p)<=5?'low':'ok'}/></div><div><small className="om-phone-label">עלות החבילה</small>{p.total_cents==null?<span className="om-muted">לא נרשמה</span>:<bdi className="om-num">{money(p.total_cents)}</bdi>}</div><div><small className="om-phone-label">ליחידה</small>{p.unit_cents==null?<span className="om-muted">—</span>:<bdi className="om-num">{money(p.unit_cents)}</bdi>}</div><div><small className="om-phone-label">תשלום</small>{p.opening?<span className="om-muted">—</span>:<span>{dateOnly(p.paid_on||p.created)}{p.method&&' · '+(d.methods[p.method]||'')}</span>}{p.note&&<small className="sh-pack-note">{p.note}</small>}</div></div>)}</div>}</section>}
   <section className="sh-section"><h3>כל כתבה ואיזה מספר היא תפסה</h3>{!d.slots.length?<p className="sh-calm">עדיין לא נשלחו כתבות לאתר הזה.</p>:<div className="sh-slot-table"><div className="sh-slot-cols" aria-hidden="true"><span>מספר</span><span>מקום בחבילה</span><span>כתבה</span><span>נשלחה</span><span>מצב</span></div>{d.slots.map((s:Row)=><div key={s.article_id} className="sh-slot-row"><b className="sh-slot-n"><bdi>#{s.sequence}</bdi></b><div><small className="om-phone-label">מקום בחבילה</small>{s.place?<span>חבילה {s.place.package} · <bdi>{s.place.position} / {s.place.size}</bdi></span>:<span className="om-muted">חודשי</span>}</div><div className="sh-slot-title"><a href={'/admin-article/'+s.article_id} onClick={open(s.article_id)}>{s.title||'כתבה'}</a>{s.order_number&&<small>הזמנה <bdi>{String(s.order_number).startsWith('#')?s.order_number:'#'+s.order_number}</bdi></small>}</div><div><small className="om-phone-label">נשלחה</small><bdi className="om-num">{dateOnly(s.created)}</bdi></div><div>{s.status==='published'?(contentUrl(s.published_url)?<a className="om-art-live" href={contentUrl(s.published_url)} target="_blank" rel="noreferrer"><ExternalLink size={14} aria-hidden="true"/>פורסמה</a>:<span className="sh-tag is-ok">פורסמה</span>):s.status==='cancelled'?<span className="sh-tag is-paused">בוטלה</span>:<span className="sh-tag is-wait">ממתינה לפרסום</span>}</div></div>)}</div>}</section>
   {d.releases.length>0&&<section className="sh-section"><h3>הוחזרו למלאי</h3><ul className="sh-feed">{d.releases.map((r:Row)=><li key={r.article_id}><span className="sh-dot" aria-hidden="true"/><b>מספר <bdi>#{r.sequence}</bdi> · {r.title||'כתבה'}</b><span>בוטלה לפני פרסום · {dateOnly(r.released_at)} · הקישור לספק נחסם</span></li>)}</ul></section>}
  </div>
 </div>;
}
