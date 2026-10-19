import type {Row} from './shared';

export function isOpenMonthlyPurchaseOrder(order:Row){
 return !!(order.on_account||order.payment==='monthly')&&!order.demo&&!order.paid&&!order.settled&&!order.payment_settled&&!order.purchase_closed_at&&!order.monthly_closed&&order.status!=='cancelled';
}

export function paymentReportPresentation(order:Row){
 const closesMonthlyOrder=isOpenMonthlyPurchaseOrder(order);
 return {
  closesMonthlyOrder,
  heading:closesMonthlyOrder?'סגירת ההזמנה החודשית לרכישות נוספות':'שליחת דיווח תשלום לאישור מנהל',
  explanation:closesMonthlyOrder?'לאחר הדיווח, ההזמנה החודשית תיסגר לרכישות נוספות. הרכישה הבאה תפתח הזמנה חדשה.':'ההעברה הבנקאית תמתין לאישור מנהל. לאחר אישור התשלום, ההזמנה תושלם ותוכלו להתחיל לערוך את התוכן באזור האישי.',
  pending:'דיווח התשלום נשלח וממתין לאישור מנהל.',
  submit:closesMonthlyOrder?'שליחת דיווח וסגירת ההזמנה':'שליחת דיווח לאישור מנהל',
 };
}

export function paymentReportPendingMessage(report:Row){
 const date=report.reported_at?new Date(report.reported_at):null;
 const sent=date&&!Number.isNaN(date.getTime())?new Intl.DateTimeFormat('he-IL',{timeZone:'Asia/Jerusalem',day:'2-digit',month:'2-digit',year:'numeric'}).format(date):'';
 return sent?'דיווח התשלום נשלח בתאריך '+sent+' וממתין לאישור מנהל.':'דיווח התשלום נשלח וממתין לאישור מנהל.';
}
