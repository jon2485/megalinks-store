// "תנועה באתר" (owner 28.11.2026, mockup design/traffic-dashboard): the site's own traffic count for the admin.
// Privacy: no cookie and nothing personal is stored. A visitor is a one-way hash of the address, the browser, the day
// and a secret kept in the settings; the address itself is never written, and the hash changes every day, so nobody
// can be followed from one day to the next. Admin screens and admins themselves are not counted (the page decides).
import type {Row} from './shared';
import {all,one,stmt,assert,admin,hash,setting,saveSetting} from './server';

const DAY=86400000,MAX_SECONDS=1800,KEEP_DAYS=400;
const dayOf=(ms:number)=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jerusalem',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(ms));
let saltOnce:Promise<string>|null=null,cleaned='';
const salt=()=>saltOnce||=(async()=>{let s=String(await setting('traffic_salt','')||'');if(!s){s=crypto.randomUUID()+crypto.randomUUID();await saveSetting('traffic_salt',s);}return s;})();

/** The page as counted: no query, no trailing slash, and record ids folded into "*" so pages of one kind count together. */
export function trafficPath(value:unknown){
 let p=String(value||'/').split(/[?#]/)[0].trim().toLowerCase();
 if(!p.startsWith('/'))p='/'+p;
 p=p.replace(/\/{2,}/g,'/').replace(/\/$/,'')||'/';
 p=p.split('/').map(part=>/^[0-9a-f]{8}-[0-9a-f-]{27}$/.test(part)||/^[0-9a-f]{20,}$/.test(part)||/^\d{3,}$/.test(part)?'*':part).join('/');
 return p.slice(0,120);
}
/** Where an entry came from, by the referring address and the campaign tag. */
export function trafficSource(referrer:unknown,campaign:unknown,ownHost:string){
 if(String(campaign||'').trim())return 'campaign';
 let host='';try{host=new URL(String(referrer||'')).hostname.toLowerCase().replace(/^www\./,'');}catch{return 'direct';}
 if(!host)return 'direct';
 // A page reloaded or opened from inside the site is not a new arrival.
 if(host===ownHost.replace(/^www\./,''))return '';
 if(/(^|\.)google\./.test(host))return 'google';
 if(/(^|\.)(facebook|instagram|fb)\.(com|me)$/.test(host))return 'facebook';
 if(/whatsapp|(^|\.)wa\.me$/.test(host))return 'whatsapp';
 if(/(^|\.)(bing|yahoo|duckduckgo|yandex)\./.test(host))return 'search';
 return 'other';
}
const BOT=/bot|crawl|spider|slurp|headless|lighthouse|preview|monitor|curl|wget|python|scrapy/i;

/** One page view (`path`), or the time spent on a view counted earlier (`id` + `seconds`). */
export async function trackView(r:Request,b:Row){
 const agent=r.headers.get('user-agent')||'';
 if(!agent||BOT.test(agent))return {ok:true};
 const now=Date.now(),day=dayOf(now);
 // On Railway the gateway passes the visitor's address in its own header (the app itself sits on loopback).
 const address=(r.headers.get('x-megalinks-visitor-ip')||r.headers.get('cf-connecting-ip')||(r.headers.get('x-forwarded-for')||'').split(',')[0]||'').trim();
 const visitor=(await hash([await salt(),day,address,agent].join('|'))).slice(0,24);
 if(b.id!==undefined){
  const id=Math.floor(Number(b.id)),seconds=Math.max(0,Math.min(MAX_SECONDS,Math.round(Number(b.seconds)||0)));
  // Only the visitor who made the view can add its time, and only on the day it was made.
  if(Number.isSafeInteger(id)&&id>0&&seconds>0)await stmt('UPDATE page_views SET seconds=MAX(seconds,?) WHERE id=? AND visitor=? AND day=?',seconds,id,visitor,day).run();
  return {ok:true};
 }
 const path=trafficPath(b.path);
 if(/^\/(admin|api|__)/.test(path))return {ok:true};
 const source=b.entry===true?trafficSource(b.referrer,b.campaign,new URL(r.url).hostname):'';
 const device=/mobi|android|iphone|ipad/i.test(agent)?'mobile':'desktop';
 const row=await one('INSERT INTO page_views(day,ts,visitor,path,source,device) VALUES (?,?,?,?,?,?) RETURNING id',day,now,visitor,path,source,device);
 // Old rows go once a day, with the first view of the day.
 if(cleaned!==day){cleaned=day;await stmt('DELETE FROM page_views WHERE day<?',dayOf(now-KEEP_DAYS*DAY)).run().catch(()=>{});}
 return {ok:true,id:row?.id||null};
}

async function totals(from:string,to:string,fromMs:number,toMs:number){
 const [views,bounce,people,orders]=await Promise.all([
  one("SELECT COUNT(*) AS views,COUNT(DISTINCT visitor||day) AS visitors,COALESCE(SUM(seconds),0) AS seconds FROM page_views WHERE day>=? AND day<=?",from,to),
  one("SELECT COUNT(*) AS n FROM (SELECT 1 FROM page_views WHERE day>=? AND day<=? GROUP BY visitor,day HAVING COUNT(*)=1)",from,to),
  one("SELECT COUNT(*) AS n FROM users WHERE role<>'admin' AND created>=? AND created<?",new Date(fromMs).toISOString(),new Date(toMs).toISOString()),
  one("SELECT COUNT(*) AS n FROM orders WHERE status<>'cancelled' AND COALESCE(json_extract(data,'$.demo'),0)<>1 AND created>=? AND created<?",new Date(fromMs).toISOString(),new Date(toMs).toISOString())]);
 const visitors=Number(views?.visitors||0);
 return {visitors,views:Number(views?.views||0),avg_seconds:visitors?Math.round(Number(views?.seconds||0)/visitors):0,bounce_percent:visitors?Math.round(Number(bounce?.n||0)/visitors*100):0,signups:Number(people?.n||0),orders:Number(orders?.n||0)};
}
/** Midnight in Israel that starts the given day (YYYY-MM-DD), as a UTC time. */
export function dayStart(day:string){
 const guess=Date.parse(day+'T00:00:00Z');
 for(const shift of [-2,-3])if(dayOf(guess+shift*3600000)===day&&dayOf(guess+shift*3600000-1)!==day)return guess+shift*3600000;
 return guess-2*3600000;
}
export async function trafficReport(range:number){
 const days=[1,7,30,90].includes(range)?range:30,now=Date.now();
 const to=dayOf(now),from=dayOf(now-(days-1)*DAY),prevTo=dayOf(now-days*DAY),prevFrom=dayOf(now-(2*days-1)*DAY);
 const startMs=dayStart(from),prevStartMs=dayStart(prevFrom);
 const [current,previous,byDay,pages,exits,sources,devices,funnel,online,first]=await Promise.all([
  totals(from,to,startMs,now+1),totals(prevFrom,prevTo,prevStartMs,startMs),
  all("SELECT day,COUNT(DISTINCT visitor) AS visitors,COUNT(*) AS views FROM page_views WHERE day>=? AND day<=? GROUP BY day ORDER BY day",from,to),
  all("SELECT path,COUNT(*) AS views,COUNT(DISTINCT visitor||day) AS visitors,COALESCE(ROUND(AVG(CASE WHEN seconds>0 THEN seconds END)),0) AS avg_seconds FROM page_views WHERE day>=? AND day<=? GROUP BY path ORDER BY views DESC LIMIT 25",from,to),
  // The last page of each visit: where people left the site.
  all("SELECT p.path,COUNT(*) AS exits FROM page_views p JOIN (SELECT MAX(id) AS last FROM page_views WHERE day>=? AND day<=? GROUP BY visitor,day) l ON l.last=p.id GROUP BY p.path",from,to),
  all("SELECT source,COUNT(*) AS n FROM page_views WHERE day>=? AND day<=? AND source<>'' GROUP BY source ORDER BY n DESC",from,to),
  all("SELECT device,COUNT(DISTINCT visitor||day) AS n FROM page_views WHERE day>=? AND day<=? GROUP BY device ORDER BY n DESC",from,to),
  one("SELECT COUNT(DISTINCT CASE WHEN path='/catalog' THEN visitor||day END) AS catalog,COUNT(DISTINCT CASE WHEN path='/cart' THEN visitor||day END) AS cart,COUNT(DISTINCT CASE WHEN path='/checkout' THEN visitor||day END) AS checkout FROM page_views WHERE day>=? AND day<=?",from,to),
  one("SELECT COUNT(DISTINCT visitor) AS n FROM page_views WHERE ts>=?",now-5*60000),
  one('SELECT MIN(day) AS d FROM page_views')]);
 const left=new Map(exits.map(e=>[String(e.path),Number(e.exits)]));
 const seen=new Map(byDay.map(d=>[String(d.day),d]));
 const series=Array.from({length:days},(_,i)=>{const day=dayOf(now-(days-1-i)*DAY),d=seen.get(day);return {day,visitors:Number(d?.visitors||0),views:Number(d?.views||0)};});
 const share=(rows:Row[],key:string)=>{const total=rows.reduce((t,r)=>t+Number(r.n),0);return rows.map(r=>({key:String(r[key]||''),count:Number(r.n),percent:total?Math.round(Number(r.n)/total*100):0}));};
 return {days,from,to,online:Number(online?.n||0),current,previous,series,
  pages:pages.map(p=>({path:String(p.path),views:Number(p.views),visitors:Number(p.visitors),avg_seconds:Number(p.avg_seconds),exit_percent:Number(p.visitors)?Math.min(100,Math.round((left.get(String(p.path))||0)/Number(p.visitors)*100)):0})),
  sources:share(sources,'source'),devices:share(devices,'device'),
  funnel:{visitors:current.visitors,catalog:Number(funnel?.catalog||0),cart:Number(funnel?.cart||0),checkout:Number(funnel?.checkout||0),orders:current.orders},
  first_day:first?.d||null};
}
/** Admin: GET admin/traffic?range=1|7|30|90. */
export async function trafficRoutes(r:Request,p:string[],u:Row){
 if(p[0]==='admin'&&p[1]==='traffic'&&r.method==='GET'){admin(u);assert(!p[2],'הכתובת אינה תקינה',404);return trafficReport(Number(new URL(r.url).searchParams.get('range'))||30);}
 return null;
}
