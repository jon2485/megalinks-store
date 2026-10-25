'use client';
import React from 'react';
import {Calculator,Check,Clock3,CreditCard,Download,Eye,FileText,Link2} from 'lucide-react';
import {money,type Row} from '@/lib/shared';
import {effectiveOrderAmounts,orderCancellation,remainingArticleNet} from '@/lib/order-finance';
import {paymentMethodLabel} from '@/lib/payment-state';
import type {Ctx} from './workspace';
import SiteReference from './site-reference';
import {CustomerPaymentReport} from './payment-reports';

function dateLabel(value:string){
 if(!value)return 'לא תועד';
 const date=new Date(value);
 return Number.isNaN(date.getTime())?'לא תועד':new Intl.DateTimeFormat('he-IL',{timeZone:'Asia/Jerusalem',day:'2-digit',month:'2-digit',year:'numeric'}).format(date);
}
export function customerPaymentFacts(o:Row){
 const paid=!!(o.paid||o.settled||o.payment_settled),cancelled=orderCancellation(o)==='full';
 const method=o.payment==='credits_card'?o.payment:o.confirmed_payment_method||o.settlement_payment_method||o.payment_method||o.payment;
 const status=cancelled?'בוטלה':o.demo?'הדגמה ללא חיוב':paid?'שולם':o.payment_report_status==='pending'?'ממתין לאישור תשלום':'טרם שולם';
 return {paid,cancelled,method:paymentMethodLabel({payment:method})||'לא תועד',status,
  tone:cancelled?'cancelled':o.demo?'demo':paid?'paid':'pending',
  date:paid&&!o.demo?dateLabel(o.paid_date||o.payment_date||o.paid_at):'לא תועד',
  documentTitle:({invoice:'חשבונית מס',receipt:'קבלה',invoice_receipt:'חשבונית מס / קבלה'} as Record<string,string>)[o.invoice_document_type]||'חשבונית / קבלה'};
}

/** Customer-only presentation; order amounts, ownership and payment actions stay server-owned. */
export default function CustomerPaymentDetail({ctx,order:o,items}:{ctx:Ctx;order:Row;items:Row[]}){
 const facts=customerPaymentFacts(o),amounts=effectiveOrderAmounts(o),refunded=Number(o.paid_refund_total)||0;
 const invoiceUrl='/api/orders/'+encodeURIComponent(o.id)+'/invoice';
 return <div className="customer-payment-detail" dir="rtl">
  <section className="order-payment-section order-payment-sites" aria-label="האתרים בהזמנה">
   <h3><Link2 size={22} aria-hidden="true"/>האתרים בהזמנה</h3>
   {items.length?<ul>{items.map(a=>{
    const site=ctx.catalog?.find(w=>w.id===a.website_id),cancelled=!!(a.publication_refunded||a.writing_refunded||facts.cancelled);
    return <li key={a.id} className={cancelled?'is-cancelled':undefined}>
     <div className="order-payment-site"><SiteReference name={a.website_name||a.data?.website_name||site?.name} url={a.website_url||a.data?.website_url||site?.url}/>{cancelled&&<span className="order-payment-cancellation">{remainingArticleNet(a,o)>0?'בוטל חלקית':'בוטל'}</span>}</div>
     <div className="order-payment-purchase-date"><span>תאריך רכישה</span><time dateTime={a.purchased_at||o.created}>{dateLabel(a.purchased_at||o.created)}</time></div>
     <div className="order-payment-item-amount"><span>לפני מע״מ</span><strong><bdi>{money(remainingArticleNet(a,o))}</bdi></strong></div>
    </li>;
   })}</ul>:<p className="order-payment-note">אין פריטים להצגה בהזמנה זו.</p>}
  </section>
  <section className="order-payment-section order-payment-facts" aria-label="פרטי התשלום">
   <h3><CreditCard size={22} aria-hidden="true"/>פרטי התשלום</h3>
   <dl>
    <div><dt>{facts.paid?'אופן התשלום':'אופן התשלום שנבחר'}</dt><dd>{facts.method}</dd></div>
    {(o.on_account||o.payment==='monthly')&&facts.paid&&<div><dt>אופן הרכישה</dt><dd>התחשבנות חודשית</dd></div>}
    <div><dt>מצב התשלום</dt><dd className={facts.cancelled?'order-cancelled-text':undefined}><span className={'order-payment-status is-'+facts.tone}>{facts.tone==='paid'?<Check size={16} aria-hidden="true"/>:facts.tone==='pending'?<Clock3 size={16} aria-hidden="true"/>:null}{facts.status}</span></dd></div>
    <div><dt>תאריך התשלום</dt><dd><bdi>{facts.date}</bdi></dd></div>
    {o.payment==='credits_card'&&<><div><dt>{facts.paid?'שולם מהיתרה':'שמור מהיתרה'}</dt><dd><bdi>{money(o.wallet_amount||0)}</bdi></dd></div><div><dt>{facts.paid?'שולם באשראי':'להשלמה באשראי'}</dt><dd><bdi>{money(o.card_amount||0)}</bdi></dd></div></>}
   </dl>
   {(o.on_account||o.payment==='monthly')&&o.purchase_closed_at&&!facts.paid&&!facts.cancelled&&<p className="order-payment-note">ההזמנה נסגרה לרכישות נוספות. התשלום טרם אושר.</p>}
   {o.demo&&<p className="order-payment-note">הזמנת הדגמה ללא חיוב כספי.</p>}
   {!facts.paid&&!o.demo&&!facts.cancelled&&<CustomerPaymentReport ctx={ctx} order={o} compact/>}
  </section>
  <section className="order-payment-section order-payment-summary" aria-label="סיכום התשלום">
   <h3><Calculator size={22} aria-hidden="true"/>סיכום התשלום:</h3>
   <dl><div><dt>לפני מע״מ</dt><dd><bdi>{money(amounts.net)}</bdi></dd></div><div><dt>מע״מ ({o.vat_percent??18}%)</dt><dd><bdi>{money(amounts.vat)}</bdi></dd></div><div className="order-payment-total"><dt>סה״כ כולל מע״מ</dt><dd><bdi>{money(amounts.total)}</bdi></dd></div></dl>
   {refunded>0&&<p className="order-payment-note">זיכוי ליתרה: <bdi>{money(refunded)}</bdi>. הסכומים המוצגים מעודכנים לאחר הזיכוי.</p>}
  </section>
  <section className="order-payment-section order-payment-document" aria-label="מסמכי ההזמנה">
   <div className="order-payment-document-name"><FileText size={30} aria-hidden="true"/><div><h3>{facts.documentTitle}</h3><p>{o.invoice_file_id?'המסמך שצורף להזמנה · PDF':'טרם צורף מסמך להזמנה'}{o.invoice_file_id&&o.invoice_document_number&&<> · <bdi>{o.invoice_document_number}</bdi></>}</p></div></div>
   {o.invoice_file_id&&<div className="order-payment-document-actions"><a className="order-payment-action is-primary" href={invoiceUrl+'?view=inline'} target="_blank" rel="noopener noreferrer"><Eye size={19} aria-hidden="true"/>{o.invoice_document_type==='receipt'?'צפייה בקבלה':'צפייה בחשבונית'}<span className="sr-only"> בחלון חדש</span></a><a className="order-payment-action" href={invoiceUrl} download><Download size={19} aria-hidden="true"/>הורדה</a></div>}
  </section>
 </div>;
}
