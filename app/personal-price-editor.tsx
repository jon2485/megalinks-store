'use client';
import React,{useEffect,useRef,useState} from 'react';
import {Input} from '@/components/ui/input';
import {pricingApi} from '@/lib/client';
import {money,type Row} from '@/lib/shared';
import {ErrorBox,type Ctx} from './workspace';
// Owner 22.11.2026: the price field first, the reference prices as one compact card, and on a phone the sheet sits above the keyboard.
export default function PersonalPriceEditor({ctx,customer,site,version,close}:{ctx:Ctx;customer:Row;site:Row;version:number;close:()=>void}){
 const[value,setValue]=useState(String((site.personal_price??site.price_cents)/100)),[busy,setBusy]=useState(false),[error,setError]=useState('');const lock=useRef(false),form=useRef<HTMLFormElement>(null);
 // On a touch phone the keyboard opens only when the field is tapped, not when the sheet opens.
 const[touch]=useState(()=>typeof window!=='undefined'&&window.matchMedia('(pointer:coarse)').matches);
 // iOS does not shrink the page for the keyboard, so a bottom sheet stays behind it. Follow the visible area instead.
 useEffect(()=>{
  const dialog=form.current?.closest<HTMLElement>('[data-slot=dialog-content]'),visual=window.visualViewport;
  if(!dialog||!visual)return;
  const fit=()=>{const keyboard=Math.max(0,window.innerHeight-visual.offsetTop-visual.height);dialog.style.setProperty('--pp-keyboard',keyboard+'px');dialog.style.setProperty('--pp-visible',visual.height+'px');};
  fit();visual.addEventListener('resize',fit);visual.addEventListener('scroll',fit);
  return()=>{visual.removeEventListener('resize',fit);visual.removeEventListener('scroll',fit);dialog.style.removeProperty('--pp-keyboard');dialog.style.removeProperty('--pp-visible');};
 },[]);
 const save=async(remove=false)=>{if(lock.current)return;const amount=Number(value),cents=Math.round(amount*100);if(!remove&&(value.trim()===''||!Number.isFinite(amount)||amount<0||Math.abs(amount*100-cents)>.00001)){setError('יש להזין מחיר תקין בשקלים, עד שתי ספרות אחרי הנקודה.');return;}lock.current=true;setBusy(true);setError('');try{await ctx.run(()=>pricingApi('admin/pricing/overrides','POST',{scope:'user',owner_id:customer.id,version,rows:[remove?{website_id:site.id,action:'remove'}:{website_id:site.id,price_ils:amount}]}),remove?'המחיר האישי הוסר - הלקוח יקבל את מחיר הרמה שלו':'המחיר האישי נשמר ללקוח זה בלבד');close();}catch(e){setError((e as Error).message);}finally{lock.current=false;setBusy(false);}};
 const shown=(price:unknown)=>price==null?'לא הוגדר':money(Number(price));
 return <form ref={form} className="personal-price-editor om-pay-form" dir="rtl" onSubmit={e=>{e.preventDefault();void save();}}>
  <label className="pp-field">מחיר ללקוח זה בלבד<span className="pp-input"><Input autoFocus={!touch} required type="number" inputMode="decimal" min="0" step="0.01" value={value} disabled={busy} onChange={e=>setValue(e.target.value)} aria-describedby="pp-hint"/><span aria-hidden="true">₪</span></span></label>
  <p id="pp-hint" className="pp-hint">יחול על הזמנות חדשות של {customer.name} בלבד.<span className="pp-more"> המחירון הכללי ולקוחות אחרים לא משתנים.</span></p>
  <dl className="pp-summary">
   <div><dt>מחירון</dt><dd><bdi>{shown(site.base_price)}</bdi></dd></div>
   <div><dt>לפי רמה</dt><dd><bdi>{shown(site.tier_price)}</bdi></dd></div>
   <div className="is-now"><dt>מוצג כרגע</dt><dd><bdi>{shown(site.price_cents)}</bdi>{site.personal_price!=null&&<small> (אישי)</small>}</dd></div>
   <div><dt>עלות</dt><dd><bdi>{shown(site.cost_cents)}</bdi></dd></div>
  </dl>
  <p className="pp-vat">כל המחירים לפני מע״מ.<span className="pp-more"> מחיר אישי גובר על מחיר רמה ומבצעים.</span></p>
  {site.personal_price!=null&&<button type="button" className="pp-reset" disabled={busy} onClick={()=>void save(true)}>הסרת המחיר האישי וחזרה למחיר לפי רמה</button>}
  <ErrorBox error={error}/>
  <div className="om-pay-actions"><button type="submit" className="om-btn is-primary" disabled={busy}>{busy?'שומר…':'שמירת המחיר'}</button><button type="button" className="om-btn" disabled={busy} onClick={close}>ביטול</button></div>
 </form>;
}
