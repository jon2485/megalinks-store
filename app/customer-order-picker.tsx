'use client';
import React,{useEffect,useMemo,useRef,useState} from 'react';
import {Check,Loader2,Minus,Plus,Search,X} from 'lucide-react';
import {api} from '@/lib/client';
import {money,type Row} from '@/lib/shared';
import {ErrorBox,categories,type Ctx} from './workspace';
import './customer-order-picker.css';
// An order the manager places for a customer's monthly account (10.11.2026, approved mockup):
// pick sites on one side, the order and its total update on the other side like a cart.
// The total comes from the server's own quote, and confirming checks it again before adding.
const base='admin/customer-account/';
const siteText=(url:string)=>String(url||'').replace(/^https?:\/\//,'').replace(/^www\./,'').replace(/\/$/,'');
const fresh=(website_id:string)=>({website_id,quantity:1,editorial:false,editorial_words:400,topic:''});
const WORD_AGOROT=15;
const sorts:Record<string,string>={name:'לפי שם',low:'מחיר: מהזול',high:'מחיר: מהיקר',dr:'DR: מהגבוה'};
const initials=(name:string)=>String(name||'').replace(/^www\./,'').trim().slice(0,2).toUpperCase();

export function CreateCustomerOrder({ctx,id,data,close}:{ctx:Ctx;id:string;data:Row;close:()=>void}){
 const sites:Row[]=data.websites||[],byId=useMemo(()=>new Map(sites.map(w=>[w.id,w])),[sites]);
 const [search,setSearch]=useState(''),[category,setCategory]=useState(''),[sort,setSort]=useState('name'),[items,setItems]=useState<Row[]>([]),[q,setQ]=useState<Row|null>(null),[quoting,setQuoting]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[phone,setPhone]=useState(data.customer.phone||''),request=useRef(crypto.randomUUID()),quoteFor=useRef('');
 const term=search.trim().toLocaleLowerCase();
 const found=useMemo(()=>{const list=sites.filter(w=>(!category||w.category===category)&&(!term||String(w.name).toLocaleLowerCase().includes(term)||siteText(w.url).toLocaleLowerCase().includes(term)));
  if(sort==='low')list.sort((a,b)=>Number(a.price_cents)-Number(b.price_cents));else if(sort==='high')list.sort((a,b)=>Number(b.price_cents)-Number(a.price_cents));else if(sort==='dr')list.sort((a,b)=>Number(b.dr||0)-Number(a.dr||0));return list;},[sites,category,term,sort]);
 const shown=found.slice(0,60),chosen=new Set(items.map(x=>x.website_id));
 const usedCategories=useMemo(()=>[...new Set(sites.map(w=>w.category).filter(Boolean))].sort((a,b)=>String(categories[a]||a).localeCompare(String(categories[b]||b),'he')),[sites]);
 const toggle=(siteId:string)=>{setItems(rows=>rows.some(x=>x.website_id===siteId)?rows.filter(x=>x.website_id!==siteId):[...rows,fresh(siteId)]);setNotice('');};
 const change=(siteId:string,key:string,value:unknown)=>{setItems(rows=>rows.map(x=>x.website_id===siteId?{...x,[key]:value}:x));setNotice('');};
 const key=JSON.stringify(items);
 // The server quote is the price: refreshed shortly after every change while the manager works.
 useEffect(()=>{if(!items.length){setQ(null);quoteFor.current='';return;}let live=true;setQuoting(true);const t=setTimeout(async()=>{try{const result=await api(base+id+'/quote','POST',{items},{background:true});if(live){setQ(result);quoteFor.current=key;setError('');}}catch(e){if(live){setQ(null);setError((e as Error).message);}}finally{if(live)setQuoting(false);}},350);return()=>{live=false;clearTimeout(t);};},[key]);// eslint-disable-line react-hooks/exhaustive-deps
 const line=(x:Row)=>(Number(byId.get(x.website_id)?.price_cents||0)+(x.editorial?Number(x.editorial_words||0)*WORD_AGOROT:0))*Number(x.quantity||1);
 const estimate=items.reduce((n,x)=>n+line(x),0),current=!!q&&quoteFor.current===key,vatPercent=Number(q?.vatPercent??18);
 const subtotal=current?q!.subtotal:estimate,vat=current?q!.vat:Math.round(estimate*vatPercent/100),total=current?q!.total:estimate+Math.round(estimate*vatPercent/100);
 const free=Math.max(0,Number(data.account?.credit_limit||0)-Number(data.account?.balance||0)),over=!!items.length&&total>free;
 const submit=async()=>{if(busy||!items.length)return;setBusy(true);setError('');setNotice('');try{
   // Confirm checks the price on the server again; if it moved since it was shown, show the new total first.
   const checked=current?q!:await api(base+id+'/quote','POST',{items});
   if(!current){setQ(checked);quoteFor.current=key;if(checked.total!==total){setNotice('הסכום עודכן לפי המחירים בשרת: '+money(checked.total)+'. בדקו ולחצו שוב לאישור.');return;}}
   await ctx.run(()=>api(base+id+'/create-order','POST',{items,phone,payment:'monthly',monthly_order_id:data.open_order?.id,pricing_token:checked.pricing_token,expected_total:checked.total,idempotency:request.current}),'ההזמנה נוספה לחשבון החודשי של הלקוח');close();
  }catch(e){setError((e as Error).message);setQ(null);quoteFor.current='';}finally{setBusy(false);}};
 if(!data.account?.enabled)return <div className="om-dialog cop cop2" dir="rtl"><p className="om-note is-warning">כדי להזמין עבור {data.customer.name} יש לאשר לו קודם חשבון חודשי.</p><div className="om-dialog-actions"><button type="button" className="om-btn" onClick={close}>סגירה</button></div></div>;
 const openNumber=data.open_order?String(data.open_order.number).replace(/^#/,''):'';
 return <div className="om-dialog cop cop2" dir="rtl">
  <div className="cop2-pills"><span className="cop2-pill is-blue">חשבון חודשי · {openNumber?<>הזמנה פתוחה <bdi>#{openNumber}</bdi></>:'תיפתח הזמנה חדשה'}</span><span className="cop2-pill is-green">מסגרת פנויה <bdi>{money(free)}</bdi></span>{data.tier?.name&&<span className="cop2-pill">רמה: {data.tier.name}</span>}</div>
  <div className="cop2-body">
   <section className="cop2-pick" aria-label="בחירת אתרים">
    <div className="cop2-tools">
     <label className="cop2-search"><Search size={17} aria-hidden="true"/><input type="search" placeholder="חיפוש לפי שם האתר או כתובת" aria-label="חיפוש אתר" value={search} onChange={e=>setSearch(e.target.value)}/>{search&&<button type="button" aria-label="ניקוי חיפוש" onClick={()=>setSearch('')}><X size={15}/></button>}</label>
     {usedCategories.length>1&&<label className="cop2-select"><span className="cop2-sr">קטגוריה</span><select value={category} onChange={e=>setCategory(e.target.value)}><option value="">כל הקטגוריות</option>{usedCategories.map(c=><option key={c} value={c}>{categories[c]||c}</option>)}</select></label>}
     <label className="cop2-select"><span className="cop2-sr">מיון</span><select value={sort} onChange={e=>setSort(e.target.value)}>{Object.entries(sorts).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
    </div>
    <ul className="cop2-list">{shown.map(w=>{const on=chosen.has(w.id);return <li key={w.id} className={on?'is-on':undefined}>
     <span className="cop2-logo" aria-hidden="true">{w.logo_url?<img src={w.logo_url} alt="" loading="lazy"/>:initials(w.name)}</span>
     <span className="cop2-site"><b>{w.name}</b><small><bdi dir="ltr">{siteText(w.url)}</bdi>{w.dr!=null&&w.dr!==''?<> · DR <bdi>{w.dr}</bdi></>:null}</small></span>
     <bdi className="cop2-price">{money(w.price_cents)}</bdi>
     <button type="button" className={'cop2-add'+(on?' is-on':'')} aria-pressed={on} aria-label={(on?'הסרת ':'הוספת ')+w.name} onClick={()=>toggle(w.id)}>{on?<><Check size={15} aria-hidden="true"/>נבחר</>:<><Plus size={15} aria-hidden="true"/>הוספה</>}</button>
    </li>;})}{!shown.length&&<li className="cop2-empty">לא נמצאו אתרים לחיפוש הזה.</li>}</ul>
    <p className="cop2-count">{found.length>shown.length?`מוצגים ${shown.length} מתוך ${found.length}. אפשר לצמצם בחיפוש.`:found.length===1?'אתר אחד':`${found.length} אתרים`}</p>
   </section>
   <aside className="cop2-cart" aria-label="ההזמנה">
    <h3>ההזמנה {items.length>0&&<span className="cop2-pill is-blue">{items.length===1?'אתר אחד':items.length+' אתרים'}</span>}</h3>
    {!items.length?<p className="cop2-hint">בחרו אתרים מהרשימה בלחיצה על ״הוספה״. הם יופיעו כאן עם הסכום.</p>
    :<div className="cop2-items">{items.map(x=>{const w=byId.get(x.website_id);return <div className="cop2-item" key={x.website_id}>
     <div className="cop2-item-top"><b>{w?.name}</b><bdi className="cop2-line">{money(line(x))}</bdi><button type="button" className="cop2-x" aria-label={'הסרת '+(w?.name||'האתר')} onClick={()=>toggle(x.website_id)}><X size={15}/></button></div>
     <input className="cop2-topic" value={x.topic} maxLength={500} placeholder="נושא הכתבה (לא חובה)" aria-label={'נושא הכתבה ב'+(w?.name||'אתר')} onChange={e=>change(x.website_id,'topic',e.target.value)}/>
     <div className="cop2-item-row">
      <label className="cop2-switch"><input type="checkbox" role="switch" checked={x.editorial} onChange={e=>change(x.website_id,'editorial',e.target.checked)}/><span className="cop2-track" aria-hidden="true"/><span>כתיבה מקצועית</span></label>
      {x.editorial&&<label className="cop2-words"><input type="number" min={100} max={5000} step={50} value={x.editorial_words} aria-label="מספר מילים" onChange={e=>change(x.website_id,'editorial_words',Math.max(100,Math.min(5000,Number(e.target.value)||100)))}/><span>מילים · <bdi>{money(Number(x.editorial_words||0)*WORD_AGOROT)}</bdi></span></label>}
      <span className="cop2-qty" role="group" aria-label="כמות כתבות באתר"><button type="button" aria-label="פחות" disabled={x.quantity<=1} onClick={()=>change(x.website_id,'quantity',Math.max(1,x.quantity-1))}><Minus size={14}/></button><bdi>{x.quantity}</bdi><button type="button" aria-label="עוד" disabled={x.quantity>=20} onClick={()=>change(x.website_id,'quantity',Math.min(20,x.quantity+1))}><Plus size={14}/></button></span>
     </div>
    </div>;})}</div>}
    <dl className="cop2-sum" aria-live="polite"><div><dt>לפני מע״מ</dt><dd><bdi>{money(subtotal)}</bdi></dd></div><div><dt>מע״מ {vatPercent}%</dt><dd><bdi>{money(vat)}</bdi></dd></div><div className="is-total"><dt>סה״כ להזמנה{quoting&&items.length?<small className="cop2-checking"><Loader2 size={12} className="cop2-spin" aria-hidden="true"/>נבדק מול השרת</small>:null}</dt><dd><bdi>{money(total)}</bdi></dd></div></dl>
    {over&&<p className="cop2-warn" role="status">הסכום גבוה מהמסגרת הפנויה של הלקוח (<bdi>{money(free)}</bdi>).</p>}
    <label className="cop2-field"><span>טלפון ליצירת קשר</span><input type="tel" value={phone} onChange={e=>setPhone(e.target.value)}/></label>
    <ErrorBox error={error}/>
    {notice&&<p className="cop2-notice" role="status">{notice}</p>}
    <button type="button" className="cop2-confirm" disabled={busy||!items.length} aria-busy={busy||undefined} onClick={submit}>{busy?<Loader2 size={18} className="cop2-spin" aria-hidden="true"/>:<Check size={18} aria-hidden="true"/>}{busy?'מוסיף לחשבון…':'אישור והוספה לחשבון החודשי'}</button>
    <p className="cop2-after">{openNumber?<>החיוב יתווסף להזמנה הפתוחה <bdi>#{openNumber}</bdi> של הלקוח.</>:'תיפתח ללקוח הזמנה חודשית חדשה.'}</p>
    <button type="button" className="cop2-cancel" disabled={busy} onClick={close}>ביטול</button>
   </aside>
  </div>
 </div>;
}
