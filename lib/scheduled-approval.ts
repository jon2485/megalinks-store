import {all,one,parse,stmt,db,now} from './server';
import {canWorkOrder} from './payment-state';
import {articleMail} from './mail';
import type {Row} from './shared';
export function futureArticleDate(article:Row,stamp=now()){
 const data=typeof article.data==='string'?JSON.parse(article.data):article.data||article;
 return !!data.scheduled&&Number.isFinite(Date.parse(data.scheduled))&&Date.parse(data.scheduled)>Date.parse(stamp);
}
/** Claim due submissions only. Approval and supplier dispatch remain manual. */
export async function releaseScheduledApprovals(origin:string){
 const stamp=now(),rows=await all("SELECT a.* FROM articles a WHERE a.status='scheduled' AND json_extract(a.data,'$.scheduled')<=? AND COALESCE(json_extract(a.data,'$.cancel_pending'),0)=0 AND COALESCE(json_extract(a.data,'$.publication_refunded'),0)=0 ORDER BY json_extract(a.data,'$.scheduled'),a.id LIMIT 100",stamp);
 let released=0;
 for(const a of rows){
  const order=parse(await one('SELECT * FROM orders WHERE id=?',a.order_id));if(!order||!canWorkOrder(order))continue;
  const activity='scheduled-review:'+a.id+':'+a.version;
  const results=await db().batch([
   stmt("UPDATE articles SET status='admin_review',version=version+1,updated=?,data=json_set(data,'$.scheduled_released_at',?) WHERE id=? AND status='scheduled' AND version=? AND json_extract(data,'$.scheduled')<=? AND COALESCE(json_extract(data,'$.cancel_pending'),0)=0 AND COALESCE(json_extract(data,'$.publication_refunded'),0)=0 AND EXISTS(SELECT 1 FROM orders o WHERE o.id=articles.order_id AND o.status<>'cancelled' AND (o.paid=1 OR json_extract(o.data,'$.demo')=1 OR json_extract(o.data,'$.on_account')=1 OR json_extract(o.data,'$.payment_settled')=1))",stamp,stamp,a.id,a.version,stamp),
   stmt("INSERT OR IGNORE INTO activity(id,user_id,resource,action,data,created) SELECT ?,'system:schedule',id,'הגיע מועד השליחה לאישור מנהל',?,? FROM articles WHERE id=? AND status='admin_review' AND version=? AND json_extract(data,'$.scheduled_released_at')=?",activity,JSON.stringify({scheduled:JSON.parse(a.data).scheduled}),stamp,a.id,a.version+1,stamp)
  ]);
  if(!results[0].meta.changes)continue;
  released++;
  // A mail failure must not take the article out of the manager's approval queue.
  try{await articleMail({...a,status:'admin_review',version:a.version+1},'submitted',origin);}catch{/* queue state is durable; the approval is available regardless of mail transport */}
 }
 return {released};
}
