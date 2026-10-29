import {all,one} from './server';
// A content-only projection. Financial fields and article bodies stay out of lists.
const contentSource=`WITH history AS (
 SELECT resource,
 MIN(CASE WHEN action='סטטוס: admin_review' THEN created END) AS submitted,
 MIN(CASE WHEN action IN ('הכתבה הועברה אוטומטית לפורטל הספק','הכתבה הועברה לתור הדגמה של הספק','נוצר קישור ספק') THEN created END) AS sent
 FROM activity GROUP BY resource
), content AS (
 SELECT a.id,a.order_id,a.user_id,a.website_id,a.title,a.status,a.published_url,a.updated,
 o.number,u.name AS user_name,w.url AS website_url,
 COALESCE(json_extract(a.data,'$.supplier_name'),json_extract(j.data,'$.supplier_name'),'') AS supplier_name,
 COALESCE(json_extract(a.data,'$.first_submitted_at'),json_extract(a.data,'$.submitted_at'),json_extract(a.data,'$.writing_first_requested_at'),json_extract(a.data,'$.writing_requested_at'),json_extract(a.data,'$.scheduled_submitted_at'),h.submitted) AS submitted_at,
 COALESCE(json_extract(a.data,'$.review_requested_at'),h.submitted,json_extract(a.data,'$.submitted_at')) AS review_requested_at,
 COALESCE(json_extract(a.data,'$.supplier_sent_at'),d.created,h.sent) AS supplier_sent_at,
 COALESCE(json_extract(a.data,'$.cancel_pending'),0) AS cancel_pending,
 COALESCE(json_extract(a.data,'$.publication_refunded'),0) AS refunded,
 j.status AS delivery_status,
 CASE WHEN o.status<>'cancelled' AND (o.paid=1 OR json_extract(o.data,'$.demo')=1 OR json_extract(o.data,'$.on_account')=1 OR json_extract(o.data,'$.payment_settled')=1) THEN 1 ELSE 0 END AS workable
 FROM articles a JOIN orders o ON o.id=a.order_id JOIN users u ON u.id=a.user_id JOIN websites w ON w.id=a.website_id
 LEFT JOIN history h ON h.resource=a.id
 LEFT JOIN jobs j ON j.id='publication:'||a.id AND j.kind='supplier_publication'
 LEFT JOIN supplier_dispatch_allocations d ON d.article_id=a.id
), visible AS (SELECT * FROM content WHERE submitted_at IS NOT NULL OR status IN ('admin_review','approved','sent','published','revisions','demo_completed'))`;

export async function adminContent(query:URLSearchParams,exported=false){
 const view=['approvals','publication'].includes(query.get('view')||'')?query.get('view')!:'articles';
 const status=query.get('status')||'all',q=(query.get('q')||'').trim().slice(0,200),requested=Math.max(1,Math.floor(Number(query.get('page'))||1));
 const where=["(?='' OR instr(lower(title||' '||user_name||' '||website_url||' '||number),lower(?))>0)"],args:unknown[]=[q,q];
 if(view==='approvals')where.push("status='admin_review' AND workable=1 AND refunded=0 AND cancel_pending=0");
 if(view==='publication')where.push("status='sent' AND COALESCE(published_url,'')='' AND refunded=0 AND (delivery_status IN ('succeeded','demo') OR delivery_status IS NULL)");
 if(['draft','writing','review','admin_review','approved','sent','published','revisions','scheduled','cancelled','demo_completed'].includes(status)){where.push('status=?');args.push(status);}
 const filter=where.join(' AND '),total=Number((await one(contentSource+' SELECT COUNT(*) AS n FROM visible WHERE '+filter,...args))?.n||0),size=20,page=Math.min(requested,Math.max(1,Math.ceil(total/size)));
 const order=view==='publication'?"CASE WHEN supplier_sent_at IS NULL THEN 0 ELSE 1 END,supplier_sent_at ASC,id ASC":"COALESCE(submitted_at,updated) DESC,id";
 const articles=await all(contentSource+' SELECT * FROM visible WHERE '+filter+' ORDER BY '+order+(exported?'':' LIMIT ? OFFSET ?'),...args,...(exported?[]:[size,(page-1)*size]));
 return {articles,total,page,size,request_key:query.toString()};
}
