import {packageRanges,slotPlace} from './supplier-stock';
import {all,one} from './server';
import {SUPPLIER_LATE_DAYS,writingCodeSql} from './writing-workflow';
// A content-only projection. Financial fields and article bodies stay out of lists.
export const contentSource=`WITH history AS (
 SELECT resource,
 MIN(CASE WHEN action='סטטוס: admin_review' THEN created END) AS submitted,
 MIN(CASE WHEN action IN ('סטטוס: approved','כתיבה מקצועית אושרה לפרסום ללא החזרה') THEN created END) AS approved,
 MIN(CASE WHEN action IN ('הכתבה הועברה אוטומטית לפורטל הספק','הכתבה הועברה לתור הדגמה של הספק','נוצר קישור ספק') THEN created END) AS sent
 FROM activity GROUP BY resource
), content AS (
 SELECT a.id,a.order_id,a.user_id,a.website_id,a.title,a.status,a.published_url,a.updated,
 o.number,${writingCodeSql('o.number','a.id')} AS article_code,o.created AS order_created,COALESCE(json_extract(o.data,'$.on_account'),0) AS on_account,u.name AS user_name,u.email AS user_email,u.phone AS user_phone,w.url AS website_url,
 COALESCE(json_extract(a.data,'$.supplier_name'),json_extract(j.data,'$.supplier_name'),'') AS supplier_name,
 COALESCE(NULLIF(json_extract(a.data,'$.supplier_id'),''),NULLIF(json_extract(j.data,'$.supplier_id'),''),json_extract(w.data,'$.supplier_id'),'') AS supplier_id,
 COALESCE(json_extract(a.data,'$.first_submitted_at'),json_extract(a.data,'$.submitted_at'),json_extract(a.data,'$.writing_first_requested_at'),json_extract(a.data,'$.writing_requested_at'),json_extract(a.data,'$.scheduled_submitted_at'),h.submitted) AS submitted_at,
 COALESCE(json_extract(a.data,'$.review_requested_at'),h.submitted,json_extract(a.data,'$.submitted_at')) AS review_requested_at,
 COALESCE(json_extract(a.data,'$.supplier_sent_at'),d.created,h.sent) AS supplier_sent_at,
 h.approved AS approved_at,json_extract(a.data,'$.published_at') AS published_at,json_extract(a.data,'$.scheduled') AS scheduled_for,
 COALESCE(json_extract(a.data,'$.cancel_pending'),0) AS cancel_pending,json_extract(a.data,'$.cancel_reason') AS cancel_reason,
 COALESCE(json_extract(a.data,'$.publication_refunded'),0) AS refunded,json_extract(a.data,'$.refund_reason') AS refund_reason,
 COALESCE(json_extract(a.data,'$.editorial'),0) AS editorial,COALESCE(json_extract(a.data,'$.publish_without_review'),0) AS publish_without_review,
 json_extract(a.data,'$.writing_requested_at') AS writing_requested_at,json_extract(a.data,'$.writing_returned_at') AS writing_returned_at,json_extract(a.data,'$.writing_completed_at') AS writing_completed_at,
 json_extract(a.data,'$.writing_revision_requested_at') AS writing_revision_requested_at,json_extract(a.data,'$.writing_revision_note') AS writing_revision_note,
 COALESCE(NULLIF(json_extract(a.data,'$.topic'),''),'') AS topic,json_extract(a.data,'$.editorial_words') AS editorial_words,json_extract(a.data,'$.keywords') AS keywords,json_extract(a.data,'$.brand') AS brand,json_extract(a.data,'$.audience') AS audience,json_extract(a.data,'$.style') AS style,json_extract(a.data,'$.target_url') AS target_url,json_extract(a.data,'$.anchor') AS anchor,json_extract(a.data,'$.target_url_2') AS target_url_2,json_extract(a.data,'$.anchor_2') AS anchor_2,json_extract(a.data,'$.notes') AS notes,
 j.status AS delivery_status,json_extract(j.data,'$.error') AS delivery_error,w.active AS website_active,
 CASE WHEN o.status<>'cancelled' AND (o.paid=1 OR json_extract(o.data,'$.demo')=1 OR json_extract(o.data,'$.on_account')=1 OR json_extract(o.data,'$.payment_settled')=1) THEN 1 ELSE 0 END AS workable
 FROM articles a JOIN orders o ON o.id=a.order_id JOIN users u ON u.id=a.user_id JOIN websites w ON w.id=a.website_id
 LEFT JOIN history h ON h.resource=a.id
 LEFT JOIN jobs j ON j.id='publication:'||a.id AND j.kind='supplier_publication'
 LEFT JOIN supplier_dispatch_allocations d ON d.article_id=a.id
), staged AS (
 SELECT *,CASE
  WHEN refunded=1 OR status='cancelled' THEN 'cancelled'
  WHEN cancel_pending=1 THEN 'cancel_pending'
  WHEN status='demo_completed' THEN 'demo_completed'
  WHEN status='published' OR COALESCE(published_url,'')<>'' THEN 'published'
  WHEN status IN ('approved','sent') AND delivery_status IN ('failed','blocked') THEN 'delivery_failed'
  WHEN status='approved' AND COALESCE(delivery_status,'') NOT IN ('succeeded','demo','writing','requested','completed','demo_completed') THEN 'delivery_failed'
  WHEN status='approved' THEN 'with_supplier'
  WHEN status='sent' THEN 'with_supplier'
  WHEN status='admin_review' THEN 'admin_review'
  WHEN status='scheduled' THEN 'scheduled'
  WHEN editorial=1 AND writing_requested_at IS NOT NULL AND (status='writing' OR (status='revisions' AND writing_returned_at IS NULL)) THEN CASE WHEN status='revisions' OR writing_revision_requested_at IS NOT NULL THEN 'writing_fix' ELSE 'writing_new' END
  WHEN editorial=1 AND writing_requested_at IS NULL THEN 'awaiting_brief'
  WHEN editorial=1 THEN 'customer_review'
  WHEN status='revisions' THEN 'customer_fix'
  ELSE 'with_customer' END AS stage,
  CASE WHEN status='sent' AND COALESCE(published_url,'')='' AND COALESCE(supplier_sent_at,updated)<strftime('%Y-%m-%dT%H:%M:%fZ','now','-${SUPPLIER_LATE_DAYS} days') THEN 1 ELSE 0 END AS supplier_late
 FROM content
), rated AS (
 SELECT *,CASE
  WHEN stage='cancel_pending' THEN 1
  WHEN workable=1 AND stage IN ('admin_review','writing_new','writing_fix','delivery_failed') THEN 1
  WHEN workable=1 AND stage='with_supplier' AND supplier_late=1 THEN 1
  ELSE 0 END AS needs_action,
  CASE stage
   WHEN 'with_supplier' THEN COALESCE(supplier_sent_at,updated)
   WHEN 'delivery_failed' THEN updated
   WHEN 'admin_review' THEN COALESCE(review_requested_at,updated)
   WHEN 'writing_fix' THEN COALESCE(writing_revision_requested_at,updated)
   WHEN 'writing_new' THEN COALESCE(writing_requested_at,updated)
   WHEN 'customer_review' THEN COALESCE(writing_returned_at,updated)
   ELSE updated END AS waiting_since
 FROM staged
), visible AS (SELECT * FROM rated WHERE stage<>'awaiting_brief' AND (workable=1 OR submitted_at IS NOT NULL OR status IN ('admin_review','approved','sent','published','revisions','demo_completed')))`;

const publicationStages="stage IN ('delivery_failed','with_supplier')";
const writingStages="stage IN ('writing_new','writing_fix','customer_review')";
const stages=['cancel_pending','delivery_failed','with_supplier','admin_review','writing_new','writing_fix','customer_review','awaiting_brief','with_customer','customer_fix','scheduled','published','cancelled','demo_completed'];

export async function adminContent(query:URLSearchParams,exported=false){
 const view=['approvals','publication','writing'].includes(query.get('view')||'')?query.get('view')!:'articles';
 const status=query.get('status')||'all',route=query.get('route')||'all',q=(query.get('q')||'').trim().slice(0,200),requested=Math.max(1,Math.floor(Number(query.get('page'))||1));
 const where=["(?='' OR instr(lower(COALESCE(title,'')||' '||COALESCE(topic,'')||' '||COALESCE(user_name,'')||' '||COALESCE(website_url,'')||' '||COALESCE(number,'')||' '||COALESCE(supplier_name,'')||' '||COALESCE(article_code,'')),lower(?))>0)"],args:unknown[]=[q,q];
 // Articles of one supplier, from the supplier page (09.11.2026).
 const supplier=(query.get('supplier')||'').slice(0,200);if(supplier){where.push('supplier_id=?');args.push(supplier);}
 if(view==='approvals')where.push("stage='admin_review' AND workable=1");
 if(view==='publication')where.push(publicationStages);
 if(view==='writing')where.push('editorial=1 AND workable=1');
 if(view==='writing'&&(status==='all'||status==='open'))where.push(writingStages);
 if(view==='writing'&&status==='done')where.push('NOT '+writingStages);
 if(status==='needs')where.push('needs_action=1');
 if(stages.includes(status)){where.push('stage=?');args.push(status);}
 if(view==='writing'&&route==='direct')where.push('publish_without_review=1');
 if(view==='writing'&&route==='review')where.push('publish_without_review=0');
 const filter=where.join(' AND '),total=Number((await one(contentSource+' SELECT COUNT(*) AS n FROM visible WHERE '+filter,...args))?.n||0),size=20,page=Math.min(requested,Math.max(1,Math.ceil(total/size)));
 // What needs handling comes first, and the longest wait comes first within it.
 const order=view==='articles'?"needs_action DESC,CASE WHEN needs_action=1 THEN waiting_since END ASC,COALESCE(submitted_at,updated) DESC,id":"needs_action DESC,waiting_since ASC,id";
 const articles=await all(contentSource+' SELECT * FROM visible WHERE '+filter+' ORDER BY '+order+(exported?'':' LIMIT ? OFFSET ?'),...args,...(exported?[]:[size,(page-1)*size]));
 const counts=await one(contentSource+` SELECT COUNT(*) AS articles,SUM(needs_action) AS needs_articles,
  SUM(stage='admin_review' AND workable=1) AS approvals,
  SUM(${publicationStages}) AS publication,SUM(needs_action=1 AND ${publicationStages}) AS needs_publication,
  SUM(editorial=1 AND workable=1 AND ${writingStages}) AS writing,SUM(editorial=1 AND workable=1 AND stage IN ('writing_new','writing_fix')) AS needs_writing,
  SUM(editorial=1 AND workable=1 AND stage='writing_new') AS writing_new,SUM(editorial=1 AND workable=1 AND stage='writing_fix') AS writing_fix,SUM(editorial=1 AND workable=1 AND stage='customer_review') AS customer_review
  FROM visible`);
 return {articles,total,page,size,counts,request_key:query.toString()};
}

/** Articles a supplier has received: waiting for publication and published. Articles still with the customer never appear (09.11.2026). */
export async function supplierArticles(supplierId:string){
 const rows:any[]=await all(contentSource+` SELECT v.id,v.title,v.topic,v.website_id,v.website_url,w2.name AS website_name,v.stage,v.status,v.supplier_sent_at,v.published_at,v.published_url,v.anchor,v.target_url,v.anchor_2,v.target_url_2,v.number,v.waiting_since,v.supplier_late,v.delivery_status,d.sequence AS stock_slot,d.stock_total AS stock_snapshot,json_extract(w2.data,'$.stock_total') AS site_stock,w2.active AS site_active FROM visible v JOIN websites w2 ON w2.id=v.website_id LEFT JOIN supplier_dispatch_allocations d ON d.article_id=v.id WHERE v.supplier_id=? AND v.stage IN ('with_supplier','published','delivery_failed') ORDER BY CASE WHEN v.stage='published' THEN 1 ELSE 0 END,COALESCE(v.published_at,v.supplier_sent_at,v.updated) DESC,v.id`,supplierId);const ranges=new Map<string,any[]>();for(const site of new Set(rows.filter((r:any)=>r.stock_snapshot!==null&&r.stock_slot).map((r:any)=>r.website_id))){const packs=(await all("SELECT id,data FROM records WHERE kind='stock_package' AND json_extract(data,'$.website_id')=? ORDER BY created,id",site)).map((r:any)=>JSON.parse(r.data));const w=rows.find((r:any)=>r.website_id===site);ranges.set(site as string,packageRanges(w.site_stock===null?null:Number(w.site_stock),packs));}return {articles:rows.map((r:any)=>({...r,stock_place:r.stock_snapshot!==null&&r.stock_slot?slotPlace(Number(r.stock_slot),ranges.get(r.website_id)||[]):null}))};
}
