'use client';
import {useLayoutEffect,useState} from 'react';
// Light/dark choice for the admin "sky" look (08.11.2026). Shared by the work center and the side menu.
// Kept in the browser only. Read after mount so the server and the first client frame match.
export type AdminTheme='dark'|'light';
const KEY='wc2-theme',EVENT='admin-theme';
// Light is the default from 09.11.2026 (owner's decision); dark only when chosen.
function stored():AdminTheme{try{return localStorage.getItem(KEY)==='dark'?'dark':'light';}catch{return 'light';}}
export function useAdminTheme():[AdminTheme,()=>void]{
 const [theme,setTheme]=useState<AdminTheme>('light');
 useLayoutEffect(()=>{
  const sync=()=>{const t=stored();setTheme(t);document.documentElement.dataset.adminTheme=t;};
  sync();window.addEventListener(EVENT,sync);window.addEventListener('storage',sync);
  return()=>{window.removeEventListener(EVENT,sync);window.removeEventListener('storage',sync);};
 },[]);
 const toggle=()=>{const next:AdminTheme=stored()==='light'?'dark':'light';try{localStorage.setItem(KEY,next);}catch{}document.documentElement.dataset.adminTheme=next;setTheme(next);window.dispatchEvent(new Event(EVENT));};
 return [theme,toggle];
}
