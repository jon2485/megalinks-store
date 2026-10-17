import {all} from './server';
export async function ledgerView(userId:string){
 const rows=await all(`SELECT l.*,o.id AS order_id,o.number AS order_number,
 CASE WHEN a.id IS NOT NULL THEN json_array(json_object('name',w.name,'url',w.url,'article_id',a.id))
 WHEN o.id IS NOT NULL THEN (SELECT json_group_array(json_object('name',w2.name,'url',w2.url,'article_id',a2.id,'paid_amount',COALESCE(json_extract(a2.data,'$.paid_amount'),json_extract(a2.data,'$.unit_price'),0))) FROM articles a2 JOIN websites w2 ON w2.id=a2.website_id WHERE a2.order_id=o.id AND a2.user_id=l.user_id)
 ELSE '[]' END AS cancellation_products
 FROM ledger l LEFT JOIN articles a ON a.user_id=l.user_id AND substr(l.reference,1,15)='article-refund:' AND a.id=substr(l.reference,16,instr(substr(l.reference,16),':')-1)
 LEFT JOIN orders o ON o.user_id=l.user_id AND (o.id=a.order_id OR l.reference='refund:'||o.id OR l.reference='order:'||o.id)
 LEFT JOIN websites w ON w.id=a.website_id WHERE l.user_id=? ORDER BY l.created DESC`,userId);
 return rows.map(row=>{const cancellation=String(row.reference||'').startsWith('article-refund:')||String(row.reference||'').startsWith('refund:');return {...row,cancellation,cancelled_at:cancellation?row.created:null,products:JSON.parse(row.cancellation_products||'[]')};});
}
