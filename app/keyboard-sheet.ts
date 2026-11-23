'use client';
import {useEffect,type RefObject} from 'react';

/* Phones (owner 23.11.2026: "the popup jumps up and it is very hard to type"). When the keyboard opens, iOS does not
   shrink the page; it covers its bottom and slides the page up to show the field, so a bottom sheet pinned to the page
   bottom ends up under the keyboard and its fields under the header. This keeps the popup that holds `ref` on the part of
   the screen the keyboard leaves free: it writes that free height (--kb-room) and the keyboard height (--kb-bottom) on the
   dialog, marks it with data-typing while a field is in use (customer-dialog-sky.css makes the header small then), and
   scrolls the focused field to the middle of the popup's own scrolling body, never the page. Desktop and phones without
   visualViewport keep the plain CSS sheet. */
const TYPED='input:not([type=checkbox]):not([type=radio]):not([type=file]):not([type=button]):not([type=submit]),textarea,select';

export function useKeyboardSheet(ref:RefObject<HTMLElement|null>,bodySelector:string){
 useEffect(()=>{
  const sheet=ref.current?.closest<HTMLElement>('[data-slot=dialog-content]'),vv=typeof window!=='undefined'?window.visualViewport:null;
  if(!sheet||!vv)return;
  let frame=0,later=0;
  const typingIn=()=>{const el=document.activeElement;return el instanceof HTMLElement&&sheet.contains(el)&&el.matches(TYPED)?el:null;};
  const reveal=()=>{const el=typingIn(),body=el?.closest<HTMLElement>(bodySelector);if(!el||!body)return;
   const field=el.closest<HTMLElement>('.field,label')||el,box=body.getBoundingClientRect(),at=field.getBoundingClientRect();
   if(at.top>=box.top+8&&at.bottom<=box.bottom-8)return;
   body.scrollTop+=at.top+at.height/2-(box.top+box.height/2);};
  const place=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{
   const below=Math.max(0,Math.round(window.innerHeight-vv.height-vv.offsetTop));
   sheet.style.setProperty('--kb-bottom',below+'px');sheet.style.setProperty('--kb-room',Math.round(vv.height)+'px');
   sheet.toggleAttribute('data-typing',!!typingIn()&&vv.height<640);
   reveal();});};
  const focus=()=>{place();clearTimeout(later);later=window.setTimeout(place,350);};
  place();
  vv.addEventListener('resize',place);vv.addEventListener('scroll',place);
  sheet.addEventListener('focusin',focus);sheet.addEventListener('focusout',focus);
  return ()=>{cancelAnimationFrame(frame);clearTimeout(later);vv.removeEventListener('resize',place);vv.removeEventListener('scroll',place);
   sheet.removeEventListener('focusin',focus);sheet.removeEventListener('focusout',focus);
   sheet.style.removeProperty('--kb-bottom');sheet.style.removeProperty('--kb-room');sheet.removeAttribute('data-typing');};
 },[ref,bodySelector]);
}
