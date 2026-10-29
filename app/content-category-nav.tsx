'use client';
import {BookOpen,FileCheck,FileText,PenLine,Send} from 'lucide-react';
import type {Ctx} from './workspace';
import {adminViewState} from '@/lib/admin-view-state';
import './content-workspace.css';
export const contentPages=[['admin-approvals','ממתינים לאישור',FileCheck],['admin-articles','כל הכתבות',FileText],['admin-publication','תור פרסום',Send],['admin-instructions','הנחיות כתיבה',PenLine],['admin-knowledge','ספריית ידע',BookOpen]] as const;
export function ContentCategoryNavigation({ctx,view}:{ctx:Ctx;view:string}){const active=view.startsWith('admin-article/')?adminViewState('content-parent','admin-articles'):view.split('/')[0];return <header className="content-heading" dir="rtl"><h1>תוכן ופרסום</h1><p>כל התוכן והפרסום, במקום אחד.</p><nav className="content-tiles" aria-label="קטגוריות תוכן ופרסום">{contentPages.map(([page,label,Icon])=><a key={page} href={'/'+page} aria-current={active===page?'page':undefined} onClick={e=>{if(e.button||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;e.preventDefault();ctx.go(page);}}><Icon size={24}/><span>{label}</span></a>)}</nav></header>;}
