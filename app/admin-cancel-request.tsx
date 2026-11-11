'use client';
import React,{useRef,useState} from 'react';
import {Check,XCircle} from 'lucide-react';
import {Input} from '@/components/ui/input';
import {Textarea} from '@/components/ui/textarea';
import {api} from '@/lib/client';
import type {Row} from '@/lib/shared';
import {paymentConfirmed} from '@/lib/admin-order-buckets';
import {ErrorBox,type Ctx} from './workspace';
import {orderNumber,orderTimestamp} from './order-presentation';

// A customer's request to cancel the whole order (11.11.2026). Approve runs the regular order cancel;
// reject sends the note back to the customer and the order continues as usual.
export function CancelRequestReview({ctx,order,close,rejectOnly=false}:{ctx:Ctx;order:Row;close:()=>void;rejectOnly?:boolean}){
 const [mode,setMode]=useState<'approve'|'reject'>(rejectOnly?'reject':'approve'),[note,setNote]=useState(''),[reference,setReference]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[done,setDone]=useState(''),lock=useRef(false);
 const external=paymentConfirmed(order)&&order.payment!=='credits';
 const act=async()=>{if(lock.current)return;lock.current=true;setBusy(true);setError('');try{
  if(mode==='approve')await api('orders/'+encodeURIComponent(order.id)+'/cancel','POST',{reason:note.trim()||order.cancel_request_reason||'',reference:reference.trim()});
  else await api('orders/'+encodeURIComponent(order.id)+'/cancel-request/reject','POST',{note:note.trim()});
  setDone(mode);ctx.refresh();
 }catch(e){setError((e as Error).message);}finally{lock.current=false;setBusy(false);}};
 return <section className="om-dialog" dir="rtl" aria-busy={busy}>
  {done&&<div className={'om-result '+(done==='approve'?'is-ok':'is-red')} role="status"><strong>{done==='approve'?'ההזמנה בוטלה':'הבקשה נדחתה'}</strong><span>{done==='approve'?'הלקוח קיבל עדכון שהביטול אושר.':'הלקוח קיבל את התשובה שלך, וההזמנה ממשיכה כרגיל.'}</span></div>}
  <section className="om-dialog-part"><dl className="om-dialog-facts"><div><dt>הזמנה</dt><dd><bdi>{orderNumber(order)}</bdi></dd></div><div><dt>לקוח</dt><dd>{order.user_name||order.name}</dd></div><div><dt>מועד הבקשה</dt><dd><bdi>{orderTimestamp(order.cancel_requested_at)}</bdi></dd></div>{order.cancel_request_scope==='article'&&<div><dt>האתר</dt><dd><bdi>{order.cancel_request_target}</bdi></dd></div>}<div><dt>סיבת הלקוח</dt><dd>{order.cancel_request_reason||'לא צוינה'}</dd></div></dl></section>
  {done?<div className="om-dialog-actions"><button type="button" className="om-btn is-primary" onClick={close}>סגירה</button></div>:<section className="om-dialog-part is-decision" style={{display:'grid',gap:14}}><ErrorBox error={error}/>
   {!rejectOnly&&<div className="om-dialog-actions"><button type="button" className={'om-btn'+(mode==='approve'?' is-primary':'')} aria-pressed={mode==='approve'} disabled={busy} onClick={()=>setMode('approve')}><Check size={16} aria-hidden="true"/>אישור הביטול</button><button type="button" className={'om-btn'+(mode==='reject'?' is-danger':'')} aria-pressed={mode==='reject'} disabled={busy} onClick={()=>setMode('reject')}><XCircle size={16} aria-hidden="true"/>דחיית הבקשה</button></div>}
   <label className="om-dialog-field"><span>{mode==='approve'?'הערה ללקוח (רשות)':'למה הבקשה נדחתה? הלקוח יראה את התשובה *'}</span><Textarea className="resize-none" maxLength={1500} value={note} disabled={busy} onChange={e=>setNote(e.target.value)}/></label>
   {mode==='approve'&&external&&<label className="om-dialog-field"><span>אסמכתת החזר (ההזמנה שולמה בתשלום חיצוני) *</span><Input value={reference} maxLength={300} disabled={busy} onChange={e=>setReference(e.target.value)}/></label>}
   {mode==='approve'&&<p className="om-note">כל הכתבות בהזמנה יבוטלו, המלאי אצל הספקים יחזור, ותשלום מהיתרה יוחזר ליתרה.</p>}
   <div className="om-dialog-actions"><button type="button" className={'om-btn '+(mode==='approve'?'is-danger':'is-primary')} disabled={busy||mode==='reject'&&note.trim().length<2||mode==='approve'&&external&&!reference.trim()} onClick={act}>{busy?'שומר…':mode==='approve'?'ביטול ההזמנה':'שליחת הדחייה ללקוח'}</button><button type="button" className="om-btn" disabled={busy} onClick={close}>סגירה</button></div>
  </section>}
 </section>;
}
