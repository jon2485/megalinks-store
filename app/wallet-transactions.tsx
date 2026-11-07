'use client';
import React,{useState} from 'react';
import {Plus,Minus,Undo2,ChevronDown} from 'lucide-react';
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
  <div id={id} className="wallet-tx-detail" hidden={!open}><dl className="wallet-tx-facts">
   {entry.cancellation?<>
    <div className="is-wide"><dt>המוצר שבוטל</dt><dd>{entry.products?.length?entry.products.map((p:Row,index:number)=><SiteReference key={p.article_id||index} name={p.name} url={p.url}/>):'פרטי האתר אינם זמינים'}</dd></div>
    <div><dt>מספר הזמנה</dt><dd>{entry.order_id?<Button variant="link" className="wallet-tx-link" onClick={()=>ctx.open({kind:'admin-finance',title:'פרטי הזמנה '+entry.order_number,render:()=> <OrderBreakdown id={entry.order_id} ctx={ctx}/>})}><bdi>{entry.order_number}</bdi></Button>:entry.order_number||'לא זמין'}</dd></div>
    <div><dt>תאריך הביטול</dt><dd>{when(date)}</dd></div>
   </>:<>
    <div><dt>תאריך</dt><dd>{when(entry.created)}</dd></div>
    <div><dt>סוג</dt><dd>{kindLabel(entry)}</dd></div>
    {entry.reference&&<div><dt>מספר פעולה</dt><dd dir="ltr" title={entry.reference}>{shortReference(String(entry.reference))}</dd></div>}
   </>}
  </dl></div>
 </li>;
}

export default function WalletTransactions({ctx,entries}:{ctx:Ctx;entries:Row[]}){return <ul className="wallet-tx-list">{entries.map(entry=><TransactionItem key={entry.id} ctx={ctx} entry={entry}/>)}</ul>;}
