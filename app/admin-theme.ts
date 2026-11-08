'use client';
import {useLayoutEffect,useState} from 'react';
// Light/dark choice for the admin "sky" look (08.11.2026). Shared by the work center and the side menu.
// Kept in the browser only. Read after mount so the server and the first client frame match.
export type AdminTheme='dark'|'light';
const KEY='wc2-theme',EVENT='admin-theme';
function stored():AdminTheme{try{return localStorage.getItem(KEY)==='light'?'light':'dark';}catch{return 'dark';}}
export function useAdminTheme():[AdminTheme,()=>void]{
 const [theme,setTheme]=useState<AdminTheme>('dark');
 useLayoutEffect(()=>{
  const sync=()=>{const t=stored();setTheme(t);document.documentElement.dataset.adminTheme=t;};
  sync();window.addEventListener(EVENT,sync);window.addEventListener('storage',sync);
  return()=>{window.removeEventListener(EVENT,sync);window.removeEventListener('storage',sync);};
 },[]);
 const toggle=()=>{const next:AdminTheme=stored()==='light'?'dark':'light';try{localStorage.setItem(KEY,next);}catch{}document.documentElement.dataset.adminTheme=next;setTheme(next);window.dispatchEvent(new Event(EVENT));};
 return [theme,toggle];
}
