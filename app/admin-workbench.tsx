'use client';
import React,{useEffect,useId,useRef,useState} from 'react';
import {ArrowRight,ChevronLeft,Search,X} from 'lucide-react';

export type WorkbenchItem={id:string;title:string;meta?:React.ReactNode;status?:React.ReactNode;attention?:boolean};

// Presentation only: the owning screen retains selection, queries and actions.
// On phones the same detail pane is disclosed; no form or action is duplicated.
export function AdminWorkbench({label,items,selectedId,onSelect,children,loading=false,empty='אין רשומות בתצוגה זו.'}:{label:string;items:WorkbenchItem[];selectedId:string;onSelect:(id:string)=>void;children:React.ReactNode;loading?:boolean;empty?:string}){
 const id=useId(),list=useRef<HTMLDivElement>(null),heading=useRef<HTMLHeadingElement>(null);
 const [detailOpen,setDetailOpen]=useState(false);
 const selected=items.find(item=>item.id===selectedId),hasSelected=!!selected;
 useEffect(()=>{if(detailOpen&&hasSelected)heading.current?.focus();},[detailOpen,selectedId,hasSelected]);
 const back=()=>{setDetailOpen(false);requestAnimationFrame(()=>list.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus());};
 return <div className={'admin-workbench'+(detailOpen&&selected?' is-detail-open':'')}>
  <section className="admin-workbench-list" aria-label={label} ref={list}>
   <h2>{label}<span>{items.length}</span></h2>
   <div className="admin-workbench-rows">{items.map(item=><button type="button" key={item.id} className={'admin-workbench-row'+(item.id===selectedId?' is-selected':'')} aria-pressed={item.id===selectedId} aria-controls={id} onClick={()=>{onSelect(item.id);setDetailOpen(true);}}>
    <span className="admin-workbench-row-copy"><strong>{item.title}</strong>{item.meta&&<span>{item.meta}</span>}</span>
    <span className="admin-workbench-row-end">{item.status&&<span className={item.attention?'admin-workbench-pending':'admin-workbench-status'}>{item.attention&&<i aria-hidden="true"/>}{item.status}</span>}<ChevronLeft size={16} aria-hidden="true"/></span>
   </button>)}</div>
   {loading&&!items.length&&<p className="admin-workbench-empty" role="status">טוען רשומות…</p>}
   {!loading&&!items.length&&<p className="admin-workbench-empty">{empty}</p>}
  </section>
  <section id={id} className="admin-workbench-detail" aria-labelledby={id+'-heading'}>
   <button type="button" className="admin-workbench-back" onClick={back}><ArrowRight size={17} aria-hidden="true"/>חזרה ל{label}</button>
   <header className="admin-workbench-detail-heading"><h2 id={id+'-heading'} ref={heading} tabIndex={-1}>{selected?.title||'בחרו רשומה מהרשימה'}</h2>{selected?.meta&&<p>{selected.meta}</p>}</header>
   <div className="admin-workbench-detail-body">{selected?children:<p className="admin-workbench-empty">בחירת רשומה מציגה כאן את הפרטים ואת אפשרויות הטיפול.</p>}</div>
  </section>
 </div>;
}

export function AdminSearch({value,onChange,label}:{value:string;onChange:(value:string)=>void;label:string}){
 const input=useRef<HTMLInputElement>(null);
 return <label className="admin-workbench-search"><Search size={18} aria-hidden="true"/><input ref={input} type="search" aria-label={label} placeholder={label} value={value} onChange={e=>onChange(e.target.value)}/>{value&&<button type="button" aria-label={'ניקוי '+label} onClick={()=>{onChange('');input.current?.focus();}}><X size={17} aria-hidden="true"/></button>}</label>;
}
