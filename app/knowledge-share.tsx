'use client';
import {useState,useRef} from 'react';
import {Copy,Check,Share2} from 'lucide-react';
export function KnowledgeShare({title,disabled=false}:{title:string;disabled?:boolean}){
 const [copied,setCopied]=useState(false),[error,setError]=useState('');const lock=useRef(false);
 const copy=async()=>{if(lock.current)return;lock.current=true;try{await navigator.clipboard.writeText(window.location.href);setCopied(true);setError('');}catch{setError('לא ניתן להעתיק. אפשר להעתיק את הכתובת משורת הכתובת.');}finally{lock.current=false;}};
 const share=async()=>{try{if(navigator.share)await navigator.share({title,url:window.location.href});else await copy();}catch(e){if((e as Error).name!=='AbortError')setError('השיתוף לא הצליח. נסו להעתיק את הקישור.');}};
 return <div className="knowledge-share"><button type="button" disabled={disabled} onClick={copy}>{copied?<Check size={17}/>:<Copy size={17}/>} {copied?'הקישור הועתק':'העתקת קישור'}</button><button type="button" disabled={disabled} onClick={share}><Share2 size={17}/>שיתוף</button><span className="sr-only" role="status">{copied?'הקישור הועתק':''}</span>{error&&<p role="alert">{error}</p>}</div>;
}
