'use client';
import React from 'react';
import {Home,FileText,ShoppingCart,Wallet,Users,Globe,Settings,Headphones,ArrowLeft,Building2} from 'lucide-react';
import {clientHubTabs,personalDestinationActive} from '@/lib/client-hub-navigation';
import {useAccountUnderline} from './account-motion';
import type {Ctx} from './workspace';
const icons={lobby:Home,articles:FileText,orders:ShoppingCart,payments:Wallet,customers:Users,profile:Settings};
export default function MobileAccountMenu({ctx,view,onSelect}:{ctx:Ctx;view:string;onSelect?:(path:string)=>void}){
 const navRef=useAccountUnderline(view);
 const select=(path:string)=>(onSelect||ctx.go)(path);
 return <section dir="rtl" className="mobile-personal-menu-content personal-launchpad personal-launchpad-inline" aria-label="ניווט קבוע באזור האישי"><nav ref={navRef} className="account-sliding-nav" aria-label="עמודי האזור האישי"><span className="account-sliding-marker" aria-hidden="true"/>{clientHubTabs.map(({id,path,label})=>{const Icon=icons[id];return <button type="button" key={path} aria-current={personalDestinationActive(path,view)?'page':undefined} onClick={()=>select(path)}><Icon size={24} aria-hidden="true"/><span>{label}</span></button>;})}</nav><button type="button" className="personal-launchpad-support" aria-current={view==='purchased/support'?'page':undefined} onClick={()=>select('purchased/support')}><Headphones size={20}/>תמיכה</button><button type="button" className="personal-sites-cta" onClick={()=>select('purchased/selling')}><Globe size={21}/><span>האתרים שלי</span><ArrowLeft size={19}/></button>{ctx.user?.role==='supplier'&&<button type="button" className="personal-launchpad-support" onClick={()=>select('supplier-workspace')}><Building2 size={20}/>פורטל ספקים</button>}</section>;
}
