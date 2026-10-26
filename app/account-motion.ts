'use client';
import {useEffect,useRef} from 'react';

/** One persistent underline, measured from actual RTL controls rather than index order. */
export function useAccountUnderline(selection:string){
 const ref=useRef<HTMLElement|null>(null);
 useEffect(()=>{
  const root=ref.current;if(!root)return;
  const measure=()=>{const active=root.querySelector<HTMLElement>('[aria-current="page"], [data-state="active"]');if(!active){root.removeAttribute('data-marker-ready');return;}const box=active.getBoundingClientRect(),parent=root.getBoundingClientRect();if(!box.width)return;root.style.setProperty('--marker-x',`${box.left-parent.left+box.width*.22}px`);root.style.setProperty('--marker-y',`${box.bottom-parent.top-5}px`);root.style.setProperty('--marker-width',`${box.width*.56}px`);root.setAttribute('data-marker-ready','true');};
  const frame=requestAnimationFrame(measure);const observer=typeof ResizeObserver==='undefined'?null:new ResizeObserver(measure);observer?.observe(root);window.addEventListener('resize',measure);
  return()=>{cancelAnimationFrame(frame);observer?.disconnect();window.removeEventListener('resize',measure);};
 },[selection]);
 return ref;
}
