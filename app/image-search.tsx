'use client';
// Stock photos for an article (owner 23.11.2026): one search box in Hebrew or English. When Hebrew was turned into
// English the line "חיפשנו: …" shows what was searched, and the words can be changed. Results come from Pixabay when it
// is connected (Pexels when Pixabay has nothing); the chosen photo is saved on our server with its credit.
import React,{useEffect,useRef,useState} from 'react';
import {ImageOff,Loader2,Pencil,Search,X} from 'lucide-react';
import {api} from '@/lib/client';
import type {Row} from '@/lib/shared';
import './image-search.css';

type Result={photos:Row[];source:string;query:string;original:string;translated:boolean};
// A preview tries each address in turn (public copy, small preview, through our server); if none opens, a quiet
// placeholder shows instead of the photo's tags as text (owner 24.11.2026: "שתמיד יוצגו תמונות").
function Thumb({p}:{p:Row}){
 const list=[p.src,...(Array.isArray(p.fallbacks)?p.fallbacks:[])].filter(Boolean) as string[];
 const [i,setI]=useState(0);
 if(i>=list.length)return <span className="isx-noimg" aria-hidden="true"><ImageOff size={22}/></span>;
 return <img key={list[i]} src={list[i]} alt="" loading="lazy" referrerPolicy="no-referrer" onError={()=>setI(n=>n+1)}/>;
}
const SOURCES:Record<string,[string,string]>={pixabay:['Pixabay','https://pixabay.com/'],pexels:['Pexels','https://www.pexels.com/']};

// Owner 27.11.2026: searching and picking load only inside this panel (its own skeleton and "שומר…"), never the
// whole page, so both calls run in the background.
export function ImageSearch({onSelected}:{onSelected:(file:Row)=>void}){
 const [text,setText]=useState(''),[result,setResult]=useState<Result|null>(null),[busy,setBusy]=useState(false),[picking,setPicking]=useState(''),[error,setError]=useState(''),[editing,setEditing]=useState(false),[term,setTerm]=useState('');
 const retry=useRef<ReturnType<typeof setTimeout>|null>(null);
 useEffect(()=>()=>{if(retry.current)clearTimeout(retry.current);},[]);
 const run=async(q:string,exact=false,again=false)=>{
  if(!q.trim()||(busy&&!again))return;setBusy(true);setError('');setEditing(false);
  try{const r=await api('image-search?query='+encodeURIComponent(q.trim())+(exact?'&exact=1':''),'GET',undefined,{background:true});setResult(exact&&result?{...r,original:result.original,translated:true}:r);setTerm(r.query);setBusy(false);}
  catch(e){const message=(e as Error).message;
   // The library is busy for a few seconds: say so and search again by itself once.
   if(!again&&/עמוס/.test(message)){setError('מאגר התמונות עמוס לרגע. מנסים שוב אוטומטית…');retry.current=setTimeout(()=>void run(q,exact,true),8000);return;}
   setError(message);setBusy(false);}
 };
 const pick=async(p:Row)=>{
  if(picking)return;setPicking(p.source+':'+p.id);setError('');
  try{onSelected(await api('image-import','POST',{photo_id:p.id,source:p.source},{background:true}));}catch(e){setError((e as Error).message);}finally{setPicking('');}
 };
 const [sourceName,sourceUrl]=SOURCES[result?.source||'']||SOURCES.pixabay;
 return <div className="isx" dir="rtl">
  <form className="isx-bar" role="search" onSubmit={e=>{e.preventDefault();void run(text);}}>
   <label className="isx-field"><Search size={18} aria-hidden="true"/><input value={text} onChange={e=>setText(e.target.value)} placeholder="נושא התמונה, בעברית או באנגלית" aria-label="נושא התמונה" enterKeyHint="search" maxLength={100}/></label>
   <button type="submit" className="isx-go" disabled={busy||!text.trim()}>{busy?<Loader2 size={18} className="isx-spin" aria-hidden="true"/>:null}{busy?'מחפש…':'חיפוש'}</button>
  </form>
  {result?.translated&&!editing&&<p className="isx-used">חיפשנו: <bdi dir="ltr" className="isx-term">{result.query}</bdi><button type="button" className="isx-link" onClick={()=>{setTerm(result.query);setEditing(true);}}><Pencil size={13} aria-hidden="true"/>שינוי</button></p>}
  {editing&&<form className="isx-edit" onSubmit={e=>{e.preventDefault();void run(term,true);}}>
   <input dir="ltr" value={term} onChange={e=>setTerm(e.target.value)} aria-label="מילות החיפוש באנגלית" maxLength={100}/>
   <button type="submit" className="isx-go is-small" disabled={busy||!term.trim()}>חיפוש</button>
   <button type="button" className="isx-x" aria-label="ביטול השינוי" onClick={()=>setEditing(false)}><X size={16} aria-hidden="true"/></button>
  </form>}
  {error&&<p className="isx-error" role="alert">{error}</p>}
  {busy&&!result&&<ul className="isx-grid" aria-hidden="true">{Array.from({length:6},(_,i)=><li key={i}><span className="isx-skel"/></li>)}</ul>}
  {result&&(result.photos.length?<ul className={'isx-grid'+(busy?' is-dim':'')} aria-label="תוצאות החיפוש">{result.photos.map(p=>{const key=p.source+':'+p.id,saving=picking===key;return <li key={key}>
   <button type="button" className="isx-tile" disabled={!!picking} aria-busy={saving||undefined} aria-label={'בחירת התמונה'+(p.photographer?' של '+p.photographer:'')} onClick={()=>void pick(p)}>
    <Thumb p={p}/>
    {saving&&<span className="isx-saving"><Loader2 size={18} className="isx-spin" aria-hidden="true"/>שומר…</span>}
   </button>
   <small className="isx-by">צילום: <bdi>{p.photographer}</bdi></small>
  </li>;})}</ul>:<div className="isx-empty" role="status"><ImageOff size={22} aria-hidden="true"/><p>לא נמצאו תמונות ל<bdi dir="auto">"{result.query}"</bdi>. נסו מילה אחרת או כללית יותר.</p></div>)}
  {result&&<p className="isx-src">תמונות מ-<a href={sourceUrl} target="_blank" rel="noreferrer">{sourceName}</a>{result.photos.length?' · לחיצה על תמונה שומרת אותה לכתבה':''}</p>}
 </div>;
}
