'use client';
import {useEffect,useRef} from 'react';
import {api} from './client';

// Poll a tiny version record, not the entire catalog. Refresh only price-related
// data, preserving navigation, scroll position and unsaved content/billing forms.
export function useLivePricing(version:number|undefined,onRefresh:(active:()=>boolean)=>Promise<void>,enabled=true,scope='customer'){
 const latest=useRef({version,onRefresh});latest.current={version,onRefresh};
 useEffect(()=>{
  if(!enabled)return;
  let active=true,running=false;
  const poll=async()=>{
   if(!active||running||document.hidden||latest.current.version==null)return;
   running=true;
   try{
    const result=await api('pricing-version','GET',undefined,{background:true});
    if(active&&Number.isSafeInteger(result.pricing_version)&&result.pricing_version!==latest.current.version)
     await latest.current.onRefresh(()=>active);
   }catch{ /* Keep the current UI usable; retry on the next tick/focus. */ }
   finally{running=false;}
  };
  const interval=setInterval(poll,5000);
  const visible=()=>{if(!document.hidden)void poll();};
  document.addEventListener('visibilitychange',visible);
  window.addEventListener('focus',visible);
  void poll();
  return()=>{active=false;clearInterval(interval);document.removeEventListener('visibilitychange',visible);window.removeEventListener('focus',visible);};
 },[enabled,scope]);
}
