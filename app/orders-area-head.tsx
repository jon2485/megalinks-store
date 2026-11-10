'use client';
import React,{useEffect} from 'react';
import {adminArea} from '@/lib/admin-navigation';
import {AdminAttentionBadge,useAdminAttention} from './admin-attention';
import type {Ctx} from './workspace';
import './supplier-v2.css';
import './orders-v2.css';
import {BookOpen,Building2,CalendarCheck,CalendarRange,CreditCard,FileText,LayoutDashboard,PenLine,Receipt,ShoppingCart,Wallet} from 'lucide-react';
export const areaIcons:Record<string,React.ElementType>={'admin-orders':ShoppingCart,'admin-month-close':CalendarCheck,'admin-payment-reports':CreditCard,'admin-invoices':Receipt,'admin-topups':Wallet,'admin-monthly':CalendarRange,'admin-supplier-overview':LayoutDashboard,'admin-suppliers':Building2,'admin-seller-requests':FileText,'admin-supplier-finance':CreditCard,'admin-articles':FileText,'admin-instructions':PenLine,'admin-knowledge':BookOpen};


// v2 page head for an admin area: the area's pages as pills (with attention
// counts), then the page title, subtitle and an optional action.
const plain=(e:React.MouseEvent)=>e.button===0&&!e.metaKey&&!e.ctrlKey&&!e.shiftKey&&!e.altKey;
export function OrdersAreaHead({ctx,current,title,sub,action,nav,stripOnly}:{ctx:Ctx;current:string;title:string;sub:string;action?:React.ReactNode;nav?:React.ReactNode;stripOnly?:boolean}){
 const area=adminArea(current),attention=useAdminAttention(ctx);
 // On a phone the strip scrolls sideways: bring the current page into view.
 useEffect(()=>{const t=setTimeout(()=>{const nav=document.querySelector('.sv2-areas'),cur=nav?.querySelector('[aria-current=page]');if(!nav||!cur||nav.scrollWidth<=nav.clientWidth)return;const n=nav.getBoundingClientRect(),c=cur.getBoundingClientRect();nav.scrollBy({left:c.left+c.width/2-(n.left+n.width/2)});},150);return ()=>clearTimeout(t);},[current]);
 return <>
  {nav??(area&&area.pages.length>1&&<nav className="sv2-areas" aria-label={area.label}>{area.pages.map(([page,label])=>{const Icon=areaIcons[page];const inner=<>{Icon&&<Icon size={18} aria-hidden="true"/>}<span className="lbl">{label}</span><AdminAttentionBadge pages={[page]} state={attention}/></>;return page===current?<span key={page} aria-current="page">{inner}</span>:<a key={page} href={'/'+page} onClick={e=>{if(!plain(e))return;e.preventDefault();ctx.go(page);}}>{inner}</a>;})}</nav>)}
  {!stripOnly&&<div className="sv2-ph"><div><h2>{title}</h2><p>{sub}</p></div>{action}</div>}
 </>;
}
