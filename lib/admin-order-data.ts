import {all,one,parse,assert} from './server';
import {orderSummarySql,fullyCancelledOrderSql} from './order-summary';
import {dateRangeClause} from './admin-date-range';
import {israelDate,adminOrderFilterLabels,type AdminOrderFilterBucket} from './admin-order-buckets';
import {effectiveOrderAmounts} from './order-finance';
import {paymentMethodLabel} from './payment-state';
import type {Row} from './shared';

export function adminOrderCte(){return `overview AS (SELECT o.*,${orderSummarySql()},u.name AS user_name,u.email AS user_email,COALESCE(NULLIF(json_extract(o.data,'$.phone'),''),u.phone,'') AS user_phone,(SELECT settled FROM monthly_charges WHERE order_id=o.id) AS payment_settled,${fullyCancelledOrderSql()} AS fully_cancelled,(SELECT COUNT(*) FROM articles a WHERE a.order_id=o.id AND COALESCE(json_extract(a.data,'$.cancel_pending'),0)=1) AS cancel_pending_count,(SELECT data FROM records WHERE id='payment-report:'||o.id AND user_id=o.user_id AND kind='customer_payment_report') AS report_json FROM orders o JOIN users u ON u.id=o.user_id),
 classified AS (SELECT *,CASE WHEN COALESCE(json_extract(data,'$.demo'),0)=1 OR fully_cancelled THEN 'archive' WHEN paid=1 OR COALESCE(payment_settled,0)=1 THEN 'closed' WHEN payment='monthly' OR COALESCE(json_extract(data,'$.on_account'),0)=1 OR billing_month IS NOT NULL THEN 'monthly' ELSE 'process' END AS bucket,COALESCE(NULLIF(paid_date,''),NULLIF(json_extract(data,'$.paid_at'),''),CASE WHEN payment_settled=1 THEN (SELECT r.created FROM records r WHERE r.kind='monthly_payment' AND r.user_id=overview.user_id AND EXISTS(SELECT 1 FROM json_each(r.data,'$.order_ids') j WHERE j.value=overview.id) ORDER BY r.created DESC LIMIT 1) END) AS confirmed_date,CASE WHEN payment_settled=1 THEN (SELECT json_extract(r.data,'$.payment_method') FROM records r WHERE r.kind='monthly_payment' AND r.user_id=overview.user_id AND EXISTS(SELECT 1 FROM json_each(r.data,'$.order_ids') j WHERE j.value=overview.id) ORDER BY r.created DESC LIMIT 1) END AS settled_receipt_method FROM overview)`;}
export function hydratedAdminOrder(raw:Row):Row{const o=parse(raw)!;delete o.report_json;let report;try{report=raw.report_json?JSON.parse(raw.report_json):null;}catch{report=null;}return {...o,paid_date:o.confirmed_date||o.paid_date,payment_report:report,amounts:effectiveOrderAmounts(o),payment_label:paymentMethodLabel({payment:o.confirmed_payment_method||o.settlement_payment_method||o.settled_receipt_method||o.payment})||'לא תועד'};}
export function orderFilter(query:URLSearchParams){
 const bucket=query.get('bucket')||'monthly';assert(Object.hasOwn(adminOrderFilterLabels,bucket),'סוג הזמנות לא תקין');
 const month=query.get('month')||'',q=(query.get('q')||'').trim().slice(0,120);assert(!month||month==='unknown'||/^\d{4}-(0[1-9]|1[0-2])$/.test(month),'חודש לא תקין');
 const field=bucket==='closed'?'confirmed_date':bucket==='all'?"CASE WHEN COALESCE(json_extract(data,'$.demo'),0)=0 AND (paid=1 OR payment_settled=1) THEN confirmed_date ELSE created END":'created',clauses=bucket==='all'?[]:['bucket=?'],args:(string|number)[]=bucket==='all'?[]:[bucket];
 if(month==='unknown')clauses.push(`(${field} IS NULL OR ${field}='')`);
 else if(month){const to=new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5)),0,12)).toISOString().slice(0,10);const range=dateRangeClause(field,month+'-01',to);clauses.push(range.sql);args.push(...range.args);}
 if(q){clauses.push("(number||' '||COALESCE(user_name,'')||' '||COALESCE(user_email,'')||' '||COALESCE(site_search,'')) LIKE ? ESCAPE '\\'");args.push('%'+q.replace(/[\\%_]/g,x=>'\\'+x)+'%');}
 return {bucket:bucket as AdminOrderFilterBucket,month,q,where:clauses.length?'WHERE '+clauses.join(' AND '):'',args,field};
}
export async function adminOrders(query:URLSearchParams,exporting=false){
 const f=orderFilter(query),cte=adminOrderCte(),requested=Math.max(1,Math.min(100000,Math.trunc(Number(query.get('page')))||1)),size=20;
 const total=Number((await one(`WITH ${cte} SELECT COUNT(*) AS n FROM classified ${f.where}`,...f.args))?.n||0),page=Math.min(requested,Math.max(1,Math.ceil(total/size)));
 const records=await all(`WITH ${cte} SELECT * FROM classified ${f.where} ORDER BY ${f.field} DESC,created DESC,id ${exporting?'':'LIMIT ? OFFSET ?'}`,...f.args,...(exporting?[]:[size,(page-1)*size]));
 const dates=exporting?[]:await all(`WITH ${cte} SELECT DISTINCT ${f.field} AS date FROM classified ${f.bucket==='all'?'':'WHERE bucket=?'}`, ...(f.bucket==='all'?[]:[f.bucket]));
 const months=[...new Set(dates.map(d=>israelDate(d.date).slice(0,7)||'unknown'))].sort().reverse();
 const counts=exporting?{}:Object.fromEntries((await all(`WITH ${cte} SELECT bucket,COUNT(*) AS n FROM classified GROUP BY bucket`)).map(r=>[r.bucket,Number(r.n)]));
 return {orders:records.map(hydratedAdminOrder),total,page,page_size:size,months,counts,filters:{bucket:f.bucket,month:f.month,q:f.q},requested_page:requested,exporting};
}
