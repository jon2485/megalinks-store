'use client';
import React,{useEffect,useRef,useState} from 'react';
import {Check} from 'lucide-react';
import {Button} from '@/components/ui/button';

const eventName='megalinks:cart-added';
export function notifyCartAdded(websiteId:string){
 if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent(eventName,{detail:{websiteId}}));
}
export function CartFeedbackButton({websiteId,enabled=true,onClick,className,label,icon}:{websiteId:string;enabled?:boolean;onClick:()=>void;className:string;label:string;icon:React.ReactNode}){
 const [added,setAdded]=useState(false),timer=useRef<ReturnType<typeof setTimeout>|null>(null);
 useEffect(()=>{
  if(!enabled)return;
  const confirmed=(event:Event)=>{
   if((event as CustomEvent).detail?.websiteId!==websiteId)return;
   if(timer.current)clearTimeout(timer.current);
   setAdded(true);timer.current=setTimeout(()=>{setAdded(false);timer.current=null;},2400);
  };
  window.addEventListener(eventName,confirmed);
  return()=>{window.removeEventListener(eventName,confirmed);if(timer.current)clearTimeout(timer.current);};
 },[websiteId,enabled]);
 return <Button type="button" onClick={onClick} className={'catalog-cart-feedback '+className} data-added={added} aria-live="polite" aria-atomic="true"><span className="flex-1">{added?'נוסף לסל':label}</span><span className="grid size-7 shrink-0 place-items-center">{added?<Check size={18} aria-hidden="true"/>:icon}</span></Button>;
}
