'use client';
export function scrollAccountTo(id:'client-hub-page-content'|'client-hub-categories'){
 const target=document.getElementById(id);if(!target)return;
 target.focus({preventScroll:true});
 target.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});
}
