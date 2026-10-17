'use client';
import React,{useState} from 'react';
import {Search,ArrowRight,LayoutDashboard,ShoppingCart,FileText,Users,Globe,Building2,Tag,LifeBuoy,Settings,RefreshCw,ArrowUpLeft} from 'lucide-react';
import {adminAreas,adminArea} from '@/lib/admin-navigation';
import {api,useData} from '@/lib/client';
import {money,when,type Row} from '@/lib/shared';
import type {Ctx} from './workspace';
import AdminLobby from './admin-lobby';
const icons=[LayoutDashboard,ShoppingCart,FileText,Users,Globe,Building2,Tag,LifeBuoy,Settings];
export function AdminNavigation({ctx,view}:{ctx:Ctx;view:string}){
 const [search,setSearch]=useState('');const active=adminArea(view);
 if(view==='admin')return <nav className="admin-lobby-shortcuts" aria-label="קטגוריות ניהול ראשיות" dir="rtl">{[{id:'admin',label:'לובי הניהול'},...adminAreas.filter(a=>a.id!=='admin')].map(a=>{const Icon=icons[adminAreas.findIndex(b=>b.id===a.id)]||Settings;return <button key={a.id} aria-current={a.id==='admin'?'page':undefined} onClick={()=>ctx.go(a.id)}><Icon size={18}/><span>{a.label}</span></button>;})}</nav>;
 const matches=adminAreas.flatMap(a=>a.pages.map(([page,label])=>({page,label,area:a.label}))).filter(x=>(x.label+' '+x.area).includes(search.trim()));
 return <section className="admin-workspace-navigation" aria-label="סביבת הניהול" dir="rtl">
  <div className="admin-workspace-topline"><div><span className="admin-eyebrow">MEGA LINKS · ניהול</span><h1>{active?.label||'ניהול המערכת'}</h1><p>{active?.description}</p></div><label className="admin-navigation-search"><Search size={18}/><input type="search" aria-label="חיפוש כלי ניהול" placeholder="איזו פעולה צריך לבצע?" value={search} onChange={e=>setSearch(e.target.value)}/></label></div>
  {search.trim()?<div className="admin-search-results" aria-live="polite">{matches.length?matches.map(x=><button key={x.page} onClick={()=>{setSearch('');ctx.go(x.page);}}><b>{x.label}</b><span>{x.area}</span><ArrowUpLeft size={16}/></button>):<p>לא נמצא כלי מתאים. נסו למשל חשבוניות, כתבות או ספקים.</p>}</div>:<nav className="admin-area-navigation" aria-label="אזורי ניהול">{adminAreas.map((a,i)=>{const Icon=icons[i];return <button key={a.id} onClick={()=>ctx.go(a.id)} aria-current={active?.id===a.id?'page':undefined}><Icon size={19}/><span>{a.label}</span></button>;})}</nav>}
  {active&&active.pages.length>1&&<nav className="admin-section-tabs" aria-label={'מסכים בתוך '+active.label}>{active.pages.map(([page,label])=><button key={page} aria-current={view===page?'page':undefined} onClick={()=>ctx.go(page)}>{label}</button>)}</nav>}
  {view.includes('/')&&active&&<button className="admin-back-link" onClick={()=>ctx.go(active.id)}><ArrowRight size={16}/>חזרה ל{active.label}</button>}
 </section>;
}
export function AdminControlCenter({ctx}:{ctx:Ctx}){return <AdminLobby ctx={ctx}/>;}

