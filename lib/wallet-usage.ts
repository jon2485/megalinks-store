import type {Row} from './shared';
// Use immutable debit entries and original item amounts; refunds stay separate.
export function walletUsageHistory(entries:Row[]):Row[]{return entries.filter(e=>Number(e.amount)<0).flatMap<Row>(entry=>{
 const total=-Number(entry.amount),products:Array<Row>=Array.isArray(entry.products)?entry.products:[];
 if(!products.length)return [{id:entry.id,ledger_id:entry.id,created:entry.created,order_id:entry.order_id,order_number:entry.order_number,amount_cents:total,reason:entry.reason,website_name:null,website_url:null}];
 const weights=products.map(p=>Math.max(0,Number(p.paid_amount)||0)),sum=weights.reduce((a,b)=>a+b,0);let cumulative=0,allocated=0;
 return products.map((p,index)=>{cumulative+=sum?weights[index]:1;const target=index===products.length-1?total:Math.round(total*cumulative/(sum||products.length)),amount=target-allocated;allocated=target;return {id:entry.id+':'+(p.article_id||index),ledger_id:entry.id,created:entry.created,order_id:entry.order_id,order_number:entry.order_number,website_name:p.name,website_url:p.url,article_id:p.article_id,amount_cents:amount,reason:entry.reason};}).filter(row=>row.amount_cents>0);
 });}
