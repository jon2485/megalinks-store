'use client';
// Agency centre, "buying for a customer" (design/agency-dashboard/spec.md 5.6 and 7): while an agency buys for one of
// its customers, the catalog shows a strip with the customer's name, hides (or keeps, by the customer's setting) the
// sites already used for that customer, adds the customer to every item put in the cart, and asks before adding a site
// that was already used. The server refuses such a site without the confirmation anyway.
import React,{useEffect,useState} from 'react';
import {X,EyeOff,CalendarCheck,Users,History,Check} from 'lucide-react';
import {api} from '@/lib/client';
import {hasAgencyCentre} from '@/lib/agency-shared';
import type {Row} from '@/lib/shared';
import type {Ctx} from './workspace';
import './agency-center.css';

type Buying={id:string;name:string;show?:boolean}|null;
const KEY='megalinks:agency-buying-for',EVENT='megalinks:agency-buying',CONFIRM='megalinks:used-site-confirm';
export function getBuyingFor():Buying{try{const v=JSON.parse(sessionStorage.getItem(KEY)||'null');return v&&typeof v.id==='string'&&v.id?v:null;}catch{return null;}}
export function setBuyingFor(value:Buying){try{if(value)sessionStorage.setItem(KEY,JSON.stringify(value));else sessionStorage.removeItem(KEY);}catch{}window.dispatchEvent(new Event(EVENT));}
export function useBuyingFor(enabled:boolean){
 const [value,setValue]=useState<Buying>(null);
 useEffect(()=>{if(!enabled){setValue(null);return;}const read=()=>setValue(getBuyingFor());read();window.addEventListener(EVENT,read);return()=>window.removeEventListener(EVENT,read);},[enabled]);
 return enabled?value:null;
}
// The used-site list of the customer being bought for: which catalog sites were used, when, and the customer's setting.
type Used={mode:string;hidden:Set<string>;info:Record<string,Row>};
export function useUsedSites(buying:Buying,revision=0){
 const [state,setState]=useState<Used|null>(null);
 useEffect(()=>{if(!buying){setState(null);return;}let live=true;api('agency/customers/'+encodeURIComponent(buying.id)+'/used-sites','GET',undefined,{background:true}).then(d=>{if(live)setState({mode:d.mode,hidden:new Set(d.hidden_site_ids||[]),info:d.used||{}});}).catch(()=>{if(live)setState(null);});return()=>{live=false;};},[buying?.id,revision]);
 return state;
}
// "hide": used sites are left out. Otherwise they stay in the catalog with a green "שומש עבור" line, after the others.
export function catalogForBuying<T extends Row>(sites:T[],buying:Buying,used:Used|null){
 if(!buying||!used||!used.hidden.size)return sites;
 if(used.mode==='hide'&&!buying.show)return sites.filter(s=>!used.hidden.has(s.id));
 const fresh:T[]=[],old:T[]=[];
 for(const s of sites)if(used.hidden.has(s.id))old.push({...s,used_for_customer:{...(used.info[s.id]||{}),customer:buying.name}});else fresh.push(s);
 return [...fresh,...old];
}
type UsedInfo={site:string;customer:string;source:'system'|'manual';date?:string;number?:string};
function confirmUsedSite(info:UsedInfo){return new Promise<boolean>(resolve=>{const detail={info,resolve,handled:false};window.dispatchEvent(new CustomEvent(CONFIRM,{detail}));if(!detail.handled)resolve(window.confirm('האתר '+info.site+' כבר שימש עבור '+info.customer+'. להוסיף בכל זאת?'));});}
// Posts a cart item; when the server says the site was already used for the customer, asks, and sends again if confirmed.
export async function addToCartChecked(payload:Row,options?:Row){
 try{return await api('cart','POST',payload,options);}
 catch(e){const text=String((e as Error).message||''),at=text.indexOf('USED_SITE:');if(at<0)throw e;
  let info:UsedInfo;try{info=JSON.parse(text.slice(at+10));}catch{throw new Error('האתר כבר שימש עבור הלקוח.');}
  if(!await confirmUsedSite(info))return null;
  return await api('cart','POST',{...payload,confirm_used_site:true},options);}
}
// The same for a cart item edit (for example choosing another customer for it in the cart).
export async function patchCartChecked(id:string,payload:Row){
 try{return await api('cart/'+id,'PATCH',payload);}
 catch(e){const text=String((e as Error).message||''),at=text.indexOf('USED_SITE:');if(at<0)throw e;
  let info:UsedInfo;try{info=JSON.parse(text.slice(at+10));}catch{throw new Error('האתר כבר שימש עבור הלקוח.');}
  if(!await confirmUsedSite(info))return null;
  return await api('cart/'+id,'PATCH',{...payload,confirm_used_site:true});}
}
const day=(iso?:string)=>iso?new Date(iso).toLocaleDateString('he-IL',{timeZone:'Asia/Jerusalem'}):'';

export default function AgencyBuyingLayer({ctx,view,hiddenCount,usedCount}:{ctx:Ctx;view:string;hiddenCount:number;usedCount:number}){
 const agency=hasAgencyCentre(ctx.user),buying=useBuyingFor(agency);
 const [ask,setAsk]=useState<{info:UsedInfo;resolve:(v:boolean)=>void}|null>(null);
 useEffect(()=>{const on=(e:Event)=>{const d=(e as CustomEvent).detail;d.handled=true;setAsk({info:d.info,resolve:d.resolve});};window.addEventListener(CONFIRM,on);return()=>window.removeEventListener(CONFIRM,on);},[]);
 const answer=(v:boolean)=>{ask?.resolve(v);setAsk(null);};
 useEffect(()=>{if(!ask)return;const key=(e:KeyboardEvent)=>{if(e.key==='Escape')answer(false);};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);});
 const catalogView=['catalog','offers'].includes(String(view||'catalog').split('/')[0]);
 const hidden=hiddenCount>0;
 return <>
  {buying&&catalogView&&<div className="agc-bar" role="region" aria-label={'מחירון עבור '+buying.name}>
   <span className="ag-av" aria-hidden="true">{buying.name.charAt(0)}</span>
   <span className="who"><small>המחירון עבור הלקוח</small><b>{buying.name}</b></span>
   {usedCount>0&&<span className="used-note">{hidden?<><EyeOff size={15} aria-hidden="true"/>הוסתרו <bdi>{usedCount}</bdi> אתרים שכבר שומשו ללקוח</>:<><span className="dot" aria-hidden="true"><Check size={11} strokeWidth={3}/></span><bdi>{usedCount}</bdi> אתרים כבר שומשו ללקוח ומסומנים בכרטיס</>}
    {(hidden||buying.show)&&<button type="button" onClick={()=>setBuyingFor({...buying,show:hidden})}>{hidden?'הצגה':'הסתרה'}</button>}</span>}
   <span className="grow"/>
   <button type="button" className="ag-btn ghost sm" aria-label="החלפת לקוח" onClick={()=>ctx.go('purchased/agency/customers')}><Users size={15} aria-hidden="true"/><span className="lbl">החלפת לקוח</span></button>
   <button type="button" className="ag-btn ghost sm" aria-label="יציאה מהמחירון של הלקוח" onClick={()=>setBuyingFor(null)}><X size={15} aria-hidden="true"/><span className="lbl">יציאה</span></button>
  </div>}
  {ask&&<><div className="agc-dim" onClick={()=>answer(false)}/><div className="agc-dialog" role="alertdialog" aria-modal="true" aria-labelledby="agc-used-title" aria-describedby="agc-used-text" dir="rtl">
   <span className="ic"><History size={22} aria-hidden="true"/></span>
   <h2 id="agc-used-title"><bdi>{ask.info.site}</bdi> כבר שומש עבור {ask.info.customer}</h2>
   <div className="used"><CalendarCheck size={17} aria-hidden="true"/><span>{ask.info.source==='system'?<>פורסם ללקוח{ask.info.date?<> ב־<bdi>{day(ask.info.date)}</bdi></>:null}{ask.info.number?<> · הזמנה <bdi>{ask.info.number}</bdi></>:null}</>:<>נמצא ברשימת האתרים שכבר שומשו ללקוח{ask.info.date?<> (נוסף ב־<bdi>{day(ask.info.date)}</bdi>)</>:null}</>}</span></div>
   <p id="agc-used-text">להוסיף אותו שוב לסל עבור הלקוח?</p>
   <div className="acts"><button type="button" className="ag-btn primary" autoFocus onClick={()=>answer(false)}>לא להוסיף</button><button type="button" className="ag-btn ghost" onClick={()=>answer(true)}>כן, להוסיף שוב</button></div>
  </div></>}
 </>;
}
