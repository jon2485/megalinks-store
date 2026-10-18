'use client';
import React,{useState} from 'react';
import {Search,ArrowRight,LayoutDashboard,ShoppingCart,FileText,Users,Globe,Building2,Tag,LifeBuoy,Settings,ArrowUpLeft,Menu,ChevronDown} from 'lucide-react';
import {adminAreas,adminArea} from '@/lib/admin-navigation';
import type {Ctx} from './workspace';
import AdminLobby from './admin-lobby';

const icons=[LayoutDashboard,ShoppingCart,FileText,Users,Globe,Building2,Tag,LifeBuoy,Settings];

export function AdminNavigation({ctx,view}:{ctx:Ctx;view:string}){
 const [search,setSearch]=useState('');
 const [expanded,setExpanded]=useState(false);
 const active=adminArea(view);
 const matches=adminAreas.flatMap(a=>a.pages.map(([page,label])=>({page,label,area:a.label})))
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
   <span>{active?.label||'ניהול המערכת'}</span>
   <button type="button" aria-expanded={expanded} aria-controls="admin-v172-menu" onClick={()=>setExpanded(!expanded)}>
    <Menu size={19} aria-hidden="true"/><span>{expanded?'סגירת הניווט':'ניווט ניהול'}</span><ChevronDown size={16} aria-hidden="true"/>
   </button>
  </div>
  <div id="admin-v172-menu" className={'admin-v172-menu'+(expanded?' is-expanded':'')}>
   <div className="admin-v172-brand"><span translate="no" dir="ltr">MEGA LINKS</span><strong>סביבת הניהול</strong></div>
   <label className="admin-v172-search"><Search size={17} aria-hidden="true"/><input type="search" name="admin-navigation-search" autoComplete="off" aria-label="חיפוש כלי ניהול" placeholder="חיפוש מסך או פעולה…" value={search} onChange={e=>setSearch(e.target.value)}/></label>
   {search.trim()?<nav className="admin-v172-results" aria-label="תוצאות חיפוש כלי ניהול" aria-live="polite">
    {matches.length?matches.map(x=><a key={x.page} href={'/'+x.page} onClick={e=>select(e,x.page)}><span><b>{x.label}</b><small>{x.area}</small></span><ArrowUpLeft size={16} aria-hidden="true"/></a>):<p>לא נמצא כלי מתאים. נסו חשבוניות, כתבות או ספקים.</p>}
   </nav>:<nav className="admin-v172-areas" aria-label="קטגוריות ניהול ראשיות">
    {adminAreas.map((area,index)=>{const Icon=icons[index];return <section key={area.id} className={'admin-v172-area'+(active?.id===area.id?' is-active':'')}>
     <a className="admin-v172-area-link" href={'/'+area.id} aria-current={view===area.id?'page':undefined} onClick={e=>select(e,area.id)}><Icon size={19} aria-hidden="true"/><span>{area.label}</span></a>
     {area.pages.length>1&&<ul aria-label={'מסכים בתוך '+area.label}>{area.pages.filter(([page])=>page!==area.id).map(([page,label])=><li key={page}><a href={'/'+page} aria-current={view===page?'page':undefined} onClick={e=>select(e,page)}>{label}</a></li>)}</ul>}
    </section>;})}
   </nav>}
   {view.includes('/')&&active&&<a className="admin-v172-back" href={'/'+active.id} onClick={e=>select(e,active.id)}><ArrowRight size={16} aria-hidden="true"/>חזרה ל{active.label}</a>}
   <p className="admin-v172-context">{active?.description}</p>
  </div>
 </aside>;
}

export function AdminControlCenter({ctx}:{ctx:Ctx}){return <AdminLobby ctx={ctx}/>;}
