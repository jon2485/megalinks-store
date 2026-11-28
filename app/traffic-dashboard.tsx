'use client';
import React,{useEffect,useRef,useState} from 'react';
import {Lock} from 'lucide-react';
import {useData} from '@/lib/client';
import type {Row} from '@/lib/shared';
import type {Ctx} from './workspace';
import './traffic-dashboard.css';

// "תנועה באתר" (owner 28.11.2026, mockup design/traffic-dashboard): who came, from where, which pages, for how long,
// and how many went on to the catalog, the cart and an order. The numbers are the site's own count (lib/traffic.ts).

/** Counts the page the visitor is on, and how long it stayed in view. Admins and admin screens are not counted. */
export function useTrafficBeacon(view:string,role:string|undefined,ready:boolean){
 const entry=useRef(true);
 useEffect(()=>{
  if(!ready||role==='admin'||view.startsWith('admin')||typeof window==='undefined')return;
  let id:number|null=null,shownMs=0,since=document.visibilityState==='visible'?Date.now():0,gone=false;
  const post=(body:Row)=>fetch('/api/track',{method:'POST',keepalive:true,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}).then(r=>r.ok?r.json() as Promise<Row>:null).catch(()=>null as Row|null);
  const first=entry.current;entry.current=false;
  const params=new URLSearchParams(window.location.search);
  void post({path:'/'+view,entry:first,...(first?{referrer:document.referrer,campaign:params.get('utm_source')||params.get('utm_campaign')||''}:{})}).then((r:Row|null)=>{id=r?.id||null;if(gone)send();});
  const seconds=()=>Math.round((shownMs+(since?Date.now()-since:0))/1000);
  const send=()=>{if(id&&seconds()>0)void post({id,seconds:seconds()});};
  const visible=()=>{if(document.visibilityState==='visible'){since=Date.now();}else{if(since)shownMs+=Date.now()-since;since=0;send();}};
  document.addEventListener('visibilitychange',visible);window.addEventListener('pagehide',send);
  return()=>{gone=true;document.removeEventListener('visibilitychange',visible);window.removeEventListener('pagehide',send);send();};
 },[view,role,ready]);
}

const RANGES:[number,string][]=[[1,'היום'],[7,'7 ימים'],[30,'30 יום'],[90,'90 יום']];
const SOURCE:Record<string,string>={google:'גוגל (חיפוש)',direct:'כניסה ישירה',whatsapp:'וואטסאפ',facebook:'פייסבוק ואינסטגרם',campaign:'קמפיינים',search:'מנועי חיפוש אחרים',other:'אתרים אחרים'};
const DEVICE:Record<string,string>={mobile:'טלפון',desktop:'מחשב'};
const PAGE:Record<string,string>={'/':'דף הבית','/catalog':'קטלוג האתרים','/offers':'מבצעים וחבילות','/cart':'סל הפרסום','/checkout':'סיכום הזמנה ותשלום','/pr':'כתבות יח״צ','/knowledge':'מדריכים וידע','/purchased':'האזור האישי','/bulk':'הזמנה מרוכזת','/profile':'פרטי חשבון','/support':'פניות שירות','/wallet':'יתרה'};
const num=(n:number)=>Number(n||0).toLocaleString('he-IL');
const clock=(s:number)=>Math.floor(s/60)+':'+String(Math.round(s%60)).padStart(2,'0');
const shortDay=(d:string)=>d.slice(8,10)+'.'+d.slice(5,7);
const percent=(part:number,whole:number)=>whole?Math.round(part/whole*100):0;

function Delta({now,before,lowerIsBetter=false,asClock=false,asPoints=false}:{now:number;before:number;lowerIsBetter?:boolean;asClock?:boolean;asPoints?:boolean}){
 if(!before&&!now)return <em className="tr-flat">אין נתונים</em>;
 if(!before)return <em className="tr-flat">אין תקופה קודמת להשוואה</em>;
 const diff=now-before;if(!diff)return <em className="tr-flat">בלי שינוי</em>;
 const good=lowerIsBetter?diff<0:diff>0;
 const text=asClock?clock(Math.abs(diff)):asPoints?Math.abs(diff)+' נק׳':Math.abs(Math.round(diff/before*100))+'%';
 return <em className={good?'tr-up':'tr-dn'}><span aria-hidden="true">{diff>0?'▲':'▼'}</span> {text} <span className="sr-only">{diff>0?'עלייה':'ירידה'}</span>מהתקופה הקודמת</em>;
}
function Chart({series}:{series:Row[]}){
 const W=760,H=200,top=Math.max(4,...series.map(d=>d.visitors)),max=Math.ceil(top/4)*4,n=series.length;
 const x=(i:number)=>n===1?W/2:36+i*(W-56)/(n-1),y=(v:number)=>H-26-v/max*(H-50);
 const line=series.map((d,i)=>(i?'L':'M')+x(i).toFixed(1)+' '+y(d.visitors).toFixed(1)).join(' ');
 const peak=series.reduce((b,d,i)=>d.visitors>series[b].visitors?i:b,0);
 return <svg viewBox={'0 0 '+W+' '+H} width="100%" role="img" aria-label={'מבקרים לפי יום. השיא: '+series[peak]?.visitors+' ב־'+shortDay(series[peak]?.day||'')}>
  {[0,1,2,3,4].map(k=>{const v=max/4*k;return <g key={k}><line x1={36} x2={W-20} y1={y(v)} y2={y(v)} stroke="#edf1f6"/><text x={30} y={y(v)+4} fontSize={11} fill="#6b7b91" textAnchor="end">{v}</text></g>;})}
  {n>1&&<path d={line+' L'+x(n-1)+' '+(H-26)+' L'+x(0)+' '+(H-26)+' Z'} fill="#1b6fe014"/>}
  {n>1?<path d={line} fill="none" stroke="#1b6fe0" strokeWidth={2.5} strokeLinejoin="round"/>:<circle cx={x(0)} cy={y(series[0]?.visitors||0)} r={5} fill="#1b6fe0"/>}
  {series[peak]?.visitors>0&&n>1&&<><circle cx={x(peak)} cy={y(series[peak].visitors)} r={4.5} fill="#1b6fe0"/><text x={Math.min(W-60,Math.max(70,x(peak)))} y={y(series[peak].visitors)-10} fontSize={12} fontWeight={700} fill="#09234b" textAnchor="middle">שיא: {series[peak].visitors}</text></>}
  <text x={x(0)} y={H-6} fontSize={11} fill="#6b7b91" textAnchor="start">{shortDay(series[0]?.day||'')}</text>
  {n>1&&<text x={x(n-1)} y={H-6} fontSize={11} fill="#6b7b91" textAnchor="end">{shortDay(series[n-1].day)}</text>}
 </svg>;
}
const Bars=({rows,labels}:{rows:Row[];labels:Record<string,string>})=>{const top=Math.max(1,...rows.map(r=>r.percent));return <>{rows.map(r=><div key={r.key} className="tr-bar"><span>{labels[r.key]||r.key}</span><div aria-hidden="true"><i style={{width:r.percent/top*100+'%'}}/></div><b>{r.percent}%</b></div>)}</>;};

export default function TrafficDashboard({ctx}:{ctx:Ctx}){
 const [range,setRange]=useState(30);
 const state=useData('admin/traffic?range='+range,ctx.revision,true,60000);
 const d=state.data as Row|null;
 if(state.error&&!d)return <div className="tr" dir="rtl"><p className="tr-empty">{state.error}</p></div>;
 if(!d)return <div className="tr" dir="rtl"><p className="tr-empty">טוענים…</p></div>;
 const c=d.current,p=d.previous,f=d.funnel,empty=!c.views;
 return <div className="tr" dir="rtl">
  <header className="tr-head"><div><h1>תנועה באתר</h1><p>מי נכנס, מאיפה הגיע, באילו עמודים היה וכמה זמן. בלי עוגיות ובלי פרטים אישיים.</p></div>
   <div className="tr-tools"><span className="tr-live"><i aria-hidden="true"/>{d.online===1?'מבקר אחד באתר עכשיו':num(d.online)+' מבקרים באתר עכשיו'}</span>
    <div className="tr-seg" role="group" aria-label="טווח זמן">{RANGES.map(([n,label])=><button key={n} type="button" className={range===n?'is-on':''} aria-pressed={range===n} onClick={()=>setRange(n)}>{label}</button>)}</div></div></header>
  {empty&&<p className="tr-note">{d.first_day?'אין צפיות בטווח הזה. המדידה התחילה ב־'+shortDay(d.first_day)+'.':'המדידה התחילה עכשיו. הנתונים יצטברו מהרגע הזה, ואין נתונים על העבר.'}</p>}
  <div className="tr-kpis">
   <div className="tr-kpi"><small>מבקרים</small><b>{num(c.visitors)}</b><Delta now={c.visitors} before={p.visitors}/></div>
   <div className="tr-kpi"><small>צפיות בעמודים</small><b>{num(c.views)}</b><Delta now={c.views} before={p.views}/></div>
   <div className="tr-kpi"><small>זמן ממוצע בביקור</small><b>{clock(c.avg_seconds)}</b><Delta now={c.avg_seconds} before={p.avg_seconds} asClock/></div>
   <div className="tr-kpi"><small>יצאו אחרי עמוד אחד</small><b>{c.bounce_percent}%</b><Delta now={c.bounce_percent} before={p.bounce_percent} lowerIsBetter asPoints/></div>
   <div className="tr-kpi"><small>נרשמו</small><b>{num(c.signups)}</b><Delta now={c.signups} before={p.signups}/></div>
   <div className="tr-kpi"><small>הזמינו</small><b>{num(c.orders)}</b><Delta now={c.orders} before={p.orders}/></div>
  </div>
  <div className="tr-two">
   <section className="tr-card"><h2>מבקרים לפי יום<small>{d.days===1?'היום':d.days+' הימים האחרונים'}</small></h2><Chart series={d.series}/></section>
   <section className="tr-card"><h2>מאיפה הגיעו</h2>{d.sources.length?<Bars rows={d.sources} labels={SOURCE}/>:<p className="tr-none">עוד אין נתונים</p>}
    <h2 className="tr-gap">מכשיר</h2>{d.devices.length?<Bars rows={d.devices} labels={DEVICE}/>:<p className="tr-none">עוד אין נתונים</p>}</section>
  </div>
  <section className="tr-card"><h2>מהביקור ועד ההזמנה<small>כמה ממשיכים בכל שלב</small></h2><div className="tr-fun">
   <div className="tr-step"><small>נכנסו לקטלוג</small><b>{num(f.catalog)}</b><em>{percent(f.catalog,f.visitors)}% מהמבקרים</em></div>
   <div className="tr-step"><small>פתחו את הסל</small><b>{num(f.cart)}</b><em>{percent(f.cart,f.catalog)}% ממי שהיה בקטלוג</em></div>
   <div className="tr-step"><small>הגיעו לתשלום</small><b>{num(f.checkout)}</b><em>{percent(f.checkout,f.cart)}% ממי שפתח סל</em></div>
   <div className="tr-step is-end"><small>הזמנות</small><b>{num(f.orders)}</b><em>הזמנות שנוצרו בתקופה</em></div></div></section>
  <section className="tr-card"><h2>העמודים הנצפים ביותר<small>עד 25 עמודים</small></h2>
   {d.pages.length?<div className="tr-scroll"><table className="tr-t"><thead><tr><th>עמוד</th><th>צפיות</th><th>מבקרים</th><th>זמן ממוצע בעמוד</th><th>יצאו מהאתר מכאן</th></tr></thead>
    <tbody>{d.pages.map((r:Row)=><tr key={r.path}><td><b>{PAGE[r.path]||r.path}</b>{PAGE[r.path]&&<small><bdi dir="ltr">{r.path}</bdi></small>}</td><td>{num(r.views)}</td><td>{num(r.visitors)}</td><td>{r.avg_seconds?clock(r.avg_seconds):'—'}</td><td>{r.exit_percent}%</td></tr>)}</tbody></table></div>:<p className="tr-none">עוד אין נתונים</p>}</section>
  <p className="tr-note"><Lock size={15} aria-hidden="true"/>המדידה נעשית אצלנו במערכת: בלי עוגיות, בלי כתובות IP ובלי פרטים אישיים. רואים מספרים, לא אנשים. מנהלים ומסכי הניהול לא נספרים.</p>
 </div>;
}
