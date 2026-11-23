'use client';
import React,{useId,useMemo,useState} from 'react';
import {ChevronDown,RotateCw} from 'lucide-react';
import {useData} from '@/lib/client';
import {money,stages,type Row} from '@/lib/shared';
import {exportSpreadsheet} from '@/lib/office';
import {historyMonthLabel} from '@/lib/order-history';
import type {Ctx} from './workspace';
import {OrderExport,recentMonths} from './order-list-parts';
import {OrdersAreaHead} from './orders-area-head';
import './supplier-v2.css';
import './admin-system-reports.css';

// 22.11.2026 (owner: "like the other admin pages"): "דוחות" in the same look as the connections, suppliers,
// orders and content lists: white sv2 cards with a plain header, tables of rows with phone labels, blue pill buttons.
// Same data (admin/reports), the same export and every block as before: the four totals, the 12-month chart,
// payments by month (with "show all"), article status bars and the top sites with the paid amount.
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
// Table columns (desktop); on phones supplier-v2.css turns every row into a card.
const monthCols={gridTemplateColumns:'minmax(0,1fr) 92px 124px'};
const stageCols={gridTemplateColumns:'minmax(0,1.3fr) 80px minmax(0,1fr)'};
const siteCols={gridTemplateColumns:'minmax(0,1.5fr) 92px 118px minmax(0,1fr)'};

export function AdminReportsPage({ctx}:{ctx:Ctx}){
 const state=useData('admin/reports',ctx.revision),data=state.data;
 const exportReport=()=>exportSpreadsheet('megalinks-reports.xlsx',[['חודש','הזמנות','תשלומים בש״ח'],...(data?.byMonth||[]).map((r:Row)=>[r.month,r.count,r.total/100])]);
 return <section className="orders-match-screen om-finance sys-reports sv2 sv2-orders sv2-fin" dir="rtl">
  <OrdersAreaHead ctx={ctx} current="admin-reports" title="דוחות וביצועים" sub="הכנסות, הזמנות וכתבות מתוך הפעילות במערכת." action={<div className="om-top-actions"><OrderExport run={exportReport} label="הורדת דוח" disabled={!data}/></div>}/>
  {!data?(state.error
   ?<div className="orders-reference-error" role="alert"><p>{state.error}</p><button type="button" className="sv2-btn tint srx-retry" onClick={ctx.refresh}><RotateCw size={16} aria-hidden="true"/>ניסיון נוסף</button></div>
   :<div className="orders-reference-loading" role="status">טוען דוחות…</div>)
  :<div className={'srx-body'+(state.loading?' is-refreshing':'')} aria-busy={state.loading||undefined}>
   {state.error&&<p className="srx-stale" role="alert"><span>לא הצלחנו לרענן. המספרים מהטעינה הקודמת.</span><button type="button" className="sv2-btn quiet sm" onClick={ctx.refresh}><RotateCw size={15} aria-hidden="true"/>ניסיון נוסף</button></p>}
   <Totals data={data}/>
   <Months rows={data.byMonth||[]}/>
   <div className="srx-split">
    <Statuses rows={data.statuses||[]}/>
    <Sites rows={data.bySite||[]} websites={Number(data.websites?.n)||0}/>
   </div>
  </div>}
 </section>;
}

// The four totals: same figures and notes as before, as white summary cards.
function Totals({data}:{data:Row}){
 const t=data.totals||{},pending=Number(t.pending)||0;
 const items:[string,React.ReactNode,string,React.ReactNode][]=[
  ['תקבולים מאומתים',<bdi key="r">{money(t.revenue)}</bdi>,'is-ok is-money','אחרי החזרים, בלי הזמנות שבוטלו'],
  ['הזמנות',<bdi key="c">{count(t.count)}</bdi>,'','כל ההזמנות במערכת'],
  ['ממתינות לתשלום',<bdi key="p">{count(pending)}</bdi>,pending?'is-report':'',pending?'נדרש אימות תקבול':'אין כרגע הזמנות שממתינות'],
  ['לקוחות רשומים',<bdi key="u">{count(data.customers?.n)}</bdi>,'is-last','חשבונות שהתחברו למערכת'],
 ];
 return <dl className="sv2-sum is-4 srx-totals">{items.map(([label,value,tone,note])=><div key={label} className={'sv2-card sv2-pad srx-total'+(tone?' '+tone:'')}>
  <dt className="lbl">{label}</dt><dd className="big">{value}</dd><dd className="hint">{note}</dd>
 </div>)}</dl>;
}

// A white card with a plain header (title and a short line), like the reference lists.
function Card({title,sub,className,children}:{title:string;sub?:React.ReactNode;className?:string;children:React.ReactNode}){
 const id=useId();
 return <section className={'sv2-card srx-card'+(className?' '+className:'')} aria-labelledby={id}>
  <div className="sv2-tools srx-head"><div><h3 id={id}>{title}</h3>{sub&&<p>{sub}</p>}</div></div>
  {children}
 </section>;
}

function Empty({title,text}:{title:string;text:string}){return <div className="sv2-empty"><h3>{title}</h3><p>{text}</p></div>;}

// Revenue by month: a column chart of the last 12 months, and the full month table next to it.
function Months({rows}:{rows:Row[]}){
 const [active,setActive]=useState(''),[all,setAll]=useState(false);
 const span=useMemo(()=>recentMonths(12).reverse(),[]);
 const points=useMemo(()=>{const byMonth=new Map(rows.map(r=>[String(r.month),r]));return span.map(month=>({month,total:Number(byMonth.get(month)?.total)||0,paid:Number(byMonth.get(month)?.count)||0}));},[rows,span]);
 if(!rows.length)return <Card title="תשלומים לפי חודש"><Empty title="עדיין אין תשלומים מאומתים" text="תשלום שיאושר יופיע כאן, בחודש שבו אושר."/></Card>;
 const top=niceTop(Math.max(0,...points.map(p=>p.total))),current=span[span.length-1];
 const shown=points.find(p=>p.month===active)||points[points.length-1],previous=points[points.length-2];
 const list=[...rows].reverse(),visible=all?list:list.slice(0,12);
 const paidText=(n:number)=>n===1?'הזמנה אחת ששולמה':n===0?'אין הזמנות ששולמו':<><bdi>{count(n)}</bdi> הזמנות ששולמו</>;
 return <div className="srx-money">
  <Card title="הכנסות לפי חודש" sub="12 החודשים האחרונים, תשלומים שאושרו" className="srx-trend">
   <div className="srx-pad">
    <div className="srx-readout">
     <span className="srx-readout-label">{historyMonthLabel(shown.month)}{shown.month===current&&<em className="sv2-pill p-man">עד היום</em>}</span>
     <b className="srx-readout-value"><bdi>{money(shown.total)}</bdi></b>
     <small>{paidText(shown.paid)}{shown.month===current&&previous&&<> · בחודש הקודם <bdi className="srx-nowrap">{money(previous.total)}</bdi></>}</small>
    </div>
    <div className="srx-chart" onMouseLeave={()=>setActive('')}>
     <div className="srx-scale" aria-hidden="true">{[1,.5,0].map(f=><span key={f} style={{'--y':f} as React.CSSProperties}><bdi>{whole(top*f)}</bdi></span>)}</div>
     <ol className="srx-cols" aria-label="הכנסות לפי חודש, 12 החודשים האחרונים">{points.map((p,i)=><li key={p.month} tabIndex={0}
      className={(p.month===shown.month?'is-on':'')+((points.length-1-i)%2?' is-alt':'')}
      aria-label={historyMonthLabel(p.month)+(p.month===current?' (עד היום)':'')+': '+money(p.total)+', '+(p.paid===1?'הזמנה אחת ששולמה':count(p.paid)+' הזמנות ששולמו')}
      onMouseEnter={()=>setActive(p.month)} onFocus={()=>setActive(p.month)} onClick={()=>setActive(p.month)} onBlur={()=>setActive('')}>
      <span className="srx-col-plot">{p.total>0&&<i style={{'--h':p.total/top} as React.CSSProperties}/>}</span>
      <span className="srx-col-label">{shortMonth(p.month)}</span>
     </li>)}</ol>
    </div>
   </div>
  </Card>
  <Card title="תשלומים לפי חודש" sub={list.length===1?'חודש אחד עם תשלומים':<><bdi>{count(list.length)}</bdi> חודשים עם תשלומים, מהחדש לישן</>} className="srx-months">
   <div role="table" aria-label="תשלומים לפי חודש">
    <div className="sv2-th" style={monthCols} role="row"><span role="columnheader">חודש</span><span role="columnheader">הזמנות ששולמו</span><span role="columnheader">סכום כולל</span></div>
    {visible.map(r=><div key={r.month} className="sv2-tr compact srx-month" style={monthCols} role="row">
     <b className="srx-name" role="rowheader">{historyMonthLabel(String(r.month))}</b>
     <span role="cell"><small className="sv2-ml">הזמנות ששולמו</small><span className="sv2-num"><bdi>{count(r.count)}</bdi></span></span>
     <span role="cell"><small className="sv2-ml">סכום כולל</small><span className="sv2-num srx-money-val"><bdi>{money(r.total)}</bdi></span></span>
    </div>)}
   </div>
   {list.length>12&&<div className="sv2-foot srx-morebar"><button type="button" className="sv2-btn tint sm srx-more" aria-expanded={all} onClick={()=>setAll(!all)}>{all?'הצגת 12 החודשים האחרונים':<>הצגת כל החודשים (<bdi>{count(list.length)}</bdi>)</>}<ChevronDown size={15} aria-hidden="true"/></button></div>}
  </Card>
 </div>;
}

function Statuses({rows}:{rows:Row[]}){
 const sorted=[...rows].sort((a,b)=>rank(a.status)-rank(b.status)),max=Math.max(1,...rows.map(r=>Number(r.count)||0)),total=rows.reduce((s,r)=>s+(Number(r.count)||0),0);
 return <Card title="מצב הכתבות" sub={rows.length?(total===1?'כתבה אחת במערכת':<><bdi>{count(total)}</bdi> כתבות במערכת</>):undefined}>
  {rows.length?<div role="table" aria-label="מצב הכתבות">
   <div className="sv2-th" style={stageCols} role="row"><span role="columnheader">שלב</span><span role="columnheader">כתבות</span><span aria-hidden="true"/></div>
   {sorted.map(r=><div key={r.status} className="sv2-tr compact srx-stage" style={stageCols} role="row">
    <b className="srx-name" role="rowheader">{stages[r.status]||r.status}</b>
    <span role="cell"><small className="sv2-ml">כתבות</small><span className="sv2-num"><bdi>{count(r.count)}</bdi></span></span>
    <span className="srx-track" aria-hidden="true"><i style={{'--w':(Number(r.count)||0)/max} as React.CSSProperties}/></span>
   </div>)}
  </div>:<Empty title="נתוני הכתבות יופיעו כאן" text="כתבה חדשה תופיע כאן לפי השלב שלה."/>}
 </Card>;
}

function Sites({rows,websites}:{rows:Row[];websites:number}){
 const max=Math.max(1,...rows.map(r=>Number(r.count)||0));
 return <Card title="האתרים עם הכי הרבה הזמנות" sub={rows.length?'כתבות בהזמנות ששולמו, בלי ביטולים':undefined}>
  {rows.length?<>
   <div role="table" aria-label="האתרים עם הכי הרבה הזמנות">
    <div className="sv2-th" style={siteCols} role="row"><span role="columnheader">אתר</span><span role="columnheader">כתבות</span><span role="columnheader">שולם</span><span aria-hidden="true"/></div>
    {rows.map((r,i)=>{const paid=Number(r.total)||0,n=Number(r.count)||0;return <div key={r.name+'-'+i} className="sv2-tr compact srx-site" style={siteCols} role="row">
     <div className="sv2-who" role="rowheader"><span className="sv2-thumb srx-rank" aria-hidden="true">{i+1}</span><span><b><bdi title={r.name}>{r.name}</bdi></b></span></div>
     <span role="cell"><small className="sv2-ml">כתבות</small><span className="sv2-num">{n===1?'כתבה אחת':<><bdi>{count(n)}</bdi> כתבות</>}</span></span>
     <span role="cell"><small className="sv2-ml">שולם</small>{paid>0?<span className="sv2-num srx-money-val"><bdi>{money(paid)}</bdi></span>:<span className="srx-none">—</span>}</span>
     <span className="srx-track" aria-hidden="true"><i style={{'--w':n/max} as React.CSSProperties}/></span>
    </div>;})}
   </div>
   {rows.length>=15&&websites>rows.length&&<div className="sv2-foot"><span>מוצגים <bdi>{rows.length}</bdi> האתרים המובילים מתוך <bdi>{count(websites)}</bdi> אתרים במערכת.</span></div>}
  </>:<Empty title="האתרים המובילים יופיעו עם תחילת הפעילות" text="אתר יופיע כאן אחרי הזמנה ששולמה."/>}
 </Card>;
}
