'use client';
import {Select,SelectTrigger,SelectValue,SelectContent,SelectItem} from '@/components/ui/select';
import './orders-unified.css';
import React,{useRef,useState} from 'react';
import {Search,X,ArrowRight,LayoutDashboard,ShoppingCart,FileText,Users,Globe,Building2,Tag,MessageSquare,Settings,ChevronDown,ChevronLeft,Grid2X2,Menu,CalendarDays,CreditCard,Wallet,ReceiptText} from 'lucide-react';
import {adminAreas,adminArea} from '@/lib/admin-navigation';
import {Sheet,SheetTrigger,SheetContent,SheetTitle,SheetDescription,SheetClose} from '@/components/ui/sheet';
import type {Ctx} from './workspace';
import BrandLogo from './brand-logo';
import Link from 'next/link';
import {WorkspaceAccountControls} from './workspace-account-controls';
import AdminLobby from './admin-lobby';
import AdminUpdateFeed from './admin-update-feed';
import {adminMenuSections,adminAreaLabel,useAdminAttention,AdminAttentionBadge} from './admin-attention';

const icons=[LayoutDashboard,ShoppingCart,FileText,Users,Globe,Building2,Tag,MessageSquare,Settings];
export function AdminMenuContent({ctx,view,onSelect=()=>{}}:{ctx:Ctx;view:string;onSelect?:()=>void}){
 const [search,setSearch]=useState(''),input=useRef<HTMLInputElement>(null),active=adminArea(view),attention=useAdminAttention(ctx);
 const q=search.trim().toLocaleLowerCase('he');
 const matches=adminAreas.flatMap(a=>a.pages.map(([page,label])=>({page,label,area:a.label}))).filter(x=>(x.label+' '+x.area).toLocaleLowerCase('he').includes(q));
 const select=(event:React.MouseEvent<HTMLAnchorElement>,page:string)=>{if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;event.preventDefault();onSelect();ctx.go(page);};
 return <><label className="admin-v172-search"><Search size={18} aria-hidden="true"/><input ref={input} type="search" aria-label="חיפוש כלי ניהול" placeholder="חיפוש בכל אזורי הניהול" value={search} onChange={e=>setSearch(e.target.value)}/>{search&&<button type="button" aria-label="ניקוי חיפוש כלי ניהול" onClick={()=>{setSearch('');input.current?.focus();}}><X size={17}/></button>}</label>
 {attention.error&&<p className="admin-v172-attention-error" role="status">חיוויי הטיפול לא עודכנו. הנתונים האחרונים מוצגים עד לרענון.</p>}
 {q?<nav className="admin-v172-results" aria-label="תוצאות חיפוש כלי ניהול">{matches.length?matches.map(x=><a key={x.page} href={'/'+x.page} onClick={e=>select(e,x.page)}><span><b>{x.label}</b><small>{x.area}</small></span><AdminAttentionBadge pages={[x.page]} state={attention}/><ChevronLeft size={16}/></a>):<p role="status">לא נמצאו מסכים. נסו כתבות, חשבוניות או ספקים.</p>}</nav>:<nav className="admin-v172-areas" aria-label="קטגוריות ניהול ראשיות">{adminMenuSections.map(section=><section key={section.label} className="admin-v172-menu-section"><h2>{section.label}</h2>{section.areas.map(id=>{const area=adminAreas.find(a=>a.id===id)!,Icon=icons[adminAreas.indexOf(area)],label=adminAreaLabel(area.id,area.label);if(id==='admin-orders')return <section key={id} className="admin-v172-area"><Link href="/admin-orders" className="admin-v172-area-link" aria-current={active?.id===id?'page':undefined} onClick={e=>select(e,'admin-orders')}><ShoppingCart size={20}/><span>הזמנות</span><AdminAttentionBadge pages={area.pages.map(([p])=>p)} scope={'area:'+id} state={attention}/></Link></section>;return <section key={id} className={'admin-v172-area'+(active?.id===id?' is-active':'')}>{area.pages.length>1?<details className="admin-v172-group" open={active?.id===id||undefined} key={id+':'+(active?.id===id)}><summary><Icon size={20}/><span>{label}</span><AdminAttentionBadge pages={area.pages.map(([p])=>p)} scope={'area:'+id} state={attention}/><ChevronDown size={16}/></summary><ul>{area.pages.map(([page,pageLabel])=><li key={page}><a href={'/'+page} aria-current={view===page?'page':undefined} onClick={e=>select(e,page)}><span>{pageLabel}</span><AdminAttentionBadge pages={[page]} state={attention}/></a></li>)}</ul></details>:<a href={'/'+id} className="admin-v172-area-link" aria-current={view===id?'page':undefined} onClick={e=>select(e,id)}><Icon size={20}/><span>{label}</span><AdminAttentionBadge pages={[id]} scope={'area:'+id} state={attention}/></a>}</section>;})}</section>)}</nav>}
 <div className="admin-menu-utilities"><Link href="/profile" onClick={e=>select(e,'profile')}><Settings size={18}/>הגדרות החשבון שלי<ChevronLeft size={16}/></Link><Link href="/" onClick={e=>select(e,'catalog')}><Globe size={18}/>מעבר לאתר הלקוחות<ChevronLeft size={16}/></Link>{active&&view.includes('/')&&<a href={'/'+active.id} onClick={e=>select(e,active.id)}><ArrowRight size={18}/>חזרה ל{active.label}</a>}</div></>;
}
export function AdminHeader({ctx,view}:{ctx:Ctx;view:string}){
 const [menu,setMenu]=useState({view,open:false});
 const open=menu.view===view&&menu.open;
 const setOpen=(value:boolean)=>setMenu({view,open:value});
 return <header className="admin-glass-header" dir="rtl"><Link className="admin-glass-brand" href="/admin" aria-label="MegaLinks — מרכז העבודה" onClick={e=>{if(e.button!==0||e.metaKey||e.ctrlKey)return;e.preventDefault();ctx.go('admin');}}><BrandLogo light className="brand-logo-desktop"/></Link><Sheet open={open} onOpenChange={setOpen}><SheetTrigger asChild><button type="button" className="admin-all-areas" onClick={()=>setOpen(true)}><Grid2X2 size={20}/><Menu size={23} className="orders-phone-menu-icon"/><span>כל אזורי הניהול</span><ChevronDown size={15}/></button></SheetTrigger><SheetContent side="right" showCloseButton={false} className="admin-glass-menu" dir="rtl"><header><div><SheetTitle>כל אזורי הניהול</SheetTitle><SheetDescription>כל המסכים והכלים שלך, מסודרים לפי תחום.</SheetDescription></div><SheetClose asChild><button type="button" aria-label="סגירת תפריט הניהול" onClick={()=>setOpen(false)}><X size={23}/></button></SheetClose></header><div className="admin-glass-menu-scroll"><AdminMenuContent ctx={ctx} view={view} onSelect={()=>setOpen(false)}/></div></SheetContent></Sheet><div className="admin-glass-account"><WorkspaceAccountControls ctx={ctx} compactGreeting/></div></header>;
}
export function AdminNavigation({ctx,view}:{ctx:Ctx;view:string}){
 return <aside className="admin-v172-navigation" aria-label="סביבת הניהול" dir="rtl"><a className="admin-v172-skip" href="#admin-workspace-content">דילוג לתוכן הניהול</a><div className="admin-v172-menu"><div className="admin-v172-brand"><strong>סביבת הניהול</strong><span>כל הכלים לעבודה השוטפת</span></div><AdminMenuContent ctx={ctx} view={view}/></div></aside>;
}
const dock=[['admin','מרכז העבודה',LayoutDashboard],['admin-orders','הזמנות',ShoppingCart],['admin-articles','כתבות',FileText],['admin-users','לקוחות',Users],['admin-support','פניות',MessageSquare]] as const;
export function AdminMobileDock({ctx,view}:{ctx:Ctx;view:string}){
 const attention=useAdminAttention(ctx),area=adminArea(view);
 const active=view==='admin'?0:area?.id==='admin-orders'?1:area?.id==='admin-approvals'?2:area?.id==='admin-users'?3:area?.id==='admin-support'?4:-1;
 return <nav className="admin-mobile-dock" aria-label="קיצורי דרך לניהול" dir="rtl"><span className={'admin-dock-indicator'+(active<0?' is-hidden':'')} aria-hidden="true" style={{'--dock-index':Math.max(0,active)} as React.CSSProperties}/>{dock.map(([page,label,Icon],i)=><a key={page} href={'/'+page} aria-current={i===active?'page':undefined} onClick={e=>{if(e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;e.preventDefault();ctx.go(page);}}><span className="admin-dock-icon"><Icon size={22}/><AdminAttentionBadge pages={[page]} state={attention}/></span><span>{label}</span></a>)}</nav>;
}
export function AdminControlCenter({ctx}:{ctx:Ctx}){
 return <><AdminUpdateFeed ctx={ctx}/><details className="admin-extra-queues"><summary><span>תורי טיפול נוספים</span><span>כספים, ספקים, ביטולים, מחירים וחיבורים</span><ChevronDown size={20}/></summary><AdminLobby ctx={ctx}/></details></>;
}
export function AdminSectionTabs({ctx,view}:{ctx:Ctx;view:string}){
 const area=adminArea(view),attention=useAdminAttention(ctx);
 if(!area||area.pages.length<2)return null;
 if(area.id==='admin-orders'){const categoryIcons=[ShoppingCart,CalendarDays,CreditCard,ReceiptText,Wallet,FileText],current=area.pages.find(([p])=>p===view)?.[0]||'admin-orders',titles:Record<string,[string,string]>={'admin-month-close':['סגירת חודש','תשלומים שאושרו סופית בתקופה שנבחרה.'],'admin-payment-reports':['דיווחי תשלום','פרטי הדיווחים וההזמנות של הלקוחות.'],'admin-invoices':['חשבוניות וקבלות','מסמכי התשלום של כל ההזמנות.'],'admin-topups':['הטענות יתרה','דיווחים להוספת קרדיט לחשבון.'],'admin-monthly':['חשבונות חודשיים','הזמנה חודשית אחת לכל לקוח.']};return <header className="orders-unified-heading" dir="rtl"><h1>{titles[current]?.[0]||'הזמנות'}</h1><p>{titles[current]?.[1]||<>כל ההזמנות והכספים,<span className="orders-heading-ending"> במקום אחד.</span></>}</p><nav className="orders-category-tiles" aria-label="קטגוריות הזמנות">{area.pages.map(([page,label],i)=>{const Icon=categoryIcons[i];return <a key={page} href={'/'+page} aria-current={page===current?'page':undefined} onClick={e=>{if(e.button||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;e.preventDefault();ctx.go(page);}}><Icon size={26}/><span>{label}</span></a>;})}</nav><div className="orders-category-phone"><label id="orders-category-label">קטגוריה</label><Select dir="rtl" value={current} onValueChange={ctx.go}><SelectTrigger aria-labelledby="orders-category-label"><SelectValue/></SelectTrigger><SelectContent position="popper" align="start" sideOffset={5} className="orders-category-popup">{area.pages.map(([page,label],i)=>{const Icon=categoryIcons[i];return <SelectItem key={page} value={page}><Icon size={23}/><span>{label}</span></SelectItem>;})}</SelectContent></Select></div></header>;}

 return <nav className="admin-section-tabs" aria-label={'מסכים בתוך '+area.label}>{area.pages.map(([page,label])=><a key={page} href={'/'+page} aria-current={page===view?'page':undefined} onClick={e=>{if(e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;e.preventDefault();ctx.go(page);}}><span>{label}</span><AdminAttentionBadge pages={[page]} state={attention}/></a>)}</nav>;
}
