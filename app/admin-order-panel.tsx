'use client';
import React,{useRef,useState} from 'react';
import {Check,ChevronDown,ChevronLeft,ChevronUp,Download,ExternalLink,FileText,List,Paperclip,ReceiptText,Settings,UserRound} from 'lucide-react';
import {useData} from '@/lib/client';
import {type Row,stages} from '@/lib/shared';
import {paymentConfirmed} from '@/lib/admin-order-buckets';
import {articleAmounts,effectiveOrderAmounts,orderCancellation,remainingArticleNet} from '@/lib/order-finance';
import {historyMonthLabel} from '@/lib/order-history';
import {paymentMethodLabel} from '@/lib/payment-state';
import {purchaseCosts} from '@/lib/admin-month-report';
import {assignedPaymentMonth} from './payment-assignment';
import {orderMoney,orderTimestamp,paymentReceivedAt,OrderUrl} from './order-presentation';
import {exportOrder} from './admin-order-approved';
import {RefundForm} from './refund-dialog';
import type {Ctx} from './workspace';
const plain=(e:React.MouseEvent)=>e.button===0&&!e.metaKey&&!e.ctrlKey&&!e.shiftKey&&!e.altKey;
const ITEM_LIMIT=10;
const itemTone=(a:Row,done:boolean)=>done?'off':a.cancel_pending?'red':a.status==='published'?'done':['admin_review','review','awaiting_approval','pending'].includes(a.status)?'wait':'work';
/** Compact money rows for the orders screen: payment, expenses and final profit (net income minus recorded purchase cost). */
function OrderMoneyRows({o,items,amounts,paid,cancelled}:{o:Row;items:Row[];amounts:{net:number;vat:number;total:number};paid:boolean;cancelled:boolean}){
 const cost=purchaseCosts(items),gain=cost.cost===null?null:amounts.net-cost.cost,pct=gain!==null&&amounts.net>0?Math.round(gain/amounts.net*100):null;
 return <div className="omk">
  <div className="omk-r"><span>לפני מע״מ{items.length>ITEM_LIMIT?' ('+items.length+' פריטים)':''}</span><b><bdi>{orderMoney(amounts.net)}</bdi></b></div>
  <div className="omk-r"><span>מע״מ {o.vat_percent??18}%</span><b><bdi>{orderMoney(amounts.vat)}</bdi></b></div>
  <div className="omk-r is-sum"><span>{Number(o.paid_refund_total)>0?'סה״כ לאחר זיכויים':paid?'סה״כ שולם':'סה״כ לתשלום'}, כולל מע״מ</span><b><bdi>{orderMoney(amounts.total)}</bdi></b></div>
  {!cancelled&&<>
   <div className="omk-r is-cost"><span>{cost.cost===null?'הוצאות ידועות עד כה':'הוצאות, עלות לספק'}<i className="sv2-dsk"> (לפני מע״מ)</i></span><b>{cost.known>0?<><span dir="ltr">−{orderMoney(cost.known).replace(/[^\d.,]/g,'')}</span> ₪</>:<bdi>{orderMoney(0)}</bdi>}</b></div>
   {gain===null?<div className="omk-r is-profit is-unknown"><span>הרווח עוד לא ידוע</span><b>{cost.missing===1?'חסרה עלות אחת':'חסרות '+cost.missing+' עלויות'}</b></div>
   :<div className={'omk-r is-profit'+(gain<0?' is-loss':'')}><span>{gain<0?'הפסד':paid?'רווח סופי':'רווח צפוי'}{pct!==null&&gain>=0&&<small><bdi>{pct}%</bdi></small>}</span><b>{gain<0?<><span dir="ltr">−{orderMoney(-gain).replace(/[^\d.,]/g,'')}</span> ₪</>:<bdi>{orderMoney(gain)}</bdi>}</b></div>}
  </>}
 </div>;
}
export function OrderPanel({ctx,order,manage,section,actions,hideDocumentButton,profit}:{ctx:Ctx;order:Row;manage:()=>void;section?:(o:Row)=>React.ReactNode;actions?:(o:Row)=>React.ReactNode;hideDocumentButton?:boolean;profit?:boolean}){
 const state=useData('orders/'+order.id,ctx.revision,true,15000),reportState=useData('orders/'+order.id+'/payment-report',ctx.revision),[active,setActive]=useState(''),[busy,setBusy]=useState(false),[exported,setExported]=useState(false),[showHistory,setShowHistory]=useState(false),[showAll,setShowAll]=useState(false),timer=useRef<ReturnType<typeof setTimeout>>(undefined);
 const o=state.data?.order,items:Row[]=state.data?.articles||[];
 if(!o)return <div className="om-panel-load" role={state.error?'alert':'status'}>{state.error?<>{state.error}<button type="button" className="om-btn" onClick={ctx.refresh}>ניסיון נוסף</button></>:'טוען פרטי הזמנה…'}</div>;
 const monthly=!!(o.on_account||o.payment==='monthly'||o.billing_month),paid=paymentConfirmed(o),cancelled=orderCancellation(o)==='full',evidence=state.data.payment_confirmation,report=reportState.data?.report,validReport=report&&(report.status==='approved'||!paid&&report.status==='pending')?report:null,month=assignedPaymentMonth(o),stamp=paymentReceivedAt(o,evidence),reference=evidence?.reference||validReport?.reference||o.bank_reference||'',proof=evidence?.proof_file_id||validReport?.proof_file_id,amounts=effectiveOrderAmounts(o),method=paymentMethodLabel({payment:o.confirmed_payment_method||o.settlement_payment_method||evidence?.payment_method||o.payment});
 const go=(page:string)=>(e:React.MouseEvent)=>{if(!plain(e))return;e.preventDefault();ctx.go(page);};
 const activity:Row[]=state.data?.activity||[],shownHistory=showHistory?activity:activity.slice(0,2),shownItems=showAll?items:items.slice(0,ITEM_LIMIT),published=items.filter(a=>a.status==='published').length,name=String(order.user_name||o.name||'');
 return <div className="om-panel sk-panel" dir="rtl">
  <section className="om-items sk-items"><header className="sk-head"><h3>פריטים בהזמנה</h3><small>{items.length===1?'אתר אחד':items.length+' אתרים'} · {published} פורסמו</small></header><div className="om-items-head" aria-hidden="true"><span>אתר וכתבה</span><span>מצב</span><span>לפני מע״מ</span><span/></div>
   {shownItems.map(a=>{const done=!!(a.publication_refunded&&(!Number(a.editorial_price)||a.writing_refunded)),open=active===a.id,cost=articleAmounts(a);return <article key={a.id}><div className={'om-item'+(done?' is-cancelled':'')}><div className="om-item-site"><span className="om-url"><OrderUrl url={a.data?.website_url||a.website_url}/><ExternalLink size={13} aria-hidden="true"/></span><div className="om-item-line"><a className="om-article" href={'/admin-article/'+a.id} onClick={go('admin-article/'+a.id)}><FileText size={14} aria-hidden="true"/><span>{a.title||a.topic||'פתיחת הכתבה'}</span></a>{monthly&&<time className="om-item-date">נוסף <bdi>{orderTimestamp(a.purchased_at||a.created||o.created)}</bdi></time>}</div>{done&&<p className="om-cancel-reason">סיבת הביטול: {a.refund_reason||'לא צוינה'}</p>}</div><span className={'om-pill is-'+itemTone(a,done)}>{done?'בוטלה':a.cancel_pending?'בקשת ביטול':stages[a.status]||'מצב לא תועד'}</span><strong>{done?<del><bdi>{orderMoney(cost.publicationNet+cost.writingNet)}</bdi></del>:<bdi>{orderMoney(remainingArticleNet(a,o))}</bdi>}</strong>{!done&&!cancelled?<button type="button" className="om-danger" aria-expanded={open} disabled={busy||!!active&&!open} onClick={()=>setActive(open?'':a.id)}>{open?'סגירה':paid?'ביטול וזיכוי':'ביטול פריט'}</button>:<span/>}</div>{open&&<div className="om-refund"><RefundForm key={a.id} ctx={ctx} userId={o.user_id} article={a} order={o} presentation="order-inline" onBusyChange={setBusy} close={()=>{setActive('');ctx.refresh();}}/></div>}</article>;})}
   {!items.length&&<p className="om-note">אין פריטים בהזמנה.</p>}
   {items.length>ITEM_LIMIT&&<div className="sk-morebar"><span>{showAll?'מוצגים כל '+items.length+' הפריטים':'מוצגים '+ITEM_LIMIT+' מתוך '+items.length+' פריטים'}</span><button type="button" className="om-btn is-primary" aria-expanded={showAll} onClick={()=>setShowAll(v=>!v)}><span>{showAll?'הצגת פחות':'הצגת כל ההזמנה'}</span>{showAll?<ChevronUp size={16} aria-hidden="true"/>:<ChevronDown size={16} aria-hidden="true"/>}</button></div>}
   {profit?<OrderMoneyRows o={o} items={items} amounts={amounts} paid={paid} cancelled={cancelled}/>:<div className="om-sum"><div><span>לפני מע״מ{items.length>ITEM_LIMIT?' ('+items.length+' פריטים)':''}</span><b><bdi>{orderMoney(amounts.net)}</bdi></b></div><div><span>מע״מ {o.vat_percent??18}%</span><b><bdi>{orderMoney(amounts.vat)}</bdi></b></div><div className="is-total"><span>{Number(o.paid_refund_total)>0?'סה״כ לאחר זיכויים':paid?'סה״כ שולם':'סה״כ לתשלום'}</span><b><bdi>{orderMoney(amounts.total)}</bdi></b></div></div>}
   <small className="sk-note">מחירי הפריטים לפני מע״מ</small>
  </section>
  <aside className="sk-side">
   <section className="om-customer sk-card"><header className="sk-head"><h3>לקוח</h3></header>
    <div className="sk-who"><span className="sk-avatar" aria-hidden="true">{name.trim().split(/\s+/).slice(0,2).map(w=>w[0]).join('')||'ל'}</span><div><a className="om-customer-name" href={'/admin-customer-account/'+o.user_id} onClick={go('admin-customer-account/'+o.user_id)}>{name||'לקוח'}</a>{(order.user_email||order.email)&&<p className="om-customer-line"><bdi>{order.user_email||order.email}</bdi></p>}{order.user_phone&&<p className="om-customer-line"><bdi>{order.user_phone}</bdi></p>}</div></div>
    <div className="sk-pair"><a className="om-btn" href={'/admin-customer-account/'+o.user_id} onClick={go('admin-customer-account/'+o.user_id)}><UserRound size={16} aria-hidden="true"/><span>תיק לקוח</span></a><a className="om-btn" href={'/admin-customer-account/'+o.user_id+'/orders'} title="כל ההזמנות של הלקוח הזה" onClick={go('admin-customer-account/'+o.user_id+'/orders')}><List size={16} aria-hidden="true"/><span>כל ההזמנות</span></a></div>
   </section>
   <section className="om-payment sk-card"><header className="sk-head"><h3>פרטי ההזמנה והחיוב</h3></header><dl><div><dt>סוג ההזמנה</dt><dd>{monthly?'חודשית':'רגילה'} · {items.length===1?'פריט אחד':items.length+' פריטים'}</dd></div><div><dt>אמצעי תשלום</dt><dd>{method||'לא תועד'}</dd></div><div><dt>תאריך הזמנה</dt><dd><bdi>{orderTimestamp(o.created)}</bdi></dd></div><div><dt>תשלום אושר</dt><dd>{stamp?<bdi>{orderTimestamp(stamp)}</bdi>:paid?'לא תועד':'טרם אושר'}</dd></div><div><dt>אסמכתא</dt><dd><bdi>{reference||(reportState.loading&&!reportState.data?'טוען…':'לא צורפה')}</bdi>{proof&&<a href={'/api/files/'+encodeURIComponent(proof)} target="_blank" rel="noopener noreferrer"><Paperclip size={13} aria-hidden="true"/>צפייה בקובץ</a>}</dd></div><div><dt>חודש שיוך</dt><dd>{month?historyMonthLabel(month):o.demo?'הדגמה':paid?'לא תועד':'טרם נקבע'}</dd></div></dl>
    {!hideDocumentButton&&<div className="sk-doc"><div><b>חשבונית / קבלה</b><small>{o.invoice_file_id?'צורפה להזמנה':'טרם צורפה'}</small></div>{o.invoice_file_id?<a className="om-btn" href={'/api/orders/'+encodeURIComponent(o.id)+'/invoice'}><ReceiptText size={16} aria-hidden="true"/>הורדה</a>:<button type="button" className="om-btn" onClick={manage}><ReceiptText size={16} aria-hidden="true"/>צירוף חשבונית</button>}</div>}
   </section>
   <section className="sk-card sk-history"><header className="sk-head"><h3>היסטוריית פעולות</h3>{activity.length>2&&<small>{showHistory?'כל '+activity.length+' הפעולות':'2 אחרונות מתוך '+activity.length}</small>}</header>
    {shownHistory.length?<ol>{shownHistory.map((e:Row)=><li key={e.id}><span>{e.action}</span><small><bdi>{orderTimestamp(e.created)}</bdi> · {e.actor}</small></li>)}</ol>:<p className="om-note">{state.loading&&!state.data?'טוען…':'טרם נרשמו פעולות.'}</p>}
    {activity.length>2&&<button type="button" className="sk-more" aria-expanded={showHistory} onClick={()=>setShowHistory(v=>!v)}><span>{showHistory?'הצגת פחות':'הצגת עוד '+(activity.length-2===1?'פעולה אחת':(activity.length-2)+' פעולות')}</span>{showHistory?<ChevronUp size={16} aria-hidden="true"/>:<ChevronDown size={16} aria-hidden="true"/>}</button>}
   </section>
   {section?.(o)}
   <footer className="om-panel-foot sk-actions"><button type="button" className="om-btn is-primary" onClick={manage}><Settings size={17} aria-hidden="true"/>ניהול הזמנה</button><button type="button" className={'om-btn'+(exported?' is-success':'')} onClick={()=>{exportOrder(o,items);setExported(true);clearTimeout(timer.current);timer.current=setTimeout(()=>setExported(false),1800);}}>{exported?<Check size={17} aria-hidden="true"/>:<Download size={17} aria-hidden="true"/>}{exported?'הקובץ הורד':'ייצוא לאקסל'}</button>{actions?.(o)}</footer>
  </aside>
 </div>;
}
