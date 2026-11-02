'use client';
import React,{useMemo,useRef,useState} from 'react';
import {Check,Search,Trash2,X} from 'lucide-react';
import {Input} from '@/components/ui/input';
import {api} from '@/lib/client';
import {money,type Row} from '@/lib/shared';
import {ErrorBox,type Ctx} from './workspace';
import './customer-order-picker.css';
// An order the manager places for a customer's monthly account: pick sites, set each one, see the total, confirm.
const base='admin/customer-account/';
const siteText=(url:string)=>String(url||'').replace(/^https?:\/\//,'').replace(/^www\./,'').replace(/\/$/,'');
const fresh=(website_id:string)=>({website_id,quantity:1,editorial:false,editorial_words:400,topic:''});
export function CreateCustomerOrder({ctx,id,data,close}:{ctx:Ctx;id:string;data:Row;close:()=>void}){
 const sites:Row[]=data.websites||[],byId=useMemo(()=>new Map(sites.map(w=>[w.id,w])),[sites]);
 const [search,setSearch]=useState(''),[items,setItems]=useState<Row[]>([]),[q,setQ]=useState<Row|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[phone,setPhone]=useState(data.customer.phone||''),request=useRef(crypto.randomUUID());
 const term=search.trim().toLocaleLowerCase(),found=sites.filter(w=>!term||String(w.name).toLocaleLowerCase().includes(term)||siteText(w.url).toLocaleLowerCase().includes(term)),shown=found.slice(0,60);
 const chosen=new Set(items.map(x=>x.website_id));
 const toggle=(siteId:string)=>{setItems(rows=>chosen.has(siteId)?rows.filter(x=>x.website_id!==siteId):[...rows,fresh(siteId)]);setQ(null);};
 const change=(siteId:string,key:string,value:unknown)=>{setItems(rows=>rows.map(x=>x.website_id===siteId?{...x,[key]:value}:x));setQ(null);};
 const estimate=items.reduce((n,x)=>n+Number(byId.get(x.website_id)?.price_cents||0)*Number(x.quantity||1)+(x.editorial?Number(x.editorial_words||0)*15:0),0);
 const submit=async()=>{if(busy||!items.length)return;setBusy(true);setError('');try{if(!q)setQ(await api(base+id+'/quote','POST',{items}));else{await ctx.run(()=>api(base+id+'/create-order','POST',{items,phone,payment:'monthly',monthly_order_id:data.open_order?.id,pricing_token:q.pricing_token,expected_total:q.total,idempotency:request.current}),'ההזמנה נוספה לחשבון הלקוח');close();}}catch(e){setError((e as Error).message);setQ(null);}finally{setBusy(false);}};
 if(!data.account?.enabled)return <div className="om-dialog cop" dir="rtl"><p className="om-note is-warning">כדי להזמין עבור {data.customer.name} יש לאשר לו קודם חשבון חודשי.</p><div className="om-dialog-actions"><button type="button" className="om-btn" onClick={close}>סגירה</button></div></div>;
 return <div className="om-dialog cop" dir="rtl">
  <p className="cop-note">החיוב יתווסף לחשבון החודשי של <b>{data.customer.name}</b>{data.open_order?<> בהזמנה הפתוחה <bdi>{data.open_order.number}</bdi></>:null}.</p>
  <section className="cop-pick" aria-label="בחירת אתרים">
   <label className="cop-search"><Search size={18} aria-hidden="true"/><input type="search" placeholder="חיפוש לפי שם האתר או כתובת" aria-label="חיפוש אתר" value={search} onChange={e=>setSearch(e.target.value)}/>{search&&<button type="button" aria-label="ניקוי חיפוש" onClick={()=>setSearch('')}><X size={16}/></button>}</label>
   <div className="cop-head" aria-hidden="true"><span/><span>אתר</span><span>כתובת</span><span>מחיר</span></div>
   <ul className="cop-list">{shown.map(w=>{const on=chosen.has(w.id);return <li key={w.id}><label className={on?'is-on':undefined}><input type="checkbox" checked={on} onChange={()=>toggle(w.id)}/><span className="cop-box" aria-hidden="true">{on&&<Check size={14}/>}</span><b>{w.name}</b><bdi className="cop-url">{siteText(w.url)}</bdi><bdi className="cop-price">{money(w.price_cents)}</bdi></label></li>;})}{!shown.length&&<li className="cop-empty">לא נמצאו אתרים לחיפוש הזה.</li>}</ul>
   <p className="cop-count">{found.length>shown.length?`מוצגים ${shown.length} מתוך ${found.length}. אפשר לצמצם בחיפוש.`:`${found.length} אתרים`}</p>
  </section>
  {items.length>0&&<section className="cop-chosen" aria-label="האתרים שנבחרו"><h3>נבחרו {items.length===1?'אתר אחד':items.length+' אתרים'}</h3>
   {items.map(x=>{const w=byId.get(x.website_id);return <div className="cop-item" key={x.website_id}>
    <div className="cop-item-site"><b>{w?.name}</b><bdi>{siteText(w?.url)}</bdi></div>
    <label className="cop-qty"><span>כמות</span><Input type="number" min={1} max={20} value={x.quantity} onChange={e=>change(x.website_id,'quantity',Math.max(1,Math.min(20,Number(e.target.value)||1)))}/></label>
    <label className="cop-topic"><span>נושא הכתבה (לא חובה)</span><Input value={x.topic} maxLength={500} onChange={e=>change(x.website_id,'topic',e.target.value)}/></label>
    <label className="cop-editorial"><input type="checkbox" checked={x.editorial} onChange={e=>change(x.website_id,'editorial',e.target.checked)}/><span>כתיבה מקצועית</span></label>
    {x.editorial&&<label className="cop-words"><span>מילים (0.15 ₪ למילה)</span><Input type="number" min={100} max={5000} value={x.editorial_words} onChange={e=>change(x.website_id,'editorial_words',Number(e.target.value))}/></label>}
    <button type="button" className="cop-remove" aria-label={'הסרת '+(w?.name||'האתר')} onClick={()=>toggle(x.website_id)}><Trash2 size={16}/></button>
   </div>;})}
  </section>}
  <label className="om-dialog-field"><span>טלפון ליצירת קשר</span><Input type="tel" value={phone} onChange={e=>setPhone(e.target.value)}/></label>
  <ErrorBox error={error}/>
  {q?<dl className="om-dialog-facts is-totals cop-total"><div><dt>לפני מע״מ</dt><dd><bdi>{money(q.subtotal)}</bdi></dd></div><div><dt>מע״מ</dt><dd><bdi>{money(q.vat)}</bdi></dd></div><div><dt>סה״כ להזמנה</dt><dd><bdi>{money(q.total)}</bdi></dd></div></dl>:items.length>0&&<p className="cop-estimate">הערכה לפני מע״מ: <bdi>{money(estimate)}</bdi>. הסכום המדויק יחושב בלחיצה על חישוב.</p>}
  <div className="om-dialog-actions"><button type="button" className="om-btn is-primary" disabled={busy||!items.length} onClick={submit}>{busy?'מעבד…':q?'אישור והוספה לחשבון החודשי':'חישוב הסכום'}</button><button type="button" className="om-btn" disabled={busy} onClick={close}>ביטול</button></div>
 </div>;
}
