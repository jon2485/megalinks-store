'use client';
import {useEffect,useRef} from 'react';
import {Button} from '@/components/ui/button';
import type {Ctx} from './workspace';

/** Opt-in guard for the new full-page editors. Each independently saved form
 * owns its own key, so saving one panel cannot clear another panel's draft. */
export function useAdminDraftGuard(ctx:Ctx) {
 const keys=useRef(new Set<string>()),path=useRef(''),open=useRef(ctx.open);
 useEffect(()=>{open.current=ctx.open;},[ctx.open]);
 const mark=(key:string,dirty:boolean)=>{if(dirty){path.current=window.location.pathname+window.location.search;keys.current.add(key);}else keys.current.delete(key);window.dispatchEvent(new CustomEvent('postflow:dirty',{detail:keys.current.size>0}));};
 useEffect(()=>{
  const before=(event:BeforeUnloadEvent)=>{if(keys.current.size){event.preventDefault();event.returnValue='';}};
  const back=(event:PopStateEvent)=>{if(!keys.current.size)return;event.stopImmediatePropagation();const target=window.location.pathname+window.location.search;window.history.pushState({},'',path.current);open.current({title:'יש שינויים שלא נשמרו',description:'אפשר לחזור לעריכה או לצאת בלי לשמור.',render:(close:()=>void)=><div className="flex-row flex-wrap"><Button onClick={close}>חזרה לעריכה</Button><Button variant="outline" onClick={()=>{keys.current.clear();window.dispatchEvent(new CustomEvent('postflow:dirty',{detail:false}));close();window.location.assign(target);}}>יציאה ללא שמירה</Button></div>});};
  window.addEventListener('beforeunload',before);window.addEventListener('popstate',back,true);
  return()=>{window.removeEventListener('beforeunload',before);window.removeEventListener('popstate',back,true);window.dispatchEvent(new CustomEvent('postflow:dirty',{detail:false}));};
 },[]);
 const confirm=(proceed:()=>void)=>{
  if(!keys.current.size){proceed();return;}
  ctx.open({title:'יש שינויים שלא נשמרו',description:'אפשר לחזור לעריכה או לצאת בלי לשמור את השינויים.',render:(close:()=>void)=><div className="flex-row flex-wrap"><Button onClick={close}>חזרה לעריכה</Button><Button variant="outline" onClick={()=>{keys.current.clear();window.dispatchEvent(new CustomEvent('postflow:dirty',{detail:false}));close();proceed();}}>יציאה ללא שמירה</Button></div>});
 };
 return {mark,confirm};
}
