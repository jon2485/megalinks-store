'use client';
// "מחיר מבצע ורמות מחיר" in a site card (owner 23.11.2026): what each price tier pays for this site after the tier's
// discount on all sites (e.g. 10% off: ₪200 → ₪180), with a manual price for this site that replaces the discount,
// and the site's own sale. Same pricing rules as the catalog: a customer pays the lower of the tier price and the sale.
import React from 'react';
import {Percent,RotateCcw,Tag} from 'lucide-react';
import {api,pricingApi} from '@/lib/client';
import type {Row} from '@/lib/shared';

export type Sale={on:boolean;price:string;title:string;ends:string};
const ils=(n:number)=>'₪'+(Math.round(n*100)/100).toLocaleString('he-IL',{maximumFractionDigits:2});
// Existing manual tier prices of one site, by tier id (shekels as text).
export function tierPricesOf(overrides:Row[]|undefined,siteId:string|undefined):Record<string,string>{
 const out:Record<string,string>={};if(!siteId)return out;
 for(const o of overrides||[])if(o.scope==='tier'&&o.website_id===siteId)out[String(o.owner_id)]=String(Number(o.price)/100);
 return out;
}

export function SitePricePlans({price,tiers,fixed,onFixed,sale,onSale,disabled}:{price:string|number;tiers:Row[];fixed:Record<string,string|null>;onFixed:(tierId:string,value:string|null)=>void;sale:Sale;onSale:(patch:Partial<Sale>)=>void;disabled?:boolean}){
 const list=Number(price),hasList=String(price).trim()!==''&&Number.isFinite(list)&&list>=0;
 const saleNum=sale.on&&String(sale.price).trim()!==''?Number(sale.price):null;
 return <div className="nsp-group spp">
  <h3><Percent size={16} aria-hidden="true"/>מחיר מבצע ורמות מחיר <small>מה הלקוח משלם בפועל, לפני מע״מ</small></h3>
  <ul className="spp-tiers">{tiers.map(t=>{const pct=Number(t.discount_bps||0)/100,auto=hasList?Math.round(list*(10000-Number(t.discount_bps||0)))/10000:null,manual=fixed[t.id];
   const pays=manual!=null&&manual!==''?Number(manual):auto,withSale=pays!=null&&saleNum!=null?Math.min(pays,saleNum):pays;
   return <li key={t.id} className={manual!=null?'is-manual':''}>
    <span className="spp-who"><b>{t.name}</b><small>{manual!=null?'מחיר ידני לאתר הזה':pct?pct+'% הנחה על כל האתרים':'בלי הנחה כללית'}</small></span>
    {manual!=null?<span className="spp-edit"><span className="nsp-money"><input type="number" inputMode="decimal" min={0} step="0.01" value={manual} disabled={disabled} aria-label={'מחיר ידני ל'+t.name} onChange={e=>onFixed(t.id,e.target.value)}/><i>₪</i></span>
      <button type="button" className="spp-link" disabled={disabled} onClick={()=>onFixed(t.id,null)}><RotateCcw size={14} aria-hidden="true"/>{pct?'חזרה ל־'+pct+'%':'חזרה למחירון'}</button></span>
     :<span className="spp-auto"><b>{auto==null?'—':ils(auto)}</b>{pct>0&&hasList&&<s>{ils(list)}</s>}<button type="button" className="spp-link" disabled={disabled} onClick={()=>onFixed(t.id,auto==null?'':String(auto))}>שינוי ידני</button></span>}
    {saleNum!=null&&withSale!=null&&withSale<(pays??Infinity)&&<small className="spp-salenote">במבצע משלמים {ils(withSale)}</small>}
   </li>;})}</ul>
  <label className={'spp-sale'+(sale.on?' is-on':'')}><input type="checkbox" checked={sale.on} disabled={disabled} onChange={e=>onSale({on:e.target.checked})}/><Tag size={16} aria-hidden="true"/><span><b>מבצע על האתר</b><small>מחיר מבצע לכל הלקוחות, מוצג כמבצע בקטלוג</small></span></label>
  {sale.on&&<div className="nsp-grid spp-salefields">
   <label className="nsp-f"><span className="nsp-lbl">מחיר מבצע</span><span className="nsp-money"><input type="number" inputMode="decimal" min={0} step="0.01" value={sale.price} disabled={disabled} onChange={e=>onSale({price:e.target.value})}/><i>₪</i></span></label>
   <label className="nsp-f"><span className="nsp-lbl">עד תאריך <small className="nsp-inline">לא חובה</small></span><input type="date" value={(sale.ends||'').slice(0,10)} disabled={disabled} onChange={e=>onSale({ends:e.target.value})}/></label>
   <label className="nsp-f is-wide"><span className="nsp-lbl">שם המבצע <small className="nsp-inline">לא חובה</small></span><input value={sale.title} disabled={disabled} maxLength={120} placeholder="למשל: מבצע חגים" onChange={e=>onSale({title:e.target.value})}/></label>
   {hasList&&saleNum!=null&&saleNum>=list&&<p className="nsp-calc is-red is-wide">מחיר המבצע צריך להיות נמוך מהמחירון ({ils(list)}).</p>}
  </div>}
  <p className="nsp-note">הלקוח משלם את הנמוך מבין מחיר הרמה שלו ומחיר המבצע. מחיר אישי ללקוח מסוים קודם לשניהם.</p>
 </div>;
}

// Save the manual tier prices that changed, one call per tier (a site has a handful of tiers at most).
export async function saveTierPrices(siteId:string,changes:Record<string,string|null>,before:Record<string,string>){
 const todo=Object.entries(changes).filter(([tier,value])=>value===null?before[tier]!==undefined:value!==''&&value!==before[tier]);
 if(!todo.length)return;
 let version=Number((await api('admin/pricing')).version);
 for(const [tier,value] of todo){
  const r=await pricingApi('admin/pricing/overrides','POST',{scope:'tier',owner_id:tier,version,rows:[value===null?{website_id:siteId,action:'remove'}:{website_id:siteId,price_ils:value}]});
  version=Number(r?.version??version+1);
 }
}
// The site's sale as the catalog stores it.
export const saleValues=(sale:Sale)=>({is_on_sale:sale.on,sale_price_ils:sale.on?sale.price:'',sale_title:sale.on?sale.title:'',sale_ends:sale.on&&sale.ends?sale.ends.slice(0,10)+'T23:59:59.999Z':''});
