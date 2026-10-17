import {Row} from './shared';
import {orderCancellation} from './order-finance';
export const historyGroups={open:'הזמנות חודשיות פתוחות',pending:'ממתינות לתשלום',closed:'הזמנות סגורות',cancelled:'הזמנות שבוטלו',demo:'הזמנות הדגמה'};
export type HistoryGroup=keyof typeof historyGroups;
export function historyMonthLabel(month:string){return /^\d{4}-(0[1-9]|1[0-2])$/.test(month)?new Intl.DateTimeFormat('he-IL',{month:'long',year:'numeric'}).format(new Date(month+'-15T12:00:00Z')):month;}
export function orderHistoryGroup(o:Row):HistoryGroup{
 if(o.demo)return 'demo';
 if(o.paid||o.settled||o.payment_settled)return 'closed';
 if(o.status==='cancelled')return 'cancelled';
 if((o.on_account||o.payment==='monthly')&&!o.monthly_closed)return 'open';
 if(orderCancellation(o)==='full')return 'cancelled';
 return 'pending';
}
export function financialOrderLabel(o:Row){if(orderCancellation(o)==='full')return 'בוטלה';const group=orderHistoryGroup(o);return group==='closed'?'שולמה':group==='open'?'חשבון חודשי פתוח':group==='demo'?'הדגמה - ללא חיוב':group==='cancelled'?'בוטלה':o.monthly_closed?'חודש נסגר - ממתינה לתשלום':'ממתינה לתשלום';}
export function financialClosedDate(o:Row){return o.monthly_closed_at||o.closed_at||o.paid_date||o.paid_at||((o.paid||o.settled||o.payment_settled)?o.updated:'');}
