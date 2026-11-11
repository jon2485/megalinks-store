import type {Row} from './shared';
import {effectiveOrderAmounts,remainingArticleNet} from './order-finance';
import {paymentConfirmed} from './admin-order-buckets';
/** Costs are immutable purchase snapshots, not current catalog prices or supplier cash payments. */
/** What we paid for an order's articles. A cancelled article costs nothing: it goes back to the state before
 *  the order, so it adds no cost, no profit and no loss (owner decision, 10.11.2026). Writing that the customer
 *  kept after a publication refund still counts. */
/** Writing costs ₪0.10 a word (owner, 11.11.2026). Saved on the article at purchase; older articles are worked out
 *  from the words bought, or from the writing price when the word count was not kept (₪0.15 a word to the customer). */
export const WRITING_COST_PER_WORD=10;
export function writingCost(a:Row){
 if(Number.isSafeInteger(a.writing_cost_cents)&&a.writing_cost_cents>=0)return Number(a.writing_cost_cents);
 const words=Number(a.editorial_words)>0?Number(a.editorial_words):Math.round(Number(a.editorial_price||0)/15);
 return Math.max(0,Math.round(words*WRITING_COST_PER_WORD));
}
export function purchaseCosts(articles:Row[]){
 let known=0,missing=0;
 for(const a of articles){
  // A refund marks the article cancelled, so the parts are read from the refund flags: writing the customer kept
  // after a publication-only refund still costs, and so does a live article whose supplier payment was kept.
  const writing=Number(a.editorial_price)>0,refunded=!!a.publication_refunded||!!a.writing_refunded,gone=a.status==='cancelled'&&!refunded;
  const publicationOff=(gone||!!a.publication_refunded)&&!a.supplier_cost_kept,writingOff=gone||!!a.writing_refunded;
  if(publicationOff&&(!writing||writingOff))continue;
  const cost=a.cost_cents;
  if(!publicationOff){if(a.cost_recorded!==false&&Number.isSafeInteger(cost)&&cost>=0&&(cost>0||a.cost_recorded===true))known+=cost;else missing++;}
  if(writing&&!writingOff)known+=writingCost(a);
 }
 if(!articles.length)missing++;
 return {known,missing,cost:missing?null:known};
}
export function buildMonthReport(orders:Row[],articles:Row[]){
 const byOrder=new Map<string,Row[]>();for(const a of articles){const group=byOrder.get(a.order_id)||[];group.push(a);byOrder.set(a.order_id,group);}
 const rows:Row[]=orders.filter(o=>!o.demo).map(o=>{const paid=paymentConfirmed(o),amounts=effectiveOrderAmounts(o),cost=purchaseCosts(byOrder.get(o.id)||[]);return {...o,items:(byOrder.get(o.id)||[]).map(a=>({id:a.id,url:a.data?.website_url||a.website_url||a.current_website_url||'',purchased_at:a.purchased_at||a.created||o.created,net:remainingArticleNet(a,o),publication_refunded:!!a.publication_refunded,writing_refunded:!!a.writing_refunded})),amounts,confirmed:paid,income_net:paid?amounts.net:0,income_vat:paid?amounts.vat:0,income_total:paid?amounts.total:0,cost_known:cost.known,cost_missing:cost.missing,cost_net:cost.cost,profit_net:paid&&cost.cost!==null?amounts.net-cost.cost:null};});
 const summary={orders:rows.length,paid_orders:0,net:0,vat:0,total:0,cost_known:0,cost_missing:0,cost_net:null as number|null,profit_net:null as number|null};
 const clients=new Map<string,Row>();
 for(const o of rows){
  if(o.confirmed){summary.paid_orders++;summary.net+=o.income_net;summary.vat+=o.income_vat;summary.total+=o.income_total;summary.cost_known+=o.cost_known;summary.cost_missing+=o.cost_missing;}
  const c=clients.get(o.user_id)||{user_id:o.user_id,name:o.user_name||o.name||'לקוח',email:o.user_email||o.email||'',phone:o.user_phone||o.phone||'',numbers:[],order_net:0,paid_net:0,paid_count:0,cost_known:0,cost_missing:0,cost_net:null,profit_net:null};
  c.numbers.push(o.number);c.order_net+=o.amounts.net;
  if(o.confirmed){c.paid_count++;c.paid_net+=o.income_net;c.cost_known+=o.cost_known;c.cost_missing+=o.cost_missing;}
  clients.set(o.user_id,c);
 }
 for(const c of clients.values())if(c.paid_count&&!c.cost_missing){c.cost_net=c.cost_known;c.profit_net=c.paid_net-c.cost_known;}
 if(!summary.cost_missing){summary.cost_net=summary.cost_known;summary.profit_net=summary.net-summary.cost_known;}
 return {orders:rows,clients:[...clients.values()],summary};
}
