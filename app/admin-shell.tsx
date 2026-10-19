'use client';
import React,{useRef,useState} from 'react';
import {Search,X,ArrowRight,LayoutDashboard,ShoppingCart,FileText,Users,Globe,Building2,Tag,LifeBuoy,Settings,ArrowUpLeft,Menu,ChevronDown} from 'lucide-react';
import {adminAreas,adminArea} from '@/lib/admin-navigation';
import type {Ctx} from './workspace';
import AdminLobby from './admin-lobby';
import {adminMenuSections,adminAreaLabel,useAdminAttention,AdminAttentionBadge} from './admin-attention';

const icons=[LayoutDashboard,ShoppingCart,FileText,Users,Globe,Building2,Tag,LifeBuoy,Settings];

export function AdminNavigation({ctx,view}:{ctx:Ctx;view:string}){
 const [search,setSearch]=useState('');
 const [expanded,setExpanded]=useState(false);
 const searchInput=useRef<HTMLInputElement>(null);
 const active=adminArea(view);
 const attention=useAdminAttention(ctx);
 const matches=adminAreas.flatMap(a=>a.pages.map(([page,label])=>({page,label:adminAreaLabel(page,label),area:adminAreaLabel(a.id,a.label)})))
  .filter(x=>(x.label+' '+x.area).includes(search.trim()));
 // Ordinary navigation always uses the workspace's existing unsaved-change guard.
 // A new tab leaves the current editor intact and uses the existing deep route.
 const select=(event:React.MouseEvent<HTMLAnchorElement>,page:string)=>{
  if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
  event.preventDefault();
  if(expanded){
   const toggle=event.currentTarget?.closest('.admin-v172-navigation')?.querySelector<HTMLButtonElement>('button[aria-controls="admin-v172-menu"]');
   if(toggle?.getClientRects().length)toggle.focus();
  }
  setExpanded(false);
  setSearch('');
  ctx.go(page);
 };
 return <aside className="admin-v172-navigation" aria-label="סביבת הניהול" dir="rtl">
  <a className="admin-v172-skip" href="#admin-workspace-content">דילוג לתוכן הניהול</a>
  <div className="admin-v172-mobile-heading">
   <span>{active?adminAreaLabel(active.id,active.label):'ניהול המערכת'}</span>
   <button type="button" aria-expanded={expanded} aria-controls="admin-v172-menu" onClick={()=>setExpanded(!expanded)}>
    <Menu size={19} aria-hidden="true"/><span>{expanded?'סגירת הניווט':'ניווט ניהול'}</span><ChevronDown size={16} aria-hidden="true"/>
   </button>
  </div>
  <div id="admin-v172-menu" className={'admin-v172-menu'+(expanded?' is-expanded':'')}>
   <div className="admin-v172-brand"><span translate="no" dir="ltr">MEGA LINKS</span><strong>סביבת הניהול</strong></div>
   <div className="admin-v172-search"><Search size={17} aria-hidden="true"/><input ref={searchInput} type="search" name="admin-navigation-search" autoComplete="off" aria-label="חיפוש כלי ניהול" placeholder="חיפוש מסכי ניהול…" value={search} onChange={e=>setSearch(e.target.value)}/>{search&&<button type="button" aria-label="ניקוי חיפוש כלי ניהול" onClick={()=>{setSearch('');searchInput.current?.focus();}}><X size={16} aria-hidden="true"/></button>}</div>
   {attention.error&&<p className="admin-v172-attention-error" role="status">חיוויי הטיפול לא עודכנו. מוצגים הנתונים האחרונים, אם קיימים.</p>}
   {search.trim()?<nav className="admin-v172-results" aria-label="תוצאות חיפוש כלי ניהול" aria-live="polite">
    {matches.length?matches.map(x=><a key={x.page} href={'/'+x.page} onClick={e=>select(e,x.page)}><span><b>{adminAreaLabel(x.page,x.label)}</b><small>{x.area}</small></span><AdminAttentionBadge pages={[x.page]} state={attention}/><ArrowUpLeft size={16} aria-hidden="true"/></a>):<p>לא נמצא כלי מתאים. נסו חשבוניות, כתבות או ספקים.</p>}
   </nav>:<nav className="admin-v172-areas" aria-label="קטגוריות ניהול ראשיות">
    {adminMenuSections.map(section=><section key={section.label} className="admin-v172-menu-section" aria-label={section.label}><h2>{section.label}</h2>{section.areas.map(id=>{const area=adminAreas.find(a=>a.id===id)!;const Icon=icons[adminAreas.indexOf(area)];const label=adminAreaLabel(area.id,area.label);return <section key={area.id} className={'admin-v172-area'+(active?.id===area.id?' is-active':'')}>
     {area.pages.length>1?<details open={active?.id===area.id} className="admin-v172-group">
      <summary><Icon size={19} aria-hidden="true"/><span>{label}</span><AdminAttentionBadge pages={area.pages.map(([page])=>page)} state={attention}/><ChevronDown size={15} aria-hidden="true"/></summary>
      <ul aria-label={'מסכים בתוך '+label}>{area.pages.map(([page,pageLabel])=><li key={page}><a href={'/'+page} aria-current={view===page?'page':undefined} onClick={e=>select(e,page)}><span>{pageLabel}</span><AdminAttentionBadge pages={[page]} state={attention}/></a></li>)}</ul>
     </details>:<a className="admin-v172-area-link" href={'/'+area.id} aria-current={view===area.id?'page':undefined} onClick={e=>select(e,area.id)}><Icon size={19} aria-hidden="true"/><span>{label}</span><AdminAttentionBadge pages={[area.id]} state={attention}/></a>}
    </section>;})}</section>)}
   </nav>}
   {view.includes('/')&&active&&<a className="admin-v172-back" href={'/'+active.id} onClick={e=>select(e,active.id)}><ArrowRight size={16} aria-hidden="true"/>חזרה ל{adminAreaLabel(active.id,active.label)}</a>}
   <p className="admin-v172-context">{active?.description}</p>
  </div>
 </aside>;
}

export function AdminControlCenter({ctx}:{ctx:Ctx}){return <AdminLobby ctx={ctx}/>;}

export function AdminSectionTabs({ctx,view}:{ctx:Ctx;view:string}){
 const area=adminArea(view),attention=useAdminAttention(ctx);
 if(!area||area.pages.length<2)return null;
 return <nav className="admin-section-tabs" aria-label={'מסכים בתוך '+adminAreaLabel(area.id,area.label)}>{area.pages.map(([page,label])=><a key={page} href={'/'+page} aria-current={page===view?'page':undefined} onClick={event=>{if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;event.preventDefault();ctx.go(page);}}><span>{label}</span><AdminAttentionBadge pages={[page]} state={attention}/></a>)}</nav>;
}
