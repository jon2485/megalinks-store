import {all,one,parse,stmt,now} from './server';
import {pendingCancelRequestSql} from './cancel-request';
import {canWorkOrder} from './payment-state';
import {dispatchArticle} from './publication';

/** On the chosen day at 07:00 Israel time, send each approved scheduled article to the supplier once.
 *  A failed or blocked delivery stays in the "delivery failed" queue for a manual retry, it is not retried here. */
export async function dispatchScheduledArticles(origin:string){
 const stamp=now(),rows=await all(`SELECT a.* FROM articles a WHERE a.status='approved' AND COALESCE(json_extract(a.data,'$.dispatch_at'),'')<>'' AND json_extract(a.data,'$.dispatch_at')<=? AND json_extract(a.data,'$.dispatch_attempted_at') IS NULL AND COALESCE(json_extract(a.data,'$.cancel_pending'),0)=0 AND COALESCE(json_extract(a.data,'$.publication_refunded'),0)=0 AND NOT ${pendingCancelRequestSql('a.order_id','a.id')} ORDER BY json_extract(a.data,'$.dispatch_at'),a.id LIMIT 100`,stamp);
 let dispatched=0;
 for(const a of rows){
  const order=parse(await one('SELECT * FROM orders WHERE id=?',a.order_id));if(!order||!canWorkOrder(order))continue;
  const claim=await stmt("UPDATE articles SET data=json_set(data,'$.dispatch_attempted_at',?),version=version+1 WHERE id=? AND version=? AND status='approved' AND json_extract(data,'$.dispatch_attempted_at') IS NULL",stamp,a.id,a.version).run();
  if(!claim.meta.changes)continue;
  const fresh=await one('SELECT * FROM articles WHERE id=?',a.id);if(!fresh)continue;
  try{await dispatchArticle(fresh,{id:'system:schedule',role:'admin',name:'שליחה מתוזמנת'},origin);dispatched++;}catch{/* stays approved and shows as a failed delivery for a manual retry */}
 }
 const stock=await dispatchStockWaiting(origin).catch(()=>({dispatched:0}));
 return {dispatched,stock_dispatched:stock.dispatched};
}

/** A stock slot freed by a cancellation, or a new package, sends the approved articles that were waiting for stock,
 *  oldest first (owner, 11.11.2026). Only sites with a free slot right now are tried, and a site is left alone once
 *  it blocks again; every other delivery problem stays in the manual queue. */
export async function dispatchStockWaiting(origin:string,websiteId?:string){
 const rows=await all(`SELECT a.* FROM jobs j JOIN articles a ON a.id=json_extract(j.data,'$.article_id') JOIN websites w ON w.id=a.website_id JOIN orders o ON o.id=a.order_id WHERE j.kind='supplier_publication' AND j.status='blocked' AND a.status='approved' AND COALESCE(json_extract(o.data,'$.demo'),0)=0 AND json_extract(w.data,'$.stock_total') IS NOT NULL AND COALESCE((SELECT c.sent_count FROM supplier_dispatch_counters c WHERE c.website_id=w.id AND c.demo=0),0)<CAST(json_extract(w.data,'$.stock_total') AS INTEGER) AND COALESCE(json_extract(a.data,'$.cancel_pending'),0)=0 AND COALESCE(json_extract(a.data,'$.publication_refunded'),0)=0 AND NOT ${pendingCancelRequestSql('a.order_id','a.id')}${websiteId?' AND a.website_id=?':''} ORDER BY j.updated,a.id LIMIT 50`,...(websiteId?[websiteId]:[]));
 let dispatched=0;const full=new Set<string>();
 for(const a of rows){
  if(full.has(a.website_id))continue;
  const order=parse(await one('SELECT * FROM orders WHERE id=?',a.order_id));if(!order||!canWorkOrder(order))continue;
  try{const result=await dispatchArticle(a,{id:'system:stock',role:'admin',name:'שליחה אוטומטית אחרי שהתפנה מלאי'},origin);if(result?.status==='blocked')full.add(a.website_id);else dispatched++;}catch{/* stays waiting and shows in the delivery queue */}
 }
 return {dispatched};
}
