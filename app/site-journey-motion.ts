'use client';
import {useEffect,useLayoutEffect,useRef} from 'react';
/** Preserve the departing chapter while React commits the arriving chapter. */
export function useSiteJourneyMotion(key:string,focusId:string){
 const viewport=useRef<HTMLDivElement>(null),page=useRef<HTMLDivElement>(null),ghost=useRef<HTMLDivElement>(null);
 const locked=useRef(false),prepared=useRef<{height:number;direction:number}|null>(null),animations=useRef<Animation[]>([]);
 const focus=useRef(focusId);
 useLayoutEffect(()=>{focus.current=focusId;},[focusId]);
 const reduced=()=>typeof window==='undefined'||window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 const clean=()=>{animations.current.forEach(a=>a.cancel());animations.current=[];ghost.current?.replaceChildren();if(viewport.current){viewport.current.style.height='';viewport.current.style.overflow='';}locked.current=false;prepared.current=null;};
 const prepare=(direction=1)=>{
  if(locked.current)return false;
  if(!viewport.current||!page.current||!ghost.current||reduced())return true;
  locked.current=true;
  const clone=page.current.cloneNode(true) as HTMLElement;clone.removeAttribute('id');clone.querySelectorAll('[id]').forEach(n=>n.removeAttribute('id'));clone.querySelectorAll('input,textarea,button').forEach(n=>n.setAttribute('disabled',''));clone.inert=true;
  ghost.current.replaceChildren(clone);prepared.current={height:viewport.current.getBoundingClientRect().height,direction};return true;
 };
 useLayoutEffect(()=>{
  const pending=prepared.current,container=viewport.current,current=page.current,old=ghost.current;
  if(!container||!current)return;
  const focusNext=()=>{const element=document.getElementById(focus.current);element?.focus({preventScroll:true});element?.scrollIntoView({block:'nearest',behavior:reduced()?'auto':'smooth'});};
  if(!pending||!old||reduced()||!current.animate){clean();if(key!=='intro')focusNext();return;}
  const nextHeight=current.getBoundingClientRect().height;container.style.height=pending.height+'px';container.style.overflow='clip';
  const timing={duration:420,easing:'cubic-bezier(.16,1,.3,1)',fill:'both' as FillMode};
  animations.current=[current.animate([{transform:`translateX(${-pending.direction*100}%)`,opacity:.5},{transform:'translateX(0)',opacity:1}],timing),old.animate([{transform:'translateX(0)',opacity:1},{transform:`translateX(${pending.direction*100}%)`,opacity:.15}],{...timing,duration:320}),container.animate([{height:pending.height+'px'},{height:nextHeight+'px'}],timing)];
  let active=true;void Promise.all(animations.current.map(a=>a.finished.catch(()=>{}))).then(()=>{if(active){clean();focusNext();}});return()=>{active=false;};
  // The committed chapter controls playback; focus and preparation are mutable.
 },[key]);
 useEffect(()=>()=>clean(),[]);
 return {viewport,page,ghost,locked,prepare};
}
