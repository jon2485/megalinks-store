'use client';
import React from 'react';
import {RefreshCw,XCircle} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {useData} from '@/lib/client';
import {money,type Row} from '@/lib/shared';
import {articleAmounts} from '@/lib/order-finance';
import {paymentMethodLabel} from '@/lib/payment-state';
import {displayUpdateDate} from '@/lib/client-updates';
import SiteReference from './site-reference';
import type {Ctx} from './workspace';

/** Read the owning customer's existing article endpoint; this dialog performs no financial action. */
export default function CustomerCancellationDialog({ctx,articleId,close}:{ctx:Ctx;articleId:string;close:()=>void}){
 const state=useData('articles/'+encodeURIComponent(articleId),ctx.revision,true,15000);
 const article:Row|undefined=state.data?.article?.id===articleId?state.data.article:undefined,order:Row|undefined=article?state.data.order:undefined;
 const cancelled=!!article&&(article.status==='cancelled'||article.publication_refunded||order?.status==='cancelled'),pending=!!article?.cancel_pending;
 const original=article&&[article.paid_amount,article.unit_price,article.publication_price,article.editorial_price].some(v=>typeof v==='number'&&Number.isFinite(v))?articleAmounts(article):null,refund=article?.refund_total;
 const method=order?paymentMethodLabel({payment:order.confirmed_payment_method||order.settlement_payment_method||order.payment}):'';
 const partial=!!article?.publication_refunded&&Number(article.editorial_price)>0&&!article.writing_refunded;
 const note=article?.refund_reason||article?.cancel_reason;
 return <section className="customer-order-glass customer-cancellation-glass" dir="rtl">
  <header className="customer-order-glass-heading"><h2>פרטי הביטול</h2>{article&&<p>{article.website_name||'פרסום כתבה'}{order?.number&&<> · <bdi>{order.number}</bdi></>}</p>}{article&&<span className={'customer-finance-status '+(pending?'is-pending':'is-cancelled')}>{pending?'הביטול ממתין לאישור':cancelled?partial?'הפרסום בוטל':'בוטלה':'הרישום השתנה'}</span>}</header>
  <div className="customer-order-glass-body">
   {state.error&&<div className="customer-cancellation-error" role="alert"><p>לא ניתן לטעון את פרטי הביטול. {state.error}</p><Button type="button" variant="outline" onClick={ctx.refresh}><RefreshCw size={16}/>ניסיון נוסף</Button></div>}
   {!article&&!state.error?<p className="customer-finance-note" role="status">טוען את פרטי העסקה והביטול…</p>:article&&<>
    <section className="customer-cancellation-section" aria-label="פרטי העסקה"><h3>העסקה שבוצעה</h3><SiteReference name={article.website_name} url={article.website_url}/><p className="customer-cancellation-title">{article.title||article.topic||'פרסום כתבה'}</p><dl className="customer-cancellation-facts"><div><dt>מספר הזמנה</dt><dd><bdi>{order?.number||article.number||'לא תועד'}</bdi></dd></div><div><dt>תאריך הרכישה</dt><dd>{displayUpdateDate(article.purchased_at||order?.created||'')}</dd></div><div><dt>אופן התשלום שנבחר</dt><dd>{method||'לא תועד'}</dd></div>{original&&<div><dt>סכום העסקה המקורי כולל מע״מ</dt><dd><bdi>{money(original.publicationGross+original.writingGross)}</bdi></dd></div>}</dl></section>
    {cancelled||pending?<><section className="customer-cancellation-section" aria-label="מצב הביטול"><h3><XCircle size={19} aria-hidden="true"/>הביטול</h3><dl className="customer-cancellation-facts"><div><dt>מצב</dt><dd>{pending?'ממתין לאישור עצירת הפרסום':partial?'ביטול הפרסום בלבד; שירות הכתיבה נשאר בחיוב':'הכתבה בוטלה'}</dd></div><div><dt>{article.cancelled_at||article.refunded_at?'תאריך הביטול':'עודכן בתאריך'}</dt><dd>{displayUpdateDate(article.cancelled_at||article.refunded_at||article.updated||'')}</dd></div>{!pending&&typeof refund==='number'&&Number.isFinite(refund)&&refund>=0&&<div><dt>סכום הביטול כולל מע״מ</dt><dd><bdi>{money(refund)}</bdi></dd></div>}</dl>{pending&&<p>הביטול עדיין בבדיקה. טרם אושר זיכוי.</p>}{!pending&&typeof refund!=='number'&&<p>לא תועד סכום זיכוי נפרד לפריט זה. פרטי החיוב והיתרה זמינים בהזמנות ותשלומים.</p>}</section><section className="customer-cancellation-section customer-cancellation-note" aria-label="הערת המנהל לביטול"><h3>הערת המנהל לביטול</h3><p>{typeof note==='string'&&note.trim()?note:'לא צורפה הערת מנהל לביטול.'}</p></section></>:<p className="customer-finance-note">אין כרגע ביטול מאושר לפריט זה. אפשר לרענן את העדכונים ולבדוק שוב.</p>}
   </>}
  </div>
  <footer className="customer-order-glass-actions"><Button type="button" variant="outline" onClick={close}>סגירה</Button></footer>
 </section>;
}
