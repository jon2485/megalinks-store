'use client';
import React from 'react';
import Link from 'next/link';
import {ChevronLeft} from 'lucide-react';
import {adminArea} from '@/lib/admin-navigation';
import {EditorialTableContext} from '@/components/ui/table-presentation';
import type {Ctx} from './workspace';
import './admin-editorial.css';

export function AdminEditorialSurface({ctx,view,active,children}:{ctx:Ctx;view:string;active:boolean;children:React.ReactNode}) {
 if(!active)return <>{children}</>;
 const area=adminArea(view),page=area?.pages.find(([id])=>id===view)?.[1];
 const detail=view.startsWith('admin-order/')?'פירוט הזמנה':view.startsWith('admin-customer-account/')?'תיק לקוח':view.startsWith('admin-article/')?'עריכת כתבה':view.startsWith('admin-support/')?'פרטי פנייה':view.startsWith('admin-knowledge/')?'עריכת מאמר':view.startsWith('admin-pricebook/')?'מחירון הלקוח':page;
 const link=(event:React.MouseEvent<HTMLAnchorElement>,target:string)=>{if(event.button||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;event.preventDefault();ctx.go(target);};
 return <EditorialTableContext.Provider value><div className="admin-editorial-surface" data-admin-route={view}>
  <a className="admin-v172-skip" href="#admin-workspace-content">דילוג לתוכן הניהול</a>
  {view!=='admin'&&<nav className="admin-editorial-breadcrumb" aria-label="מיקום בניהול"><Link href="/admin" onClick={e=>link(e,'admin')}>מרכז העבודה</Link>{area&&<><ChevronLeft size={14} aria-hidden="true"/>{detail&&detail!==area.label?<Link href={'/'+area.id} onClick={e=>link(e,area.id)}>{area.label}</Link>:<span aria-current="page">{area.label}</span>}</>}{detail&&detail!==area?.label&&<><ChevronLeft size={14} aria-hidden="true"/><span aria-current="page">{detail}</span></>}</nav>}
  {children}
 </div></EditorialTableContext.Provider>;
}
