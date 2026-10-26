'use client';
import React,{useState} from 'react';
import {Home,FileText,ShoppingCart,Wallet,Users,Globe,Settings,Bell,FolderOpen,Headphones,Code2,ChevronDown,X,Building2} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Popover,PopoverTrigger,PopoverContent} from '@/components/ui/popover';
import {clientHubTabs,personalDestinationActive} from '@/lib/client-hub-navigation';
import type {Ctx} from './workspace';
const icons={lobby:Home,articles:FileText,orders:ShoppingCart,payments:Wallet,customers:Users,selling:Globe,profile:Settings};

export default function MobileAccountMenu({ctx,view}:{ctx:Ctx;view:string}){
 const[open,setOpen]=useState(false);const entries=[...clientHubTabs.map(tab=>({path:tab.path,label:tab.label,icon:icons[tab.id]})),{path:'purchased/notifications',label:'התראות',icon:Bell},{path:'purchased/files',label:'קבצים',icon:FolderOpen},{path:'purchased/support',label:'תמיכה',icon:Headphones},{path:'purchased/api',label:'חיבור API',icon:Code2},...(ctx.user?.role==='supplier'?[{path:'supplier-workspace',label:'פורטל ספקים',icon:Building2}]:[])];
 return <div className="mobile-personal-menu"><Popover open={open} onOpenChange={setOpen}><PopoverTrigger asChild><Button type="button" variant="outline" className="mobile-personal-menu-trigger"><Users size={21}/>אזור אישי<ChevronDown size={17}/></Button></PopoverTrigger><PopoverContent dir="rtl" align="end" side="bottom" sideOffset={8} collisionPadding={14} className="mobile-personal-menu-content" aria-label="תפריט האזור האישי"><header><h2>האזור האישי</h2><Button type="button" variant="ghost" size="icon" aria-label="סגירת תפריט האזור האישי" onClick={()=>setOpen(false)}><X size={20}/></Button></header><nav aria-label="עמודי האזור האישי">{entries.map(({path,label,icon:Icon},i)=><button type="button" key={path} className={i===7?'personal-secondary-start':undefined} aria-current={personalDestinationActive(path,view)?'page':undefined} onClick={()=>{setOpen(false);ctx.go(path);}}><Icon size={21} aria-hidden="true"/><span>{label}</span></button>)}</nav></PopoverContent></Popover></div>;
}
