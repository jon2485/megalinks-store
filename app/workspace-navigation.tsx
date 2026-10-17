'use client';

import React,{useEffect,useState} from 'react';
import {Globe,FileText,Wallet,LayoutDashboard,Settings,ShoppingCart,LifeBuoy,Code2,Building2,ShieldCheck,Menu,X} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Sheet,SheetTrigger,SheetContent,SheetTitle,SheetDescription,SheetClose} from '@/components/ui/sheet';
import {NavigationMenu,NavigationMenuList,NavigationMenuItem,NavigationMenuTrigger,NavigationMenuContent,NavigationMenuLink} from '@/components/ui/navigation-menu';
import BrandLogo from './brand-logo';
import './workspace-header-compact.css';
import {WorkspaceAccountControls} from './workspace-account-controls';
import {navClient,navAdmin,type Ctx} from './workspace';
import {type Row} from '@/lib/shared';
import {adminAreas,adminArea} from '@/lib/admin-navigation';

type Entry=readonly [string,string,React.ElementType];
type Group={id:string;label:string;icon:React.ElementType;items:Entry[]};
export function navigationGroups(ctx:Ctx):Group[]{
 if(ctx.adminMode&&ctx.user?.role==='admin')return [
  {id:'work',label:'סביבת הניהול',icon:LayoutDashboard,items:adminAreas.map(a=>[a.id,a.label,navAdmin.find(n=>n[0]===a.id)?.[2]||Settings] as Entry)},
  {id:'account',label:'סביבת הלקוח',icon:Globe,items:[['catalog','מעבר לקטלוג הלקוח',Globe],['purchased','אזור הלקוח',FileText]]}
 ];
 const account:Entry[]=[];
 if(ctx.user?.role==='admin')account.push(['admin','מעבר לניהול המערכת',ShieldCheck]);
 const work:Entry[]=navClient.filter(([page])=>page==='purchased').map(([page,label,Icon])=>[page,label,Icon]);
 if(ctx.user?.role==='supplier')work.push(['supplier-workspace','פורטל ספקים',Building2]);
 return [{id:'sites',label:'אתרים ומבצעים',icon:Globe,items:[...navClient.slice(0,2)]},{id:'work',label:'אזור אישי',icon:FileText,items:work},...(account.length?[{id:'account',label:'ניהול',icon:ShieldCheck,items:account}]:[])];
}
export function activeNavigation(page:string,view:string){
 if(page===view)return true;
 if(page.startsWith('admin')&&adminArea(view)?.id===page)return true;
 if(page==='purchased')return view.startsWith('purchased/')||['orders','articles','links','bulk','files'].includes(view)||view.startsWith('article/');
 if(page==='admin-articles')return view.startsWith('admin-article/');
 return false;
}
export function WorkspaceTopNavigation({ctx,view,counts}:{ctx:Ctx;view:string;counts:Row}){
 const [open,setOpen]=useState('');const groups=navigationGroups(ctx);
 useEffect(()=>setOpen(''),[view,ctx.adminMode]);
 const select=(page:string)=>{setOpen('');ctx.go(page);};
 return <NavigationMenu dir="rtl" viewport={false} value={open} onValueChange={setOpen} delayDuration={120} skipDelayDuration={200} aria-label={ctx.adminMode?'תפריט ניהול ראשי':'תפריט האתר'} className="workspace-top-navigation"><NavigationMenuList className="workspace-top-navigation-list">{groups.map(({id,label,icon:Icon,items})=>{
  const active=items.some(([page])=>activeNavigation(page,view));
  if(items.length===1){const [page,itemLabel,ItemIcon]=items[0];return <NavigationMenuItem key={id}><button type="button" className={'workspace-top-navigation-trigger'+(active?' is-current':'')} aria-current={active?'page':undefined} onClick={()=>select(page)}><span className="workspace-top-navigation-icon-badge"><ItemIcon size={21}/></span><span>{itemLabel}</span></button></NavigationMenuItem>;}
  return <NavigationMenuItem value={id} key={id} className="workspace-top-navigation-group"><NavigationMenuTrigger className={'workspace-top-navigation-trigger'+(active?' is-current':'')}><span className="workspace-top-navigation-icon-badge"><Icon size={21} className="workspace-top-navigation-icon" aria-hidden="true"/></span><span>{label}</span></NavigationMenuTrigger><NavigationMenuContent className={'workspace-top-navigation-panel'+(items.length>8?' workspace-top-navigation-panel-wide':'')}><p className="workspace-top-navigation-caption">{label}</p><ul className="workspace-top-navigation-links">{items.map(([page,itemLabel,ItemIcon])=>{const selected=activeNavigation(page,view);return <li key={page}><NavigationMenuLink asChild active={selected}><button type="button" className="workspace-top-navigation-link" aria-current={selected?'page':undefined} onClick={()=>select(page)}><span className="workspace-top-navigation-link-icon"><ItemIcon size={19} aria-hidden="true"/></span><span>{itemLabel}</span>{page==='purchased'&&counts.orders>0&&<span className="workspace-top-navigation-count">{counts.orders}</span>}</button></NavigationMenuLink></li>;})}</ul></NavigationMenuContent></NavigationMenuItem>;
 })}</NavigationMenuList></NavigationMenu>;
}
export function WorkspaceMobileNavigation({ctx,view,counts}:{ctx:Ctx;view:string;counts:Row}){
 const [open,setOpen]=useState(false);
 useEffect(()=>setOpen(false),[view,ctx.adminMode]);
 useEffect(()=>{const media=window.matchMedia('(min-width: 1024px)');const close=()=>{if(media.matches)setOpen(false);};media.addEventListener('change',close);return()=>media.removeEventListener('change',close);},[]);
 const select=(page:string)=>{setOpen(false);ctx.go(page);};
 const drawerCtx={...ctx,go:select};
 return <div className="workspace-mobile-header" dir="rtl"><Sheet open={open} onOpenChange={setOpen}><SheetTrigger asChild><Button variant="ghost" size="icon" className="workspace-mobile-menu-button" aria-label="פתיחת תפריט האתר"><Menu size={25}/></Button></SheetTrigger><SheetContent side="right" showCloseButton={false} className="workspace-mobile-drawer" dir="rtl"><div className="workspace-mobile-drawer-top"><div className="workspace-mobile-drawer-brand"><SheetTitle className="workspace-mobile-drawer-title"><BrandLogo light className="brand-logo-drawer"/></SheetTitle><SheetClose asChild><Button variant="ghost" size="icon" className="workspace-mobile-close" aria-label="סגירת התפריט"><X size={23}/></Button></SheetClose></div><SheetDescription className="sr-only">תפריט האתר לפי קבוצות. בחירת עמוד תסגור את התפריט.</SheetDescription>{ctx.user?<WorkspaceAccountControls ctx={drawerCtx}/>:<a className="workspace-signin" href="/signin-with-chatgpt?return_to=/" target="_top">כניסה למערכת</a>}</div><nav className="workspace-mobile-drawer-links" aria-label={ctx.adminMode?'תפריט ניהול':'תפריט האתר'}>{navigationGroups(ctx).map(group=><section key={group.id} className="workspace-mobile-drawer-group" aria-labelledby={'mobile-nav-'+group.id}><h2 id={'mobile-nav-'+group.id}>{group.label}</h2>{group.items.filter(([page])=>page!=='support').map(([page,label,Icon])=><button type="button" key={page} className={'workspace-mobile-drawer-link'+(activeNavigation(page,view)?' is-current':'')} aria-current={activeNavigation(page,view)?'page':undefined} onClick={()=>select(page)}><Icon size={21} aria-hidden="true"/><span>{label}</span>{page==='purchased'&&counts.orders>0&&<span className="workspace-top-navigation-count">{counts.orders}</span>}</button>)}</section>)}</nav><div className="workspace-mobile-drawer-bottom"><button type="button" className="workspace-mobile-drawer-link" onClick={()=>select(ctx.adminMode?'admin-support':'support')}><LifeBuoy size={21}/><span>תמיכה</span></button></div></SheetContent></Sheet><button type="button" className="workspace-mobile-brand" onClick={()=>ctx.go(ctx.adminMode?'admin':'catalog')} aria-label="MegaLinks — לעמוד הראשי"><BrandLogo light className="brand-logo-mobile"/></button><Button className="workspace-mobile-cart" onClick={()=>ctx.go('cart')}><ShoppingCart size={17}/><span>סל ({counts.cart||0})</span></Button></div>;
}
export default function WorkspaceHeader({ctx,view,counts,brand}:{ctx:Ctx;view:string;counts:Row;brand:string}){
 return <header className="workspace-site-header workspace-site-header-compact" dir="rtl"><WorkspaceMobileNavigation ctx={ctx} view={view} counts={counts}/><div className="workspace-desktop-header"><div className="workspace-site-header-main"><button type="button" className="workspace-site-brand" onClick={()=>ctx.go(ctx.adminMode?'admin':'catalog')} aria-label="Mega Links — לעמוד הראשי"><BrandLogo light className="brand-logo-desktop"/></button><WorkspaceTopNavigation ctx={ctx} view={view} counts={counts}/><div className="workspace-site-header-actions">{ctx.user?<><WorkspaceAccountControls ctx={ctx}/></>:<a className="workspace-signin" href="/signin-with-chatgpt?return_to=/" target="_top">כניסה למערכת</a>}<Button className="workspace-header-cart workspace-site-cart" onClick={()=>ctx.go('cart')}><ShoppingCart size={18}/><span>סל פרסום ({counts.cart||0})</span></Button></div></div></div></header>;
}
