'use client';
import React,{useMemo,useState} from 'react';
import {ArrowLeft,CalendarDays,ChevronDown,ChevronUp,Download,ExternalLink,FileText,Search,X} from 'lucide-react';
import {useData} from '@/lib/client';
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from '@/components/ui/select';
import {money,type Row} from '@/lib/shared';
import {effectiveOrderAmounts,orderCancellation,remainingArticleNet} from '@/lib/order-finance';
import {paymentMethodLabel} from '@/lib/payment-state';
import {publicationLink} from '@/lib/purchased-history';
import {exportSpreadsheet} from '@/lib/office';
import {CustomerPaymentReport} from './payment-reports';
import {CustomerCancelRequest,cancelOptions,openCancelRequest} from './customer-cancel-request';
import {ErrorBox,type Ctx} from './workspace';
import './customer-orders-sky.css';

// Customer "ההזמנות שלי" in the look of the admin orders area (approved 11.11.2026, mockups 1-4).
// Only the customer's own facts: no cost, profit, other customers or internal history.
const day=(v:unknown)=>{const d=new Date(String(v||''));return Number.isNaN(+d)?'':new Intl.DateTimeFormat('he-IL',{timeZone:'Asia/Jerusalem',day:'2-digit',month:'2-digit',year:'numeric'}).format(d);};
const monthKey=(v:unknown)=>{const d=new Date(String(v||''));return Number.isNaN(+d)?'':new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jerusalem',year:'numeric',month:'2-digit'}).format(d);};
const monthName=(k:string)=>{const [y,m]=k.split('-').map(Number);return new Intl.DateTimeFormat('he-IL',{month:'long',year:'numeric'}).format(new Date(Date.UTC(y,m-1,15)));};
const host=(v:unknown)=>String(v||'').replace(/^https?:\/\//,'').replace(/^www\./,'').replace(/\/$/,'');
const paid=(o:Row)=>!!(o.paid||o.settled||o.payment_settled);
const monthly=(o:Row)=>!!(o.on_account||o.payment==='monthly');
const awaitingPay=(o:Row)=>!paid(o)&&!o.demo&&!monthly(o)&&orderCancellation(o)!=='full';
type Pill={tone:'ok'|'wait'|'info'|'off';text:string};
function payPill(o:Row):Pill{
 if(orderCancellation(o)==='full')return {tone:'off',text:paid(o)?'בוטלה וזוכתה':'בוטלה'};
 if(o.cancel_request_status==='pending')return {tone:'wait',text:'בקשת ביטול בבדיקה'};
 if(o.demo)return {tone:'off',text:'הדגמה'};
 if(paid(o))return {tone:'ok',text:'שולם'};
 if(monthly(o))return {tone:'info',text:'בחשבון החודשי'};
 if(o.payment_report_status==='pending')return {tone:'info',text:'דיווח תשלום בבדיקה'};
 return {tone:'wait',text:'ממתין לתשלום'};
}
const stageLabels:Record<string,[string,Pill['tone']]>={draft:['בהכנת התוכן','info'],writing:['בכתיבה אצלנו','info'],review:['ממתין לאישורך','wait'],admin_review:['בבדיקה שלנו','info'],revisions:['נדרשים תיקונים','wait'],approved:['אושר, יישלח לפרסום','info'],scheduled:['מתוזמן לשליחה','info'],sent:['נשלח לפרסום','info'],published:['פורסם','ok'],demo_completed:['הדגמה הושלמה','ok'],cancelled:['בוטל','off']};
function articlePill(a:Row,o:Row):Pill{
 if(orderCancellation(o)==='full'||a.status==='cancelled')return {tone:'off',text:'בוטל'};
 if(a.publication_refunded)return {tone:'off',text:a.writing_refunded||!Number(a.editorial_price)?'בוטל וזוכה':'הפרסום בוטל'};
 if(a.cancel_pending)return {tone:'wait',text:'ביטול בבדיקה'};
 const [text,tone]=stageLabels[a.status]||['בטיפול','info'];return {text,tone};
}
const PillView=({p}:{p:Pill})=><span className={'cos-pill is-'+p.tone}><i aria-hidden="true"/>{p.text}</span>;
function sitesOf(o:Row,articles:Row[]):{name:string;url:string}[]{
 if(articles.length)return articles.map(a=>({name:String(a.website_name||a.data?.website_name||''),url:String(a.website_url||a.data?.website_url||'')}));
 try{const x=typeof o.item_preview==='string'?JSON.parse(o.item_preview):o.item_preview||[];return (x as Row[]).map(s=>({name:String(s.name||''),url:String(s.url||'')}));}catch{return [];}
}
function progress(o:Row,articles:Row[]){const live=articles.filter(a=>a.status!=='cancelled'&&!a.publication_refunded),done=live.filter(a=>a.status==='published'||a.status==='demo_completed').length;return {done,total:articles.length?live.length:Number(o.article_count||0)};}

function updatesFor(o:Row,articles:Row[]){
 const list:{at:string;text:string}[]=[];const add=(at:unknown,text:string)=>{if(at&&!Number.isNaN(+new Date(String(at))))list.push({at:String(at),text});};
 add(o.created,'ההזמנה נוצרה');
 add(o.payment_reported_at,'דיווחת על תשלום');
 if(paid(o))add(o.paid_at||o.payment_approved_at||o.payment_date,'התשלום אושר');
 add(o.invoice_attached_at,'חשבונית / קבלה צורפה להזמנה');
 for(const a of articles){const s=host(a.website_url||a.data?.website_url)||a.website_name||'האתר';
  add(a.writing_returned_at,'הטקסט ל־'+s+' מוכן לאישורך');add(a.sent_for_publication_at,'הכתבה ב־'+s+' נשלחה לפרסום');add(a.published_at,'הכתבה ב־'+s+' פורסמה');
  for(const h of a.refund_history||[])add(h.at,'האתר '+s+' בוטל'+(h.destination==='wallet'?' וזוכה ליתרה':''));}
 add(o.cancel_requested_at,o.cancel_request_scope==='article'?'שלחת בקשת ביטול ל־'+(o.cancel_request_target||'אתר'):'שלחת בקשת ביטול להזמנה');
 if(o.cancel_request_status==='rejected')add(o.cancel_request_handled_at,'בקשת הביטול לא אושרה');
 if(o.cancel_request_status==='approved')add(o.cancel_request_handled_at,'בקשת הביטול אושרה');
 return list.sort((x,y)=>+new Date(y.at)-+new Date(x.at));
}

function OrderPanel({ctx,order}:{ctx:Ctx;order:Row}){
 const state=useData('orders/'+order.id,ctx.revision,true,15000),o:Row=state.data?.order||order,items:Row[]=state.data?.articles||[];
 if(!state.data)return <div className="cos-panel-load" role={state.error?'alert':'status'}>{state.error||'טוען את פרטי ההזמנה…'}</div>;
 const amounts=effectiveOrderAmounts(o),prog=progress(o,items),cancelled=orderCancellation(o)==='full',refunded=Number(o.paid_refund_total||0);
 const confirmed=o.payment==='credits_card'?'':o.confirmed_payment_method||o.settlement_payment_method||'',method=confirmed?paymentMethodLabel({payment:confirmed})||String(confirmed):paymentMethodLabel(o);
 const updates=updatesFor(o,items);
 const exportOrder=()=>exportSpreadsheet('order-'+String(o.number||'').replace(/^#/,'')+'.xlsx',[['מספר הזמנה',o.number],['תאריך הזמנה',day(o.created)],['אופן תשלום',method],[],['אתר','כותרת הכתבה','מצב','מחיר לפני מע״מ (₪)'],...items.map(a=>[host(a.website_url||a.data?.website_url)||a.website_name||'',a.title||a.topic||'',articlePill(a,o).text,remainingArticleNet(a,o)/100]),[],['סכום לפני מע״מ',amounts.net/100],['מע״מ',amounts.vat/100],['סכום כולל מע״מ',amounts.total/100]]);
 return <div className="cos-panel">
  {o.cancel_request_status==='pending'&&<div className="cos-banner" role="status"><X size={16} aria-hidden="true"/>{o.cancel_request_scope==='article'?'בקשת ביטול ל־'+(o.cancel_request_target||'אתר'):'בקשת ביטול להזמנה'} נשלחה ב־{day(o.cancel_requested_at)} ומחכה לאישור. נעדכן אותך כאן ובמייל.</div>}
  <div className="cos-grid">
   <section className="cos-card cos-items" aria-label="הפריטים בהזמנה"><h3>הפריטים בהזמנה <small>{items.length===1?'אתר אחד':items.length+' אתרים'} · {prog.done} פורסמו</small></h3>
    <div className="cos-items-head" aria-hidden="true"><span>אתר וכתבה</span><span>מצב</span><span>לפני מע״מ</span></div>
    {items.map(a=>{const p=articlePill(a,o),gone=p.tone==='off',url=a.website_url||a.data?.website_url,live=a.status==='published'?publicationLink(a):'';return <div key={a.id} className={'cos-item'+(gone?' is-gone':'')}>
     <div className="cos-item-site">{url?<a href={url} target="_blank" rel="noopener noreferrer" dir="ltr">{host(url)}<ExternalLink size={13} aria-hidden="true"/></a>:<b>{a.website_name||'אתר'}</b>}<button type="button" className="cos-item-title" onClick={()=>ctx.go('article/'+encodeURIComponent(a.id))}><FileText size={13} aria-hidden="true"/>{a.title||a.topic||'פתיחת הכתבה'}</button>{(a.refund_history||[]).map((h:Row,i:number)=><small key={i} className="cos-item-note">{day(h.at)} · {h.destination==='wallet'?'זוכה ליתרה':h.destination==='external'?'הוחזר מחוץ למערכת':'הוסר מהחיוב'}</small>)}</div>
     <div><PillView p={p}/>{live&&<a className="cos-live" href={live} target="_blank" rel="noopener noreferrer">צפייה בכתבה<ArrowLeft size={13} aria-hidden="true"/></a>}</div>
     <strong className="cos-price">{gone?<del><bdi>{money(Number(a.publication_price||0)+Number(a.editorial_price||0))}</bdi></del>:<bdi>{money(remainingArticleNet(a,o))}</bdi>}</strong></div>;})}
    {!items.length&&<p className="cos-muted">אין פריטים להצגה בהזמנה זו.</p>}
    <dl className="cos-sum"><div><dt>לפני מע״מ</dt><dd><bdi>{money(amounts.net)}</bdi></dd></div><div><dt>מע״מ {o.vat_percent??18}%</dt><dd><bdi>{money(amounts.vat)}</bdi></dd></div><div className="is-total"><dt>{paid(o)?'סה״כ שולם, כולל מע״מ':'סה״כ לתשלום, כולל מע״מ'}</dt><dd><bdi>{money(amounts.total)}</bdi></dd></div>{refunded>0&&<div><dt>זוכה ליתרה</dt><dd><bdi>{money(refunded)}</bdi></dd></div>}</dl>
   </section>
   <aside className="cos-side">
    <section className="cos-card"><h3>פרטי ההזמנה והתשלום</h3><dl className="cos-facts"><div><dt>סוג ההזמנה</dt><dd>{monthly(o)?'חודשית':'רגילה'}</dd></div><div><dt>{paid(o)?'אמצעי תשלום':'אמצעי התשלום שנבחר'}</dt><dd>{method||'לא תועד'}</dd></div><div><dt>{paid(o)?'תאריך התשלום':'תאריך ההזמנה'}</dt><dd><bdi>{day(paid(o)?(o.paid_date||o.payment_date||o.paid_at):o.created)||'לא תועד'}</bdi></dd></div><div><dt>מצב</dt><dd><PillView p={payPill(o)}/></dd></div></dl>
     {monthly(o)&&o.purchase_closed_at&&!paid(o)&&<p className="cos-muted">ההזמנה נסגרה לרכישות נוספות. התשלום טרם אושר.</p>}
     {!paid(o)&&!o.demo&&!cancelled&&<div className="cos-pay"><CustomerPaymentReport ctx={ctx} order={o} look="sky"/></div>}
     <div className="cos-doc"><span className="cos-doc-icon"><FileText size={19} aria-hidden="true"/></span><div><b>חשבונית / קבלה</b><small>{o.invoice_file_id?'מצורפת להזמנה · PDF':'טרם צורף מסמך להזמנה'}</small></div>{o.invoice_file_id&&<a className="cos-btn" href={'/api/orders/'+encodeURIComponent(o.id)+'/invoice'} download><Download size={16} aria-hidden="true"/>הורדה</a>}</div>
    </section>
    {updates.length>0&&<section className="cos-card"><h3>עדכונים להזמנה זו</h3><ol className="cos-updates">{updates.slice(0,8).map((u,i)=><li key={i}><i aria-hidden="true"/><div>{u.text}<small><bdi>{day(u.at)}</bdi></small></div></li>)}</ol></section>}
    <CustomerCancelRequest ctx={ctx} order={o} articles={items} compact/>
    <div className="cos-actions"><button type="button" className="cos-btn" onClick={exportOrder}><Download size={16} aria-hidden="true"/>ייצוא לאקסל</button><CustomerCancelButton ctx={ctx} order={o} items={items}/></div>
   </aside>
  </div>
 </div>;
}
function CustomerCancelButton({ctx,order,items}:{ctx:Ctx;order:Row;items:Row[]}){
 if(order.cancel_request_status==='pending')return <span className="cos-btn is-wait" aria-disabled="true">בקשת ביטול בבדיקה</span>;
 if(!cancelOptions(order,items).can)return null;
 return <button type="button" className="cos-btn is-danger" onClick={()=>openCancelRequest(ctx,order,items)}><X size={16} aria-hidden="true"/>בקשת ביטול</button>;
}

type Filter='all'|'pay'|'active'|'done';
export default function CustomerOrdersSky({ctx,providedOrders}:{ctx:Ctx;providedOrders?:Row[]}){
 const state=useData('orders',ctx.revision,!providedOrders,15000),arts=useData('articles',ctx.revision,true,30000);
 const [filter,setFilter]=useState<Filter>('all'),[q,setQ]=useState(''),[month,setMonth]=useState(''),[open,setOpen]=useState('');
 const orders:Row[]=useMemo(()=>[...(providedOrders||state.data?.orders||[])].sort((a,b)=>String(b.created).localeCompare(String(a.created))),[providedOrders,state.data]);
 const byOrder=useMemo(()=>{const m=new Map<string,Row[]>();for(const a of arts.data?.articles||[]){const k=String(a.order_id);m.set(k,[...(m.get(k)||[]),a]);}return m;},[arts.data]);
 const kind=(o:Row):Filter=>{if(awaitingPay(o)&&o.payment_report_status!=='pending')return 'pay';const p=progress(o,byOrder.get(o.id)||[]);return orderCancellation(o)==='full'||(paid(o)||o.demo)&&p.total>0&&p.done>=p.total?'done':'active';};
 const counts={all:orders.length,pay:orders.filter(o=>kind(o)==='pay').length,active:orders.filter(o=>kind(o)==='active').length,done:orders.filter(o=>kind(o)==='done').length};
 const months=[...new Set(orders.map(o=>monthKey(o.created)).filter(Boolean))];
 const term=q.trim().toLowerCase();
 const shown=orders.filter(o=>(filter==='all'||kind(o)===filter)&&(!month||monthKey(o.created)===month)&&(!term||[o.number,...sitesOf(o,byOrder.get(o.id)||[]).flatMap(s=>[s.name,s.url])].some(v=>String(v||'').toLowerCase().includes(term))));
 const chip=(id:Filter,label:string,warn=false)=><button type="button" className={'cos-chip'+(filter===id?' is-on':'')+(warn&&counts[id]?' is-warn':'')} aria-pressed={filter===id} onClick={()=>setFilter(id)}>{label}<b>{counts[id]}</b></button>;
 return <section className="cos" dir="rtl" aria-label="ההזמנות שלי">
  <div className="cos-top"><div className="cos-chips">{chip('all','כל ההזמנות')}{chip('pay','ממתינות לתשלום',true)}{chip('active','בטיפול')}{chip('done','הושלמו')}</div><h2>ההזמנות שלי</h2></div>
  <div className="cos-tools"><label className="cos-search"><Search size={17} aria-hidden="true"/><input type="search" placeholder="חיפוש מספר הזמנה או אתר" aria-label="חיפוש מספר הזמנה או אתר" value={q} onChange={e=>setQ(e.target.value)}/>{q&&<button type="button" aria-label="ניקוי החיפוש" onClick={()=>setQ('')}><X size={15}/></button>}</label><Select dir="rtl" value={month||'all'} onValueChange={v=>setMonth(v==='all'?'':v)}><SelectTrigger className="cos-select" aria-label="סינון לפי חודש"><CalendarDays size={16} aria-hidden="true"/><SelectValue/></SelectTrigger><SelectContent position="popper" align="start" sideOffset={6} className="cos-select-menu"><SelectItem value="all">כל החודשים</SelectItem>{months.map(m=><SelectItem key={m} value={m}>{monthName(m)}</SelectItem>)}</SelectContent></Select></div>
  <ErrorBox error={state.error}/>
  {state.loading&&!providedOrders&&!state.data?<p className="cos-muted" role="status">טוען הזמנות…</p>:!orders.length?<p className="cos-empty">ההזמנות שלך יופיעו כאן לאחר הרכישה.</p>:<>
   <div className="cos-cols" aria-hidden="true"><span>הזמנה</span><span>אתרים</span><span>תשלום</span><span>פרסום</span><span>סכום</span><span/></div>
   <div className="cos-list">{shown.map(o=>{const items=byOrder.get(o.id)||[],sites=sitesOf(o,items),first=sites[0]||{name:'',url:''},p=progress(o,items),pill=payPill(o),isOpen=open===o.id,amounts=effectiveOrderAmounts(o),gone=orderCancellation(o)==='full',need=kind(o)==='pay'||o.cancel_request_status==='pending',toggle=()=>setOpen(isOpen?'':o.id);
    return <article key={o.id} className={'cos-order'+(isOpen?' is-open':'')+(need?' is-need':'')}>
     <div className="cos-row" role="button" tabIndex={0} aria-expanded={isOpen} aria-label={'פירוט הזמנה '+o.number} onClick={toggle} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();toggle();}}}>
      <div className="cos-num"><b><bdi>{String(o.number||'')}</bdi></b><small>{day(o.created)}</small></div>
      <div className="cos-sites"><span className="cos-fav" aria-hidden="true">{(first.name||host(first.url)||'א').trim().charAt(0)}</span><div><b>{first.name||host(first.url)||'אתר'}</b>{first.url&&<small dir="ltr">{host(first.url)}</small>}</div>{sites.length>1&&<span className="cos-more">+{sites.length-1}</span>}</div>
      <div className="cos-paycell"><PillView p={pill}/></div>
      <div className="cos-prog" aria-label={'פורסמו '+p.done+' מתוך '+p.total}><span className="cos-bar"><span style={{width:(p.total?Math.round(p.done/p.total*100):0)+'%'}}/></span>{gone?'—':p.total?(p.done+'/'+p.total+(p.done?' פורסמו':'')):'—'}</div>
      <div className="cos-amt"><b>{gone?<del><bdi>{money(Number(o.total||0))}</bdi></del>:<bdi>{money(amounts.total)}</bdi>}</b><small>כולל מע״מ</small></div>
      <div className="cos-act">{isOpen?<span className="cos-btn is-round" aria-hidden="true"><ChevronUp size={17}/></span>:kind(o)==='pay'?<span className="cos-btn is-primary">להשלמת התשלום</span>:<span className="cos-btn">פירוט<ChevronDown size={16} aria-hidden="true"/></span>}</div>
     </div>
     {isOpen&&<OrderPanel ctx={ctx} order={o}/>}
    </article>;})}
    {!shown.length&&<p className="cos-empty">לא נמצאו הזמנות לסינון הזה.</p>}
   </div></>}
 </section>;
}
