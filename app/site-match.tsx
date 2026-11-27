'use client';
import React,{useEffect,useMemo,useRef,useState} from 'react';
import {Check,Loader2,Pencil,Plus,ShoppingCart,Sparkles,X} from 'lucide-react';
import {toast} from 'sonner';
import {api} from '@/lib/client';
import {money,type Row} from '@/lib/shared';
import {anchorTypeLabels,classifyAnchor,siteDomain,type AnchorType} from '@/lib/anchor-mix';
import {addToCartChecked} from './agency-buying';
import type {Ctx} from './workspace';
import './site-match.css';

// "מצאו לי אתרים מתאימים" (owner 27.11.2026, mockups design/ai-ideas 4-10): the business, its site address and the
// budget; Claude picks sites that fit and that do not already link to that address, with a phrase and a target page
// for each (editable), and the phrase mix of the address before and after.
type Pick={id:string;name:string;url:string;dr?:number;category?:string;price_cents:number;reason:string;anchor:string;anchor_type:AnchorType;target_url:string;alternatives:string[];added?:boolean};
type Result={domain:string;brand:string;keywords:string[];used:Row[];history:Record<AnchorType,number>;history_total:number;picks:Pick[];total_cents:number;note:string};
const TYPES:AnchorType[]=['brand','naked','partial','exact'];

export function SiteMatchButton({ctx,className='',label='מצאו לי אתרים מתאימים',initial={}}:{ctx:Ctx;className?:string;label?:string;initial?:{target_url?:string;business?:string;customer_id?:string;customer_name?:string}}){
 const [open,setOpen]=useState(false);
 return <>
  <button type="button" className={'sm-trigger '+className} onClick={()=>{if(!ctx.user){window.location.assign('/signin-with-chatgpt?return_to='+encodeURIComponent(window.location.pathname));return;}setOpen(true);}}><Sparkles size={18} aria-hidden="true"/><span>{label}</span></button>
  {open&&<SiteMatchWindow ctx={ctx} initial={initial} onClose={()=>setOpen(false)}/>}
 </>;
}

function SiteMatchWindow({ctx,initial,onClose}:{ctx:Ctx;initial:{target_url?:string;business?:string;customer_id?:string;customer_name?:string};onClose:()=>void}){
 const [target,setTarget]=useState(initial.target_url||''),[business,setBusiness]=useState(initial.business||''),[budget,setBudget]=useState('3000'),[count,setCount]=useState('3'),[keyText,setKeyText]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[result,setResult]=useState<Result|null>(null),[showUsed,setShowUsed]=useState(false),[editing,setEditing]=useState(''),[adding,setAdding]=useState('');
 const box=useRef<HTMLDivElement>(null);
 useEffect(()=>{const prev=document.body.style.overflow;document.body.style.overflow='hidden';const key=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose();};document.addEventListener('keydown',key);return()=>{document.body.style.overflow=prev;document.removeEventListener('keydown',key);};},[onClose]);
 const keywords=useMemo(()=>keyText.split(/[,،\n]/).map(k=>k.trim()).filter(Boolean).slice(0,8),[keyText]);
 const find=async(e?:React.FormEvent)=>{e?.preventDefault();if(busy)return;setError('');
  if(!siteDomain(target)){setError('יש להזין את כתובת האתר שלכם, למשל example.co.il');return;}
  if(business.trim().length<3){setError('ספרו בכמה מילים מה העסק');return;}
  setBusy(true);setResult(null);
  try{const r=await api('site-match','POST',{target_url:target,business,budget_ils:Number(budget)||0,count:Number(count)||3,keywords,customer_id:initial.customer_id||''},{background:true}) as Result;setResult(r);requestAnimationFrame(()=>box.current?.querySelector('.sm-results')?.scrollIntoView({behavior:'smooth',block:'start'}));}
  catch(err){setError((err as Error).message||'לא הצלחנו להכין המלצה כרגע');}finally{setBusy(false);}
 };
 const context=result?{domain:result.domain,brand:result.brand,keywords:result.keywords}:{domain:'',brand:'',keywords:[]};
 const update=(id:string,patch:Partial<Pick>)=>setResult(r=>r?{...r,picks:r.picks.map(p=>p.id===id?{...p,...patch,...(patch.anchor!==undefined?{anchor_type:classifyAnchor(patch.anchor,context)}:{})}:p)}:r);
 const after=useMemo(()=>{const c={...(result?.history||{brand:0,naked:0,partial:0,exact:0,other:0})};for(const p of result?.picks||[])c[p.anchor_type]=(c[p.anchor_type]||0)+1;return c;},[result]);
 const scale=Math.max(1,...TYPES.map(t=>after[t]||0));
 const topic=keywords[0]?'כתבה בנושא '+keywords[0]:business.trim();
 const add=async(p:Pick)=>{const res=await addToCartChecked({website_id:p.id,topic,anchor:p.anchor,target_url:p.target_url,quantity:1,customer_id:initial.customer_id||'',notes:''},{background:true});if(res!==null)update(p.id,{added:true});return res!==null;};
 const addOne=async(p:Pick)=>{if(adding)return;setAdding(p.id);try{if(await add(p)){toast.success(p.name+' נוסף לסל עם הביטוי');ctx.refresh();}}catch(err){toast.error((err as Error).message);}finally{setAdding('');}};
 const addAll=async()=>{if(adding||!result)return;setAdding('all');let n=0;try{for(const p of result.picks)if(!p.added&&await add(p))n++;if(n){toast.success(n===1?'אתר אחד נוסף לסל':n+' אתרים נוספו לסל, עם הביטויים');ctx.refresh();}}catch(err){toast.error((err as Error).message);}finally{setAdding('');}};
 return <div className="sm-scrim" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}>
  <div ref={box} className="sm-window" role="dialog" aria-modal="true" aria-labelledby="sm-title" dir="rtl">
   <header className="sm-head"><span className="sm-spark" aria-hidden="true"><Sparkles size={22}/></span><div><h2 id="sm-title">מצאו לי אתרים מתאימים</h2><p>{initial.customer_name?'עבור '+initial.customer_name+'. ':''}נבחר אתרים שמתאימים לעסק, שעוד לא קישרו לאתר הזה, ונציע לכל אחד ביטוי ועמוד יעד.</p></div><button type="button" className="sm-x" aria-label="סגירה" onClick={onClose}><X size={20}/></button></header>
   <form className="sm-form" onSubmit={find} noValidate>
    <label className="sm-f"><span>כתובת האתר שלכם</span><input dir="ltr" value={target} onChange={e=>setTarget(e.target.value)} placeholder="example.co.il" inputMode="url"/></label>
    <label className="sm-f sm-wide"><span>מה העסק</span><input value={business} onChange={e=>setBusiness(e.target.value)} placeholder="למשל: חנות אונליין לנעלי ריצה"/></label>
    <label className="sm-f"><span>תקציב (₪, לפני מע״מ)</span><input type="number" min={100} step={100} value={budget} onChange={e=>setBudget(e.target.value)}/></label>
    <label className="sm-f sm-narrow"><span>כתבות</span><input type="number" min={1} max={10} value={count} onChange={e=>setCount(e.target.value)}/></label>
    <label className="sm-f sm-keys"><span>מילות מפתח (לא חובה, מופרדות בפסיק)</span><input value={keyText} onChange={e=>setKeyText(e.target.value)} placeholder="נעלי ריצה, ציוד ריצה"/></label>
    <button type="submit" className="sm-go" disabled={busy}>{busy?<Loader2 className="sm-spin" size={18}/>:<Sparkles size={18}/>}{busy?'מחפשים…':'מצאו לי אתרים'}</button>
   </form>
   {error&&<p className="sm-error" role="alert">{error}</p>}
   {busy&&<div className="sm-busy" role="status"><Loader2 className="sm-spin" size={22}/><div><b>מחפשים את האתרים המתאימים</b><small>בודקים את הקטלוג, את האתרים שכבר קישרו אליכם ואת הביטויים. זה לוקח עד חצי דקה.</small></div></div>}
   {result&&<section className="sm-results" aria-label="ההמלצה">
    {result.used.length?<div className="sm-used"><span>ל־<bdi dir="ltr">{result.domain}</bdi> כבר יש קישורים מ־<b>{result.used.length===1?'אתר אחד':result.used.length+' אתרים'}</b>. הם לא יוצעו שוב.</span><button type="button" onClick={()=>setShowUsed(v=>!v)}>{showUsed?'הסתרה':'הצגת הרשימה'}</button>{showUsed&&<ul>{result.used.map(s=><li key={s.id}>{s.name} <bdi dir="ltr">{siteDomain(s.url||'')}</bdi></li>)}</ul>}</div>:<div className="sm-used"><span>ל־<bdi dir="ltr">{result.domain}</bdi> עוד אין קישורים מהחשבון שלכם, אז כל האתרים פתוחים.</span></div>}
    <div className="sm-grid">
     <div className="sm-list">{result.picks.map(p=><article key={p.id} className={'sm-card'+(p.added?' is-added':'')}>
      <div className="sm-top"><b>{p.name}</b><bdi dir="ltr" className="sm-dom">{siteDomain(p.url)}</bdi><span className="sm-tags">{p.dr?<span>DR {p.dr}</span>:null}{p.category?<span>{p.category}</span>:null}</span></div>
      <p className="sm-why">{p.reason}</p>
      {editing===p.id?<div className="sm-edit">
       <div className="sm-edit-row"><input aria-label="הביטוי" value={p.anchor} onChange={e=>update(p.id,{anchor:e.target.value})} maxLength={100}/><input aria-label="עמוד היעד" dir="ltr" value={p.target_url} onChange={e=>update(p.id,{target_url:e.target.value})}/><button type="button" className="sm-save" onClick={()=>setEditing('')}><Check size={16}/>שמירה</button></div>
       {p.alternatives.length?<div className="sm-alts"><span>הצעות נוספות:</span>{p.alternatives.map(a=><button key={a} type="button" onClick={()=>update(p.id,{anchor:a})}>{a}</button>)}</div>:null}
       <small>סוג הביטוי מתעדכן לבד (עכשיו: {anchorTypeLabels[p.anchor_type]}), וגם החלוקה בצד.</small>
      </div>:<div className="sm-anchor"><span className={'sm-type t-'+p.anchor_type}>{anchorTypeLabels[p.anchor_type]}</span>ביטוי מומלץ: <q>{p.anchor}</q><span className="sm-arrow" aria-hidden="true">←</span><bdi dir="ltr" className="sm-page">{p.target_url.replace(/^https?:\/\//,'').replace(/\/$/,'')}</bdi>{!p.added&&<button type="button" className="sm-edit-btn" onClick={()=>setEditing(p.id)}><Pencil size={13}/>שינוי</button>}</div>}
      <div className="sm-side"><span className="sm-price">{money(p.price_cents)}</span>{p.added?<span className="sm-added"><Check size={15}/>בסל</span>:<button type="button" className="sm-add" disabled={!!adding} onClick={()=>void addOne(p)}>{adding===p.id?<Loader2 className="sm-spin" size={15}/>:<Plus size={15}/>}הוספה לסל</button>}</div>
     </article>)}</div>
     <aside className="sm-plan"><h3>חלוקת הביטויים ל־<bdi dir="ltr">{result.domain}</bdi></h3><small>מה יש היום, ומה יהיה אחרי ההזמנה</small>
      {TYPES.map(t=>{const now=result.history[t]||0,next=after[t]||0;return <div key={t} className="sm-bar"><header><span>{anchorTypeLabels[t]}</span><span dir="ltr">{next>now?now+' → '+next:now}</span></header><div className="sm-track"><i className="now" style={{width:now/scale*100+'%'}}/><i className="add" style={{width:(next-now)/scale*100+'%'}}/></div></div>;})}
      <p className="sm-note">{result.note||'רוב הקישורים על שם העסק או הכתובת, חלק ביטויים חלקיים ומעט מדויקים. כך הפרופיל נראה טבעי.'}</p>
     </aside>
    </div>
    <div className="sm-sum"><span><b>{result.picks.length===1?'אתר אחד':result.picks.length+' אתרים'} · {money(result.picks.reduce((s,p)=>s+p.price_cents,0))}</b><small>המחירים לפני מע״מ. הביטויים והקישורים יוכנסו לכל כתבה בסל.</small></span>{result.picks.every(p=>p.added)?<button type="button" className="sm-all is-done" onClick={()=>{onClose();ctx.go('cart');}}><ShoppingCart size={18}/>מעבר לסל</button>:<button type="button" className="sm-all" disabled={!!adding} onClick={()=>void addAll()}>{adding==='all'?<Loader2 className="sm-spin" size={18}/>:<ShoppingCart size={18}/>}הוספת כולם לסל עם הביטויים</button>}</div>
   </section>}
  </div>
 </div>;
}
