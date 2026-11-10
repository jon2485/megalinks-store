'use client';
import {useAdminDraftGuard} from './admin-draft-guard';
import CustomerFileOrders from './customer-file-orders';
import CustomerArticlesAdmin from './customer-articles-admin';
import SiteReference from './site-reference';
import {RefundForm} from './refund-dialog';
import {OrderPaymentFooter} from './order-payment-footer';
import {paymentStatusLabel} from '@/lib/payment-state';
import React,{useState,useRef} from 'react';
import {Eye,Plus,ArrowRight,Wallet,History,FileText} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Textarea} from '@/components/ui/textarea';
import {api,pricingApi,useData} from '@/lib/client';
import {Row,money,when,stages} from '@/lib/shared';
import {articleAmounts,effectiveOrderTotal,refundAmounts,orderCancellation,orderCancellationLabel} from '@/lib/order-finance';
import {Ctx,ErrorBox,Pick,Field} from './workspace';
import {ActionForm} from './screens';
import {PersonalPricebook} from './pricing-admin';
import {CreateCustomerOrder} from './customer-order-picker';
import './customer-file-v2.css';
export {CreateCustomerOrder};
const base='admin/customer-account/';
const roleNames:Record<string,string>={customer:'לקוח',agency:'סוכנות',supplier:'ספק',admin:'מנהל'};
const initials=(name='')=>name.trim().split(/\s+/).slice(0,2).map(w=>w[0]).join('')||'ל';
export function ArticlePreview({ctx,id}:{ctx:Ctx;id:string}){const state=useData('articles/'+id,ctx.revision),a=state.data?.article;return <div dir="rtl" className="space-y-4 text-right"><ErrorBox error={state.error}/>{state.loading?<p>טוען כתבה…</p>:a&&<><div className="account-inline-info"><b>{a.website_name||state.data.website?.name}</b><span>{a.cancel_pending?'ממתין לאישור ביטול':stages[a.status]||a.status}</span><span>מזהה כתבה: {a.id}</span></div><h3>{a.title||'טרם נוספה כותרת'}</h3>{a.content?<iframe title="תוכן הכתבה" sandbox="" className="h-[45vh] w-full rounded-xl border bg-white" srcDoc={'<!doctype html><html dir="rtl"><head><meta http-equiv="Content-Security-Policy" content="script-src &#39;none&#39;; object-src &#39;none&#39;"><style>body{font:16px Arial;line-height:1.8;padding:16px;color:#09234b}img{max-width:100%;height:auto}figure{margin:10px 0}figcaption{text-align:center;font-size:12px}</style></head><body>'+a.content+'</body></html>'}/>:<p className="account-note">טרם נוסף תוכן. {a.editorial?'הוזמנה כתיבה מקצועית.':''}</p>}{a.editorial&&!a.content&&<dl><dt>נושא</dt><dd>{a.topic||a.title}</dd><dt>הוראות לכותב</dt><dd className="whitespace-pre-wrap">{a.writer_instructions||a.notes||'טרם נוספו הוראות'}</dd></dl>}{a.content&&<a href={'/api/articles/'+a.id+'/document'} className="text-blue-700 underline">הורדת הכתבה בוורד</a>}<Button variant="outline" onClick={()=>ctx.go('admin-article/'+id)}>מעבר לסביבת התוכן</Button></>}</div>;}
export {RefundForm} from './refund-dialog';
export function CustomerOrderDialog({ctx,id,close}:{ctx:Ctx;id:string;close:()=>void}){const state=useData(base+id,ctx.revision);return state.data?<CreateCustomerOrder ctx={ctx} id={id} data={state.data} close={close}/>:<div dir="rtl"><ErrorBox error={state.error}/>{!state.error&&<p role="status">טוען את פרטי הלקוח…</p>}</div>;}
export const openCustomerOrder=(ctx:Ctx,id:string,name:string)=>ctx.open({kind:'customer-order',title:'הזמנה עבור הלקוח',description:name,render:(close:()=>void)=><CustomerOrderDialog ctx={ctx} id={id} close={close}/>});
function AccountFinancialActions({data,price,refund}:{data:Row;price:(a:Row)=>void;refund:(a:Row,o:Row)=>void}){
 const [q,setQ]=useState(''),[limit,setLimit]=useState(20);
 const items=data.articles.filter((a:Row)=>[a.website_name,a.website_url,a.title,a.number].some(v=>String(v||'').toLocaleLowerCase().includes(q.trim().toLocaleLowerCase())));
 return <section className="financial-order-details" dir="rtl"><Input aria-label="חיפוש פריט לניהול" placeholder="חיפוש אתר, כותרת או מספר הזמנה" value={q} onChange={e=>{setQ(e.target.value);setLimit(20);}}/><p className="financial-order-note">פעולות ניהול נפרדות מהיסטוריית הסכומים. ביטול נפתח לבדיקת הסכום לפני אישור.</p>{items.slice(0,limit).map((a:Row)=>{const o=data.orders.find((o:Row)=>o.id===a.order_id),x=articleAmounts(a);if(!o)return null;return <div className="financial-month-summary" key={a.id}><SiteReference name={a.website_name} url={a.website_url}/><p>{a.title||a.topic||'טרם נוסף תוכן'} · <bdi>{o.number}</bdi></p><div className="financial-order-tools">{!o.paid&&!o.settled&&!o.monthly_closed&&!a.publication_refunded&&!a.cancel_pending&&<Button variant="outline" onClick={()=>price(a)}>עריכת מחיר</Button>}{o.status!=='cancelled'&&(!x.publicationRefunded||(a.editorial_price>0&&!x.writingRefunded))&&<Button variant="outline" onClick={()=>refund(a,o)}>{a.cancel_pending?'אישור ביטול וזיכוי':'ביטול וזיכוי'}</Button>}</div></div>;})}{items.length>limit&&<Button variant="outline" onClick={()=>setLimit(x=>x+20)}>הצגת פריטים נוספים</Button>}</section>;
}
export default function CustomerAccountAdmin({ctx,id,initialTab='orders'}:{ctx:Ctx;id:string;initialTab?:string}){
 const state=useData(base+id,ctx.revision,true,15000),[tab,setTab]=useState(['payments','monthly'].includes(initialTab)?'orders':initialTab),[month,setMonth]=useState(''),[search,setSearch]=useState(''),[status,setStatus]=useState('');const d=state.data;
 const draft=useAdminDraftGuard(ctx);
 const preview=(a:Row)=>ctx.open({kind:'admin-finance',title:'צפייה בכתבה',render:()=> <ArticlePreview ctx={ctx} id={a.id}/>});
 const refund=(a:Row,o:Row)=>ctx.open({kind:'admin-finance',title:'ביטול וזיכוי כתבה',description:'בדיקת הסכום והיעד לזיכוי לפני האישור',render:(close:()=>void)=><RefundForm ctx={ctx} userId={id} article={a} order={o} close={close}/>});
 const price=(a:Row)=>ctx.open({kind:'admin-finance',title:'עריכת מחיר הפרסום בהזמנה',description:'השינוי חל על כתבה זו בלבד. הסכומים לפני מע״מ.',render:(close:()=>void)=><ActionForm fields={[["price_ils","מחיר פרסום חדש (₪)","number"],["reason","סיבה לשינוי (רשות) - תוצג ללקוח","textarea"]]} initial={{price_ils:articleAmounts(a).publicationNet/100}} submit={b=>ctx.run(()=>pricingApi(base+id+'/price','POST',{...b,article_id:a.id,version:a.version}),'מחיר ההזמנה עודכן').then(close)}/>});
 return <div className="customer-account-admin admin-azure-workspace azure-page-theme cf" dir="rtl"><ErrorBox error={state.error}/>{state.loading&&!d?<p className="cf-loading" role="status">טוען חשבון לקוח…</p>:d&&<>
 <header className="cf-head">
  <div className="cf-head-top"><button type="button" className="cf-back" onClick={()=>ctx.go('admin-users')}><ArrowRight size={18} aria-hidden="true"/>לקוחות והרשאות</button>{d.account?.enabled&&<span className="cf-pill is-blue">חשבון חודשי מאושר</span>}</div>
  <div className="cf-head-main"><span className="cf-avatar" aria-hidden="true">{initials(d.customer.name)}</span>
   <div className="cf-head-copy"><h1>{d.customer.name||'לקוח'}</h1><p className="cf-chips"><bdi>{d.customer.email}</bdi>{d.customer.phone&&<bdi>{d.customer.phone}</bdi>}{d.customer.company&&<span>{d.customer.company}</span>}<span className="cf-pill">{roleNames[d.customer.role]||d.customer.role||'לקוח'}</span></p></div>
   <div className="cf-head-actions"><Button variant="outline" onClick={()=>ctx.go('admin-pricebook/'+id)}><Wallet size={16}/>מחירון אישי</Button><Button onClick={()=>openCustomerOrder(ctx,id,d.customer.name)}><Plus size={17}/>הזמנה עבור הלקוח</Button></div>
  </div>
 </header>
 <dl className="cf-stats">{([['קרדיט בארנק',d.customer.credits||0,'green'],['יתרה לתשלום',d.account?.balance||0,'orange'],['מסגרת מאושרת',d.account?.credit_limit||0,''],['מסגרת פנויה',Math.max(0,(d.account?.credit_limit||0)-(d.account?.balance||0)),'']] as [string,number,string][]).map(([label,value,tone])=><div key={label} className={tone&&Number(value)>0?'is-'+tone:undefined}><dt>{label}</dt><dd><bdi>{money(Number(value))}</bdi></dd></div>)}</dl>
 <nav className="account-tabs cf-tabs" aria-label="מידע בתיק הלקוח">{([['orders','הזמנות ותשלומים',d.orders?.length||0],['articles','כתבות',d.articles?.length||0],['profile','פרטי לקוח',0],['history','היסטוריית פעולות',d.history?.length||0]] as [string,string,number][]).map(([key,label,count])=><button type="button" key={key} aria-pressed={tab===key} onClick={()=>{if(key!==tab)draft.confirm(()=>setTab(key));}}>{label}{count>0&&<b>{count}</b>}</button>)}</nav>
 {tab==='orders'&&<CustomerFileOrders ctx={ctx} id={id} name={d.customer.name} newOrder={()=>openCustomerOrder(ctx,id,d.customer.name)}/>}

 {tab==='articles'&&<CustomerArticlesAdmin ctx={ctx} articles={d.articles} orders={d.orders} preview={preview}/>}
 {tab==='profile'&&<div className="space-y-5"><section className="panel" onChangeCapture={()=>draft.mark('profile',true)}><h2>פרטי החשבון</h2><ActionForm fields={[["name","שם","text"],["company","חברה / סוכנות","text"],["phone","טלפון","tel"]]} initial={d.customer} submit={b=>ctx.run(()=>api('admin/users/'+id,'PATCH',{...b,role:d.customer.role}),'פרטי הלקוח נשמרו').then(()=>draft.mark('profile',false))}/><p>{d.customer.email}</p></section><section className="panel" onChangeCapture={()=>draft.mark('monthly',true)}><h2>חשבון חודשי</h2><ActionForm fields={[["limit_ils","מסגרת מאושרת (₪)","number"]]} initial={{limit_ils:(d.account?.credit_limit||0)/100}} submit={b=>ctx.run(()=>api('admin/credit-accounts','PATCH',{...b,user_id:id,enabled:!!d.account?.enabled}),'המסגרת נשמרה').then(()=>draft.mark('monthly',false))}/><Button variant="outline" onClick={()=>ctx.run(()=>api('admin/credit-accounts','PATCH',{user_id:id,limit_ils:(d.account?.credit_limit||0)/100,enabled:!d.account?.enabled}),'הרשאת החשבון עודכנה').catch(()=>{})}>{d.account?.enabled?'ביטול הרשאת חשבון חודשי':'אישור חשבון חודשי'}</Button></section><PersonalPricebook ctx={ctx} id={id} embedded/></div>}
 {tab==='history'&&<section className="panel cf-history"><h2>היסטוריית פעולות</h2>{d.history.length?d.history.map((h:Row)=><div className="account-history" key={h.id}><b>{h.action}</b><span>{h.actor} · {when(h.created)}</span>{h.reason&&<p>{h.reason}</p>}{h.amount!=null&&<p>{money(h.amount)}</p>}</div>):<p>עדיין אין פעולות מתועדות.</p>}</section>}
 </>}</div>;
}
