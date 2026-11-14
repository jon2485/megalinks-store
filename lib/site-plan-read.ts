// Server side of "תוכנית פרסום מהאתר שלכם" (lib/site-plan.ts holds the pure logic): reads a few public pages of the
// customer's own site and turns them into a plan priced for this customer. Reading a stranger's address from the server
// is guarded: public host names only, every address the name points to must be public (checked over DNS-over-HTTPS,
// also after each redirect), default ports only, short time-outs, a size cap, HTML only, at most 6 pages of one site.
// Nothing from the pages is stored; only a small summary of each plan request is kept for the rate limit.
import {ApiError,assert,all,one,stmt,uid,now} from './server';
import {pricingContext,pricedSite} from './pricing';
import {planUrl,publicHostName,privateAddress,readPage,pagesToRead,analyzeSite,buildPlan,type SitePage,type PlanSite} from './site-plan';
import {agencyUsedSites} from './agency';
import {hasAgencyCentre} from './agency-shared';
type Row=Record<string,any>;

const PAGE_BYTES=700_000,PAGE_MS=7000,MAX_PER_HOUR=20;
const checked=new Map<string,number>();
async function publicHost(host:string){
 assert(publicHostName(host),'יש להזין כתובת של אתר ציבורי');
 const at=checked.get(host);if(at&&Date.now()-at<10*60_000)return;
 const ask=async(type:'A'|'AAAA')=>{const res=await fetch('https://cloudflare-dns.com/dns-query?name='+encodeURIComponent(host)+'&type='+type,{headers:{accept:'application/dns-json'},signal:AbortSignal.timeout(4000)});if(!res.ok)throw new Error('dns');const d:Row=await res.json();return (d.Answer||[]).filter((x:Row)=>x.type===1||x.type===28).map((x:Row)=>String(x.data));};
 let found:string[]=[];
 try{const [a,b]=await Promise.all([ask('A'),ask('AAAA').catch(()=>[] as string[])]);found=[...a,...b];}
 catch{throw new ApiError(502,'לא הצלחנו לבדוק את הכתובת כרגע. נסו שוב בעוד רגע.');}
 assert(found.length,'לא מצאנו אתר בכתובת הזאת. בדקו שהיא נכונה.',404);
 assert(!found.some(privateAddress),'יש להזין כתובת של אתר ציבורי');
 checked.set(host,Date.now());if(checked.size>500)checked.clear();
}
// One HTML page, following up to 3 redirects, each checked again. Returns null when the page is not usable.
async function fetchPage(start:string):Promise<{url:string;html:string}|null>{
 let url=start;
 for(let hop=0;hop<4;hop++){
  const u=new URL(url);await publicHost(u.hostname.toLowerCase());
  let res:Response;
  try{res=await fetch(url,{redirect:'manual',headers:{accept:'text/html,application/xhtml+xml','accept-language':'he,en;q=0.8','user-agent':'Mozilla/5.0 (compatible; MegaLinksSitePlan/1.0)'},signal:AbortSignal.timeout(PAGE_MS)});}catch{return null;}
  if(res.status>=300&&res.status<400){await res.body?.cancel();const next=res.headers.get('location');if(!next)return null;const checkedNext=planUrl(new URL(next,url).href);if('error' in checkedNext)return null;url=checkedNext.url;continue;}
  if(res.status<200||res.status>=300||!/html/i.test(res.headers.get('content-type')||'text/html')){await res.body?.cancel();return null;}
  const charset=((res.headers.get('content-type')||'').match(/charset=([\w-]+)/i)||[])[1]||'utf-8';
  let decoder:TextDecoder;try{decoder=new TextDecoder(charset);}catch{decoder=new TextDecoder('utf-8');}
  const reader=res.body?.getReader();let html='',size=0;
  while(reader){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;html+=decoder.decode(part.value,{stream:true});if(size>PAGE_BYTES){await reader.cancel();break;}}
  return {url,html};
 }
 return null;
}
export async function readSite(input:unknown){
 const start=planUrl(input);if('error' in start)throw new ApiError(400,start.error);
 const first=await fetchPage(start.url);
 assert(first&&first.html.length>200,'לא הצלחנו לפתוח את האתר. בדקו שהכתובת נכונה ושהאתר עולה, ונסו שוב.',422);
 const home=readPage(first!.html,first!.url);
 const more=pagesToRead(home,5);
 const pages=(await Promise.all(more.map(async m=>{const p=await fetchPage(m.url).catch(()=>null);return p?{...readPage(p.html,p.url),kind:m.kind}:null;}))).filter(Boolean) as (SitePage&{kind:string})[];
 return analyzeSite(home,pages);
}
// POST /api/site-plan {url, customer_id?}: the account's own plan, or a plan for one of its customers (agency centre),
// leaving out the sites already used for that customer. Prices are the account's own catalog prices.
export async function sitePlan(u:Row,body:Row){
 assert(hasAgencyCentre(u)||u.role==='admin','התוכנית זמינה לחשבונות לקוח',403);
 const since=new Date(Date.now()-3600_000).toISOString();
 const recent=Number((await one("SELECT COUNT(*) AS n FROM records WHERE user_id=? AND kind='site_plan' AND created>?",u.id,since))?.n||0);
 assert(recent<MAX_PER_HOUR,'הכנתם הרבה תוכניות בשעה האחרונה. נסו שוב מאוחר יותר.',429);
 const customerId=typeof body.customer_id==='string'?body.customer_id.slice(0,200):'';
 let hidden=new Set<string>(),customerName='';
 if(customerId){assert(hasAgencyCentre(u),'הלקוח לא נמצא',404);const used=await agencyUsedSites(u,customerId);hidden=new Set(used.hidden_site_ids||[]);
  const rec=await one("SELECT data FROM records WHERE id=? AND user_id=? AND kind='customer'",customerId,u.id);customerName=rec?String(JSON.parse(rec.data||'{}').name||''):'';}
 const analysis=await readSite(body.url);
 const pricing=await pricingContext(u.id);
 const sites:PlanSite[]=(await all('SELECT * FROM websites WHERE active=1')).filter((w:Row)=>!hidden.has(w.id)).map((w:Row)=>{const p=pricedSite(w,pricing) as Row;return {id:String(w.id),name:String(w.name),url:String(w.url),category:String(w.category),dr:Number(w.dr||0),price_cents:Number(p.price_cents)};});
 const sizes=buildPlan(analysis,sites);
 assert(sizes.length,'לא מצאנו אתרים מתאימים במחירון כרגע. נסו כתובת אחרת או פנו אלינו.',404);
 const stamp=now();
 await stmt('INSERT INTO records(id,kind,user_id,data,created,updated) VALUES (?,?,?,?,?,?)','site-plan:'+uid(),'site_plan',u.id,JSON.stringify({host:analysis.host,name:analysis.name,field:analysis.field?.category||'',city:analysis.city?.name||'',customer_id:customerId||undefined,totals:sizes.map(s=>[s.key,s.total_cents])}),stamp,stamp).run();
 return {analysis:{name:analysis.name,site_url:analysis.site_url,host:analysis.host,field:analysis.field,city:analysis.city,pages_read:analysis.pages_read,targets:analysis.targets},customer:customerId?{id:customerId,name:customerName}:null,used_left_out:hidden.size,sizes};
}
