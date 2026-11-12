'use client';
// Agency centre, "buying for a customer" (design/agency-dashboard/spec.md 5.6 and 7): while an agency buys for one of
// its customers, the catalog shows a strip with the customer's name, hides (or keeps, by the customer's setting) the
// sites already used for that customer, adds the customer to every item put in the cart, and asks before adding a site
// that was already used. The server refuses such a site without the confirmation anyway.
import React,{useEffect,useState} from 'react';
import {TriangleAlert,X,EyeOff,Eye,CalendarCheck,Users} from 'lucide-react';
import {api} from '@/lib/client';
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
// The used-site list of the customer being bought for: which catalog sites to hide, and the customer's setting.
export function useUsedSites(buying:Buying,revision=0){
 const [state,setState]=useState<{mode:string;hidden:Set<string>}|null>(null);
 useEffect(()=>{if(!buying){setState(null);return;}let live=true;api('agency/customers/'+encodeURIComponent(buying.id)+'/used-sites','GET',undefined,{background:true}).then(d=>{if(live)setState({mode:d.mode,hidden:new Set(d.hidden_site_ids||[])});}).catch(()=>{if(live)setState(null);});return()=>{live=false;};},[buying?.id,revision]);
 return state;
}
export function catalogForBuying<T extends Row>(sites:T[],buying:Buying,used:{mode:string;hidden:Set<string>}|null){
 if(!buying||!used||used.mode!=='hide'||buying.show)return sites;
 return sites.filter(s=>!used.hidden.has(s.id));
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

export default function AgencyBuyingLayer({ctx,view,hiddenCount}:{ctx:Ctx;view:string;hiddenCount:number}){
 const agency=ctx.user?.role==='agency',buying=useBuyingFor(agency);
 const [ask,setAsk]=useState<{info:UsedInfo;resolve:(v:boolean)=>void}|null>(null);
 useEffect(()=>{const on=(e:Event)=>{const d=(e as CustomEvent).detail;d.handled=true;setAsk({info:d.info,resolve:d.resolve});};window.addEventListener(CONFIRM,on);return()=>window.removeEventListener(CONFIRM,on);},[]);
 const answer=(v:boolean)=>{ask?.resolve(v);setAsk(null);};
 useEffect(()=>{if(!ask)return;const key=(e:KeyboardEvent)=>{if(e.key==='Escape')answer(false);};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);});
 const catalogView=['catalog','offers'].includes(String(view||'catalog').split('/')[0]);
 return <>
  {buying&&catalogView&&<div className="agc-bar" role="region" aria-label="רכישה עבור לקוח">
   <span className="ag-av" aria-hidden="true" style={{background:'#1673e6'}}>{buying.name.charAt(0)}</span>
   <span><small>רוכשים עבור</small><b>{buying.name}</b></span>
   {hiddenCount>0||buying.show?<button type="button" className="hid" onClick={()=>setBuyingFor({...buying,show:!buying.show})}>{buying.show?<Eye size={15}/>:<EyeOff size={15}/>}{buying.show?'מוצגים גם אתרים שכבר שימשו · ':'הוסתרו '+hiddenCount+' אתרים שכבר שימשו · '}<u>{buying.show?'הסתרה':'הצגה'}</u></button>:null}
   <span className="grow"/>
   <button type="button" className="ag-btn ghost sm" aria-label="החלפת לקוח" onClick={()=>ctx.go('purchased/agency/customers')}><Users size={15}/><span className="lbl">החלפת לקוח</span></button>
   <button type="button" className="ag-btn ghost sm" aria-label="יציאה ממצב לקוח" onClick={()=>setBuyingFor(null)}><X size={15}/><span className="lbl">יציאה ממצב לקוח</span></button>
  </div>}
  {ask&&<><div className="agc-dim" onClick={()=>answer(false)}/><div className="agc-dialog" role="alertdialog" aria-modal="true" aria-labelledby="agc-used-title" aria-describedby="agc-used-text" dir="rtl">
   <span className="ic"><TriangleAlert size={24}/></span>
   <h2 id="agc-used-title">האתר כבר שימש עבור {ask.info.customer}</h2>
   <p id="agc-used-text">להוסיף בכל זאת את <b>{ask.info.site}</b> לסל עבור הלקוח?</p>
   <div className="used"><CalendarCheck size={16}/><span>{ask.info.source==='system'?<>פורסם עבור הלקוח{ask.info.date?<> ב-<bdi>{day(ask.info.date)}</bdi></>:null}{ask.info.number?<> · הזמנה <bdi>{ask.info.number}</bdi></>:null}</>:<>ברשימת האתרים שכבר שימשו{ask.info.date?<> (נוסף <bdi>{day(ask.info.date)}</bdi>)</>:null}</>}</span></div>
   <div className="acts"><button type="button" className="ag-btn primary" autoFocus onClick={()=>answer(false)}>לא, חזרה לקטלוג</button><button type="button" className="ag-btn ghost" onClick={()=>answer(true)}>להוסיף בכל זאת</button></div>
  </div></>}
 </>;
}
