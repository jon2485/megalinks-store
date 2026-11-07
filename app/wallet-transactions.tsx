'use client';
import React,{useState} from 'react';
import {Plus,Minus,Undo2,ChevronDown,Globe,Hash,CalendarDays,Tag,ArrowLeft} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {money,when,type Row} from '@/lib/shared';
import {type Ctx} from './workspace';
import SiteReference from './site-reference';
import {OrderBreakdown} from './billing-workspace';

/** Internal references look like "bank-transfer:<hash>"; customers only need a short, readable code. */
function shortReference(reference:string){
 const parts=reference.split(':').filter(Boolean);
 const last=parts[parts.length-1]||reference;
 return last.length>12?'…'+last.slice(-8):last;
}
function kindLabel(entry:Row){return entry.cancellation?'זיכוי ביטול':entry.amount>0?(String(entry.reference||'').startsWith('bank-transfer')||/הטענ|טעינ/.test(String(entry.reason||''))?'טעינה':'זיכוי'):'חיוב';}

function TransactionItem({ctx,entry}:{ctx:Ctx;entry:Row}){
 const [open,setOpen]=useState(false),id='wallet-tx-'+entry.id;
 const tone=entry.cancellation?'refund':entry.amount>0?'in':'out';
 const title=entry.cancellation?'זיכוי בעקבות ביטול':String(entry.reason||'תנועה ביתרה');
 const Icon=entry.cancellation?Undo2:entry.amount>0?Plus:Minus;
 const date=entry.cancellation?(entry.cancelled_at||entry.created):entry.created;
 return <li className="wallet-tx" data-tone={tone} data-open={open}>
  <button type="button" className="wallet-tx-row" aria-expanded={open} aria-controls={id} onClick={()=>setOpen(v=>!v)}>
   <span className="wallet-tx-icon" aria-hidden="true"><Icon size={20}/></span>
   <span className="wallet-tx-main"><strong>{title}</strong><span><time dateTime={date}>{when(date)}</time> · {kindLabel(entry)}</span></span>
   <strong className="wallet-tx-amount"><bdi>{entry.amount>0?'+':''}{money(entry.amount)}</bdi></strong>
   <ChevronDown size={18} className="wallet-tx-chevron" aria-hidden="true"/>
  </button>
  <div id={id} className="wallet-tx-detail" hidden={!open}><div className="cv7-detail">
   <div className="cv7-hero" data-tone={tone==='out'?'out':'in'}><span className="cv7-hero-icon" aria-hidden="true"><Icon size={19}/></span><span><b><bdi>{money(Math.abs(entry.amount))}</bdi> {entry.cancellation?'חזרו ליתרה':entry.amount>0?'נוספו ליתרה':'שולמו מהיתרה'}</b><small>{entry.cancellation?'ההזמנה בוטלה, והסכום זמין לרכישה הבאה.':entry.amount>0?'הסכום זמין לשימוש מיד.':'החיוב בוצע מהיתרה שבחשבון.'}</small></span></div>
   {entry.cancellation&&(entry.products?.length?entry.products.map((p:Row,index:number)=><div key={p.article_id||index} className="cv7-site"><span className="cv7-tile-icon" aria-hidden="true"><Globe size={18}/></span><SiteReference name={p.name} url={p.url}/></div>):<p className="cv7-muted">פרטי האתר אינם זמינים</p>)}
   <dl className="cv7-tiles">
    {entry.cancellation&&<div className={entry.order_id?'is-link':''}><span className="cv7-tile-icon" aria-hidden="true"><Hash size={16}/></span><span><dt>הזמנה</dt><dd>{entry.order_id?<button type="button" className="cv7-tile-link" onClick={()=>ctx.open({kind:'admin-finance',title:'פרטי הזמנה '+entry.order_number,render:()=> <OrderBreakdown id={entry.order_id} ctx={ctx}/>})}><bdi>{entry.order_number}</bdi><ArrowLeft size={14} aria-hidden="true"/></button>:entry.order_number||'לא זמין'}</dd></span></div>}
    <div><span className="cv7-tile-icon" aria-hidden="true"><CalendarDays size={16}/></span><span><dt>{entry.cancellation?'תאריך הביטול':'תאריך'}</dt><dd>{when(date)}</dd></span></div>
    {!entry.cancellation&&<div><span className="cv7-tile-icon" aria-hidden="true"><Tag size={16}/></span><span><dt>סוג</dt><dd>{kindLabel(entry)}</dd></span></div>}
    {!entry.cancellation&&entry.reference&&<div><span className="cv7-tile-icon" aria-hidden="true"><Hash size={16}/></span><span><dt>מספר פעולה</dt><dd dir="ltr" className="cv7-ref" title={entry.reference}>{shortReference(String(entry.reference))}</dd></span></div>}
   </dl>
  </div></div>
 </li>;
}

export default function WalletTransactions({ctx,entries}:{ctx:Ctx;entries:Row[]}){return <ul className="wallet-tx-list">{entries.map(entry=><TransactionItem key={entry.id} ctx={ctx} entry={entry}/>)}</ul>;}
