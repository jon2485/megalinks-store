import type {Row} from './shared';
import {effectiveOrderAmounts,orderCancellation} from './order-finance';
export const confirmedOrderPayment=(o:Row)=>!o.demo&&!!(o.paid||o.settled||o.payment_settled);
export const outstandingOrder=(o:Row)=>!o.demo&&!confirmedOrderPayment(o)&&orderCancellation(o)!=='full';
export function adminOrderMonth(o:Row,paid=true){const date=paid?(o.paid_date||o.payment_approved_at||o.paid_at):o.created;return String(date||'').slice(0,7);}
export function groupAdminOrders(orders:Row[],paid=true){const groups=new Map<string,Row>();for(const o of orders){const month=adminOrderMonth(o,paid);if(!groups.has(month))groups.set(month,{month,orders:[],net:0,vat:0,total:0});const g=groups.get(month)!;g.orders.push(o);const amount=effectiveOrderAmounts(o);g.net+=amount.net;g.vat+=amount.vat;g.total+=amount.total;}return [...groups.values()].sort((a,b)=>b.month.localeCompare(a.month));}
