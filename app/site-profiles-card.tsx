'use client';
import React,{useEffect,useRef,useState} from 'react';
import {Loader2,Pause,Play,RotateCcw,Sparkles} from 'lucide-react';
import {toast} from 'sonner';
import {api,useData} from '@/lib/client';
import type {Row} from '@/lib/shared';
import type {Ctx} from './workspace';
import './site-match.css';

// "ניתוח האתרים עם Claude" (owner 27.11.2026, mockup design/ai-ideas 5): the system reads every catalog site through
// the Claude API in the background (the maintenance tick) and keeps a profile for the recommendations. Here the admin
// sees the progress, can run batches now while the page is open, pause, and send failed sites back to the queue.
export function SiteProfilesCard({ctx}:{ctx:Ctx}){
 const state=useData('admin/site-profiles',ctx.revision);
 const [data,setData]=useState<Row|null>(null),[running,setRunning]=useState(false),[busy,setBusy]=useState('');
 const live=useRef(false);
 useEffect(()=>{if(state.data)setData(state.data);},[state.data]);
 useEffect(()=>()=>{live.current=false;},[]);
 const s=data||state.data;
 if(!s)return null;
 const pct=s.total?Math.round((s.done+s.failed)/s.total*100):0;
 const run=async()=>{if(running){live.current=false;setRunning(false);return;}live.current=true;setRunning(true);
  try{while(live.current){const r=await api('admin/site-profiles/run','POST',{},{background:true});setData(r.status);if(!r.analyzed&&!r.failed)break;}}
  catch(e){toast.error((e as Error).message);}finally{live.current=false;setRunning(false);}};
 const act=async(path:string,body:Row={})=>{setBusy(path);try{setData(await api('admin/site-profiles/'+path,'POST',body,{background:true}));}catch(e){toast.error((e as Error).message);}finally{setBusy('');}};
 const p=s.sample?.profile||null;
 return <section className="spc" dir="rtl" aria-labelledby="spc-title">
  <header><h3 id="spc-title"><span className="sm-spark" aria-hidden="true"><Sparkles size={20}/></span>ניתוח האתרים עם Claude</h3><span className={'spc-state'+(running?' is-live':s.paused?' is-paused':'')}>{running?'מנתח עכשיו':s.paused?'מושהה':s.pending?'רץ ברקע':'הושלם'}</span></header>
  <p>המערכת קוראת כל אתר בקטלוג דרך ה־API של Claude, ושומרת לו נושאים, קהל, סוג אתר ומה מתאים לו. ההמלצות ללקוחות נבנות מזה.</p>
  <div className="spc-prog"><span>נותחו <b>{s.done.toLocaleString('he-IL')}</b> מתוך {s.total.toLocaleString('he-IL')} אתרים</span><div className="sm-track"><i className="add" style={{width:pct+'%'}}/></div></div>
  <div className="spc-stats"><div><b>{s.done.toLocaleString('he-IL')}</b><small>נותחו</small></div><div><b>{s.pending.toLocaleString('he-IL')}</b><small>בתור</small></div><div><b>{s.failed.toLocaleString('he-IL')}</b><small>לא נפתחו</small></div><div><b>${s.estimated_cost_usd}</b><small>עלות משוערת</small></div></div>
  <div className="spc-acts">
   <button type="button" className="sm-go" onClick={()=>void run()} disabled={!s.pending&&!running}>{running?<Loader2 className="sm-spin" size={17}/>:<Play size={17}/>}{running?'עצירה':'ניתוח עכשיו'}</button>
   <button type="button" className="spc-btn" disabled={!!busy} onClick={()=>void act('pause',{paused:!s.paused})}>{s.paused?<Play size={16}/>:<Pause size={16}/>}{s.paused?'המשך ברקע':'השהיה ברקע'}</button>
   {s.failed>0&&<button type="button" className="spc-btn" disabled={!!busy} onClick={()=>void act('retry')}><RotateCcw size={16}/>ניסיון חוזר ל־{s.failed}</button>}
  </div>
  {s.sample&&p&&<div className="spc-ex"><div className="spc-ex-head"><b>{s.sample.name}</b><bdi dir="ltr">{String(s.sample.url||'').replace(/^https?:\/\/(www\.)?/,'').replace(/\/$/,'')}</bdi><button type="button" className="spc-btn sm" disabled={!!busy} onClick={()=>void act(encodeURIComponent(s.sample.id)+'/redo')}><RotateCcw size={14}/>ניתוח מחדש</button></div>
   <dl><dt>נושאים</dt><dd className="spc-tags">{(p.topics||[]).map((t:string)=><span key={t}>{t}</span>)}</dd><dt>קהל</dt><dd>{p.audience}</dd><dt>סוג אתר</dt><dd>{p.site_type}</dd><dt>מתאים לכתבה על</dt><dd>{p.good_for}</dd><dt>נבדק</dt><dd>{new Date(p.checked_at).toLocaleDateString('he-IL')}{p.source==='home'?' · מתוך דף הבית':' · לפי השם והקטגוריה'}</dd></dl></div>}
 </section>;
}
