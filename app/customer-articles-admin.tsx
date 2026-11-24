'use client';
import React,{useState} from 'react';
import {FileText,Clock,CheckCheck,Eye,ExternalLink,Search,Pencil,ShieldCheck} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Row,stages,when} from '@/lib/shared';
import {purchaseStage,publicationLink} from '@/lib/purchased-history';
import {articleAmounts,orderCancellation} from '@/lib/order-finance';
import {Ctx} from './workspace';
import {PurchaseRow} from './purchased-view';

export const customerArticleGroups=[{key:'open',label:'פתוחות אצל הלקוח',icon:FileText},{key:'publication',label:'ממתינות לפרסום',icon:Clock},{key:'published',label:'פורסמו',icon:CheckCheck}];
export function customerArticleGroup(a:Row,o?:Row):string|null{
 if(articleAmounts(a).publicationRefunded||o&&orderCancellation(o)==='full')return null;
 const stage=purchaseStage(a);
 return stage==='editing'||stage==='approval'?'open':stage==='publication'||stage==='published'?stage:null;
}
export function selectCustomerArticles(articles:Row[],orders:Row[],group:string,query:string){
 const q=query.trim().toLocaleLowerCase(),byOrder=new Map(orders.map(o=>[o.id,o]));
 return articles.filter(a=>customerArticleGroup(a,byOrder.get(a.order_id))===group&&(!q||[a.title,a.topic,a.website_name,a.website_url,a.number,byOrder.get(a.order_id)?.number].some(v=>String(v||'').toLocaleLowerCase().includes(q))));
}
export default function CustomerArticlesAdmin({ctx,articles,orders,preview}:{ctx:Ctx;articles:Row[];orders:Row[];preview:(a:Row)=>void}){
 const [group,setGroup]=useState('open'),[query,setQuery]=useState('');
 const rows=selectCustomerArticles(articles,orders,group,query),sites=new Map<string,Row>((ctx.catalog||[]).map((w:Row)=>[w.id,w]));
 return <section className="customer-articles-admin" dir="rtl" aria-label="הכתבות של הלקוח">
  <h2>הכתבות של הלקוח</h2>
  <div className="customer-article-groups" aria-label="סינון לפי מצב הכתבה">{customerArticleGroups.map(g=><button key={g.key} type="button" aria-pressed={group===g.key} onClick={()=>setGroup(g.key)}><g.icon size={22}/><strong>{selectCustomerArticles(articles,orders,g.key,'').length}</strong><span>{g.label}</span></button>)}</div>
  <div className="customer-article-search"><Search size={20} aria-hidden="true"/><Input aria-label="חיפוש כתבה, אתר או מספר הזמנה" placeholder="חיפוש כתבה, אתר או מספר הזמנה" value={query} onChange={e=>setQuery(e.target.value)}/>{query&&<Button variant="outline" onClick={()=>setQuery('')}>איפוס</Button>}</div>
  <p className="customer-article-count" role="status">{rows.length} כתבות מוצגות</p>
  {/* 24.11.2026 (owner) The rows of the customer's "הכתבות שלי": site logo, name and address, title, state, order number. Admin buttons. */}
  <div className="client-hub approved-account personal-apple cf-article-rows"><div className="approved-article-rows flex min-w-0 flex-col gap-4">{rows.map(a=>{const live=publicationLink(a),approval=a.status==='admin_review',btn='inline-flex h-auto min-h-11 items-center justify-center gap-2 whitespace-normal rounded-full px-4 py-2.5 text-sm font-bold w-full min-w-0';
   return <PurchaseRow key={a.id} article={a} site={sites.get(a.website_id)} ctx={ctx} actions={<div className="purchase-modern-actions"><div className="purchase-action-row"><div className="purchase-action-buttons">
    <Button className={btn+' bg-teal-400 text-slate-950 hover:bg-teal-300'} onClick={()=>ctx.go('admin-article/'+a.id)}>{approval?<><ShieldCheck size={16}/>בדיקה ואישור</>:<><Pencil size={16}/>עריכה</>}</Button>
    <div className="purchase-secondary-actions">{live?<a href={live} target="_blank" rel="noreferrer" className={btn+' border border-slate-500 bg-white text-slate-950'}><ExternalLink size={16}/>קישור לכתבה</a>:<Button variant="outline" className={btn+' border border-slate-500 bg-white text-slate-950'} onClick={()=>preview(a)}><Eye size={16}/>צפייה בכתבה</Button>}</div>
   </div></div></div>}/>;})}</div></div>
  {!rows.length&&<div className="customer-article-empty">{query?'לא נמצאו כתבות התואמות לחיפוש.':'אין כרגע כתבות בקבוצה זו.'}</div>}
 </section>;
}
