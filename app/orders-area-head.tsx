'use client';
import React from 'react';
import {adminArea} from '@/lib/admin-navigation';
import {AdminAttentionBadge,useAdminAttention} from './admin-attention';
import type {Ctx} from './workspace';

// v2 page head for an admin area: the area's pages as pills (with attention
// counts), then the page title, subtitle and an optional action.
const plain=(e:React.MouseEvent)=>e.button===0&&!e.metaKey&&!e.ctrlKey&&!e.shiftKey&&!e.altKey;
export function OrdersAreaHead({ctx,current,title,sub,action}:{ctx:Ctx;current:string;title:string;sub:string;action?:React.ReactNode}){
 const area=adminArea(current),attention=useAdminAttention(ctx);
 return <>
  {area&&<nav className="sv2-areas" aria-label={area.label}>{area.pages.map(([page,label])=>page===current?<span key={page} aria-current="page">{label}<AdminAttentionBadge pages={[page]} state={attention}/></span>:<a key={page} href={'/'+page} onClick={e=>{if(!plain(e))return;e.preventDefault();ctx.go(page);}}>{label}<AdminAttentionBadge pages={[page]} state={attention}/></a>)}</nav>}
  <div className="sv2-ph"><div><h2>{title}</h2><p>{sub}</p></div>{action}</div>
 </>;
}
