import React from 'react';
import type {Row} from '@/lib/shared';
const when=(v:string)=>v?new Intl.DateTimeFormat('he-IL',{timeZone:'Asia/Jerusalem',day:'2-digit',month:'2-digit',year:'numeric',...(v.length>10?{hour:'2-digit',minute:'2-digit'}:{})}).format(new Date(v)):'לא תועד';
import {israelDate} from '@/lib/admin-order-buckets';
export function assignedPaymentMonth(o:Row){
 if(!(o.paid||o.settled||o.payment_settled)||o.demo)return '';
 return israelDate(o.paid_date||o.payment_approved_at||o.paid_at||'').slice(0,7);
}
export default function PaymentAssignment({order:o}:{order:Row}){
 const stamp=o.paid_date||o.payment_approved_at||o.paid_at,month=assignedPaymentMonth(o);
 const label=month?new Intl.DateTimeFormat('he-IL',{month:'long',year:'numeric',timeZone:'Asia/Jerusalem'}).format(new Date(month+'-15T12:00:00Z')):o.demo?'הדגמה — אינה נכללת בהכנסות':o.paid||o.settled||o.payment_settled?'מועד האישור לא תועד — נדרשת בדיקה':'טרם שויכה — נקבע לאחר אישור התשלום';
 return <section className="payment-assignment" aria-label="תאריכים ושיוך כספי"><dl><div><dt>חודש שיוך סופי</dt><dd><strong>{label}</strong></dd></div><div><dt>תאריך ההזמנה</dt><dd>{when(o.created)}</dd></div>{o.payment_date&&<div><dt>תאריך ביצוע התשלום</dt><dd>{when(o.payment_date)}</dd></div>}{o.payment_reported_at&&<div><dt>תאריך דיווח התשלום</dt><dd>{when(o.payment_reported_at)}</dd></div>}{stamp&&<div><dt>אישור סופי</dt><dd>{when(stamp)}</dd></div>}</dl><p>השיוך הכספי נקבע לפי האישור הסופי, בשעון ישראל.</p></section>;
}
