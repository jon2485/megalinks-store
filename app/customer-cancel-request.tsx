'use client';
import React,{useRef,useState} from 'react';
import {Clock3,XCircle} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {api} from '@/lib/client';
import type {Row} from '@/lib/shared';
import {orderCancellation} from '@/lib/order-finance';
import type {Ctx} from './workspace';
import './customer-cancel-request.css';

// Owner rule (11.11.2026): the customer only asks to cancel. The admin approves or rejects,
// and a rejection comes back here with the admin's note.
export function CustomerCancelRequest({ctx,order,articles}:{ctx:Ctx;order:Row;articles:Row[]}){
 const [open,setOpen]=useState(false),[reason,setReason]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[sent,setSent]=useState(false),lock=useRef(false);
 const status=sent?'pending':order.cancel_request_status;
 const closed=orderCancellation(order)==='full'||['cancelled','completed'].includes(order.status)||order.demo;
 const active=articles.filter(a=>a.status!=='cancelled'&&!a.publication_refunded);
 const canAsk=!closed&&active.length>0&&articles.every(a=>!['sent','published'].includes(a.status));
 if(status==='pending')return <section className="customer-cancel-request customer-cancel-request-status" role="status"><Clock3 size={18} aria-hidden="true"/> <strong>בקשת הביטול נשלחה ומחכה לאישור המנהל.</strong>{order.cancel_request_reason&&!sent&&<p>הסיבה שכתבת: {order.cancel_request_reason}</p>}</section>;
 const rejected=status==='rejected'&&<section className="customer-cancel-request customer-cancel-request-status" role="status"><XCircle size={18} aria-hidden="true"/> <strong>בקשת הביטול הקודמת לא אושרה.</strong>{order.cancel_request_note&&<p>תשובת המנהל: {order.cancel_request_note}</p>}</section>;
 if(!canAsk)return rejected||null;
 const submit=async()=>{if(lock.current)return;if(reason.trim().length<2){setError('יש לכתוב את סיבת הביטול');return;}lock.current=true;setBusy(true);setError('');try{await api('orders/'+encodeURIComponent(order.id)+'/cancel','POST',{reason:reason.trim()});setSent(true);setOpen(false);ctx.refresh();}catch(e){setError((e as Error).message);}finally{lock.current=false;setBusy(false);}};
 return <>{rejected}<details className="customer-cancel-request" open={open} onToggle={e=>setOpen((e.currentTarget as HTMLDetailsElement).open)}><summary>בקשה לביטול ההזמנה</summary>
  <p>הבקשה נשלחת למנהל לאישור. ההזמנה ממשיכה כרגיל עד שהמנהל יחליט, ותקבלו עדכון כאן ובמייל.</p>
  <label className="customer-cancel-request-field"><span>סיבת הביטול *</span><textarea value={reason} maxLength={1500} rows={3} disabled={busy} onChange={e=>setReason(e.target.value)}/></label>
  {error&&<p role="alert" className="customer-cancel-request-error">{error}</p>}
  <Button type="button" variant="outline" className="text-destructive" disabled={busy} onClick={submit}>{busy?'שולח…':'שליחת בקשת ביטול'}</Button>
 </details></>;
}
