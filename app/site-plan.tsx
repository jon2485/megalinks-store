'use client';
// "תוכנית פרסום מהאתר שלכם" (owner 14.11.2026, design/idea-site-plan): the customer gives their website address and
// gets a ready plan from the catalog. The server reads the site (lib/site-plan-read.ts); this screen shows the plan in
// three sizes, lets the customer swap a site, edit a topic, link or anchor, or drop a site, and adds the plan to the
// regular cart. Nothing is bought here and the cart prices everything again as usual.
import React,{useEffect,useMemo,useRef,useState} from 'react';
import {Globe,Check,ShieldCheck,RefreshCw,Pencil,Trash2,ShoppingCart,ArrowRight,LoaderCircle,Sparkles} from 'lucide-react';
import {toast} from 'sonner';
import {api} from '@/lib/client';
import {type Row,money} from '@/lib/shared';
import {hasAgencyCentre,fillBriefDefaults} from '@/lib/agency-shared';
import type {Ctx} from './workspace';
import {useBuyingFor,addToCartChecked} from './agency-buying';
import './site-plan.css';

const STEPS=['קוראים את האתר','מבינים מה העסק','מוצאים את האזור','בוחרים אתרים ונושאים לכתבות'];
const short=(url:string)=>String(url||'').replace(/^https?:\/\/(www\.)?/,'').replace(/\/$/,'');
// The site's name on its tile: a long first word alone, otherwise the first two words, never cut inside a word.
const tile=(name:string)=>{const w=String(name||'').trim().split(/\s+/);return w[0]&&w[0].length>=6?w[0]:w.slice(0,2).join('\n');};

export default function SitePlan({ctx}:{ctx:Ctx}){
 const allowed=hasAgencyCentre(ctx.user)||ctx.user?.role==='admin';
 const buying=useBuyingFor(hasAgencyCentre(ctx.user));
 const [url,setUrl]=useState(''),[busy,setBusy]=useState(false),[step,setStep]=useState(0),[error,setError]=useState('');
 const [plan,setPlan]=useState<Row|null>(null),[size,setSize]=useState('balanced'),[items,setItems]=useState<Record<string,Row[]>>({}),[editing,setEditing]=useState(''),[adding,setAdding]=useState(false);
 const [customer,setCustomer]=useState<Row|null>(null);
 const timer=useRef<ReturnType<typeof setInterval>|null>(null),input=useRef<HTMLInputElement>(null);
 // Buying for one of the account's customers: the plan is for that customer and its site is filled in.
 useEffect(()=>{let live=true;if(!buying){setCustomer(null);return;}
  api('agency/customers/'+encodeURIComponent(buying.id),'GET',undefined,{background:true}).then(d=>{if(!live)return;setCustomer(d.customer||null);const domain=(d.customer?.domains||[])[0];if(domain)setUrl(u=>u||domain);}).catch(()=>{});
  return()=>{live=false;};},[buying?.id]);
 useEffect(()=>()=>{if(timer.current)clearInterval(timer.current);},[]);
 async function make(e?:React.FormEvent){
  e?.preventDefault();if(busy)return;const value=url.trim();if(!value){setError('יש להזין את כתובת האתר');input.current?.focus();return;}
  setBusy(true);setError('');setPlan(null);setStep(0);setEditing('');
  timer.current=setInterval(()=>setStep(s=>Math.min(STEPS.length-1,s+1)),1400);
  // The screen shows its own reading steps, so the site-wide loading cover stays away (background request).
  try{const d=await api('site-plan','POST',{url:value,...(buying?{customer_id:buying.id}:{})},{background:true});
   setPlan(d);setItems(Object.fromEntries((d.sizes||[]).map((s:Row)=>[s.key,s.items.map((i:Row)=>({...i}))])));
   setSize((d.sizes||[]).some((s:Row)=>s.key==='balanced')?'balanced':d.sizes?.[0]?.key||'balanced');
   requestAnimationFrame(()=>document.getElementById('sp-plan')?.scrollIntoView({behavior:'smooth',block:'start'}));}
  catch(err){setError((err as Error).message||'לא הצלחנו להכין תוכנית. נסו שוב.');}
  finally{if(timer.current)clearInterval(timer.current);timer.current=null;setBusy(false);}
 }
 const current=items[size]||[],total=current.reduce((n,i)=>n+Number(i.price_cents||0),0);
 const targets:Row[]=plan?.analysis?.targets||[];
 const distinctPages=new Set(current.map(i=>i.target_url)).size===current.length,distinctAnchors=new Set(current.map(i=>String(i.anchor||'').trim())).size===current.length;
 const change=(index:number,patch:Row)=>setItems(all=>({...all,[size]:(all[size]||[]).map((x,i)=>i===index?{...x,...patch}:x)}));
 const swap=(index:number)=>{const it=current[index];const alts:Row[]=it.alternatives||[];const taken=new Set(current.map(i=>i.website_id));const next=alts.find(a=>!taken.has(a.id));
  if(!next){toast.info('אין עוד אתר מתאים להחלפה בתוכנית הזאת');return;}
  change(index,{website_id:next.id,name:next.name,url:next.url,category:next.category,dr:next.dr,price_cents:next.price_cents,alternatives:[...alts.filter(a=>a.id!==next.id),{id:it.website_id,name:it.name,url:it.url,category:it.category,dr:it.dr,price_cents:it.price_cents}]});};
 const drop=(index:number)=>setItems(all=>({...all,[size]:(all[size]||[]).filter((_,i)=>i!==index)}));
 async function addAll(){
  if(adding||!current.length)return;setAdding(true);let added=0;
  try{for(const it of current){
    const topic=String(it.topic||'').trim();if(!topic){toast.error('יש נושא ריק בתוכנית');break;}
    let payload:Row={website_id:it.website_id,topic,target_url:it.target_url,anchor:String(it.anchor||'').trim(),brand:plan?.analysis?.name||''};
    if(buying)payload=fillBriefDefaults({...payload,brand:'',customer_id:buying.id},customer?.brief_defaults||null).brief;
    if(await addToCartChecked(payload))added++;}
   if(added){toast.success(added===1?'אתר אחד נוסף לסל':added+' אתרים נוספו לסל');ctx.refresh();ctx.go('cart');}}
  catch(err){toast.error((err as Error).message||'ההוספה לסל נכשלה');if(added)ctx.refresh();}
  finally{setAdding(false);}
 }
 if(!allowed)return <section className="sp" dir="rtl"><div className="sp-card"><h1>תוכנית פרסום מהאתר שלכם</h1><p className="sp-sub">התוכנית זמינה לחשבונות לקוח. התחברו כדי להמשיך.</p></div></section>;
 const a=plan?.analysis;
 return <section className="sp" dir="rtl" aria-labelledby="sp-title">
  <form className="sp-card sp-start" onSubmit={make} noValidate>
   <div className="sp-intro">
   <span className="sp-pill"><Sparkles size={14} aria-hidden="true"/>חדש</span>
   <h1 id="sp-title">{buying?<>תוכנית פרסום עבור <bdi>{buying.name}</bdi></>:'תוכנית פרסום מהאתר שלכם'}</h1>
   <p className="sp-sub">מדביקים את כתובת האתר, ותוך דקה מקבלים תוכנית מוכנה: באילו אתרים לפרסם, על מה לכתוב, ולאיזה עמוד לקשר.</p>
   </div>
   <div className="sp-go">
   <label className="sp-url"><Globe size={20} aria-hidden="true"/><span className="sr-only">כתובת האתר</span>
    <input ref={input} type="text" inputMode="url" dir="ltr" autoComplete="url" placeholder="example.co.il" value={url} maxLength={500} disabled={busy} onChange={e=>{setUrl(e.target.value);setError('');}} aria-describedby="sp-error"/></label>
   <button className={'sp-btn primary'+(busy?' busy':'')} type="submit" disabled={busy}>{busy?<><LoaderCircle size={18} className="sp-spin-icon" aria-hidden="true"/>מכינים את התוכנית…</>:plan?'הכנת תוכנית חדשה':'הכנת התוכנית'}</button>
   {error&&<p className="sp-error" id="sp-error" role="alert">{error}</p>}
   {busy&&<ul className="sp-steps" aria-live="polite">{STEPS.map((s,i)=><li key={s} className={i<step?'done':i===step?'now':''}><span className="dot">{i<step?<Check size={15} strokeWidth={3}/>:i===step?<span className="spin"/>:null}</span><span>{s}{i===step?'…':''}</span></li>)}</ul>}
   {!plan&&!busy&&<p className="sp-note"><ShieldCheck size={17} aria-hidden="true"/><span>קוראים רק עמודים ציבוריים באתר. שום דבר לא נקנה בלי שתאשרו.</span></p>}
   </div>
  </form>

  {plan&&a&&<div className="sp-plan" id="sp-plan">
   <section className="sp-card sp-head">
    <div className="sp-head-text">
    <h2>{buying?<>התוכנית של <bdi>{buying.name}</bdi></>:<>התוכנית של <bdi>{a.name}</bdi></>}</h2>
    <div className="sp-chips">
     {a.field&&<span className="sp-chip">{a.field.term}</span>}
     {a.city?<span className="sp-chip">{a.city.name}</span>:<span className="sp-chip muted">לא מצאנו עיר באתר</span>}
     <span className="sp-chip muted">קראנו <bdi>{a.pages_read}</bdi> עמודים</span>
    </div>
    {!a.city&&<p className="sp-hint">כדי לקבל גם אתרים מקומיים, כדאי שבאתר תופיע העיר שבה העסק נמצא.</p>}
    </div>
    <div className="sp-seg" role="radiogroup" aria-label="גודל התוכנית">{(plan.sizes||[]).map((s:Row)=>{const sum=(items[s.key]||[]).reduce((n:number,i:Row)=>n+Number(i.price_cents||0),0);return <button key={s.key} type="button" role="radio" aria-checked={size===s.key} className={size===s.key?'on':''} onClick={()=>{setSize(s.key);setEditing('');}}>{s.label}<small><bdi>{money(sum)}</bdi></small></button>;})}</div>
   </section>
   <div className="sp-sites">
   {current.map((it,index)=>{const key=size+':'+index,open=editing===key;return <article className="sp-site" key={key}>
    <div className="sp-site-head"><span className="sp-logo" aria-hidden="true">{tile(it.name)}</span><span className="t"><b>{it.name}</b><small dir="ltr">{short(it.url)}</small></span><span className="sp-price"><bdi>{money(it.price_cents)}</bdi></span></div>
    <p className="sp-why"><Check size={16} strokeWidth={2.6} aria-hidden="true"/>למה: {it.why}</p>
    {open?<div className="sp-edit">
     <label>נושא לכתבה<input type="text" value={it.topic} maxLength={500} onChange={e=>change(index,{topic:e.target.value})}/></label>
     <label>קישור אל<select value={it.target_url} onChange={e=>change(index,{target_url:e.target.value})}>{targets.map(t=><option key={t.url} value={t.url}>{t.title&&t.kind!=='home'?t.title+' · ':''}{short(t.url)}</option>)}</select></label>
     <label>עוגן<input type="text" value={it.anchor} maxLength={200} onChange={e=>change(index,{anchor:e.target.value})}/></label>
    </div>:<dl className="sp-rows">
     <div><dt>נושא לכתבה</dt><dd>{it.topic}</dd></div>
     <div><dt>קישור אל</dt><dd className="ltr">{short(it.target_url)}</dd></div>
     <div><dt>עוגן</dt><dd>{it.anchor}</dd></div>
    </dl>}
    <div className="sp-acts">
     <button type="button" className="sp-ghost" onClick={()=>swap(index)}><RefreshCw size={15} aria-hidden="true"/>להחליף אתר</button>
     <button type="button" className={'sp-ghost'+(open?' on':'')} aria-pressed={open} onClick={()=>setEditing(open?'':key)}><Pencil size={15} aria-hidden="true"/>{open?'סיום עריכה':'עריכה'}</button>
     <button type="button" className="sp-ghost icon" aria-label={'הסרת '+it.name+' מהתוכנית'} onClick={()=>drop(index)}><Trash2 size={16} aria-hidden="true"/></button>
    </div>
   </article>;})}
   </div>
   {!current.length&&<p className="sp-empty">הסרתם את כל האתרים מהתוכנית הזאת. אפשר לבחור גודל אחר או להכין תוכנית חדשה.</p>}
   {current.length>0&&<section className="sp-sum">
    <div className="total"><b><bdi>{current.length}</bdi> {current.length===1?'כתבה':'כתבות'}</b><span><strong><bdi>{money(total)}</bdi></strong> <small>לפני מע״מ</small></span></div>
    <ul>
     {distinctPages&&current.length>1&&<li><Check size={16} strokeWidth={2.6} aria-hidden="true"/>כל כתבה מקשרת לעמוד אחר באתר</li>}
     {distinctAnchors&&current.length>1&&<li><Check size={16} strokeWidth={2.6} aria-hidden="true"/>כל עוגן שונה</li>}
     {buying&&<li><Check size={16} strokeWidth={2.6} aria-hidden="true"/>אף אתר כאן לא שימש את <bdi>{buying.name}</bdi> קודם</li>}
    </ul>
    <button type="button" className="sp-btn primary" disabled={adding} onClick={addAll}>{adding?<><LoaderCircle size={18} className="sp-spin-icon" aria-hidden="true"/>מוסיפים לסל…</>:<><ShoppingCart size={18} aria-hidden="true"/>הוספת התוכנית לסל</>}</button>
   </section>}
   <p className="sp-fine">זו הצעה. אפשר להחליף כל אתר, נושא או עוגן לפני שמוסיפים לסל, והמחיר הסופי מחושב בסל.</p>
   <button type="button" className="sp-back" onClick={()=>{setPlan(null);setUrl('');window.scrollTo({top:0,behavior:'smooth'});requestAnimationFrame(()=>input.current?.focus());}}><ArrowRight size={16} aria-hidden="true"/>לכתובת אחרת</button>
  </div>}
 </section>;
}
