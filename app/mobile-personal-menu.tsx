'use client';
import React,{useState} from 'react';
import {Home,FileText,ShoppingCart,Wallet,Users,Globe,Settings,Headphones,ChevronDown,ArrowLeft,X,Building2} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Popover,PopoverTrigger,PopoverContent} from '@/components/ui/popover';
import {clientHubTabs,personalDestinationActive} from '@/lib/client-hub-navigation';
import type {Ctx} from './workspace';
const icons={lobby:Home,articles:FileText,orders:ShoppingCart,payments:Wallet,customers:Users,profile:Settings};
export default function MobileAccountMenu({ctx,view}:{ctx:Ctx;view:string}){
 const[open,setOpen]=useState(false);
 const select=(path:string)=>{setOpen(false);ctx.go(path);};
 return <div className="mobile-personal-menu"><Popover open={open} onOpenChange={setOpen}><PopoverTrigger asChild><Button type="button" variant="outline" className="mobile-personal-menu-trigger"><Users size={21}/>אזור אישי<ChevronDown size={17}/></Button></PopoverTrigger><PopoverContent dir="rtl" align="end" side="bottom" sideOffset={8} collisionPadding={14} className="mobile-personal-menu-content personal-launchpad" aria-label="תפריט האזור האישי"><header><h2>האזור האישי</h2><Button type="button" variant="ghost" size="icon" aria-label="סגירת תפריט האזור האישי" onClick={()=>setOpen(false)}><X size={20}/></Button></header><nav aria-label="עמודי האזור האישי">{clientHubTabs.map(({id,path,label})=>{const Icon=icons[id];return <button type="button" key={path} aria-current={personalDestinationActive(path,view)?'page':undefined} onClick={()=>select(path)}><Icon size={24} aria-hidden="true"/><span>{label}</span></button>;})}</nav><button type="button" className="personal-launchpad-support" aria-current={view==='purchased/support'?'page':undefined} onClick={()=>select('purchased/support')}><Headphones size={20}/>תמיכה</button><button type="button" className="personal-sites-cta" onClick={()=>select('purchased/selling')}><Globe size={21}/><span>האתרים שלי</span><ArrowLeft size={19}/></button>{ctx.user?.role==='supplier'&&<button type="button" className="personal-launchpad-support" onClick={()=>select('supplier-workspace')}><Building2 size={20}/>פורטל ספקים</button>}</PopoverContent></Popover></div>;
}
