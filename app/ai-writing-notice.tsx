'use client';
import React,{useEffect,useState} from 'react';
import {Check,PenLine} from 'lucide-react';
import './ai-writing-notice.css';

// Owner 27.11.2026: while the AI writes, a green check with a moving pen, and "עובדים על המאמר שלך" whose dots grow
// and shrink back (. .. ... .. .) so it feels like it is being written. Reduced motion: still "...".
const steps=[1,2,3,2];
export function WritingDots(){
 const [i,setI]=useState(2);
 useEffect(()=>{if(typeof window!=='undefined'&&window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)return;const t=setInterval(()=>setI(v=>(v+1)%steps.length),480);return()=>clearInterval(t);},[]);
 return <span className="aiw-dots" aria-hidden="true"><span>{'.'.repeat(steps[i])}</span></span>;
}
/** The green check; `writing` adds the moving pen and its line. */
export function WritingMark({writing=true}:{writing?:boolean}){
 return <span className={'aiw-mark'+(writing?' is-writing':'')} aria-hidden="true">
  <span className="aiw-check"><Check size={26} strokeWidth={3}/></span>
  {writing&&<span className="aiw-pen"><PenLine size={15} strokeWidth={2.4}/></span>}
 </span>;
}
export function WritingTitle({working,doneText='המאמר מוכן לעריכה'}:{working:boolean;doneText?:string}){
 // the last word and the dots never split across lines
 return working?<>עובדים על המאמר <span className="aiw-last">שלך<WritingDots/></span></>:<>{doneText}</>;
}
