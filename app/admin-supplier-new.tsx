'use client';
// "הוספת ספק" (owner 23.11.2026, approved mockup): one screen with the supplier, how we pay it, and its sites.
// Every site card has the catalog's own fields (URL, name, logo, category, cost to us, list price, a sample article),
// "+ הוספת אתר" adds another card. Saving creates the supplier, then each site in turn, then the stock that was typed in.
// A site that is already in the catalog is attached instead of copied. Nothing new on the server: the same calls as the
// catalog form, the stock dialogs and "צירוף אתרים".
import React,{useMemo,useRef,useState} from 'react';
import {ArrowLeftRight,Boxes,CalendarDays,Check,Link2,Loader2,Package,Plus,Trash2,Upload} from 'lucide-react';
import {api,pricingApi,useData} from '@/lib/client';
import type {Row} from '@/lib/shared';
import {categories,type Ctx} from './workspace';
import './admin-supplier-new.css';

type Guard={mark:(key:string,dirty:boolean)=>void};
export type BillingKey='monthly'|'pool'|'stock'|'exchange';
// Internal keys stay; the names are the owner's (23.11.2026): one package for all sites = "מלאי · חבילה מראש",
// a separate stock per site = "מלאי משתנה פר אתר".
export const BILLING_TYPES:{key:BillingKey;title:string;line:string;icon:React.ReactNode;explain:React.ReactNode}[]=[
 {key:'monthly',title:'התחשבנות חודשית',line:'משלמים פעם בחודש על מה שפורסם',icon:<CalendarDays size={20} aria-hidden="true"/>,
  explain:<><b>התחשבנות חודשית:</b> משלמים לספק פעם בחודש על הכתבות שפורסמו באותו חודש, לפי מחיר העלות של כל אתר.</>},
 {key:'pool',title:'מלאי · חבילה מראש',line:'חבילה אחת לכל האתרים של הספק',icon:<Package size={20} aria-hidden="true"/>,
  explain:<><b>מלאי · חבילה מראש:</b> קונים מהספק מראש חבילה אחת של כתבות (למשל 100), והיא משמשת את כל האתרים שלו. כל כתבה בכל אחד מהאתרים יורדת מאותה חבילה. את הכמות והעלות ממלאים כאן למטה.</>},
 {key:'stock',title:'מלאי משתנה פר אתר',line:'לכל אתר מלאי משלו, בכמות משלו',icon:<Boxes size={20} aria-hidden="true"/>,
  explain:<><b>מלאי משתנה פר אתר:</b> קונים מהספק מלאי נפרד לכל אתר, וכל אתר בכמות שלו (למשל אתר א׳ 50 כתבות, אתר ב׳ 20).<ul><li>כתבה יורדת רק מהמלאי של האתר שבו היא מתפרסמת.</li><li>כשהמלאי של אתר נגמר, כתבות חדשות לאתר הזה מחכות עד שמוסיפים לו מלאי, גם אם באתרים האחרים של הספק נשאר מלאי.</li><li>את הכמות והעלות של כל אתר ממלאים בכרטיס של האתר.</li></ul></>},
 {key:'exchange',title:'החלפות',line:'קישור תמורת קישור, בלי כסף',icon:<ArrowLeftRight size={20} aria-hidden="true"/>,
  explain:<><b>החלפות:</b> לא משלמים לספק כסף. כל כתבה שפורסמה אצלו ואושרה נותנת לו קישור אחד בחזרה, באתר שהוא בוחר מהרשימה שלך. העלות שלך נקבעת לפי האתר שהוא בוחר.</>},
];

// The four payment cards, also used in the supplier details of an existing supplier.
export function BillingTypeCards({value,onChange,name='billing'}:{value:string;onChange:(v:BillingKey)=>void;name?:string}){
 const chosen=BILLING_TYPES.find(t=>t.key===value);
 return <div className="nsp-types-wrap"><div className="nsp-types" role="radiogroup" aria-label="איך משלמים לספק">{BILLING_TYPES.map(t=><label key={t.key} className={'nsp-type'+(value===t.key?' is-on':'')}>
  <input type="radio" name={name} value={t.key} checked={value===t.key} onChange={()=>onChange(t.key)} className="nsp-sr"/>
  {value===t.key&&<span className="nsp-ok" aria-hidden="true"><Check size={14}/></span>}
  <span className="nsp-ic">{t.icon}</span><b>{t.title}</b><span className="nsp-line">{t.line}</span></label>)}</div>
  {chosen&&<div className="nsp-explain" aria-live="polite">{chosen.explain}</div>}</div>;
}

type Site={key:string;url:string;name:string;named:boolean;category:string;logo:string;cost:string;price:string;sample:string;qty:string;total:string;attach:Row|null;id?:string;done?:boolean;error?:string};
const blank=():Site=>({key:Math.random().toString(36).slice(2),url:'',name:'',named:false,category:'',logo:'',cost:'',price:'',sample:'',qty:'',total:'',attach:null});
const todayLocal=()=>{const d=new Date();return new Date(d.getTime()-d.getTimezoneOffset()*6e4).toISOString().slice(0,10);};
const fullUrl=(raw:string)=>{const v=raw.trim();if(!v)return '';try{const u=new URL(/^https?:\/\//i.test(v)?v:'https://'+v);return u.hostname.includes('.')?u.href:'';}catch{return '';}};
const hostOf=(raw:string)=>{try{return new URL(fullUrl(raw)).hostname.replace(/^www\./,'').toLowerCase();}catch{return '';}};
const money=(v:string)=>v.trim()===''?null:Number(v);

export default function NewSupplierPage({ctx,guard}:{ctx:Ctx;guard:Guard}){
 const catalog=useData('catalog?scope=admin',ctx.revision),websites:Row[]=catalog.data?.websites||[];
 const byHost=useMemo(()=>{const m=new Map<string,Row>();for(const w of websites){const h=hostOf(String(w.url||''));if(h&&!m.has(h))m.set(h,w);}return m;},[websites]);
 const [f,setF]=useState({name:'',contact:'',email:'',phone:'',workflow:'',notes:''});
 const [billing,setBilling]=useState<BillingKey>('monthly'),[pool,setPool]=useState({qty:'',total:''});
 const [sites,setSites]=useState<Site[]>([blank()]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[step,setStep]=useState('');
 const supplierId=useRef(''),poolDone=useRef(false),lock=useRef(false);
 const dirty=()=>guard.mark('supplier-new',true);
 const setSite=(key:string,patch:Partial<Site>)=>{setSites(list=>list.map(s=>s.key===key?{...s,...patch}:s));dirty();};
 const onUrl=(s:Site,url:string)=>{const h=hostOf(url);setSite(s.key,{url,...(!s.named?{name:h}:{} ),attach:null});};
 const known=(s:Site)=>{const h=hostOf(s.url);const w=h?byHost.get(h):undefined;return w&&!s.done?w:undefined;};
 const upload=async(s:Site,file?:File)=>{if(!file)return;if(!['image/png','image/jpeg','image/gif','image/webp'].includes(file.type)||file.size>5*1024*1024){setSite(s.key,{error:'יש לבחור תמונת PNG, JPG, GIF או WEBP בגודל עד 5MB.'});return;}
  try{const data=new FormData();data.append('file',file);const r=await api('admin/catalog-logo','POST',data);setSite(s.key,{logo:r.url,error:''});}catch(e){setSite(s.key,{error:(e as Error).message});}};

 const problem=():string=>{
  if(!f.name.trim())return 'יש להזין את שם הספק.';
  if(f.email.trim()&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim()))return 'המייל של הספק אינו תקין.';
  if(billing==='pool'&&(pool.qty||pool.total)&&(!(Number.isInteger(Number(pool.qty))&&Number(pool.qty)>0)||money(pool.total)===null||Number(pool.total)<0))return 'בחבילה מראש יש להזין כמות כתבות שלמה ועלות חבילה.';
  for(const [i,s] of sites.entries()){if(s.done)continue;const n='אתר '+(i+1)+': ';
   if(!s.url.trim()&&!s.name.trim()&&!s.price.trim())continue;
   if(!fullUrl(s.url))return n+'יש להזין כתובת אתר מלאה.';
   if(s.attach)continue;
   if(known(s))return n+'האתר כבר בקטלוג. אפשר לצרף אותו לספק הזה בכפתור שבכרטיס.';
   if(!s.name.trim())return n+'יש להזין את שם האתר.';
   if(!s.category)return n+'יש לבחור קטגוריה.';
   if(money(s.price)===null||Number(s.price)<0)return n+'יש להזין מחיר מחירון.';
   if(billing!=='exchange'&&s.cost.trim()&&(!(Number(s.cost)>=0)))return n+'מחיר העלות אינו תקין.';
   if(billing==='stock'&&(s.qty||s.total)&&(!(Number.isInteger(Number(s.qty))&&Number(s.qty)>0)||money(s.total)===null))return n+'במלאי לאתר יש להזין כמות כתבות שלמה ועלות חבילה.';
  }
  return '';
 };

 const save=async()=>{
  if(lock.current)return;const p=problem();if(p){setError(p);return;}
  lock.current=true;setBusy(true);setError('');
  try{
   if(!supplierId.current){setStep('שומר את הספק…');const r=await api('records/supplier','POST',{...f,name:f.name.trim(),email:f.email.trim(),billing_default:billing});supplierId.current=r.id;}
   const id=supplierId.current;let version=catalog.data?.pricing_version;
   // Sites already in the catalog are attached first, while the catalog's pricing version is still the one we loaded.
   for(const s of [...sites.filter(x=>x.attach),...sites.filter(x=>!x.attach)]){
    if(s.done||!fullUrl(s.url))continue;
    setStep('שומר את '+(s.name||hostOf(s.url))+'…');
    try{
     let siteId=s.attach?.id as string|undefined;
     if(s.attach){await pricingApi('admin/catalog-bulk','POST',{pricing_version:version,rows:[{id:s.attach.id,expected_updated:s.attach.updated,values:{supplier_id:id}}]});}
     else{const r=await pricingApi('admin/websites','POST',{name:s.name.trim(),url:fullUrl(s.url),category:s.category,price_ils:s.price,...(billing!=='exchange'&&s.cost.trim()?{cost_ils:s.cost}:{}),supplier_id:id,logo_url:s.logo,example_articles:s.sample.trim()?[s.sample.trim()]:[]});siteId=r.id;}
     if(billing==='stock'&&siteId&&s.qty&&!s.attach)await api('admin/supplier-stock/'+encodeURIComponent(siteId),'POST',{quantity:Number(s.qty),total_ils:s.total,paid_on:todayLocal(),method:'',note:'נוסף בהוספת הספק'});
     setSites(list=>list.map(x=>x.key===s.key?{...x,done:true,id:siteId,error:''}:x));
    }catch(e){setSites(list=>list.map(x=>x.key===s.key?{...x,error:(e as Error).message}:x));throw new Error('הספק נשמר, אבל '+(s.name||hostOf(s.url))+' לא נשמר: '+(e as Error).message+' אפשר לתקן ולשמור שוב, בלי שהספק ייווצר פעמיים.');}
   }
   if(billing==='pool'&&pool.qty&&!poolDone.current){setStep('שומר את החבילה…');await api('admin/supplier-pool/'+encodeURIComponent(id),'POST',{quantity:Number(pool.qty),total_ils:pool.total,paid_on:todayLocal(),method:'',note:'נוסף בהוספת הספק'});poolDone.current=true;}
   guard.mark('supplier-new',false);ctx.refresh();ctx.go('admin-supplier/'+id);
  }catch(e){setError((e as Error).message);}finally{lock.current=false;setBusy(false);setStep('');}
 };

 const count=sites.filter(s=>fullUrl(s.url)).length;
 const field=(label:React.ReactNode,input:React.ReactNode,wide=false,hint?:string)=><label className={'nsp-f'+(wide?' is-wide':'')}><span className="nsp-lbl">{label}{hint&&<small>{hint}</small>}</span>{input}</label>;
 const req=<i className="nsp-req" aria-hidden="true">*</i>;
 return <div className="nsp" dir="rtl">
  <header className="nsp-head"><h1>הוספת ספק</h1><p>פרטי הספק, איך משלמים לו, והאתרים שלו. הכל במסך אחד.</p></header>
  <section className="nsp-card" aria-labelledby="nsp-1"><div className="nsp-sec"><span className="nsp-n">1</span><h2 id="nsp-1">פרטי הספק</h2></div>
   <div className="nsp-grid">
    {field(<>שם הספק {req}</>,<input value={f.name} onChange={e=>{setF(v=>({...v,name:e.target.value}));dirty();}} maxLength={200} required/>)}
    {field('איש קשר',<input value={f.contact} onChange={e=>{setF(v=>({...v,contact:e.target.value}));dirty();}} maxLength={200}/>)}
    {field('מייל לקבלת כתבות',<input type="email" dir="ltr" value={f.email} onChange={e=>{setF(v=>({...v,email:e.target.value}));dirty();}} maxLength={254}/>)}
    {field('טלפון',<input type="tel" dir="ltr" value={f.phone} onChange={e=>{setF(v=>({...v,phone:e.target.value}));dirty();}} maxLength={40}/>)}
   </div>
  </section>
  <section className="nsp-card" aria-labelledby="nsp-2"><div className="nsp-sec"><span className="nsp-n">2</span><h2 id="nsp-2">איך משלמים לספק</h2><small>אפשר לשנות אתר מסוים אחר כך</small></div>
   <BillingTypeCards value={billing} onChange={v=>{setBilling(v);dirty();}}/>
   {billing==='pool'&&<div className="nsp-stock"><b className="nsp-stock-t">החבילה של הספק</b>
    {field('כמה כתבות בחבילה',<input type="number" inputMode="numeric" min={1} step={1} value={pool.qty} onChange={e=>{setPool(v=>({...v,qty:e.target.value}));dirty();}}/>)}
    {field('עלות החבילה',<span className="nsp-money"><input type="number" inputMode="decimal" min={0} step="0.01" value={pool.total} onChange={e=>{setPool(v=>({...v,total:e.target.value}));dirty();}}/><i>₪</i></span>)}
    <small className="nsp-note">לא חובה עכשיו. אפשר להוסיף או להגדיל את החבילה אחר כך ב״הוספת מלאי״ בכרטיס הספק.</small></div>}
  </section>
  <section className="nsp-card" aria-labelledby="nsp-3"><div className="nsp-sec"><span className="nsp-n">3</span><h2 id="nsp-3">האתרים של הספק</h2><small>{count===1?'אתר אחד':count+' אתרים'}</small></div>
   {sites.map((s,i)=>{const w=known(s);return <article key={s.key} className={'nsp-site'+(s.done?' is-done':'')+(s.error?' is-error':'')} aria-label={'אתר '+(i+1)}>
    <div className="nsp-site-h"><span className="nsp-sn">{i+1}</span><b>{s.attach?.name||s.name||hostOf(s.url)||'אתר חדש'}</b>{s.done&&<span className="nsp-saved"><Check size={14} aria-hidden="true"/>נשמר</span>}
     {sites.length>1&&!s.done&&<button type="button" className="nsp-rm" onClick={()=>{setSites(list=>list.filter(x=>x.key!==s.key));dirty();}}><Trash2 size={15} aria-hidden="true"/>הסרה</button>}</div>
    {s.attach?<div className="nsp-attached"><Link2 size={16} aria-hidden="true"/><span><b>{s.attach.name}</b> כבר בקטלוג ויצורף לספק הזה עם הפרטים והמחירים שלו.</span><button type="button" className="nsp-link" onClick={()=>setSite(s.key,{attach:null,url:''})}>ביטול</button></div>:<div className="nsp-grid">
     {field(<>כתובת האתר (URL) {req}</>,<input dir="ltr" inputMode="url" placeholder="example.co.il" value={s.url} disabled={s.done} onChange={e=>onUrl(s,e.target.value)}/>)}
     {w&&<div className="nsp-known is-wide" role="status"><span>האתר <b>{w.name}</b> כבר בקטלוג{w.supplier_name?<> (אצל הספק <bdi>{w.supplier_name}</bdi>)</>:' (בלי ספק)'}.</span><button type="button" className="nsp-btn is-small" onClick={()=>setSite(s.key,{attach:w})}><Link2 size={15} aria-hidden="true"/>לצרף לספק הזה</button></div>}
     {field(<>שם האתר {req}</>,<input value={s.name} disabled={s.done} onChange={e=>setSite(s.key,{name:e.target.value,named:true})} maxLength={200}/>,false,'מתמלא לבד מהכתובת, אפשר לשנות')}
     <div className="nsp-f"><span className="nsp-lbl">תמונת האתר (לוגו)</span><label className="nsp-logo"><span className={'nsp-thumb'+(s.logo?'':' is-empty')}>{s.logo?<img src={s.logo} alt=""/>:<Upload size={18} aria-hidden="true"/>}</span><span><b>{s.logo?'להחלפת התמונה':'העלאת תמונה'}</b><small>PNG, JPG, GIF או WEBP · עד 5MB</small></span><input type="file" className="nsp-sr" accept="image/png,image/jpeg,image/gif,image/webp" disabled={s.done} onChange={e=>{void upload(s,e.target.files?.[0]);e.target.value='';}}/></label></div>
     {field(<>קטגוריה {req}</>,<select value={s.category} disabled={s.done} onChange={e=>setSite(s.key,{category:e.target.value})}><option value="">בחירת קטגוריה</option>{Object.entries(categories).map(([k,l])=><option key={k} value={k}>{l}</option>)}</select>)}
     {billing==='exchange'?<p className="nsp-exch"><ArrowLeftRight size={15} aria-hidden="true"/>בהחלפה לא משלמים לספק. העלות נקבעת לפי האתר שהוא בוחר בתמורה.</p>:
      field('מחיר עלות לנו',<span className="nsp-money"><input type="number" inputMode="decimal" min={0} step="0.01" value={s.cost} disabled={s.done} onChange={e=>setSite(s.key,{cost:e.target.value})}/><i>₪ לפני מע״מ</i></span>,false,'מה שאנחנו משלמים לספק על כתבה')}
     {field(<>מחיר מחירון {req}</>,<span className="nsp-money"><input type="number" inputMode="decimal" min={0} step="0.01" value={s.price} disabled={s.done} onChange={e=>setSite(s.key,{price:e.target.value})}/><i>₪ לפני מע״מ</i></span>,false,'מה שהלקוח משלם באתר שלנו')}
     {billing==='stock'&&<div className="nsp-stock is-wide"><b className="nsp-stock-t">מלאי לאתר הזה</b>
      {field('כמה כתבות במלאי',<input type="number" inputMode="numeric" min={1} step={1} value={s.qty} disabled={s.done} onChange={e=>setSite(s.key,{qty:e.target.value})}/>)}
      {field('עלות החבילה לאתר',<span className="nsp-money"><input type="number" inputMode="decimal" min={0} step="0.01" value={s.total} disabled={s.done} onChange={e=>setSite(s.key,{total:e.target.value})}/><i>₪</i></span>)}</div>}
     {field('כתבה לדוגמה',<input dir="ltr" inputMode="url" placeholder="https://" value={s.sample} disabled={s.done} onChange={e=>setSite(s.key,{sample:e.target.value})}/>,true,'קישור לכתבה שפורסמה באתר')}
    </div>}
    {s.error&&<p className="nsp-err" role="alert">{s.error}</p>}
   </article>;})}
   <button type="button" className="nsp-add" onClick={()=>{setSites(list=>[...list,blank()]);dirty();}}><Plus size={18} aria-hidden="true"/>הוספת אתר נוסף לספק</button>
  </section>
  <section className="nsp-card" aria-labelledby="nsp-4"><div className="nsp-sec"><span className="nsp-n">4</span><h2 id="nsp-4">אופן התנהלות והערות</h2><small>לא חובה</small></div>
   <div className="nsp-grid">
    {field('אופן ההתנהלות',<textarea rows={3} value={f.workflow} placeholder="איך שולחים כתבות, זמני תגובה, למי פונים בעניין תשלום" onChange={e=>{setF(v=>({...v,workflow:e.target.value}));dirty();}} maxLength={6000}/>,true)}
    {field('הסכם והערות פנימיות',<textarea rows={3} value={f.notes} placeholder="תנאים מיוחדים, הנחות, הערות" onChange={e=>{setF(v=>({...v,notes:e.target.value}));dirty();}} maxLength={6000}/>,true,'גלוי רק בניהול')}
   </div>
  </section>
  {error&&<p className="nsp-err is-main" role="alert">{error}</p>}
  <div className="nsp-save"><small>{supplierId.current?'הספק כבר נשמר. השמירה תמשיך מהאתר שלא נשמר.':count?'יישמרו הספק ו'+(count===1?'אתר אחד':'-'+count+' אתרים')+' לקטלוג':'יישמר הספק בלי אתרים'}</small>
   <button type="button" className="nsp-btn" disabled={busy} aria-busy={busy||undefined} onClick={()=>void save()}>{busy?<Loader2 size={18} className="nsp-spin" aria-hidden="true"/>:<Check size={18} aria-hidden="true"/>}{busy?step||'שומר…':'שמירת הספק והאתרים'}</button></div>
 </div>;
}
