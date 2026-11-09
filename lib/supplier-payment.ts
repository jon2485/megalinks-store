import {assert} from './server';
import {money,type Row} from './shared';
import {supplierPaymentMethods} from './supplier-presentation';

// How an admin paid a supplier. Used by both manual suppliers and suppliers with an account (09.11.2026).
export {supplierPaymentMethods};

/** Validates the payment date, method and note sent with a payment report. */
export function supplierPaymentDetails(b:Row){
 const day=String(b.paid_on||'').trim(),method=String(b.method||'bank_transfer'),note=String(b.note||'').trim().slice(0,1500);
 assert(/^\d{4}-\d{2}-\d{2}$/.test(day)&&Number.isFinite(Date.parse(day+'T12:00:00Z')),'יש לבחור תאריך תשלום');
 assert(day<=new Date(Date.now()+36e5*14).toISOString().slice(0,10),'תאריך התשלום לא יכול להיות בעתיד');
 assert(method in supplierPaymentMethods,'יש לבחור אופן תשלום');
 return {paid_on:day,paid_at:day+'T12:00:00.000Z',payment_method:method,payment_note:note};
}

/** The email the supplier receives once a payment is reported. */
export function supplierPaidMail(input:{to:string;month:string;amount:number;paidOn:string;method:string;reference:string;note:string;count:number}){
 const [y,m,d]=input.paidOn.split('-');
 return {to:input.to,subject:'בוצע תשלום עבור פרסומים בחודש '+input.month,text:['שלום,','בוצע אליך תשלום עבור '+input.count+' פרסומים בחודש '+input.month+'.','סכום: '+money(input.amount),'תאריך התשלום: '+d+'.'+m+'.'+y,'אופן התשלום: '+(supplierPaymentMethods[input.method]||input.method),input.reference?'אסמכתה: '+input.reference:'',input.note?'הערה: '+input.note:'','\nתודה על שיתוף הפעולה,','MegaLinks'].filter(Boolean).join('\n'),seller_notice:true};
}
