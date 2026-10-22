'use client';
import {useState,useRef,useEffect} from 'react';
import {Search,X,ArrowLeft,ArrowRight} from 'lucide-react';
import {api} from '@/lib/client';
import type {KnowledgeSummary,KnowledgeCategory} from '@/lib/knowledge';
import {KnowledgeWaves,KnowledgeCard,KnowledgeCta} from './knowledge-components';

type HubData={articles:KnowledgeSummary[];categories:KnowledgeCategory[];total:number;page:number};
export default function KnowledgeHub({initial,initialQuery='',initialCategory=''}:{initial:HubData;initialQuery?:string;initialCategory?:string}){
 const [data,setData]=useState(initial),[query,setQuery]=useState(initialQuery),[category,setCategory]=useState(initialCategory),[loading,setLoading]=useState(false),[error,setError]=useState('');
 const search=useRef<HTMLInputElement>(null),controller=useRef<AbortController|null>(null),sequence=useRef(0);
 useEffect(()=>()=>controller.current?.abort(),[]);
 const load=async(q:string,c:string,page=1)=>{
  controller.current?.abort();const abort=new AbortController();controller.current=abort;const seq=++sequence.current;setLoading(true);setError('');
  try{
   const params=new URLSearchParams({q,category:c,page:String(page)});
   const result=await api('knowledge?'+params,'GET',undefined,{background:true,signal:abort.signal});
   if(sequence.current===seq){setData(result);window.history.replaceState({},'','/knowledge'+(q||c||page>1?'?'+params:''));}
  }catch(e){if((e as Error).name!=='AbortError'&&sequence.current===seq)setError((e as Error).message);}
  finally{if(sequence.current===seq)setLoading(false);}
 };
 const featured=data.articles.find(a=>a.featured)||data.articles[0],rest=data.articles.filter(a=>a.id!==featured?.id);
 return <main className="knowledge-main knowledge-hub" id="knowledge-content">
  <KnowledgeWaves/>
  <nav className="knowledge-breadcrumb" aria-label="מיקום באתר"><a href="/">דף הבית</a><span>/</span><span aria-current="page">מדריכים וידע</span></nav>
  <header className="knowledge-hub-hero">
   <h1><span>מדריכים וידע.</span><span className="knowledge-hub-accent">כלים לפרסום חכם.</span></h1>
   <p>מדריכים, טיפים ותובנות שיעזרו לכם לפרסם נכון.</p>
  </header>
  <div className="knowledge-filters">
   <form className="knowledge-search" role="search" noValidate onSubmit={e=>{e.preventDefault();void load(query,category);}}>
    <label className="sr-only" htmlFor="knowledge-search">חיפוש מדריכים</label>
    <input id="knowledge-search" ref={search} value={query} maxLength={200} onChange={e=>setQuery(e.target.value)} placeholder="מה תרצו ללמוד?"/>
    {query&&<button type="button" aria-label="ניקוי החיפוש" onClick={()=>{setQuery('');void load('',category);search.current?.focus();}}><X size={17}/></button>}
    <button type="submit" aria-label="חיפוש" disabled={loading}><Search size={20}/></button>
   </form>
   <div className="knowledge-categories" role="group" aria-label="סינון לפי נושא">
    {[{id:'',name:'הכל'},...data.categories].map(c=><button type="button" key={c.id} aria-pressed={category===c.id} className={category===c.id?'is-active':''} disabled={loading} onClick={()=>{setCategory(c.id);void load(query,c.id);}}>{c.name}</button>)}
   </div>
  </div>
  <div aria-busy={loading} className="knowledge-results">
   {loading&&<p role="status" className="knowledge-loading">טוען מדריכים…</p>}
   {error&&<div className="knowledge-error" role="alert">{error}<button type="button" onClick={()=>load(query,category)}>ניסיון נוסף</button></div>}
   {!loading&&!error&&!featured&&<div className="knowledge-empty">
    <h2>{query||category?'לא נמצאו מדריכים מתאימים':'המדריכים שלנו בדרך'}</h2>
    <p>{query||category?'נסו נושא אחר או נקו את הסינון.':'כאן יופיעו המדריכים לאחר הפרסום הראשון.'}</p>
    {(query||category)&&<button type="button" className="knowledge-button" onClick={()=>{setQuery('');setCategory('');void load('','');}}>ניקוי הסינון</button>}
   </div>}
   {featured&&<><KnowledgeCard article={featured} categories={data.categories} featured hub/><div className="knowledge-card-grid">{rest.map(a=><KnowledgeCard key={a.id} article={a} categories={data.categories} hub/>)}</div></>}
   {data.total>24&&<nav className="knowledge-pagination" aria-label="עמודי מדריכים">
    <button type="button" disabled={loading||data.page<=1} onClick={()=>load(query,category,data.page-1)}><ArrowRight size={17}/>הקודם</button>
    <span>עמוד {data.page} מתוך {Math.ceil(data.total/24)}</span>
    <button type="button" disabled={loading||data.page*24>=data.total} onClick={()=>load(query,category,data.page+1)}>הבא<ArrowLeft size={17}/></button>
   </nav>}
  </div>
  <KnowledgeCta/>
 </main>;
}
