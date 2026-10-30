'use client';

import React,{useRef,useState} from 'react';
import {Check,CheckCircle2,Download,FileText,Search,X} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {money,type Row} from '@/lib/shared';
import {articleAmounts,effectiveOrderAmounts,orderCancellation,remainingArticleNet} from '@/lib/order-finance';
import {paymentMethodLabel} from '@/lib/payment-state';
import {exportSpreadsheet} from '@/lib/office';
import {type Ctx} from './workspace';
import {customerOrderStatusLabel,orderDate} from './customer-order-screen';
import {CustomerPaymentReport} from './payment-reports';
import SiteReference from './site-reference';
import {orderTimestamp} from './order-presentation';
import './customer-order-reference.css';

// Presentation for the existing customer order-details dialog only. Financial
// amounts, ownership and report eligibility retain their existing domain owners.
export default function CustomerOrderDialog({ctx,order,articles}:{ctx:Ctx;order:Row;articles:Row[]}){
 const [query,setQuery]=useState('');const search=useRef<HTMLInputElement>(null);
 const amounts=effectiveOrderAmounts(order),cancelled=orderCancellation(order)==='full';
 const paid=!!(order.paid||order.settled||order.payment_settled),refunded=Number(order.paid_refund_total||0);
 const method=order.settlement_payment_method==='bank_transfer'?'העברה בנקאית':order.settlement_payment_method==='card'?'כרטיס אשראי':paymentMethodLabel(order);
 const q=query.trim().toLocaleLowerCase();
 const visible=articles.filter(a=>!q||[a.title,a.topic,a.website_name,a.website_url,ctx.catalog?.find(w=>w.id===a.website_id)?.name].some(v=>String(v||'').toLocaleLowerCase().includes(q)));
 const exportOrder=()=>exportSpreadsheet('order-'+order.number+'.xlsx',[
  ['מספר הזמנה',order.number],['תאריך הזמנה',orderDate(order.created)],['אופן תשלום',method],[],
  ['אתר','קישור','כותרת הכתבה','מחיר לפני מע״מ (₪)'],
  ...articles.map(a=>[a.website_name||ctx.catalog?.find(w=>w.id===a.website_id)?.name||'',a.website_url||ctx.catalog?.find(w=>w.id===a.website_id)?.url||'',a.title||a.topic||'',remainingArticleNet(a,order)/100]),
  [],['סכום לפני מע״מ',amounts.net/100],['מע״מ',amounts.vat/100],['סכום כולל מע״מ',amounts.total/100],
 ]);
 return <section className="customer-order-glass customer-order-reference" dir="rtl">
  <header className="customer-order-glass-heading"><h2>הזמנה <bdi>#{String(order.number).replace(/^#+/,'')}</bdi></h2><p>{order.user_name||ctx.user?.name} · <bdi>{orderTimestamp(order.created)}</bdi></p><span className={'customer-finance-status '+(cancelled?'is-cancelled':paid?'is-paid':'is-pending')}>{customerOrderStatusLabel(order).replace(/^הזמנה /,'')}</span></header>
  <div className="customer-order-glass-body">
   {refunded>0&&<section className="customer-order-glass-refund"><CheckCircle2 size={23} aria-hidden="true"/><div><h3>הוחזר ליתרה באתר</h3><strong><bdi>{money(refunded)}</bdi></strong><p>הזיכוי הוחזר ליתרה. התשלום המקורי נשמר בהיסטוריה.</p></div></section>}
   {order.demo&&<p className="customer-finance-note">הזמנת הדגמה — ללא חיוב כספי.</p>}
   {(order.on_account||order.payment==='monthly')&&order.purchase_closed_at&&!paid&&<p className="customer-finance-note">ההזמנה נסגרה לרכישות נוספות. התשלום טרם אושר.</p>}
   {articles.length>6&&<div className="customer-order-glass-search"><Search size={19} aria-hidden="true"/><Input ref={search} type="search" aria-label="חיפוש בתוך ההזמנה" placeholder="חיפוש בתוך ההזמנה" value={query} onChange={e=>setQuery(e.target.value)}/>{query&&<Button type="button" variant="ghost" size="icon" aria-label="ניקוי חיפוש בהזמנה" onClick={()=>{setQuery('');search.current?.focus();}}><X size={18}/></Button>}</div>}
   <ul className="customer-order-glass-items">{visible.map(a=>{const site=ctx.catalog?.find(w=>w.id===a.website_id),net=remainingArticleNet(a,order),original=articleAmounts(a).publicationNet+articleAmounts(a).writingNet,isCancelled=!!(a.publication_refunded||a.writing_refunded||cancelled);return <li key={a.id} className={isCancelled?'is-cancelled':undefined}>
    <div className="customer-order-glass-item-site"><SiteReference name={a.website_name||a.data?.website_name||site?.name} url={a.website_url||a.data?.website_url||site?.url}/>{isCancelled&&<span className="customer-finance-status is-cancelled">{net>0?'בוטל חלקית':paid?'בוטל וזוכה':'בוטל'}</span>}</div>
    <div className="customer-order-glass-item-price">{isCancelled&&original!==net&&<del><bdi>{money(original)}</bdi></del>}<strong><bdi>{money(net)}</bdi></strong></div>
    {isCancelled&&<details className="customer-order-glass-cancellation"><summary>{paid?'פרטי הזיכוי':'פרטי הביטול'}</summary><p>{a.refund_reason||a.cancel_reason||'ביטול הפריט עודכן בסכום ההזמנה.'}</p>{a.refunded_at&&<p>תאריך הביטול: {orderDate(a.refunded_at)}</p>}</details>}
   </li>;})}</ul>
   {!visible.length&&<p className="customer-finance-note">{query?'לא נמצאו פריטים התואמים לחיפוש.':'אין פריטים להצגה בהזמנה זו.'}</p>}
   <dl className="customer-order-glass-facts"><div><dt>אופן התשלום</dt><dd>{method}</dd></div><div><dt>מצב התשלום</dt><dd><span className={'customer-reference-payment '+(paid?'is-paid':'is-pending')}>{paid&&<Check size={16} aria-hidden="true"/>}{order.demo?'הדגמה':paid?'שולם':'טרם שולם'}</span></dd></div><div><dt>{paid?'תאריך התשלום':'תאריך ההזמנה'}</dt><dd><bdi>{orderDate(paid?(order.paid_date||order.payment_date||order.paid_at):order.created)}</bdi></dd></div></dl>
   <dl className="customer-order-glass-totals"><div><dt>לפני מע״מ</dt><dd><bdi>{money(amounts.net)}</bdi></dd></div><div><dt>מע״מ ({order.vat_percent??18}%)</dt><dd><bdi>{money(amounts.vat)}</bdi></dd></div><div><dt>{refunded>0?'סכום לאחר זיכויים':'סה״כ לתשלום'}</dt><dd><bdi>{money(amounts.total)}</bdi></dd></div></dl>
   <details className="customer-reference-more"><summary>פרטים נוספים וייצוא</summary><p className="customer-finance-note">מחירי הפריטים לפני מע״מ; שירות כתיבה נכלל אם נרכש.</p><ul>{articles.map(a=><li key={a.id}><strong>{a.website_name||ctx.catalog?.find(w=>w.id===a.website_id)?.name||'אתר'}</strong><span>{a.title||a.topic||'טרם נוספה כותרת'}</span><time dateTime={a.purchased_at||order.created}>{orderTimestamp(a.purchased_at||order.created)}</time></li>)}</ul><p className="customer-finance-note">{paid?'שולם במקור':'סכום ההזמנה'}: <bdi>{money(paid?order.total:amounts.total)}</bdi></p><Button type="button" variant="outline" onClick={exportOrder}><Download size={18} aria-hidden="true"/>ייצוא לאקסל</Button></details>
   {!paid&&!order.demo&&!cancelled&&<CustomerPaymentReport ctx={ctx} order={order} compact/>}
  </div>
  <footer className="customer-order-glass-actions">{order.invoice_file_id?<><a className="customer-finance-primary" href={'/api/orders/'+order.id+'/invoice'} target="_blank" rel="noopener noreferrer"><FileText size={21} aria-hidden="true"/>צפייה בחשבונית</a><a href={'/api/orders/'+order.id+'/invoice'} download><Download size={20} aria-hidden="true"/>הורדה</a></>:<>{paid&&!order.demo&&<span className="customer-finance-note">חשבונית / קבלה טרם צורפה</span>}<Button type="button" variant="outline" onClick={exportOrder}><Download size={18} aria-hidden="true"/>ייצוא לאקסל</Button></>}</footer>
 </section>;
}
