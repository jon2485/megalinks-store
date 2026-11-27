// "מצאו לי אתרים מתאימים" (owner 27.11.2026, mockups design/ai-ideas 4-10).
// 1. Every catalog site is read once by Claude through the API (in the background, in small batches) and gets a
//    profile: topics, audience, site type and what it suits. Nothing of this is written by hand.
// 2. A recommendation: the sites that fit the business and the budget, without any site that already links to the
//    customer's domain (from this account's own orders, by the target address, never all orders of everyone), with a
//    suggested phrase and target page for each, balancing the domain's existing phrase mix.
import type {Row} from './shared';
import {all,one,stmt,now,assert,ApiError,externalFetch,setting,saveSetting} from './server';
import {pricingContext,pricedSite} from './pricing';
import {categoryLabels} from './sheets-plan';
import {anchorCounts,anchorTarget,anchorTypeLabels,classifyAnchor,siteDomain,type AnchorType} from './anchor-mix';

/** Runs one prompt and returns the raw JSON text; `cheap` asks for the small model when the provider has one. */
export type AiRun=(prompt:string,cheap?:boolean)=>Promise<string>;
export type SiteProfile={topics:string[];audience:string;site_type:string;good_for:string;checked_at:string;source:string;error?:string};

const PAUSE_KEY='site_profiles_paused';
const parseJson=(raw:string)=>{const t=String(raw||'').trim().replace(/^```(?:json)?\s*/i,'').replace(/```\s*$/,'');const s=t.indexOf('{'),e=t.lastIndexOf('}');return JSON.parse(s>=0&&e>s?t.slice(s,e+1):t);};
const clip=(v:unknown,n:number)=>String(v??'').replace(/\s+/g,' ').trim().slice(0,n);
const dataOf=(w:Row)=>{try{return typeof w.data==='string'?JSON.parse(w.data||'{}'):w.data||{};}catch{return {};}};

// ---------- 1. site profiles ----------
async function readHome(url:string){
 try{
  // The outbound guard does not follow redirects by itself: follow up to three (http to https, www and the like).
  let address=url,res=await externalFetch(address,{headers:{'user-agent':'Mozilla/5.0 (compatible; MegaLinksSiteReader/1.0)',accept:'text/html'}},8000);
  for(let hop=0;hop<3&&res.status>=300&&res.status<400&&res.headers.get('location');hop++){address=new URL(res.headers.get('location')!,address).href;res=await externalFetch(address,{headers:{'user-agent':'Mozilla/5.0 (compatible; MegaLinksSiteReader/1.0)',accept:'text/html'}},8000);}
  if(!res.ok)return '';
  const html=(await res.text()).slice(0,250000);
  const pick=(re:RegExp,max:number)=>[...html.matchAll(re)].map(m=>m[1].replace(/<[^>]+>/g,' ').replace(/&[a-z#0-9]+;/gi,' ').replace(/\s+/g,' ').trim()).filter(Boolean).slice(0,max);
  return [...pick(/<title[^>]*>([\s\S]*?)<\/title>/gi,1),...pick(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/gi,1),...pick(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)["']/gi,1),...pick(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi,30),...pick(/<nav[\s\S]*?<\/nav>/gi,0)].join(' | ').slice(0,3500);
 }catch{return '';}
}
function profilePrompt(w:Row,home:string){
 const d=dataOf(w),examples=(Array.isArray(d.example_articles)?d.example_articles:[]).slice(0,3).join(', ');
 return `אתה מנתח אתרי תוכן בישראל עבור מערכת לפרסום כתבות. נתח את האתר הבא והחזר JSON בלבד.
שם: ${clip(w.name,120)}
כתובת: ${clip(w.url,200)}
קטגוריה במערכת: ${categoryLabels[String(w.category)]||clip(w.category,60)}
כתבות לדוגמה: ${clip(examples,600)}
תוכן מדף הבית: ${home||'(לא נקרא)'}
החזר: {"topics":[עד 8 נושאים קצרים בעברית],"audience":"הקהל בשורה אחת","site_type":"סוג האתר בכמה מילים, למשל חדשות ארצי, מגזין נישה, אתר מקומי","good_for":"לאילו כתבות מסחריות האתר מתאים, שורה אחת"}. בלי טקסט נוסף, בלי המצאות: אם אין מידע, כתוב לפי השם והקטגוריה.`;
}
export async function siteProfileStatus(){
 const [row,sample,paused]=await Promise.all([
  one("SELECT COUNT(*) AS total,SUM(CASE WHEN json_extract(data,'$.ai_profile.checked_at') IS NOT NULL AND json_extract(data,'$.ai_profile.error') IS NULL THEN 1 ELSE 0 END) AS done,SUM(CASE WHEN json_extract(data,'$.ai_profile.error') IS NOT NULL THEN 1 ELSE 0 END) AS failed FROM websites WHERE active=1"),
  one("SELECT id,name,url,json_extract(data,'$.ai_profile') AS profile FROM websites WHERE active=1 AND json_extract(data,'$.ai_profile.checked_at') IS NOT NULL AND json_extract(data,'$.ai_profile.error') IS NULL ORDER BY json_extract(data,'$.ai_profile.checked_at') DESC LIMIT 1"),
  setting(PAUSE_KEY,false)]);
 const total=Number(row?.total||0),done=Number(row?.done||0),failed=Number(row?.failed||0);
 return {total,done,failed,pending:Math.max(0,total-done-failed),paused:!!paused,
  // Haiku: about 3,000 words in and 200 out per site, well under a tenth of a cent.
  estimated_cost_usd:Math.round(done*0.0005*100)/100,
  sample:sample?{id:sample.id,name:sample.name,url:sample.url,profile:JSON.parse(sample.profile||'{}')}:null};
}
export const setSiteProfilesPaused=(paused:boolean)=>saveSetting(PAUSE_KEY,paused);
/** Reads up to `limit` sites that have no profile yet (or the one asked), `parallel` at a time. */
export async function runSiteProfiles(ai:AiRun,{limit=12,parallel=4,siteId='',force=false}:{limit?:number;parallel?:number;siteId?:string;force?:boolean}={}){
 if(!siteId&&!force&&await setting(PAUSE_KEY,false))return {analyzed:0,paused:true};
 const rows=siteId?await all('SELECT * FROM websites WHERE id=?',siteId):await all("SELECT * FROM websites WHERE active=1 AND json_extract(data,'$.ai_profile.checked_at') IS NULL ORDER BY CAST(COALESCE(dr,0) AS INTEGER) DESC,id LIMIT ?",Math.max(1,Math.min(40,limit)));
 let analyzed=0,failed=0;
 for(let i=0;i<rows.length;i+=parallel){
  await Promise.all(rows.slice(i,i+parallel).map(async w=>{
   let profile:SiteProfile;
   try{
    const home=await readHome(String(w.url||''));
    const out=parseJson(await ai(profilePrompt(w,home),true));
    profile={topics:(Array.isArray(out.topics)?out.topics:[]).map((t:unknown)=>clip(t,40)).filter(Boolean).slice(0,8),audience:clip(out.audience,160),site_type:clip(out.site_type,80),good_for:clip(out.good_for,200),checked_at:now(),source:home?'home':'name'};
    analyzed++;
   }catch(e){profile={topics:[],audience:'',site_type:'',good_for:'',checked_at:now(),source:'',error:clip((e as Error).message,160)||'הניתוח נכשל'};failed++;}
   await stmt("UPDATE websites SET data=json_set(COALESCE(data,'{}'),'$.ai_profile',json(?)) WHERE id=?",JSON.stringify(profile),w.id).run();
  }));
 }
 return {analyzed,failed};
}
/** Failed sites go back to the queue (the admin's "ניסיון חוזר"). */
export const retryFailedProfiles=()=>stmt("UPDATE websites SET data=json_remove(data,'$.ai_profile') WHERE json_extract(data,'$.ai_profile.error') IS NOT NULL").run();

// ---------- 2. recommendations ----------
export type MatchInput={target_url:string;business:string;budget_ils:number;count:number;keywords:string[];brand?:string;customer_id?:string};
/** This account's links to the domain: the sites already used and the phrases, from its own non-cancelled orders. */
export async function domainHistory(u:Row,domain:string){
 const rows=await all(`SELECT a.website_id,w.name,w.url,json_extract(a.data,'$.target_url') AS t1,json_extract(a.data,'$.anchor') AS a1,json_extract(a.data,'$.target_url_2') AS t2,json_extract(a.data,'$.anchor_2') AS a2
  FROM articles a JOIN orders o ON o.id=a.order_id LEFT JOIN websites w ON w.id=a.website_id
  WHERE o.user_id=? AND a.status<>'cancelled' AND o.status<>'cancelled' AND COALESCE(json_extract(o.data,'$.demo'),0)<>1`,u.id);
 const used=new Map<string,Row>(),anchors:{anchor:string}[]=[];
 for(const r of rows){
  let hit=false;
  for(const [t,a] of [[r.t1,r.a1],[r.t2,r.a2]])if(t&&siteDomain(String(t))===domain){hit=true;anchors.push({anchor:String(a||t)});}
  if(hit&&r.website_id&&!used.has(r.website_id))used.set(r.website_id,{id:r.website_id,name:r.name,url:r.url});
 }
 return {used:[...used.values()],anchors};
}
const words=(v:string)=>String(v||'').toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(w=>w.length>1);
export async function recommendSites(u:Row,input:MatchInput,ai:AiRun){
 const domain=siteDomain(input.target_url);assert(domain,'יש להזין את כתובת האתר שלכם');
 const business=clip(input.business,300);assert(business.length>=3,'ספרו בכמה מילים מה העסק');
 const budget=Math.round(Number(input.budget_ils)*100);assert(Number.isFinite(budget)&&budget>=100,'יש להזין תקציב');
 const count=Math.max(1,Math.min(10,Math.floor(Number(input.count)||3)));
 const keywords=(Array.isArray(input.keywords)?input.keywords:[]).map(k=>clip(k,60)).filter(Boolean).slice(0,8);
 const brand=clip(input.brand,60);
 const [history,pricing,sites]=await Promise.all([domainHistory(u,domain),pricingContext(u.id),all("SELECT * FROM websites WHERE active=1 AND json_extract(data,'$.archived_at') IS NULL")]);
 const usedIds=new Set(history.used.map(s=>s.id));
 // A site that is the customer's own domain is never offered.
 const priced=sites.filter(w=>!usedIds.has(w.id)&&siteDomain(String(w.url||''))!==domain).map(w=>({w,site:pricedSite(w,pricing) as Row,profile:(dataOf(w).ai_profile||null) as SiteProfile|null})).filter(x=>Number(x.site.price_cents)>0&&Number(x.site.price_cents)<=budget);
 assert(priced.length,'לא נמצאו אתרים בתקציב הזה שעוד לא קישרו אליכם. נסו תקציב גבוה יותר.',404);
 // Short list without AI: shared words with the business and keywords (profile, name, category), then strength.
 const want=new Set([...words(business),...keywords.flatMap(words)]);
 const score=(x:typeof priced[number])=>{const p=x.profile&&!x.profile.error?x.profile:null;const text=[x.w.name,categoryLabels[String(x.w.category)]||x.w.category,p?.topics.join(' '),p?.good_for,p?.audience].join(' ');const hits=words(text).filter(w=>want.has(w)).length;return hits*10+Number(x.w.dr||0)/10+(p?2:0);};
 const ranked=priced.map(x=>({...x,score:score(x)})).sort((a,b)=>b.score-a.score);
 const short=[...ranked.slice(0,30),...ranked.slice(30).filter(x=>Number(x.w.dr||0)>=60).slice(0,10)].slice(0,40);
 const counts=anchorCounts(history.anchors,{domain,brand,keywords}),total=history.anchors.length;
 const mix=(Object.keys(counts) as AnchorType[]).map(t=>`${anchorTypeLabels[t]}: ${counts[t]} (יעד בערך ${Math.round(anchorTarget[t]*100)}%)`).join(', ');
 const prompt=`אתה יועץ לבניית קישורים בישראל. בחר ${count} אתרים לפרסום כתבה עבור העסק, מתוך הרשימה בלבד, והחזר JSON בלבד.
העסק: ${business}
האתר של העסק: ${domain}${brand?' (שם המותג: '+brand+')':''}
מילות מפתח: ${keywords.join(', ')||'(לא נמסרו)'}
תקציב כולל: ${budget/100} ש״ח (לפני מע״מ). סך המחירים של האתרים שתבחר לא יעלה על התקציב.
חלוקת הביטויים הקיימת לאתר הזה (${total} קישורים): ${mix}
כללים: העדף התאמה לתחום ולקהל של העסק על פני כוח האתר; שלב אתר גדול, אתר תוכן ואתר נישה כשאפשר; לכל אתר הצע ביטוי קישור טבעי בעברית ועמוד יעד באתר של העסק (דף הבית או עמוד פנימי הגיוני תחת ${domain}); אזן את החלוקה: רוב על שם העסק או הכתובת, חלק ביטויים חלקיים, ומעט מדויקים (לכל היותר ביטוי מדויק אחד). לכל אתר כתוב סיבה במשפט אחד, והצע 3 ביטויים חלופיים.
האתרים: ${JSON.stringify(short.map(x=>({id:x.w.id,name:x.w.name,domain:siteDomain(String(x.w.url||'')),dr:x.w.dr,price_ils:Number(x.site.price_cents)/100,category:categoryLabels[String(x.w.category)]||x.w.category,topics:x.profile?.topics||[],audience:x.profile?.audience||'',good_for:x.profile?.good_for||''})))}
החזר: {"picks":[{"id":"...","reason":"...","anchor":"...","anchor_type":"brand|naked|partial|exact","target_url":"https://${domain}/...","alternatives":["...","...","..."]}],"note":"משפט אחד על הבחירה"}`;
 let out:Row;try{out=parseJson(await ai(prompt));}catch(e){if(e instanceof ApiError)throw e;throw new ApiError(502,'לא הצלחנו להכין המלצה כרגע. נסו שוב בעוד רגע.');}
 const byId=new Map(short.map(x=>[String(x.w.id),x]));let spent=0;const picks:Row[]=[];
 for(const p of Array.isArray(out.picks)?out.picks:[]){
  const x=byId.get(String(p?.id||''));if(!x||picks.some(q=>q.id===x.w.id))continue;
  const price=Number(x.site.price_cents);if(spent+price>budget)continue;
  let target=clip(p.target_url,300);if(siteDomain(target)!==domain)target='https://'+domain+'/';
  const anchor=clip(p.anchor,100)||domain;
  picks.push({id:x.w.id,name:x.w.name,url:x.w.url,dr:x.w.dr,ur:x.w.ur,category:categoryLabels[String(x.w.category)]||x.w.category,logo_url:x.site.logo_url||'',price_cents:price,reason:clip(p.reason,240),anchor,anchor_type:classifyAnchor(anchor,{domain,brand,keywords}),target_url:target,alternatives:(Array.isArray(p.alternatives)?p.alternatives:[]).map((a:unknown)=>clip(a,100)).filter(Boolean).slice(0,3)});
  spent+=price;if(picks.length>=count)break;
 }
 assert(picks.length,'לא הצלחנו להכין המלצה כרגע. נסו שוב בעוד רגע.',502);
 return {domain,brand,keywords,used:history.used,history:counts,history_total:total,picks,total_cents:spent,note:clip(out.note,240)};
}
