import {all,one,parse,assert} from './server';
import {adminOrderCte,hydratedAdminOrder} from './admin-order-data';
import {dateRangeClause,validReportDay} from './admin-date-range';
import {buildMonthReport} from './admin-month-report';
export async function adminMonthReport(query:URLSearchParams){
 const from=query.get('from')||'',to=query.get('to')||'',basis:string='payment';
 assert(validReportDay(from)&&validReportDay(to)&&from<=to,'יש לבחור טווח תאריכים תקין');assert(['payment','order'].includes(basis),'בסיס תאריך לא תקין');
 const cte=adminOrderCte(),range=dateRangeClause(basis==='order'?'created':'confirmed_date',from,to);
 const selection=`SELECT * FROM classified WHERE COALESCE(json_extract(data,'$.demo'),0)=0 ${basis==='payment'?"AND (paid=1 OR payment_settled=1)":''} AND ${range.sql}`;
 const orders=(await all(`WITH ${cte} ${selection} ORDER BY created DESC,id`,...range.args)).map(hydratedAdminOrder);
 const articles=(await all(`WITH ${cte}, selected AS (${selection}) SELECT a.* FROM articles a JOIN selected o ON a.order_id=o.id`,...range.args)).map(a=>parse(a)!);
 const missingDate=basis==='payment'?Number((await one(`WITH ${cte} SELECT COUNT(*) AS n FROM classified WHERE COALESCE(json_extract(data,'$.demo'),0)=0 AND (paid=1 OR payment_settled=1) AND (confirmed_date IS NULL OR confirmed_date='')`))?.n||0):0;
 return {...buildMonthReport(orders,articles),from,to,basis,missing_payment_dates:missingDate};
}
