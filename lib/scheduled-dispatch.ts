import {all,one,parse,stmt,now} from './server';
import {canWorkOrder} from './payment-state';
import {dispatchArticle} from './publication';

/** On the chosen day at 07:00 Israel time, send each approved scheduled article to the supplier once.
 *  A failed or blocked delivery stays in the "delivery failed" queue for a manual retry, it is not retried here. */
export async function dispatchScheduledArticles(origin:string){
 const stamp=now(),rows=await all("SELECT a.* FROM articles a WHERE a.status='approved' AND COALESCE(json_extract(a.data,'$.dispatch_at'),'')<>'' AND json_extract(a.data,'$.dispatch_at')<=? AND json_extract(a.data,'$.dispatch_attempted_at') IS NULL AND COALESCE(json_extract(a.data,'$.cancel_pending'),0)=0 AND COALESCE(json_extract(a.data,'$.publication_refunded'),0)=0 ORDER BY json_extract(a.data,'$.dispatch_at'),a.id LIMIT 100",stamp);
 let dispatched=0;
 for(const a of rows){
  const order=parse(await one('SELECT * FROM orders WHERE id=?',a.order_id));if(!order||!canWorkOrder(order))continue;
  const claim=await stmt("UPDATE articles SET data=json_set(data,'$.dispatch_attempted_at',?),version=version+1 WHERE id=? AND version=? AND status='approved' AND json_extract(data,'$.dispatch_attempted_at') IS NULL",stamp,a.id,a.version).run();
  if(!claim.meta.changes)continue;
  const fresh=await one('SELECT * FROM articles WHERE id=?',a.id);if(!fresh)continue;
  try{await dispatchArticle(fresh,{id:'system:schedule',role:'admin',name:'שליחה מתוזמנת'},origin);dispatched++;}catch{/* stays approved and shows as a failed delivery for a manual retry */}
 }
 return {dispatched};
}
