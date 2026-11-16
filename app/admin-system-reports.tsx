'use client';
import React,{useId,useMemo,useState} from 'react';
import {CalendarRange,ChevronDown,FileText,Globe,RotateCw} from 'lucide-react';
import {useData} from '@/lib/client';
import {money,stages,type Row} from '@/lib/shared';
import {exportSpreadsheet} from '@/lib/office';
import {historyMonthLabel} from '@/lib/order-history';
import type {Ctx} from './workspace';
import {OrderExport,OrderSummary,recentMonths} from './order-list-parts';
import {OrdersAreaHead} from './orders-area-head';
import './admin-system-reports.css';

// 16.11.2026 Reports page in the approved v2 look. Same data (admin/reports), same export and
// the same four totals, article status bars, top sites and payments by month as the old ReportsView.
// Added: a 12-month revenue chart built from byMonth, this month vs last month, and the paid
// amount per site (bySite.total, already returned by the API).

const count=(n:unknown)=>new Intl.NumberFormat('he-IL').format(Number(n)||0);
const whole=(cents:number)=>new Intl.NumberFormat('he-IL',{style:'currency',currency:'ILS',maximumFractionDigits:0}).format(cents/100);
const shortMonth=(month:string)=>new Intl.DateTimeFormat('he-IL',{month:'short'}).format(new Date(month+'-15T12:00:00Z'));
// Round the chart top up to 1, 2, 2.5 or 5 times a power of ten, so the scale lines read clean.
// Values are in agorot; the top is at least ₪100 (₪1,000 when the 12 months are empty).
const niceTop=(v:number)=>{if(v<=0)return 100000;const p=10**Math.floor(Math.log10(v)),n=v/p;return Math.max(10000,(n<=1?1:n<=2?2:n<=2.5?2.5:n<=5?5:10)*p);};
// Article statuses follow the work order (as listed in `stages`), unknown ones last.
const stageOrder=Object.keys(stages),rank=(s:string)=>{const i=stageOrder.indexOf(s);return i<0?stageOrder.length:i;};

export function AdminReportsPage({ctx}:{ctx:Ctx}){
 const state=useData('admin/reports',ctx.revision),data=state.data;
 const exportReport=()=>exportSpreadsheet('postflow-reports.xlsx',[['חודש','הזמנות','תשלומים בש״ח'],...(data?.byMonth||[]).map((r:Row)=>[r.month,r.count,r.total/100])]);
 return <section className="orders-match-screen om-finance sys-reports sv2 sv2-orders sv2-fin" dir="rtl">
  <OrdersAreaHead ctx={ctx} current="admin-reports" title="דוחות וביצועים" sub="הכנסות, הזמנות וכתבות מתוך הפעילות במערכת." action={<div className="om-top-actions"><OrderExport run={exportReport} label="הורדת דוח" disabled={!data}/></div>}/>
  <div className="orders-reference-panel">
   {!data?(state.error
    ?<div className="orders-reference-error" role="alert"><p>{state.error}</p><button type="button" className="sr-retry" onClick={ctx.refresh}><RotateCw size={16} aria-hidden="true"/>ניסיון נוסף</button></div>
    :<div className="orders-reference-loading" role="status">טוען דוחות…</div>)
   :<div className={'sr-body'+(state.loading?' is-refreshing':'')} aria-busy={state.loading||undefined}>
    {state.error&&<p className="sr-stale" role="alert">לא הצלחנו לרענן. המספרים מהטעינה הקודמת.<button type="button" className="sr-retry" onClick={ctx.refresh}><RotateCw size={15} aria-hidden="true"/>ניסיון נוסף</button></p>}
    <Totals data={data}/>
    <Months rows={data.byMonth||[]}/>
    <div className="sr-split">
     <Statuses rows={data.statuses||[]}/>
     <Sites rows={data.bySite||[]} websites={Number(data.websites?.n)||0}/>
    </div>
   </div>}
  </div>
 </section>;
}

function Totals({data}:{data:Row}){
 const t=data.totals||{},pending=Number(t.pending)||0;
 return <OrderSummary items={[
  ['תקבולים מאומתים',<bdi key="r">{money(t.revenue)}</bdi>,'ok','אחרי החזרים, בלי הזמנות שבוטלו'],
  ['הזמנות',<bdi key="c">{count(t.count)}</bdi>,undefined,'כל ההזמנות במערכת'],
  ['ממתינות לתשלום',<bdi key="p">{count(pending)}</bdi>,pending?'report':undefined,pending?'נדרש אימות תקבול':'אין כרגע הזמנות שממתינות'],
  ['לקוחות רשומים',<bdi key="u">{count(data.customers?.n)}</bdi>,undefined,'חשבונות שהתחברו למערכת'],
 ]}/>;
}

function Card({icon:Icon,title,sub,className,children}:{icon:React.ElementType;title:string;sub?:React.ReactNode;className?:string;children:React.ReactNode}){
 const id=useId();
 return <section className={'sr-card'+(className?' '+className:'')} aria-labelledby={id}>
  <header className="sr-card-head"><span className="sr-ico" aria-hidden="true"><Icon size={18}/></span><div><h3 id={id}>{title}</h3>{sub&&<p>{sub}</p>}</div></header>
  {children}
 </section>;
}

function Empty({title,text}:{title:string;text:string}){return <div className="sr-empty"><b>{title}</b><p>{text}</p></div>;}

// Revenue by month: a column chart of the last 12 months, and the full month table next to it.
function Months({rows}:{rows:Row[]}){
 const [active,setActive]=useState(''),[all,setAll]=useState(false);
 const span=useMemo(()=>recentMonths(12).reverse(),[]);
 const points=useMemo(()=>{const byMonth=new Map(rows.map(r=>[String(r.month),r]));return span.map(month=>({month,total:Number(byMonth.get(month)?.total)||0,paid:Number(byMonth.get(month)?.count)||0}));},[rows,span]);
 if(!rows.length)return <Card icon={CalendarRange} title="תשלומים לפי חודש"><Empty title="עדיין אין תשלומים מאומתים" text="תשלום שיאושר יופיע כאן, בחודש שבו אושר."/></Card>;
 const top=niceTop(Math.max(0,...points.map(p=>p.total))),current=span[span.length-1];
 const shown=points.find(p=>p.month===active)||points[points.length-1],previous=points[points.length-2];
 const list=[...rows].reverse(),visible=all?list:list.slice(0,12);
 const paidText=(n:number)=>n===1?'הזמנה אחת ששולמה':n===0?'אין הזמנות ששולמו':<><bdi>{count(n)}</bdi> הזמנות ששולמו</>;
 return <div className="sr-money">
  <Card icon={CalendarRange} title="הכנסות לפי חודש" sub="12 החודשים האחרונים, תשלומים שאושרו" className="sr-trend">
   <div className="sr-readout">
    <span className="sr-readout-label">{historyMonthLabel(shown.month)}{shown.month===current&&<em>עד היום</em>}</span>
    <b className="sr-readout-value"><bdi>{money(shown.total)}</bdi></b>
    <small>{paidText(shown.paid)}{shown.month===current&&previous&&<> · בחודש הקודם <bdi>{money(previous.total)}</bdi></>}</small>
   </div>
   <div className="sr-chart" onMouseLeave={()=>setActive('')}>
    <div className="sr-scale" aria-hidden="true">{[1,.5,0].map(f=><span key={f} style={{'--y':f} as React.CSSProperties}><bdi>{whole(top*f)}</bdi></span>)}</div>
    <ol className="sr-cols" aria-label="הכנסות לפי חודש, 12 החודשים האחרונים">{points.map((p,i)=><li key={p.month} tabIndex={0}
     className={(p.month===shown.month?'is-on':'')+((points.length-1-i)%2?' is-alt':'')}
     aria-label={historyMonthLabel(p.month)+(p.month===current?' (עד היום)':'')+': '+money(p.total)+', '+(p.paid===1?'הזמנה אחת ששולמה':count(p.paid)+' הזמנות ששולמו')}
     onMouseEnter={()=>setActive(p.month)} onFocus={()=>setActive(p.month)} onClick={()=>setActive(p.month)} onBlur={()=>setActive('')}>
     <span className="sr-col-plot">{p.total>0&&<i style={{'--h':p.total/top} as React.CSSProperties}/>}</span>
     <span className="sr-col-label">{shortMonth(p.month)}</span>
    </li>)}</ol>
   </div>
  </Card>
  <Card icon={CalendarRange} title="תשלומים לפי חודש" sub={list.length===1?'חודש אחד עם תשלומים':<><bdi>{count(list.length)}</bdi> חודשים עם תשלומים, מהחדש לישן</>} className="sr-months">
   <table className="sr-table">
    <thead><tr><th scope="col">חודש</th><th scope="col">הזמנות ששולמו</th><th scope="col">סכום כולל</th></tr></thead>
    <tbody>{visible.map(r=><tr key={r.month}><th scope="row">{historyMonthLabel(String(r.month))}</th><td><bdi>{count(r.count)}</bdi></td><td className="is-money"><bdi>{money(r.total)}</bdi></td></tr>)}</tbody>
   </table>
   {list.length>12&&<button type="button" className="sr-more" aria-expanded={all} onClick={()=>setAll(!all)}>{all?'הצגת 12 החודשים האחרונים':<>הצגת כל החודשים (<bdi>{count(list.length)}</bdi>)</>}<ChevronDown size={16} aria-hidden="true"/></button>}
  </Card>
 </div>;
}

function Statuses({rows}:{rows:Row[]}){
 const sorted=[...rows].sort((a,b)=>rank(a.status)-rank(b.status)),max=Math.max(1,...rows.map(r=>Number(r.count)||0)),total=rows.reduce((s,r)=>s+(Number(r.count)||0),0);
 return <Card icon={FileText} title="מצב הכתבות" sub={rows.length?(total===1?'כתבה אחת במערכת':<><bdi>{count(total)}</bdi> כתבות במערכת</>):undefined}>
  {rows.length?<ul className="sr-bars">{sorted.map(r=><li key={r.status}>
   <div className="sr-bar-line"><span className="sr-bar-name">{stages[r.status]||r.status}</span><b><bdi>{count(r.count)}</bdi></b></div>
   <div className="sr-track" aria-hidden="true"><i style={{'--w':(Number(r.count)||0)/max} as React.CSSProperties}/></div>
  </li>)}</ul>:<Empty title="נתוני הכתבות יופיעו כאן" text="כתבה חדשה תופיע כאן לפי השלב שלה."/>}
 </Card>;
}

function Sites({rows,websites}:{rows:Row[];websites:number}){
 const max=Math.max(1,...rows.map(r=>Number(r.count)||0));
 return <Card icon={Globe} title="האתרים עם הכי הרבה הזמנות" sub={rows.length?'כתבות בהזמנות ששולמו, בלי ביטולים':undefined}>
  {rows.length?<>
   <ol className="sr-bars is-ranked">{rows.map((r,i)=>{const paid=Number(r.total)||0,n=Number(r.count)||0;return <li key={r.name+'-'+i}>
    <div className="sr-bar-line"><span className="sr-bar-name"><span className="sr-rank" aria-hidden="true">{i+1}</span><bdi title={r.name}>{r.name}</bdi></span><span className="sr-bar-meta"><b>{n===1?'כתבה אחת':<><bdi>{count(n)}</bdi> כתבות</>}</b>{paid>0&&<span className="sr-paid">שולם <bdi>{money(paid)}</bdi></span>}</span></div>
    <div className="sr-track" aria-hidden="true"><i style={{'--w':n/max} as React.CSSProperties}/></div>
   </li>;})}</ol>
   {rows.length>=15&&websites>rows.length&&<p className="sr-foot">מוצגים <bdi>{rows.length}</bdi> האתרים המובילים מתוך <bdi>{count(websites)}</bdi> אתרים במערכת.</p>}
  </>:<Empty title="האתרים המובילים יופיעו עם תחילת הפעילות" text="אתר יופיע כאן אחרי הזמנה ששולמה."/>}
 </Card>;
}
