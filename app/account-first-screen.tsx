'use client';
import React,{useEffect,useRef} from 'react';
import {ChevronsDown} from 'lucide-react';
import {scrollAccountTo} from './account-scroll';
export default function AccountFirstScreen({children}:{children:React.ReactNode}){
 const ref=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  const root=ref.current;if(!root)return;
  const header=root.closest('.workspace-page-shell')?.querySelector<HTMLElement>('.workspace-site-header');
  const measure=()=>{root.style.setProperty('--account-intro-top',`${Math.max(0,root.getBoundingClientRect().top+window.scrollY)}px`);root.parentElement?.style.setProperty('--account-scroll-offset',`${(header?.getBoundingClientRect().height||64)+16}px`);};
  measure();const observer=typeof ResizeObserver==='undefined'?null:new ResizeObserver(measure);if(header)observer?.observe(header);window.addEventListener('resize',measure);
  const visible=()=>{root.dataset.cueVisible=String(!document.hidden&&root.getBoundingClientRect().bottom>0&&root.getBoundingClientRect().top<window.innerHeight);};
  visible();const intersection=typeof IntersectionObserver==='undefined'?null:new IntersectionObserver(visible);intersection?.observe(root);document.addEventListener('visibilitychange',visible);window.addEventListener('scroll',visible,{passive:true});
  return()=>{observer?.disconnect();intersection?.disconnect();window.removeEventListener('resize',measure);window.removeEventListener('scroll',visible);document.removeEventListener('visibilitychange',visible);};
 },[]);
 const scroll=()=>scrollAccountTo('client-hub-page-content');
 return <div ref={ref} className="account-mobile-first-screen">{children}<button type="button" className="account-scroll-cue" aria-label="גלילה לתוכן העמוד" onClick={scroll}><ChevronsDown size={24} aria-hidden="true"/></button></div>;
}
