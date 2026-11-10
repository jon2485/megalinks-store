import {all,one,parse,stmt,db,now} from './server';
import {canWorkOrder} from './payment-state';
import {articleMail} from './mail';
import type {Row} from './shared';
import {israelDay,israelDayStart} from './publication-date';
export function futureArticleDate(article:Row,stamp=now()){
 const data=typeof article.data==='string'?JSON.parse(article.data):article.data||article;
 return !!data.scheduled&&Number.isFinite(Date.parse(data.scheduled))&&Date.parse(data.scheduled)>Date.parse(stamp);
}
/** A scheduled article goes to the supplier at 07:00 Israel time on the chosen day. */
export const DISPATCH_HOUR=7;
/** The moment the supplier may get the article: 07:00 Israel time on the chosen day, or '' when no day was chosen. */
export function dispatchAtFor(article:Row){
 const data=typeof article.data==='string'?JSON.parse(article.data):article.data||article;
 if(!data.scheduled||!Number.isFinite(Date.parse(data.scheduled)))return '';
 const day=israelDay(data.scheduled);if(!day)return '';
 let at=Date.parse(israelDayStart(day))+DISPATCH_HOUR*3600e3;
 const hour=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Jerusalem',hour:'2-digit',hourCycle:'h23'}).format(new Date(at)));
 at+=(DISPATCH_HOUR-hour)*3600e3;// clock change days
 return new Date(at).toISOString();
}
export function dispatchDue(article:Row,stamp=now()){const at=dispatchAtFor(article);return !at||Date.parse(at)<=Date.parse(stamp);}
/** Older submissions that still wait as 'scheduled' go to the manager's approval queue right away.
 *  New submissions with a future day go to approval directly; only the supplier dispatch waits for the day. */
export async function releaseScheduledApprovals(origin:string){
 const stamp=now(),rows=await all("SELECT a.* FROM articles a WHERE a.status='scheduled' AND COALESCE(json_extract(a.data,'$.cancel_pending'),0)=0 AND COALESCE(json_extract(a.data,'$.publication_refunded'),0)=0 ORDER BY json_extract(a.data,'$.scheduled'),a.id LIMIT 100");
 let released=0;
 for(const a of rows){
  const order=parse(await one('SELECT * FROM orders WHERE id=?',a.order_id));if(!order||!canWorkOrder(order))continue;
  const activity='scheduled-review:'+a.id+':'+a.version;
  const results=await db().batch([
   stmt("UPDATE articles SET status='admin_review',version=version+1,updated=?,data=json_set(data,'$.scheduled_released_at',?,'$.review_requested_at',?) WHERE id=? AND status='scheduled' AND version=? AND COALESCE(json_extract(data,'$.cancel_pending'),0)=0 AND COALESCE(json_extract(data,'$.publication_refunded'),0)=0 AND EXISTS(SELECT 1 FROM orders o WHERE o.id=articles.order_id AND o.status<>'cancelled' AND (o.paid=1 OR json_extract(o.data,'$.demo')=1 OR json_extract(o.data,'$.on_account')=1 OR json_extract(o.data,'$.payment_settled')=1))",stamp,stamp,stamp,a.id,a.version),
   stmt("INSERT OR IGNORE INTO activity(id,user_id,resource,action,data,created) SELECT ?,'system:schedule',id,'הכתבה המתוזמנת הועברה לאישור מנהל',?,? FROM articles WHERE id=? AND status='admin_review' AND version=? AND json_extract(data,'$.scheduled_released_at')=?",activity,JSON.stringify({scheduled:JSON.parse(a.data).scheduled}),stamp,a.id,a.version+1,stamp)
  ]);
  if(!results[0].meta.changes)continue;
  released++;
  // A mail failure must not take the article out of the manager's approval queue.
  try{await articleMail({...a,status:'admin_review',version:a.version+1},'submitted',origin);}catch{/* queue state is durable; the approval is available regardless of mail transport */}
 }
 return {released};
}
