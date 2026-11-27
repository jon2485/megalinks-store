'use client';
import React,{useEffect,useState} from 'react';
import {AlertTriangle,FileText,Loader2,ShoppingCart} from 'lucide-react';
import {toast} from 'sonner';
import {api,useData} from '@/lib/client';
import {money,type Row} from '@/lib/shared';
import type {Ctx} from './workspace';
import './price-quotes.css';

// The customer's side of a price quote (owner 27.11.2026, mockups design/quotes 3-4).
const dateHe=(iso:string)=>new Intl.DateTimeFormat('he-IL',{day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(iso));
const seen=(id:string)=>{try{return sessionStorage.getItem('pq-later:'+id)==='1';}catch{return false;}};
const later=(id:string)=>{try{sessionStorage.setItem('pq-later:'+id,'1');}catch{}};
const linked=()=>typeof window==='undefined'?'':new URLSearchParams(window.location.search).get('quote')||'';

/** In the catalog: "קיבלת הצעת מחיר מס׳ X. להוסיף אותה לסל?". A visitor who came from the e-mail signs in first. */
export function QuotePrompt({ctx}:{ctx:Ctx}){
 const state=useData('quotes/pending',ctx.revision,!!ctx.user);
 const [closed,setClosed]=useState<string[]>([]),[busy,setBusy]=useState(false);
 useEffect(()=>{if(!ctx.user&&linked())window.location.assign('/signin-with-chatgpt?return_to='+encodeURIComponent(window.location.pathname+window.location.search));},[ctx.user]);
 const quotes:Row[]=state.data?.quotes||[],from=linked();
 const q=quotes.find(x=>!closed.includes(x.id)&&(x.id===from||!seen(x.id)));
 useEffect(()=>{if(!q)return;const prev=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{document.body.style.overflow=prev;};},[q?.id]);
 // The link's quote is not in the list: it expired, was approved already, or belongs to another account.
 const [missing,setMissing]=useState(false);
 useEffect(()=>{if(ctx.user&&from&&state.data&&!quotes.some(x=>x.id===from)&&!missing){setMissing(true);toast.message('ההצעה מהמייל כבר לא ממתינה לאישור. אם אישרתם אותה, היא בסל.');}},[ctx.user,from,state.data]);
 if(!q)return null;
 const close=()=>{later(q.id);setClosed(c=>[...c,q.id]);};
 const accept=async()=>{if(busy)return;setBusy(true);try{await api('quotes/'+q.id+'/accept','POST',{},{background:true});toast.success('האתרים מהצעה מס׳ '+q.number+' נוספו לסל');setClosed(c=>[...c,q.id]);ctx.refresh();ctx.go('cart');}catch(err){toast.error((err as Error).message);}finally{setBusy(false);}};
 return <div className="pqd-scrim" dir="rtl"><div className="pqd" role="dialog" aria-modal="true" aria-labelledby="pqd-title">
  <div className="pqd-head"><span className="pqd-ico" aria-hidden="true"><FileText size={28}/></span><h2 id="pqd-title">קיבלת הצעת מחיר מס׳ {q.number}<small>מחירים מיוחדים שהוכנו עבורך</small></h2></div>
  <div className="pqd-body">
   <div className="pqd-rows">{q.domain&&<div className="pqd-row"><span>לאתר</span><span><b><bdi dir="ltr">{q.domain}</bdi></b></span></div>}<div className="pqd-row"><span>כמות אתרים</span><span><b>{q.count}</b></span></div><div className="pqd-row is-exp"><span>בתוקף עד</span><span><b>{dateHe(q.expires)}</b></span></div></div>
   <h3 className="pqd-h3">האתרים בהצעה</h3>
   <div className="pqd-rows">{q.items.map((i:Row)=><div key={i.website_id} className="pqd-row"><span>{i.name}</span><span>{i.before_cents>i.price_cents&&<s>{money(i.before_cents)}</s>}{i.percent_off>0&&<em className="pqd-off" dir="ltr">-{i.percent_off}%</em>}<b>{money(i.price_cents)}</b></span></div>)}
    {q.saving_cents>0&&<div className="pqd-row is-save"><span>הנחה</span><span>{q.percent_off>0&&<em className="pqd-off" dir="ltr">-{q.percent_off}%</em>}<b>{money(q.saving_cents)}</b></span></div>}
    <div className="pqd-row is-total"><span>סה״כ לפני מע״מ</span><span>{q.before_cents>q.total_cents&&<s>{money(q.before_cents)}</s>}<b>{money(q.total_cents)}</b></span></div></div>
   <div className="pqd-acts"><button type="button" className="pq-btn is-white" disabled={busy} onClick={close}>לא עכשיו</button><button type="button" className="pq-btn is-orange" disabled={busy} onClick={()=>void accept()}>{busy?<Loader2 className="pq-spin" size={20}/>:<ShoppingCart size={20}/>}הוספה לסל</button></div>
  </div></div></div>;
}

/** In the cart, before a quote line is removed: the special prices of the whole quote will be cancelled. */
export function QuoteRemoveDialog({item,items,busy,onKeep,onRemove}:{item:Row;items:Row[];busy:boolean;onKeep:()=>void;onRemove:()=>void}){
 useEffect(()=>{const key=(e:KeyboardEvent)=>{if(e.key==='Escape')onKeep();};document.addEventListener('keydown',key);return()=>document.removeEventListener('keydown',key);},[onKeep]);
 const rest=items.filter(i=>i.quote_id===item.quote_id&&i.id!==item.id);
 const withQuote=rest.reduce((t,i)=>t+i.publication_price*i.quantity,0),without=rest.reduce((t,i)=>t+Number(i.quote_normal_price??i.publication_price)*i.quantity,0);
 return <div className="pqd-scrim" dir="rtl" onMouseDown={e=>{if(e.target===e.currentTarget)onKeep();}}><div className="pqd" role="alertdialog" aria-modal="true" aria-labelledby="pqw-title" aria-describedby="pqw-text">
  <div className="pqd-head is-warn"><span className="pqd-ico" aria-hidden="true"><AlertTriangle size={28}/></span><h2 id="pqw-title">ההנחה המיוחדת תתבטל<small>הצעת מחיר מס׳ {item.quote_number}</small></h2></div>
  <div className="pqd-body"><p id="pqw-text" className="pqd-lead">ישנם אתרים בהזמנה עם הנחה מיוחדת להזמנה זו. מחיקה של פריטים תבטל את ההנחה. לבטל?</p>
   <div className="pqd-rows"><div className="pqd-row"><span>הפריט שנמחק</span><span><b>{item.name}</b></span></div><div className="pqd-row"><span>האתרים שנשארים</span><span><b>{rest.length}</b></span></div>
    {rest.length>0&&<><div className="pqd-row is-save"><span>המחיר שלהם עם ההנחה</span><span><b>{money(withQuote)}</b></span></div><div className="pqd-row is-bad"><span>המחיר שלהם בלי ההנחה</span><span><b>{money(without)}</b></span></div></>}</div>
   <div className="pqd-acts"><button type="button" className="pq-btn is-red" disabled={busy} onClick={onRemove}>למחוק ולבטל את ההנחה</button><button type="button" className="pq-btn" disabled={busy} onClick={onKeep} autoFocus>להשאיר את ההצעה</button></div>
  </div></div></div>;
}
