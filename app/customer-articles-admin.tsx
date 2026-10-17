'use client';
import React,{useState} from 'react';
import {FileText,Clock,CheckCheck,Eye,ExternalLink,Search} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Row,stages,when} from '@/lib/shared';
import {purchaseStage,publicationLink} from '@/lib/purchased-history';
import {articleAmounts,orderCancellation} from '@/lib/order-finance';
import {Ctx} from './workspace';
import SiteReference from './site-reference';

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
 const rows=selectCustomerArticles(articles,orders,group,query),byOrder=new Map(orders.map(o=>[o.id,o]));
 return <section className="customer-articles-admin" dir="rtl" aria-label="הכתבות של הלקוח">
  <h2>הכתבות של הלקוח</h2>
  <div className="customer-article-groups" aria-label="סינון לפי מצב הכתבה">{customerArticleGroups.map(g=><button key={g.key} type="button" aria-pressed={group===g.key} onClick={()=>setGroup(g.key)}><g.icon size={22}/><strong>{selectCustomerArticles(articles,orders,g.key,'').length}</strong><span>{g.label}</span></button>)}</div>
  <div className="customer-article-search"><Search size={20} aria-hidden="true"/><Input aria-label="חיפוש כתבה, אתר או מספר הזמנה" placeholder="חיפוש כתבה, אתר או מספר הזמנה" value={query} onChange={e=>setQuery(e.target.value)}/>{query&&<Button variant="outline" onClick={()=>setQuery('')}>איפוס</Button>}</div>
  <p className="customer-article-count" role="status">{rows.length} כתבות מוצגות</p>
  <div className="customer-article-grid">{rows.map(a=>{const o=byOrder.get(a.order_id),live=publicationLink(a),approval=a.status==='admin_review';return <article className="customer-article-card" key={a.id}>
   <h3>{a.title||a.topic||'טרם נוספה כותרת'}</h3>
   <div className="customer-article-identity"><SiteReference name={a.website_name} url={a.website_url}/><span className={'customer-article-badge '+(approval?'needs-approval':group==='published'?'is-published':'')}>{a.cancel_pending?'ממתינה לאישור ביטול':stages[a.status]||a.status}</span></div>
   <dl><div><dt>מספר הזמנה</dt><dd><bdi>{o?.number||a.number||'—'}</bdi></dd></div><div><dt>{group==='published'?'תאריך פרסום':'תאריך רכישה'}</dt><dd>{when(group==='published'?(a.published_at||a.updated):(o?.created||a.created))}</dd></div></dl>
   <div className="customer-article-buttons"><Button onClick={()=>approval?ctx.go('admin-article/'+a.id):preview(a)}><Eye size={17}/>{approval?'בדיקה ואישור':'צפייה בכתבה'}</Button>{!approval&&group!=='published'&&<Button variant="outline" onClick={()=>ctx.go('admin-article/'+a.id)}><FileText size={17}/>סביבת התוכן</Button>}{live&&<a href={live} target="_blank" rel="noreferrer"><ExternalLink size={17}/>קישור לכתבה</a>}</div>
  </article>;})}</div>
  {!rows.length&&<div className="customer-article-empty">{query?'לא נמצאו כתבות התואמות לחיפוש.':'אין כרגע כתבות בקבוצה זו.'}</div>}
 </section>;
}
