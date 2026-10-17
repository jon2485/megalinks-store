import type {Row} from './shared';
import {orderCancellation} from './order-finance';
export const isBankPayment=(o:Row)=>['invoice','bank_transfer'].includes(o.payment);
export const isCardPayment=(o:Row)=>['card','credits_card'].includes(o.payment);
export const isAwaitingPayment=(o:Row)=>orderCancellation(o)!=='full'&&!o.paid&&!o.demo&&!o.on_account&&['pending','awaiting_approval'].includes(o.status);
export const canWorkOrder=(o:Row)=>!!o&&orderCancellation(o)!=='full'&&!!(o.paid||o.payment_settled||o.demo||o.on_account);
export function paymentMethodLabel(o:Row){return ({invoice:'העברה בנקאית',bank_transfer:'העברה בנקאית',card:'כרטיס אשראי',credits:'תשלום מהיתרה',credits_card:'יתרה והשלמה באשראי',monthly:'התחשבנות חודשית',demo_card:'אשראי - הדגמה',demo_transfer:'העברה - הדגמה',demo_credits:'יתרה - הדגמה',demo_monthly:'חשבון חודשי - הדגמה'} as Record<string,string>)[o.payment]||o.payment;}
export function paymentStatusLabel(o:Row){if(orderCancellation(o)==='full')return 'בוטלה';if(o.demo)return 'הדגמה - ללא חיוב';if(o.paid||o.payment_settled||o.settled)return 'הזמנה שולמה';if(o.on_account||o.payment==='monthly')return 'טרם שולם · חשבון חודשי';return isBankPayment(o)?'טרם שולם · העברה בנקאית':o.payment==='credits_card'?'טרם שולם · ממתין להשלמה':'טרם שולם · אשראי';}
