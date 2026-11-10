import {all,one} from './server';
import {adminOrderCte,hydratedAdminOrder} from './admin-order-data';
import {israelDate} from './admin-order-buckets';
import {adminMonthReport} from './admin-month-server';

// Summary numbers for the top of the work center. Each number uses the same rules as the screen it links to:
// orders and money from the orders classification, articles from the article statuses.
const DAYS=14;
const reportSql=`(bucket NOT IN ('closed','archive') AND COALESCE(payment_report_status,'')='pending' AND COALESCE(payment,'') NOT IN ('card','credits_card'))`;
const awaitingSql=`(bucket='process' AND NOT ${reportSql})`;
const shift=(day:string,n:number)=>{const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};

export async function adminPulse(){
 const today=israelDate(new Date().toISOString()),month=today.slice(0,7),from=shift(today,-(DAYS+1));
 const prevMonth=shift(month+'-01',-1).slice(0,7),prevSameDay=prevMonth+'-'+String(Math.min(Number(today.slice(8)),Number(shift(month+'-01',-1).slice(8)))).padStart(2,'0');
 const cte=adminOrderCte();
 const [created,paid,awaiting,articles]=await Promise.all([
  all(`WITH ${cte} SELECT created FROM classified WHERE bucket<>'archive' AND julianday(created)>=julianday(?)`,from),
  all(`WITH ${cte} SELECT * FROM classified WHERE bucket='closed' AND julianday(confirmed_date)>=julianday(?)`,prevMonth+'-01'),
  one(`WITH ${cte} SELECT COUNT(*) AS n,COALESCE(SUM(total),0) AS cents,MIN(created) AS oldest FROM classified WHERE ${awaitingSql}`),
  one(`SELECT COALESCE(SUM(a.status IN ('writing','admin_review','review','revisions','approved','sent')),0) AS active,COALESCE(SUM(a.status='admin_review'),0) AS review FROM articles a JOIN orders o ON o.id=a.order_id WHERE COALESCE(json_extract(o.data,'$.demo'),0)=0 AND o.status<>'cancelled' AND COALESCE(json_extract(a.data,'$.cancel_pending'),0)=0`)
 ]);
 const days=Array.from({length:DAYS},(_,i)=>shift(today,i-DAYS+1));
 const ordersBy:Record<string,number>={},moneyBy:Record<string,number>={};
 for(const r of created){const d=israelDate(r.created);ordersBy[d]=(ordersBy[d]||0)+1;}
 let revenue=0,prevRevenue=0;
 for(const raw of paid){const o=hydratedAdminOrder(raw),d=israelDate(o.paid_date||''),cents=Number(o.amounts?.total||0);if(!d)continue;moneyBy[d]=(moneyBy[d]||0)+cents;
  if(d.slice(0,7)===month)revenue+=cents;else if(d.slice(0,7)===prevMonth&&d<=prevSameDay)prevRevenue+=cents;}
 // Month profit: the month-close report itself, for the whole current month, so the lobby and that screen agree.
 // net is null while a paid article still has no recorded cost. A failure here must not hide the other numbers.
 let profit:{net:number|null;income_net:number;missing:number;from:string;to:string}|null=null;
 try{const to=shift(shift(month+'-01',32).slice(0,7)+'-01',-1),report=await adminMonthReport(new URLSearchParams({from:month+'-01',to}));profit={net:report.summary.profit_net,income_net:report.summary.net,missing:report.summary.cost_missing,from:month+'-01',to};}catch{profit=null;}
 const oldest=awaiting?.oldest?Math.floor((Date.now()-+new Date(awaiting.oldest))/864e5):0;
 return {
  today,
  orders:{today:ordersBy[today]||0,yesterday:ordersBy[shift(today,-1)]||0,series:days.map(d=>ordersBy[d]||0)},
  revenue:{month:revenue,previous:prevRevenue,series:days.map(d=>moneyBy[d]||0)},
  awaiting:{count:Number(awaiting?.n||0),cents:Number(awaiting?.cents||0),oldest_days:Math.max(0,oldest)},
  articles:{active:Number(articles?.active||0),review:Number(articles?.review||0)},
  profit
 };
}
