'use client';
import React,{useRef,useState} from 'react';
import {Check,ChevronLeft,Download,ExternalLink,FileText,History,Paperclip,ReceiptText,Settings,ShoppingCart,UserRound} from 'lucide-react';
import {useData} from '@/lib/client';
import {type Row,stages} from '@/lib/shared';
import {paymentConfirmed} from '@/lib/admin-order-buckets';
import {articleAmounts,effectiveOrderAmounts,orderCancellation,remainingArticleNet} from '@/lib/order-finance';
import {historyMonthLabel} from '@/lib/order-history';
import {paymentMethodLabel} from '@/lib/payment-state';
import {assignedPaymentMonth} from './payment-assignment';
import {orderMoney,orderTimestamp,paymentReceivedAt,OrderUrl} from './order-presentation';
import {exportOrder} from './admin-order-approved';
import {RefundForm} from './refund-dialog';
import type {Ctx} from './workspace';
const plain=(e:React.MouseEvent)=>e.button===0&&!e.metaKey&&!e.ctrlKey&&!e.shiftKey&&!e.altKey;
const itemTone=(a:Row,done:boolean)=>done?'off':a.cancel_pending?'red':a.status==='published'?'done':['admin_review','review','awaiting_approval','pending'].includes(a.status)?'wait':'work';
export function OrderPanel({ctx,order,manage,section,actions,hideDocumentButton}:{ctx:Ctx;order:Row;manage:()=>void;section?:(o:Row)=>React.ReactNode;actions?:(o:Row)=>React.ReactNode;hideDocumentButton?:boolean}){
 const state=useData('orders/'+order.id,ctx.revision,true,15000),reportState=useData('orders/'+order.id+'/payment-report',ctx.revision),[active,setActive]=useState(''),[busy,setBusy]=useState(false),[exported,setExported]=useState(false),timer=useRef<ReturnType<typeof setTimeout>>(undefined);
 const o=state.data?.order,items:Row[]=state.data?.articles||[];
 if(!o)return <div className="om-panel-load" role={state.error?'alert':'status'}>{state.error?<>{state.error}<button type="button" className="om-btn" onClick={ctx.refresh}>ניסיון נוסף</button></>:'טוען פרטי הזמנה…'}</div>;
 const monthly=!!(o.on_account||o.payment==='monthly'||o.billing_month),paid=paymentConfirmed(o),cancelled=orderCancellation(o)==='full',evidence=state.data.payment_confirmation,report=reportState.data?.report,validReport=report&&(report.status==='approved'||!paid&&report.status==='pending')?report:null,month=assignedPaymentMonth(o),stamp=paymentReceivedAt(o,evidence),reference=evidence?.reference||validReport?.reference||o.bank_reference||'',proof=evidence?.proof_file_id||validReport?.proof_file_id,amounts=effectiveOrderAmounts(o),method=paymentMethodLabel({payment:o.confirmed_payment_method||o.settlement_payment_method||evidence?.payment_method||o.payment});
 const go=(page:string)=>(e:React.MouseEvent)=>{if(!plain(e))return;e.preventDefault();ctx.go(page);};
 return <div className="om-panel" dir="rtl">
  <section className="om-items"><h3>פריטים בהזמנה</h3><div className="om-items-head" aria-hidden="true"><span>אתר וכתבה</span><span>מצב</span><span>לפני מע״מ</span><span/></div>
   {items.map(a=>{const done=!!(a.publication_refunded&&(!Number(a.editorial_price)||a.writing_refunded)),open=active===a.id,cost=articleAmounts(a);return <article key={a.id}><div className={'om-item'+(done?' is-cancelled':'')}><div className="om-item-site"><span className="om-url"><OrderUrl url={a.data?.website_url||a.website_url}/><ExternalLink size={13} aria-hidden="true"/></span>{monthly&&<time className="om-item-date">נוסף <bdi>{orderTimestamp(a.purchased_at||a.created||o.created)}</bdi></time>}<a className="om-article" href={'/admin-article/'+a.id} onClick={go('admin-article/'+a.id)}><FileText size={14} aria-hidden="true"/><span>{a.title||a.topic||'פתיחת הכתבה'}</span></a>{done&&<p className="om-cancel-reason">סיבת הביטול: {a.refund_reason||'לא צוינה'}</p>}</div><span className={'om-pill is-'+itemTone(a,done)}>{done?'בוטלה':a.cancel_pending?'בקשת ביטול':stages[a.status]||'מצב לא תועד'}</span><strong>{done?<del><bdi>{orderMoney(cost.publicationNet+cost.writingNet)}</bdi></del>:<bdi>{orderMoney(remainingArticleNet(a,o))}</bdi>}</strong>{!done&&!cancelled?<button type="button" className="om-danger" aria-expanded={open} disabled={busy||!!active&&!open} onClick={()=>setActive(open?'':a.id)}>{open?'סגירה':paid?'ביטול וזיכוי':'ביטול פריט'}</button>:<span/>}</div>{open&&<div className="om-refund"><RefundForm key={a.id} ctx={ctx} userId={o.user_id} article={a} order={o} presentation="order-inline" onBusyChange={setBusy} close={()=>{setActive('');ctx.refresh();}}/></div>}</article>;})}
   {!items.length&&<p className="om-note">אין פריטים בהזמנה.</p>}
  </section>
  <section className="om-payment"><h3>תשלום</h3><dl><div><dt>אמצעי תשלום</dt><dd>{method||'לא תועד'}</dd></div><div><dt>תאריך הזמנה</dt><dd><bdi>{orderTimestamp(o.created)}</bdi></dd></div><div><dt>תשלום אושר</dt><dd>{stamp?<bdi>{orderTimestamp(stamp)}</bdi>:paid?'לא תועד':'טרם אושר'}</dd></div><div><dt>אסמכתא</dt><dd><bdi>{reference||(reportState.loading&&!reportState.data?'טוען…':'לא צורפה')}</bdi>{proof&&<a href={'/api/files/'+encodeURIComponent(proof)} target="_blank" rel="noopener noreferrer"><Paperclip size={13} aria-hidden="true"/>צפייה בקובץ</a>}</dd></div><div><dt>חודש שיוך</dt><dd>{month?historyMonthLabel(month):o.demo?'הדגמה':paid?'לא תועד':'טרם נקבע'}</dd></div></dl>
   <div className="om-sum"><div><span>לפני מע״מ</span><b><bdi>{orderMoney(amounts.net)}</bdi></b></div><div><span>מע״מ {o.vat_percent??18}%</span><b><bdi>{orderMoney(amounts.vat)}</bdi></b></div><div className="is-total"><span>{Number(o.paid_refund_total)>0?'סה״כ לאחר זיכויים':paid?'סה״כ שולם':'סה״כ לתשלום'}</span><b><bdi>{orderMoney(amounts.total)}</bdi></b></div></div>
  </section>
  <section className="om-customer"><h3>לקוח</h3><p className="om-customer-name">{order.user_name||o.name}</p>{(order.user_email||order.email)&&<p className="om-customer-line"><bdi>{order.user_email||order.email}</bdi></p>}{order.user_phone&&<p className="om-customer-line"><bdi>{order.user_phone}</bdi></p>}
   <a className="om-link" href={'/admin-customer-account/'+o.user_id} onClick={go('admin-customer-account/'+o.user_id)}><UserRound size={16} aria-hidden="true"/><span>תיק לקוח</span><ChevronLeft size={15} aria-hidden="true"/></a>
   <a className="om-link" href={'/admin-customer-account/'+o.user_id+'/orders'} onClick={go('admin-customer-account/'+o.user_id+'/orders')}><ShoppingCart size={16} aria-hidden="true"/><span>כל ההזמנות של הלקוח</span><ChevronLeft size={15} aria-hidden="true"/></a>
   <a className="om-link" href={'/admin-order/'+o.id} onClick={e=>{if(!plain(e))return;e.preventDefault();manage();}}><History size={16} aria-hidden="true"/><span>היסטוריית פעולות</span><ChevronLeft size={15} aria-hidden="true"/></a>
  </section>
  {section?.(o)}<footer className="om-panel-foot"><button type="button" className="om-btn is-primary" onClick={manage}><Settings size={17} aria-hidden="true"/>ניהול הזמנה</button>{hideDocumentButton?null:o.invoice_file_id?<a className="om-btn" href={'/api/orders/'+encodeURIComponent(o.id)+'/invoice'}><ReceiptText size={17} aria-hidden="true"/>חשבונית / קבלה</a>:<button type="button" className="om-btn" onClick={manage}><ReceiptText size={17} aria-hidden="true"/>צירוף חשבונית</button>}<button type="button" className={'om-btn'+(exported?' is-success':'')} onClick={()=>{exportOrder(o,items);setExported(true);clearTimeout(timer.current);timer.current=setTimeout(()=>setExported(false),1800);}}>{exported?<Check size={17} aria-hidden="true"/>:<Download size={17} aria-hidden="true"/>}{exported?'הקובץ הורד':'ייצוא לאקסל'}</button>{actions?.(o)}<small>מחירי הפריטים לפני מע״מ</small></footer>
 </div>;
}
