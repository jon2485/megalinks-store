import {one,all} from './server';
import {queueMail} from './mail';
import {supplierLateSql} from './writing-workflow';
import type {Row} from './shared';

// 24.11.2026 (owner) One mail to the admins at 18:00 Israel time: today's orders, articles sent to writing,
// articles published, and what is waiting too long. Called from the every-minute maintenance request; the job id
// carries the day, so it is sent once a day even if the request arrives many times.
const zone='Asia/Jerusalem';
const money=(cents:number)=>new Intl.NumberFormat('he-IL',{style:'currency',currency:'ILS'}).format((Number(cents)||0)/100);
const count=(n:number,one:string,many:string)=>n===1?one:n+' '+many;

/** The Israel calendar day of a moment, its hour, and the UTC time that day began. */
export function israelDay(at:Date){
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).formatToParts(at).map(p=>[p.type,p.value]));
 const day=parts.year+'-'+parts.month+'-'+parts.day,hour=Number(parts.hour)%24;
 const asUtc=Date.UTC(Number(parts.year),Number(parts.month)-1,Number(parts.day),hour,Number(parts.minute));
 const offset=asUtc-Math.floor(at.getTime()/60000)*60000; // how far Israel is ahead of UTC right now
 return {day,hour,start:new Date(Date.UTC(Number(parts.year),Number(parts.month)-1,Number(parts.day))-offset).toISOString()};
}

export async function dailySummaryText(start:string,label:string){
 const [orders,writing,published,late,review,briefs]=await Promise.all([
  all("SELECT o.number,o.total,o.status,u.name FROM orders o JOIN users u ON u.id=o.user_id WHERE o.created>=? ORDER BY o.created",start),
  one("SELECT COUNT(*) AS n FROM articles a WHERE json_extract(a.data,'$.writing_requested_at')>=?",start),
  all("SELECT a.title,a.published_url,w.name AS site FROM articles a JOIN websites w ON w.id=a.website_id WHERE a.status='published' AND COALESCE(json_extract(a.data,'$.published_at'),a.updated)>=? ORDER BY a.updated",start),
  all("SELECT a.title,w.name AS site,o.number FROM articles a JOIN websites w ON w.id=a.website_id JOIN orders o ON o.id=a.order_id WHERE "+supplierLateSql('a')+" ORDER BY a.updated LIMIT 30"),
  one("SELECT COUNT(*) AS n FROM articles a WHERE a.status='admin_review' AND a.updated<?",new Date(Date.now()-864e5).toISOString()),
  one("SELECT COUNT(*) AS n FROM articles a WHERE a.status='writing' AND json_extract(a.data,'$.writing_requested_at')<?",new Date(Date.now()-2*864e5).toISOString()),
 ]);
 const title=(a:Row)=>(a.title||'כתבה ללא כותרת')+' · '+a.site;
 const lines=['סיכום יום '+label,''];
 lines.push('הזמנות היום: '+orders.length+(orders.length?' · סך הכול '+money(orders.reduce((s:number,o:Row)=>s+Number(o.total||0),0))+' כולל מע״מ':''));
 for(const o of orders.slice(0,20))lines.push('  '+o.number+' · '+o.name+' · '+money(o.total)+(o.status==='paid'?' · שולמה':o.status==='cancelled'?' · בוטלה':' · ממתינה לתשלום'));
 if(orders.length>20)lines.push('  ועוד '+(orders.length-20)+' הזמנות');
 lines.push('','כתבות שנשלחו לכתיבה היום: '+Number(writing?.n||0));
 lines.push('','כתבות שעלו היום: '+published.length);
 for(const a of published.slice(0,20))lines.push('  '+title(a)+(a.published_url?' · '+a.published_url:''));
 const waits=late.length+Number(review?.n||0)+Number(briefs?.n||0);
 lines.push('',waits?'מה מתעכב:':'מה מתעכב: אין עיכובים.');
 if(late.length){lines.push('  אצל הספק יותר מ־3 ימים: '+count(late.length,'כתבה אחת','כתבות'));for(const a of late.slice(0,15))lines.push('    '+a.number+' · '+title(a));}
 if(Number(review?.n))lines.push('  מחכות לאישור שלך יותר מיממה: '+count(Number(review!.n),'כתבה אחת','כתבות'));
 if(Number(briefs?.n))lines.push('  מחכות לכותב יותר מיומיים: '+count(Number(briefs!.n),'כתבה אחת','כתבות'));
 return lines.join('\n');
}

export async function sendDailySummary(origin:string,at=new Date()){
 const {day,hour,start}=israelDay(at);if(hour<18)return {daily_summary:'early'};
 if(await one("SELECT id FROM jobs WHERE id>=? AND id<? LIMIT 1",'email:daily-summary:'+day+':','email:daily-summary:'+day+';'))return {daily_summary:'sent'};
 const admins=await all("SELECT id,email FROM users WHERE role='admin' AND COALESCE(email,'')<>''");if(!admins.length)return {daily_summary:'no-admin'};
 const label=day.slice(8,10)+'.'+day.slice(5,7)+'.'+day.slice(0,4),text=await dailySummaryText(start,label);
 for(const a of admins)await queueMail('email:daily-summary:'+day+':'+a.id,a.id,{to:a.email,subject:'סיכום יום '+label+' · MegaLinks',text,button:{label:'פתיחת הלובי',url:origin+'/admin'}}).catch(()=>{});
 return {daily_summary:'queued'};
}
