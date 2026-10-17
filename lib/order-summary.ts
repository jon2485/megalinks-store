import {paymentDateSql} from './payment-evidence';
export function fullyCancelledOrderSql(alias='o'){return `(${alias}.status='cancelled' OR (EXISTS(SELECT 1 FROM articles a WHERE a.order_id=${alias}.id) AND NOT EXISTS(SELECT 1 FROM articles a WHERE a.order_id=${alias}.id AND NOT (COALESCE(json_extract(a.data,'$.publication_refunded'),0)=1 AND (COALESCE(json_extract(a.data,'$.editorial_price'),0)=0 OR COALESCE(json_extract(a.data,'$.writing_refunded'),0)=1)))))`;}
// Derive cancellation from the actual components. This also covers earlier
// refunds without rewriting historical orders or changing monthly grouping.
export function orderSummarySql(alias='o'){
 return `${paymentDateSql(alias)},(SELECT c.month FROM monthly_charges c WHERE c.order_id=${alias}.id) AS billing_month,
 EXISTS(SELECT 1 FROM monthly_charges c JOIN records r ON r.id='monthly:'||c.month||':'||c.user_id||':'||c.demo WHERE c.order_id=${alias}.id) AS monthly_closed,
 (SELECT r.created FROM monthly_charges c JOIN records r ON r.id='monthly:'||c.month||':'||c.user_id||':'||c.demo WHERE c.order_id=${alias}.id) AS monthly_closed_at,
 (SELECT json_group_array(json_object('id',a.id,'name',COALESCE(w.name,json_extract(a.data,'$.website_name'),'אתר שנרכש'),'url',COALESCE(w.url,json_extract(a.data,'$.website_url'),''))) FROM articles a LEFT JOIN websites w ON w.id=a.website_id WHERE a.order_id=${alias}.id) AS item_preview,
 (SELECT GROUP_CONCAT(w.name||' '||w.url||' '||COALESCE(a.title,''),' ') FROM articles a JOIN websites w ON w.id=a.website_id WHERE a.order_id=${alias}.id) AS site_search,
 (SELECT COUNT(*) FROM articles a WHERE a.order_id=${alias}.id) AS article_count,
 (SELECT COUNT(*) FROM articles a WHERE a.order_id=${alias}.id AND COALESCE(json_extract(a.data,'$.publication_refunded'),0)=1 AND (COALESCE(json_extract(a.data,'$.editorial_price'),0)=0 OR COALESCE(json_extract(a.data,'$.writing_refunded'),0)=1)) AS fully_refunded_count,
 (SELECT COUNT(*) FROM articles a WHERE a.order_id=${alias}.id AND (COALESCE(json_extract(a.data,'$.publication_refunded'),0)=1 OR COALESCE(json_extract(a.data,'$.writing_refunded'),0)=1)) AS refunded_count,
 (SELECT COUNT(*) FROM articles a WHERE a.order_id=${alias}.id AND COALESCE(json_extract(a.data,'$.cancel_pending'),0)=1) AS cancel_pending_count`;
}
