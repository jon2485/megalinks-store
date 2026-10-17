import type {Row} from './shared';
// Historical totals stay immutable on paid orders; refunds are separate amounts.
export function articleAmounts(a:Row){
 const pub=Math.max(0,Number(a.publication_price||0)),writing=Math.max(0,Number(a.editorial_price||0));
 const gross=Number(a.paid_amount??a.unit_price??pub+writing);
 const net=Number(a.paid_net_amount??Math.round(gross/(1+Number(a.vat_percent??a.order_vat_percent??18)/100)));
 const writingNet=Number(a.writing_net_amount??(pub+writing?Math.round(net*writing/(pub+writing)):0));
 const writingGross=Number(a.writing_gross_amount??(pub+writing?Math.round(gross*writing/(pub+writing)):0));
 return {publicationNet:net-writingNet,writingNet,publicationGross:gross-writingGross,writingGross,
  publicationRefunded:!!a.publication_refunded,writingRefunded:!!a.writing_refunded};
}
export function orderCancellation(o:Row){if((o.order_status||o.status)==='cancelled'||(Number(o.article_count)>0&&Number(o.fully_refunded_count)===Number(o.article_count)))return 'full';if(Number(o.refunded_count)>0||Number(o.refund_total)>0)return 'partial';if(Number(o.cancel_pending_count)>0)return 'pending';return 'none';}
export function orderCancellationLabel(o:Row){return {full:'בוטלה',partial:(o.paid||o.settled||o.payment_settled)?'זוכתה חלקית':'',pending:'ביטול בבדיקה',none:''}[orderCancellation(o)];}
export function effectiveOrderTotal(o:Row){if(orderCancellation(o)==='full')return 0;return Math.max(0,Number(o.total||0)-Number(o.paid_refund_total||0));}
export function effectiveOrderAmounts(o:Row){const total=effectiveOrderTotal(o);if(!total)return {net:0,vat:0,total:0};const originalNet=Math.max(0,Number(o.subtotal||0)-Number(o.discount||0)),refund=Number(o.paid_refund_total||0),rate=Number(o.vat_percent??18);const net=Math.min(total,Math.max(0,originalNet-Math.round(refund/(1+rate/100))));return {net,vat:total-net,total};}
export function orderDisplayStatus(o:Row){return orderCancellation(o)==='full'?'cancelled':o.order_status||o.status;}
export function remainingArticleNet(a:Row,o?:Row){if(o&&orderCancellation(o)==='full')return 0;const x=articleAmounts(a);return (x.publicationRefunded?0:x.publicationNet)+(x.writingRefunded?0:x.writingNet);}
export function refundAmounts(a:Row,mode:string){const x=articleAmounts(a);return {net:(x.publicationRefunded?0:x.publicationNet)+(mode==='full'&&!x.writingRefunded?x.writingNet:0),gross:(x.publicationRefunded?0:x.publicationGross)+(mode==='full'&&!x.writingRefunded?x.writingGross:0),publication:!x.publicationRefunded,writing:mode==='full'&&!x.writingRefunded&&Number(a.editorial_price)>0};}
