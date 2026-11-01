import {all,one,stmt,parse,hash,now,assert,audit} from './server';
import type {Row} from './shared';
import {fullyCancelledOrderSql} from './order-summary';
import {adminUnionCtes} from './admin-sql';

// Source events remain read-only; manual handling is separate metadata.
export function adminUpdatesCte(){
 const allowed=`NOT ${fullyCancelledOrderSql()} AND (o.paid=1 OR COALESCE(json_extract(o.data,'$.demo'),0)=1 OR COALESCE(json_extract(o.data,'$.on_account'),0)=1 OR EXISTS(SELECT 1 FROM monthly_charges c WHERE c.order_id=o.id AND c.settled=1))`;
 const articleBase='articles a JOIN orders o ON o.id=a.order_id JOIN users u ON u.id=a.user_id LEFT JOIN websites w ON w.id=a.website_id';
 const branches=[
  `SELECT 'seller-request:'||r.id AS id,'seller' AS kind,r.id AS resource_id,'' AS number,u.name AS user_name,COALESCE(json_extract(r.proposal,'$.name'),'') AS website_name,r.kind AS detail,r.updated AS happened_at,NULL AS amount,'בקשת ספק לבדיקה' AS title,'ממתינה לאישור' AS status,'בדיקת הבקשה' AS action,'admin-seller-request/'||r.id AS page,1 AS needs_action FROM seller_requests r JOIN users u ON u.id=r.user_id WHERE r.status='pending'`,
  `SELECT 'seller-invoice:'||s.id,'seller',s.id,'',u.name,'',s.month,s.updated,s.net,'חשבונית ספק לבדיקה','ממתינה לבדיקה','בדיקת החשבונית','admin-seller-requests',1 FROM seller_statements s JOIN users u ON u.id=s.user_id WHERE s.status='invoice_review'`,
  `SELECT 'article:'||a.id AS id,'article' AS kind,a.id AS resource_id,o.number,u.name AS user_name,COALESCE(w.name,'') AS website_name,COALESCE(NULLIF(a.title,''),json_extract(a.data,'$.topic'),'כתבה ללא כותרת') AS detail,a.updated AS happened_at,NULL AS amount,'כתבה חדשה לבדיקה' AS title,'ממתינה לאישור' AS status,'בדיקת הכתבה' AS action,'admin-article/'||a.id AS page,1 AS needs_action FROM ${articleBase} WHERE ${allowed} AND a.status='admin_review' AND COALESCE(json_extract(a.data,'$.cancel_pending'),0)=0`,
  `SELECT 'publication:'||a.id,'publication',a.id,o.number,u.name,COALESCE(w.name,''),COALESCE(NULLIF(a.title,''),'כתבה ללא כותרת'),a.updated,NULL,'כתבה ממתינה לפרסום','מוכנה לשליחה','פתיחת הכתבה','admin-article/'||a.id,1 FROM ${articleBase} WHERE ${allowed} AND a.status='approved' AND COALESCE(json_extract(a.data,'$.cancel_pending'),0)=0`,
  `SELECT 'revisions:'||a.id,'revisions',a.id,o.number,u.name,COALESCE(w.name,''),COALESCE(NULLIF(a.title,''),'כתבה ללא כותרת'),a.updated,NULL,'כתבה חזרה עם הערות','נדרשים תיקונים','צפייה בכתבה ובהערות','admin-article/'||a.id,1 FROM ${articleBase} WHERE ${allowed} AND a.status='revisions' AND COALESCE(json_extract(a.data,'$.cancel_pending'),0)=0`,
  `SELECT 'report:'||r.id,'bank',r.id,o.number,u.name,'',COALESCE(json_extract(r.data,'$.reference'),''),r.updated,json_extract(r.data,'$.amount_cents'),'דיווח תשלום לבדיקה','ממתין לאישור','פתיחת ההזמנה','admin-order/'||o.id,1 FROM records r JOIN orders o ON o.id=json_extract(r.data,'$.order_id') JOIN users u ON u.id=r.user_id WHERE r.kind='customer_payment_report' AND json_extract(r.data,'$.status')='pending' AND json_extract(r.data,'$.payment_method')='bank_transfer' AND o.payment NOT IN ('card','credits_card') AND o.paid=0 AND o.status<>'cancelled'`,
  `SELECT 'bank:'||o.id,'bank',o.id,o.number,u.name,'',COALESCE(json_extract(o.data,'$.bank_reference'),''),o.created,o.total,'העברה בנקאית ממתינה לבדיקה','ממתין לאישור','פתיחת ההזמנה','admin-order/'||o.id,1 FROM orders o JOIN users u ON u.id=o.user_id WHERE o.paid=0 AND o.status IN ('pending','awaiting_approval') AND o.payment IN ('invoice','bank_transfer') AND COALESCE(json_extract(o.data,'$.demo'),0)=0 AND NOT ${fullyCancelledOrderSql()} AND NOT EXISTS(SELECT 1 FROM records r WHERE r.id='payment-report:'||o.id AND json_extract(r.data,'$.status')='pending')`,
  `SELECT 'support:'||r.id,'support',r.id,COALESCE(json_extract(r.data,'$.order_number'),''),u.name,'',COALESCE(json_extract(r.data,'$.name'),'פנייה ללא נושא'),r.updated,NULL,'פנייה דורשת טיפול','פנייה פתוחה','פתיחת הפנייה','admin-support/'||r.id,1 FROM records r JOIN users u ON u.id=r.user_id WHERE r.kind='ticket' AND COALESCE(json_extract(r.data,'$.status'),'open') NOT IN ('closed','resolved','completed','cancelled','answered') AND NOT (COALESCE(json_extract(r.data,'$.payment_method'),'')='bank_transfer' AND COALESCE(json_extract(r.data,'$.amount_cents'),0)>0)`,
  `SELECT 'paid:'||o.id,'paid',o.id,o.number,u.name,'',CASE o.payment WHEN 'credits' THEN 'תשלום מהיתרה' WHEN 'card' THEN 'תשלום באשראי' WHEN 'credits_card' THEN 'יתרה ואשראי' ELSE 'תשלום מאושר' END,COALESCE(json_extract(o.data,'$.paid_at'),o.updated),o.total,'תשלום אושר','שולם ואושר','פתיחת ההזמנה','admin-order/'||o.id,0 FROM orders o JOIN users u ON u.id=o.user_id WHERE o.paid=1 AND o.status<>'cancelled' AND COALESCE(json_extract(o.data,'$.demo'),0)=0 AND COALESCE(json_extract(o.data,'$.paid_at'),o.updated)>=datetime('now','-30 days')`,
  `SELECT 'delivery:'||j.id,'delivery',a.id,o.number,u.name,COALESCE(w.name,''),COALESCE(NULLIF(a.title,''),'כתבה ללא כותרת'),j.updated,NULL,'תקלה בשליחת כתבה','דורש בדיקה','פתיחת הכתבה','admin-article/'||a.id,1 FROM jobs j JOIN articles a ON a.id=json_extract(j.data,'$.article_id') JOIN orders o ON o.id=a.order_id JOIN users u ON u.id=a.user_id LEFT JOIN websites w ON w.id=a.website_id WHERE j.kind='supplier_publication' AND j.status IN ('failed','blocked')`,
  `SELECT 'cancellation:'||a.id,'cancellation',a.id,o.number,u.name,COALESCE(w.name,''),COALESCE(NULLIF(a.title,''),'כתבה ללא כותרת'),a.updated,NULL,'בקשת ביטול וזיכוי','ביטול בבדיקה','טיפול בביטול וזיכוי','admin-order/'||o.id,1 FROM ${articleBase} WHERE COALESCE(json_extract(a.data,'$.cancel_pending'),0)=1`,
  `SELECT 'topup:'||r.id,'topup',r.id,'',u.name,'',COALESCE(json_extract(r.data,'$.reference'),''),r.updated,json_extract(r.data,'$.amount_cents'),'בקשת הטענת יתרה','ממתינה לאישור','בדיקת הבקשה','admin-topups',1 FROM records r JOIN users u ON u.id=r.user_id WHERE (r.kind='wallet_topup' OR (r.kind='ticket' AND json_extract(r.data,'$.payment_method')='bank_transfer' AND json_extract(r.data,'$.amount_cents')>0)) AND COALESCE(json_extract(r.data,'$.decision'),'pending')='pending'`,
 ];
 const feed=adminUnionCtes('feed',branches);
 return feed;
}
const snapshotFields=['id','kind','resource_id','number','user_name','website_name','detail','happened_at','amount','title','status','action','page','needs_action'] as const;
const sameEvent=(alias='feed')=>`json_extract(h.data,'$.snapshot.id')=${alias}.id AND json_extract(h.data,'$.snapshot.happened_at')=${alias}.happened_at AND json_extract(h.data,'$.snapshot.status')=${alias}.status AND json_extract(h.data,'$.snapshot.detail')=${alias}.detail AND json_extract(h.data,'$.snapshot.amount') IS ${alias}.amount`;
const eventVersion=(row:Row)=>hash(JSON.stringify([row.id,row.happened_at,row.status,row.detail,row.amount]));
export async function handleAdminUpdate(user:Row,body:Row){
 assert(typeof body.id==='string'&&body.id.length<500&&typeof body.version==='string','התראה לא תקינה');
 const cte=adminUpdatesCte(),row=await one(`WITH ${cte} SELECT * FROM feed WHERE id=?`,body.id);
 assert(row,'ההתראה השתנתה או כבר אינה זמינה. יש לרענן',409);assert(await eventVersion(row)===body.version,'ההתראה התעדכנה. יש לרענן לפני הסימון',409);
 const id='admin-update-handled:'+body.version,stamp=now(),snapshot=Object.fromEntries(snapshotFields.map(k=>[k,row[k]]));
 const result=await stmt('INSERT OR IGNORE INTO records(id,kind,user_id,data,created,updated) VALUES (?,?,?,?,?,?)',id,'admin_update_handled',user.id,JSON.stringify({snapshot,handled_at:stamp,handled_by:user.id,version:body.version}),stamp,stamp).run();
 if(result.meta.changes)await audit(user,id,'התראה סומנה כטופלה',{event_id:row.id});
 return {ok:true,history_id:id};
}
export async function reopenAdminUpdate(user:Row,body:Row){
 const raw=await one("SELECT * FROM records WHERE id=? AND kind='admin_update_handled'",String(body.history_id||''));assert(raw,'ההתראה כבר הוחזרה לטיפול',409);
 const h=parse(raw)!,row=await one(`WITH ${adminUpdatesCte()} SELECT * FROM feed WHERE id=?`,h.snapshot.id);
 assert(row&&await eventVersion(row)===h.version,'האירוע המקורי השתנה. ההתראה נשארה בהיסטוריה',409);
 await stmt("DELETE FROM records WHERE id=? AND kind='admin_update_handled'",raw.id).run();await audit(user,raw.id,'התראה הוחזרה לטיפול',{event_id:row.id});return {ok:true};
}
const laneSql=`CASE kind WHEN 'cancellation' THEN 'urgent' WHEN 'delivery' THEN 'urgent' WHEN 'bank' THEN 'urgent' WHEN 'topup' THEN 'urgent' WHEN 'article' THEN 'content' WHEN 'publication' THEN 'content' WHEN 'revisions' THEN 'content' WHEN 'support' THEN 'service' WHEN 'seller' THEN 'service' ELSE 'info' END`;
const laneLimits={urgent:20,content:5,service:5,info:3} as const;
const withVersion=async(row:Row):Promise<Row>=>({...row,page:String(row.id).startsWith('seller-request:')?'admin-seller-request/'+encodeURIComponent(String(row.resource_id)):row.page,version:await eventVersion(row)});
// Open updates per work lane: oldest waiting first, information newest first. Counts come from the same rows as the list.
async function adminUpdateLanes(query:URLSearchParams){
 const open=`SELECT * FROM feed WHERE NOT EXISTS(SELECT 1 FROM records h WHERE h.kind='admin_update_handled' AND ${sameEvent()})`;
 const q=(query.get('q')||'').trim().slice(0,120),args=[q,'%'+q.replace(/[\\%_]/g,c=>'\\'+c)+'%'];
 const cte=`${adminUpdatesCte()},selected AS (SELECT *,${laneSql} AS lane FROM (${open}) WHERE (?='' OR (title||' '||user_name||' '||number||' '||website_name||' '||detail) LIKE ? ESCAPE '\\')),ranked AS (SELECT *,ROW_NUMBER() OVER (PARTITION BY lane ORDER BY CASE WHEN lane='info' THEN -julianday(happened_at) ELSE julianday(happened_at) END,id) AS lane_rank FROM selected)`;
 const limits=Object.fromEntries((Object.keys(laneLimits) as (keyof typeof laneLimits)[]).map(lane=>[lane,Math.max(1,Math.min(500,Math.trunc(Number(query.get('limit_'+lane)))||laneLimits[lane]))])) as Record<keyof typeof laneLimits,number>;
 const [rows,totals,handled]=await Promise.all([
  all(`WITH ${cte} SELECT * FROM ranked WHERE lane_rank<=CASE lane WHEN 'urgent' THEN ? WHEN 'content' THEN ? WHEN 'service' THEN ? ELSE ? END ORDER BY lane,lane_rank`,...args,limits.urgent,limits.content,limits.service,limits.info),
  all(`WITH ${cte} SELECT lane,COUNT(*) AS n FROM selected GROUP BY lane`,...args),
  one("SELECT COUNT(*) AS n FROM records WHERE kind='admin_update_handled'")
 ]);
 const updates=await Promise.all(rows.map(withVersion));
 const lanes=Object.fromEntries(Object.keys(laneLimits).map(lane=>[lane,{total:Number(totals.find(t=>t.lane===lane)?.n||0),rows:updates.filter(r=>r.lane===lane)}]));
 return {lanes,filters:{q},limits,counts:{handled:Number(handled?.n||0)}};
}
export async function adminUpdates(query:URLSearchParams){
 if(query.get('view')==='lanes')return adminUpdateLanes(query);
 const source=adminUpdatesCte(),state=query.get('state')||'all';assert(['open','handled','all'].includes(state),'מצב התראות לא תקין');
 const archived=`history AS (SELECT ${snapshotFields.map(k=>"json_extract(h.data,'$.snapshot."+k+"') AS "+k).join(',')},h.id AS history_id,json_extract(h.data,'$.handled_at') AS handled_at,COALESCE(u.name,'מנהל') AS handled_by_name FROM records h LEFT JOIN users u ON u.id=h.user_id WHERE h.kind='admin_update_handled')`;
 const open=`SELECT * FROM feed WHERE NOT EXISTS(SELECT 1 FROM records h WHERE h.kind='admin_update_handled' AND ${sameEvent()})`;
 const cte=state==='handled'?`${source},${archived},selected AS (SELECT * FROM history)`:source+`,selected AS (${state==='open'?open:'SELECT * FROM feed'})`;
 const filter=['action','info'].includes(query.get('filter')||'')?query.get('filter')!:'all';
 const q=(query.get('q')||'').trim().slice(0,120),requested=Math.max(1,Math.min(100000,Math.trunc(Number(query.get('page')))||1)),size=20;
 const where=`WHERE (?='all' OR needs_action=?) AND (?='' OR (title||' '||user_name||' '||number||' '||website_name||' '||detail) LIKE ? ESCAPE '\\')`;
 const args=[filter,filter==='action'?1:0,q,'%'+q.replace(/[\\%_]/g,c=>'\\'+c)+'%'];
 const total=await one(`WITH ${cte} SELECT COUNT(*) AS total FROM selected ${where}`,...args),page=Math.min(requested,Math.max(1,Math.ceil(Number(total?.total||0)/size)));
 const [rows,counts,handled]=await Promise.all([
  all(`WITH ${cte} SELECT * FROM selected ${where} ORDER BY ${state==='handled'?'handled_at':'happened_at'} DESC,id LIMIT ? OFFSET ?`,...args,size,(page-1)*size),
  one(`WITH ${source},available AS (${open}) SELECT COUNT(*) AS total,COALESCE(SUM(needs_action),0) AS action,COALESCE(SUM(CASE WHEN needs_action=0 THEN 1 ELSE 0 END),0) AS info FROM available`),
  one("SELECT COUNT(*) AS n FROM records WHERE kind='admin_update_handled'")
 ]);
 const updates=await Promise.all(rows.map(async row=>({...await withVersion(row),...(state==='handled'?{can_reopen:!!await one(`WITH ${source} SELECT 1 FROM feed WHERE id=? AND happened_at=? AND status=? AND detail=? AND amount IS ?`,row.id,row.happened_at,row.status,row.detail,row.amount)}:{})})));
 return {updates,total:Number(total?.total||0),page,page_size:size,state,filters:{q,filter},requested_page:requested,counts:{...counts,open:Number(counts?.total||0),handled:Number(handled?.n||0)}};
}
