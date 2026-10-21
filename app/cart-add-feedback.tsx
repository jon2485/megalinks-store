'use client';
import React,{useEffect,useRef,useState} from 'react';
import {Check} from 'lucide-react';
import {Button} from '@/components/ui/button';

export const CART_ADDED_DURATION=2400;
const eventName='megalinks:cart-added';
export function notifyCartAdded(websiteId:string){
 if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent(eventName,{detail:{websiteId}}));
}
export function CartFeedbackButton({websiteId,enabled=true,disabled=false,onClick,className,label,icon}:{websiteId:string;enabled?:boolean;disabled?:boolean;onClick:()=>void;className:string;label:string;icon:React.ReactNode}){
 const [added,setAdded]=useState(false),timer=useRef<ReturnType<typeof setTimeout>|null>(null);
 useEffect(()=>{
  setAdded(false);
  if(!enabled)return;
  const confirmed=(event:Event)=>{
   if((event as CustomEvent).detail?.websiteId!==websiteId)return;
   if(timer.current)clearTimeout(timer.current);
   setAdded(true);timer.current=setTimeout(()=>{setAdded(false);timer.current=null;},CART_ADDED_DURATION);
  };
  window.addEventListener(eventName,confirmed);
  return()=>{window.removeEventListener(eventName,confirmed);if(timer.current)clearTimeout(timer.current);};
 },[websiteId,enabled]);
 return <Button type="button" disabled={disabled} onClick={onClick} className={'catalog-cart-feedback '+className} data-added={added} aria-live="polite" aria-atomic="true"><span className="catalog-cart-feedback-label flex-1">{added?'נוסף לסל':label}</span><span className="catalog-cart-feedback-icon grid size-7 shrink-0 place-items-center">{added?<Check size={18} aria-hidden="true"/>:icon}</span></Button>;
}
