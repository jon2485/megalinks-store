import type {Row} from './shared';
import {orderCancellation} from './order-finance';
export const adminOrderBuckets={monthly:'הזמנות חודשיות פתוחות',closed:'הזמנות סגורות',process:'הזמנות בתהליך',archive:'ביטולים והדגמות'} as const;
export type AdminOrderBucket=keyof typeof adminOrderBuckets;
export const adminOrderFilterLabels={all:'כל הסטטוסים',...adminOrderBuckets};
export type AdminOrderFilterBucket=keyof typeof adminOrderFilterLabels;
export const paymentConfirmed=(o:Row)=>!o.demo&&!!(o.paid||o.settled||o.payment_settled);
/** Purchase closure, month PDF and customer reports never prove receipt of money. */
export function adminOrderBucket(o:Row):AdminOrderBucket{
 if(o.demo||orderCancellation(o)==='full')return 'archive';
 if(paymentConfirmed(o))return 'closed';
 if(o.on_account||o.payment==='monthly'||o.billing_month)return 'monthly';
 return 'process';
}
export function israelDate(value:string){
 if(/^\d{4}-\d{2}-\d{2}$/.test(value||''))return value;
 const d=new Date(value);if(!value||Number.isNaN(+d))return '';
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jerusalem',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d);
 const get=(type:string)=>parts.find(p=>p.type===type)?.value;return `${get('year')}-${get('month')}-${get('day')}`;
}
export function adminOrderDate(o:Row,bucket:AdminOrderBucket){return israelDate(bucket==='closed'?(o.paid_date||o.payment_date||o.paid_at||''):o.created);}
export function adminBucketMonth(o:Row,bucket:AdminOrderBucket){return adminOrderDate(o,bucket).slice(0,7)||'unknown';}
