import {all,one} from './server';
import {fullyCancelledOrderSql} from './order-summary';
import {adminUnionCtes} from './admin-sql';

// Read-only operational feed. Existing approval/payment/publication handlers own writes.
export async function adminUpdates(query:URLSearchParams){
 const allowed=`NOT ${fullyCancelledOrderSql()} AND (o.paid=1 OR COALESCE(json_extract(o.data,'$.demo'),0)=1 OR COALESCE(json_extract(o.data,'$.on_account'),0)=1 OR EXISTS(SELECT 1 FROM monthly_charges c WHERE c.order_id=o.id AND c.settled=1))`;
 const articleBase='articles a JOIN orders o ON o.id=a.order_id JOIN users u ON u.id=a.user_id LEFT JOIN websites w ON w.id=a.website_id';
 const branches=[
  `SELECT 'article:'||a.id AS id,'article' AS kind,a.id AS resource_id,o.number,u.name AS user_name,COALESCE(w.name,'') AS website_name,COALESCE(NULLIF(a.title,''),json_extract(a.data,'$.topic'),'כתבה ללא כותרת') AS detail,a.updated AS happened_at,NULL AS amount,'כתבה חדשה לבדיקה' AS title,'ממתינה לאישור' AS status,'בדיקת הכתבה' AS action,'admin-article/'||a.id AS page,1 AS needs_action FROM ${articleBase} WHERE ${allowed} AND a.status='admin_review' AND COALESCE(json_extract(a.data,'$.cancel_pending'),0)=0`,
  `SELECT 'publication:'||a.id,'publication',a.id,o.number,u.name,COALESCE(w.name,''),COALESCE(NULLIF(a.title,''),'כתבה ללא כותרת'),a.updated,NULL,'כתבה ממתינה לפרסום','מוכנה לשליחה','פתיחת הכתבה','admin-article/'||a.id,1 FROM ${articleBase} WHERE ${allowed} AND a.status='approved' AND COALESCE(json_extract(a.data,'$.cancel_pending'),0)=0`,
  `SELECT 'revisions:'||a.id,'revisions',a.id,o.number,u.name,COALESCE(w.name,''),COALESCE(NULLIF(a.title,''),'כתבה ללא כותרת'),a.updated,NULL,'כתבה חזרה עם הערות','נדרשים תיקונים','צפייה בכתבה ובהערות','admin-article/'||a.id,1 FROM ${articleBase} WHERE ${allowed} AND a.status='revisions' AND COALESCE(json_extract(a.data,'$.cancel_pending'),0)=0`,
  `SELECT 'report:'||r.id,'bank',r.id,o.number,u.name,'',COALESCE(json_extract(r.data,'$.reference'),''),r.updated,json_extract(r.data,'$.amount_cents'),'דיווח תשלום לבדיקה','ממתין לאישור','פתיחת ההזמנה','admin-order/'||o.id,1 FROM records r JOIN orders o ON o.id=json_extract(r.data,'$.order_id') JOIN users u ON u.id=r.user_id WHERE r.kind='customer_payment_report' AND json_extract(r.data,'$.status')='pending' AND o.paid=0 AND o.status<>'cancelled'`,
  `SELECT 'bank:'||o.id,'bank',o.id,o.number,u.name,'',COALESCE(json_extract(o.data,'$.bank_reference'),''),o.created,o.total,'העברה בנקאית ממתינה לבדיקה','ממתין לאישור','פתיחת ההזמנה','admin-order/'||o.id,1 FROM orders o JOIN users u ON u.id=o.user_id WHERE o.paid=0 AND o.status IN ('pending','awaiting_approval') AND o.payment IN ('invoice','bank_transfer') AND COALESCE(json_extract(o.data,'$.demo'),0)=0 AND NOT ${fullyCancelledOrderSql()} AND NOT EXISTS(SELECT 1 FROM records r WHERE r.id='payment-report:'||o.id AND json_extract(r.data,'$.status')='pending')`,
  `SELECT 'support:'||r.id,'support',r.id,COALESCE(json_extract(r.data,'$.order_number'),''),u.name,'',COALESCE(json_extract(r.data,'$.name'),'פנייה ללא נושא'),r.updated,NULL,'פנייה דורשת טיפול','פנייה פתוחה','פתיחת הפנייה','admin-support/'||r.id,1 FROM records r JOIN users u ON u.id=r.user_id WHERE r.kind='ticket' AND COALESCE(json_extract(r.data,'$.status'),'open') NOT IN ('closed','resolved','completed','cancelled','answered') AND NOT (COALESCE(json_extract(r.data,'$.payment_method'),'')='bank_transfer' AND COALESCE(json_extract(r.data,'$.amount_cents'),0)>0)`,
  `SELECT 'paid:'||o.id,'paid',o.id,o.number,u.name,'',CASE o.payment WHEN 'credits' THEN 'תשלום מהיתרה' WHEN 'card' THEN 'תשלום באשראי' WHEN 'credits_card' THEN 'יתרה ואשראי' ELSE 'תשלום מאושר' END,COALESCE(json_extract(o.data,'$.paid_at'),o.updated),o.total,'תשלום אושר','שולם ואושר','פתיחת ההזמנה','admin-order/'||o.id,0 FROM orders o JOIN users u ON u.id=o.user_id WHERE o.paid=1 AND o.status<>'cancelled' AND COALESCE(json_extract(o.data,'$.demo'),0)=0 AND COALESCE(json_extract(o.data,'$.paid_at'),o.updated)>=datetime('now','-30 days')`,
  `SELECT 'delivery:'||j.id,'delivery',a.id,o.number,u.name,COALESCE(w.name,''),COALESCE(NULLIF(a.title,''),'כתבה ללא כותרת'),j.updated,NULL,'תקלה בשליחת כתבה','דורש בדיקה','פתיחת הכתבה','admin-article/'||a.id,1 FROM jobs j JOIN articles a ON a.id=json_extract(j.data,'$.article_id') JOIN orders o ON o.id=a.order_id JOIN users u ON u.id=a.user_id LEFT JOIN websites w ON w.id=a.website_id WHERE j.kind='supplier_publication' AND j.status IN ('failed','blocked')`,
 ];
 const feed=adminUnionCtes('feed',branches);
 const filter=['action','info'].includes(query.get('filter')||'')?query.get('filter')!:'all';
 const q=(query.get('q')||'').trim().slice(0,120),requested=Math.max(1,Math.min(100000,Math.trunc(Number(query.get('page')))||1)),size=20;
 const where=`WHERE (?='all' OR needs_action=?) AND (?='' OR (title||' '||user_name||' '||number||' '||website_name||' '||detail) LIKE ? ESCAPE '\\')`;
 const args=[filter,filter==='action'?1:0,q,'%'+q.replace(/[\\%_]/g,c=>'\\'+c)+'%'];
 const total=await one(`WITH ${feed} SELECT COUNT(*) AS total FROM feed ${where}`,...args);
 const page=Math.min(requested,Math.max(1,Math.ceil(Number(total?.total||0)/size)));
 const [updates,counts]=await Promise.all([
  all(`WITH ${feed} SELECT * FROM feed ${where} ORDER BY happened_at DESC,id LIMIT ? OFFSET ?`,...args,size,(page-1)*size),
  one(`WITH ${feed} SELECT COUNT(*) AS total,COALESCE(SUM(needs_action),0) AS action,COALESCE(SUM(CASE WHEN needs_action=0 THEN 1 ELSE 0 END),0) AS info FROM feed`),
 ]);
 return {updates,total:Number(total?.total||0),page,page_size:size,counts};
}
