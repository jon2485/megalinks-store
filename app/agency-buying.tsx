'use client';
// Agency centre, "buying for a customer" (design/agency-dashboard/spec.md 5.6 and 7): while an agency buys for one of
// its customers, the catalog shows a strip with the customer's name, hides (or keeps, by the customer's setting) the
// sites already used for that customer, adds the customer to every item put in the cart, and asks before adding a site
// that was already used. The server refuses such a site without the confirmation anyway.
import React,{useEffect,useRef,useState} from 'react';
import {X,EyeOff,CalendarCheck,Users,History,Check} from 'lucide-react';
import {api,useData} from '@/lib/client';
import {hasAgencyCentre,fillBriefDefaults,moveBriefDefaults,briefDefaultsUsed,briefDefaultsInput,BRIEF_DEFAULT_MAX} from '@/lib/agency-shared';
import {type Row,writingStyles} from '@/lib/shared';
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
// Brief defaults of the customer being bought for (spec 5.6, owner 13.11.2026): brand, audience and style only.
// Kept as a promise, so an add right after entering customer mode still waits for them; read again after a change.
// Returns the cart payload for that customer: the customer's id, and the defaults in the fields the buyer left empty.
// Outside customer mode the payload is returned as it is.
export function useBriefDefaults(buying:Buying,revision=0){
 const ref=useRef<Promise<{id:string;values:Row|null}>>(Promise.resolve({id:'',values:null}));
 useEffect(()=>{const id=buying?.id||'';ref.current=id?api('agency/customers/'+encodeURIComponent(id),'GET',undefined,{background:true}).then(d=>({id,values:d.customer?.brief_defaults||null})).catch(()=>({id,values:null})):Promise.resolve({id:'',values:null});},[buying?.id,revision]);
 return async(payload:Row)=>{if(!buying)return payload;const d=await ref.current;return fillBriefDefaults({...payload,customer_id:buying.id},d.id===buying.id?d.values:null).brief;};
}
// A cart item given to another customer takes that customer's defaults in place of the previous customer's; what the
// buyer typed stays. `customers` are the account's customer records as the cart already loads them.
export function withCustomerDefaults(item:Row,change:Row,customers:Row[]){
 if(change.customer_id===undefined||String(change.customer_id||'')===String(item.customer_id||''))return change;
 const of=(id:unknown)=>customers.find(c=>c.id===id)?.brief_defaults;
 return {...moveBriefDefaults(item,of(item.customer_id),of(change.customer_id)),...change};
}
// The quiet line in a brief form whose fields hold the customer's defaults. Only for the account itself, never in admin screens.
export function useBriefDefaultsNote(ctx:Ctx,customerId:string,brief:Row){
 const enabled=!!customerId&&hasAgencyCentre(ctx.user)&&!ctx.adminMode;
 const customer=useData(enabled?'agency/customers/'+encodeURIComponent(customerId):'',ctx.revision,enabled).data?.customer;
 // The style is left out: a brief with no style shows the first style anyway.
 return enabled&&customer&&briefDefaultsUsed(brief,customer.brief_defaults).some(key=>key!=='style')?<p className="agc-filled">מולא לפי ברירות המחדל של <bdi>{customer.name}</bdi></p>:null;
}
// In a brief of an article bought for one of the account's customers: the target links already sent for that customer,
// most used first, with how many times. A tap puts the link in the brief; typing a new one is always possible.
// A link used 3 times or more is marked, so the buyer can vary. Only for the account itself, never in admin screens.
export function CustomerLinkPicks({ctx,customerId,current,pick,disabled}:{ctx:Ctx;customerId:string;current:string;pick:(url:string)=>void;disabled?:boolean}){
 const enabled=!!customerId&&hasAgencyCentre(ctx.user)&&!ctx.adminMode,base='agency/customers/'+encodeURIComponent(customerId||'');
 const customer=useData(enabled?base:'',ctx.revision,enabled).data?.customer,links:Row[]=useData(enabled?base+'/links':'',ctx.revision,enabled).data?.links||[];
 if(!enabled||!customer||!links.length)return null;
 const now=String(current||'').trim().replace(/\/+$/,'');
 // When every link is on the customer's one site, the site is named once and each link shows only its page, so links
 // on a narrow phone do not all look the same.
 const host=(u:string)=>{try{return new URL(u).hostname.replace(/^www\./,'');}catch{return '';}},hosts=new Set(links.map(l=>host(String(l.target_url||'')))),one=hosts.size===1?[...hosts][0]:'';
 const label=(u:string)=>{if(!one)return u.replace(/^https?:\/\/(www\.)?/,'');try{const x=new URL(u),path=decodeURI(x.pathname+x.search).replace(/\/+$/,'');return path||'עמוד הבית';}catch{return u;}};
 return <div className="agc-links" role="group" aria-label={'קישורים שכבר נשלחו עבור '+customer.name}>
  <p>קישורים שכבר נשלחו עבור <bdi>{customer.name}</bdi>{one&&<> באתר <bdi dir="ltr">{one}</bdi></>}. בוחרים בלחיצה, או כותבים קישור חדש.</p>
  <div className="agc-links-row">{links.slice(0,8).map(l=>{const url=String(l.target_url||''),on=!!now&&url.replace(/\/+$/,'')===now;return <button key={url} type="button" className={'agc-link'+(on?' on':'')+(l.count>=3?' hot':'')} aria-pressed={on} disabled={disabled} onClick={()=>pick(url)}><bdi dir="ltr" title={url}>{label(url)}</bdi><span>{l.count===1?'פעם אחת':l.count+' פעמים'}</span></button>;})}</div>
 </div>;
}
// The "ברירות מחדל לבריף" part of the customer's details form in the centre (agency-center.tsx). Saved with the customer.
export const emptyBriefDefaults=(saved?:unknown):Record<string,string>=>({brand:'',audience:'',style:'',...briefDefaultsInput(saved).values});
export function BriefDefaultsFields({value,change,disabled}:{value:Record<string,string>;change:(key:string,value:string)=>void;disabled?:boolean}){
 const text=(key:string,label:string,placeholder?:string)=><label>{label}<input type="text" value={value[key]||''} maxLength={BRIEF_DEFAULT_MAX[key]} placeholder={placeholder} disabled={disabled} onChange={e=>change(key,e.target.value)}/></label>;
 return <div className="ag-bd" role="group" aria-label="ברירות מחדל לבריף">
  <h3>ברירות מחדל לבריף</h3>
  <p className="ag-bd-hint">מה שקבוע בכל הכתבות של הלקוח. נכנס לבריף לבד, ואפשר לשנות בכל כתבה. את הקישור, העוגן ומילות המפתח בוחרים בכל כתבה מחדש.</p>
  <div className="ag-form">
   {text('brand','שם העסק','למשל: קפה הבוקר')}
   {text('audience','קהל יעד','למשל: תושבי הצפון שאוהבים קפה')}
   <label>סגנון כתיבה<select value={value.style||''} disabled={disabled} onChange={e=>change('style',e.target.value)}><option value="">בלי ברירת מחדל</option>{writingStyles.map(style=><option key={style} value={style}>{style}</option>)}</select></label>
  </div>
 </div>;
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
