import type {Row} from './shared';
import {effectiveOrderAmounts,remainingArticleNet} from './order-finance';
import {paymentConfirmed} from './admin-order-buckets';
/** Costs are immutable purchase snapshots, not current catalog prices or supplier cash payments. */
export function purchaseCosts(articles:Row[]){
 let known=0,missing=0;
 for(const a of articles){
  const cost=a.cost_cents;
  if(a.cost_recorded!==false&&Number.isSafeInteger(cost)&&cost>=0&&(cost>0||a.cost_recorded===true))known+=cost;else missing++;
  if(Number(a.editorial_price)>0){const writing=a.writing_cost_cents;if(Number.isSafeInteger(writing)&&writing>=0)known+=writing;else missing++;}
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
