// Agency centre (design/agency-dashboard/spec.md): server side. Only accounts of type "סוכנות" (role 'agency').
// Every number is read from the existing articles, orders and customer records: nothing is copied, so an action in the
// agency centre and in "הכתבות שלי" is the same action on the same rows.
import type {Row} from './shared';
import {assert,all,one,stmt,now,audit,uid} from './server';
import {articleCustomerJoins,articleCustomerColumns} from './article-customer';
import {customerInput,customerErrors} from './customer-fields';
import {normalizeDomain,articleSpend,usedSiteKey,usedSiteMatches,parseUsedSites} from './agency-shared';
export {normalizeDomain,articleSpend};

export function assertAgency(u:Row){assert(u?.role==='agency','מרכז הסוכנות פתוח לחשבונות סוכנות בלבד',403);}

// ---------- customers ----------
const TAG_MAX=12,DOMAIN_MAX=20;
const list=(value:unknown,max:number,each:(v:string)=>string)=>[...new Set((Array.isArray(value)?value:String(value??'').split(/[\n,;]+/)).map(v=>each(String(v))).filter(Boolean))].slice(0,max);
// The agency's own fields on a customer record, on top of name, company, email, phone and notes.
export function agencyCustomerInput(input:Row){
 const base=customerInput(input);
 const budget=input.monthly_budget_ils===''||input.monthly_budget_ils==null?null:Math.round(Number(input.monthly_budget_ils)*100);
 return {...base,
  status:input.status==='archived'?'archived':'active',
  contact_name:String(input.contact_name??'').trim().slice(0,200),
  domains:list(input.domains,DOMAIN_MAX,normalizeDomain),
  tags:list(input.tags,TAG_MAX,v=>v.trim().slice(0,40)),
  monthly_budget_cents:budget!=null&&Number.isSafeInteger(budget)&&budget>0?budget:null,
 };
}
function agencyCustomerErrors(values:Row){
 const errors=customerErrors(values);
 if(values.contact_name.length>200)errors.contact_name='שם איש הקשר ארוך מדי';
 return errors;
}
const parseRecord=(r:Row)=>({id:r.id,created:r.created,updated:r.updated,...JSON.parse(r.data||'{}')});

export const WAITING_FOR_AGENCY=['draft','review','revisions'];
const israelMonth=(iso:string)=>iso?new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jerusalem',year:'numeric',month:'2-digit'}).format(new Date(iso)):'';

// All the agency's articles with what the centre needs. One query; numbers are summed here.
async function agencyArticles(u:Row,where='',...args:unknown[]){
 return await all(`SELECT a.id,a.status,a.title,a.published_url,a.updated,a.data,a.website_id,a.order_id,${articleCustomerColumns},o.number,o.paid,o.created AS purchased_at,o.status AS order_status,w.name AS website_name,w.url AS website_url,json_extract(w.data,'$.logo_url') AS website_logo
  FROM articles a JOIN orders o ON o.id=a.order_id JOIN websites w ON w.id=a.website_id ${articleCustomerJoins}
  WHERE a.user_id=? ${where} ORDER BY COALESCE(json_extract(a.data,'$.published_at'),o.created) DESC`,u.id,...args);
}
// What the agency may see of an article: no cost, supplier or internal fields.
export function agencyArticleRow(a:Row){
 const d=JSON.parse(a.data||'{}');
 return {id:a.id,status:a.status,title:a.title||d.topic||'',topic:d.topic||'',customer_id:a.assigned_customer_id||'',customer_name:a.customer_name||'',
  website_id:a.website_id,website_name:a.website_name||d.website_name||'',website_url:a.website_url||d.website_url||'',website_logo:a.website_logo||'',
  order_id:a.order_id,number:a.number,paid:!!Number(a.paid),demo:!!d.demo,on_account:!!d.on_account,
  purchased_at:d.purchased_at||a.purchased_at||'',published_at:a.status==='published'?d.published_at||a.updated:'',published_url:a.status==='published'?a.published_url||'':'',
  scheduled:d.scheduled||'',anchor:d.anchor||'',target_url:d.target_url||'',anchor_2:d.anchor_2||'',target_url_2:d.target_url_2||'',
  spend:articleSpend(a),publication_refunded:!!d.publication_refunded,writing_refunded:!!d.writing_refunded,updated:a.updated};
}

export async function agencyCustomers(u:Row){
 assertAgency(u);
 const [records,articles]=await Promise.all([all("SELECT * FROM records WHERE kind='customer' AND user_id=? ORDER BY json_extract(data,'$.name'),id",u.id),agencyArticles(u)]);
 const month=israelMonth(new Date().toISOString()),stats=new Map<string,Row>();
 for(const raw of articles){const a=agencyArticleRow(raw);const key=a.customer_id||'';const s=stats.get(key)||{published:0,waiting:0,month_spend:0,month_published:0,last:''};
  if(a.status==='published'&&!a.demo){s.published++;if(israelMonth(a.published_at)===month)s.month_published++;}
  if(WAITING_FOR_AGENCY.includes(a.status))s.waiting++;
  if(israelMonth(a.published_at||a.purchased_at)===month)s.month_spend+=a.spend;
  if(a.updated>s.last)s.last=a.updated;stats.set(key,s);}
 const empty={published:0,waiting:0,month_spend:0,month_published:0,last:''};
 return {customers:records.map(r=>{const c=parseRecord(r);return {...c,status:c.status==='archived'?'archived':'active',domains:c.domains||[],tags:c.tags||[],stats:stats.get(c.id)||empty};}),unassigned:stats.get('')||empty};
}

export async function agencyCustomer(u:Row,id:string){
 assertAgency(u);
 const r=await one("SELECT * FROM records WHERE id=? AND kind='customer' AND user_id=?",id,u.id);
 assert(r,'הלקוח לא נמצא',404);
 const c=parseRecord(r);return {...c,status:c.status==='archived'?'archived':'active',domains:c.domains||[],tags:c.tags||[]};
}

export async function saveAgencyCustomer(u:Row,id:string|null,body:Row){
 assertAgency(u);
 const values=agencyCustomerInput(body),errors=agencyCustomerErrors(values);
 assert(!Object.keys(errors).length,Object.values(errors)[0]);
 const stamp=now();
 if(id){
  const r=await one("SELECT * FROM records WHERE id=? AND kind='customer' AND user_id=?",id,u.id);assert(r,'הלקוח לא נמצא',404);
  const old=JSON.parse(r.data||'{}');
  await stmt('UPDATE records SET data=?,updated=? WHERE id=? AND user_id=?',JSON.stringify({...old,...values}),stamp,id,u.id).run();
  await audit(u,id,old.status!==values.status?(values.status==='archived'?'לקוח הועבר לארכיון':'לקוח הוחזר מהארכיון'):'פרטי לקוח עודכנו',{});
  return {ok:true,id};
 }
 const count=await one("SELECT COUNT(*) AS n FROM records WHERE kind='customer' AND user_id=?",u.id);
 assert(Number(count?.n||0)<2000,'אפשר לשמור עד 2,000 לקוחות',409);
 const newId='customer-'+uid();
 await stmt('INSERT INTO records(id,kind,user_id,data,created,updated) VALUES (?,?,?,?,?,?)',newId,'customer',u.id,JSON.stringify(values),stamp,stamp).run();
 await audit(u,newId,'לקוח נוסף',{});
 return {ok:true,id:newId};
}

// ---------- publications ----------
// Filters: customer ('none' = not assigned), from / to (YYYY-MM-DD, Israel date of publication, or of purchase when not
// published yet), status (published | on_the_way | refunded), site (website id).
export async function agencyPublications(u:Row,q:URLSearchParams){
 assertAgency(u);
 const customer=q.get('customer')||'',from=q.get('from')||'',to=q.get('to')||'',status=q.get('status')||'',site=q.get('site')||'';
 const validDay=(v:string)=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(v))return false;const d=new Date(v+'T00:00:00Z');return !Number.isNaN(d.getTime())&&d.toISOString().startsWith(v);};
 assert(!from||validDay(from),'תאריך לא תקין');assert(!to||validDay(to),'תאריך לא תקין');
 if(customer&&customer!=='none')await agencyCustomer(u,customer);
 const day=(iso:string)=>iso?new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jerusalem'}).format(new Date(iso)):'';
 const rows=(await agencyArticles(u)).map(agencyArticleRow).filter(a=>{
  if(a.demo)return false;
  if(customer==='none'?a.customer_id:customer&&a.customer_id!==customer)return false;
  if(site&&a.website_id!==site)return false;
  // Only bought publications: an unpaid order (waiting for payment, or cancelled before payment) is not one.
  if(!a.paid&&!a.on_account)return false;
  const refunded=a.publication_refunded||a.status==='cancelled';
  const kind=refunded?'refunded':a.status==='published'?'published':'on_the_way';
  if(status&&kind!==status)return false;
  const date=day(a.published_at||a.purchased_at);
  if(from&&date<from)return false;if(to&&date>to)return false;
  return true;
 });
 const sites=new Set(rows.filter(a=>a.status==='published').map(a=>a.website_id));
 const summary={count:rows.length,published:rows.filter(a=>a.status==='published').length,on_the_way:rows.filter(a=>a.status!=='published'&&a.status!=='cancelled'&&!a.publication_refunded).length,sites:sites.size,spend:rows.reduce((s,a)=>s+a.spend,0)};
 const years=[...new Set(rows.map(a=>day(a.published_at||a.purchased_at).slice(0,4)).filter(Boolean))].sort().reverse();
 return {summary,years,publications:rows.slice(0,1000)};
}

// ---------- customer articles (all stages, for the "כתבות" tab) ----------
export async function agencyCustomerArticles(u:Row,id:string){
 await agencyCustomer(u,id);
 return {articles:(await agencyArticles(u)).map(agencyArticleRow).filter(a=>a.customer_id===id)};
}

// ---------- sites already used for a customer (spec section 7) ----------
type UsedEntry={domain:string;path:string;added_at?:string};
const usedId=(customerId:string)=>'used-sites:'+customerId;
const USED_MAX=5000;
async function usedRecord(u:Row,customerId:string){
 const r=await one("SELECT data FROM records WHERE id=? AND kind='customer_used_sites' AND user_id=?",usedId(customerId),u.id);
 const d=r?JSON.parse(r.data||'{}'):{};
 const mode=d.mode==='warn'||d.mode==='hide'?d.mode:(await agencySettings(u)).used_mode;
 return {mode,entries:(Array.isArray(d.entries)?d.entries:[]) as UsedEntry[],exists:!!r};
}
async function saveUsedRecord(u:Row,customerId:string,data:Row){
 const stamp=now();
 await stmt("INSERT INTO records(id,kind,user_id,data,created,updated) VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,updated=excluded.updated WHERE records.user_id=excluded.user_id AND records.kind='customer_used_sites'",usedId(customerId),'customer_used_sites',u.id,JSON.stringify(data),stamp,stamp).run();
}
// Sites the customer already got a publication in through the system: published, or sent to the site for publication.
async function systemUsed(u:Row,customerId:string){
 const rows=(await agencyArticles(u,"AND a.status IN ('published','sent')")).map(agencyArticleRow).filter(a=>a.customer_id===customerId&&!a.demo);
 const bySite=new Map<string,Row>();
 for(const a of rows){const prev=bySite.get(a.website_id),when=a.published_at||a.purchased_at;if(!prev||when>prev.last)bySite.set(a.website_id,{website_id:a.website_id,website_name:a.website_name,website_url:a.website_url,last:when,status:a.status,number:a.number});}
 return [...bySite.values()];
}
const catalogSites=()=>all("SELECT id,name,url FROM websites WHERE active=1");

export async function agencyUsedSites(u:Row,customerId:string){
 await agencyCustomer(u,customerId);
 const [rec,system,sites]=await Promise.all([usedRecord(u,customerId),systemUsed(u,customerId),catalogSites()]);
 const manual=rec.entries.map(e=>{const hits=sites.filter(s=>usedSiteMatches(e,s.url));return {...e,catalog:hits.map(s=>({id:s.id,name:s.name}))};});
 const hidden=new Set([...system.map(s=>s.website_id),...manual.flatMap(m=>m.catalog.map((c:Row)=>c.id))]);
 return {mode:rec.mode,system,manual,hidden_site_ids:[...hidden]};
}
export async function importUsedSites(u:Row,customerId:string,text:string){
 await agencyCustomer(u,customerId);
 const rec=await usedRecord(u,customerId),parsed=parseUsedSites(String(text||'').slice(0,400000),rec.entries);
 const room=Math.max(0,USED_MAX-rec.entries.length),stamp=now();
 const added=parsed.added.slice(0,room).map(e=>({...e,added_at:stamp}));
 if(added.length)await saveUsedRecord(u,customerId,{mode:rec.mode,entries:[...rec.entries,...added]});
 const sites=added.length?await catalogSites():[];
 const inCatalog=added.filter(e=>sites.some(s=>usedSiteMatches(e,s.url))).length;
 if(added.length)await audit(u,customerId,'נוספו אתרים לרשימת "כבר שימשו"',{added:added.length});
 return {added:added.length,in_catalog:inCatalog,duplicates:parsed.duplicates,invalid:parsed.invalid.slice(0,50),invalid_count:parsed.invalid.length,over_limit:parsed.added.length-added.length};
}
export async function removeUsedSite(u:Row,customerId:string,domain:string,path:string){
 await agencyCustomer(u,customerId);
 const rec=await usedRecord(u,customerId),entries=rec.entries.filter(e=>!(e.domain===domain&&e.path===(path||'')));
 assert(entries.length<rec.entries.length,'האתר אינו ברשימה',404);
 await saveUsedRecord(u,customerId,{mode:rec.mode,entries});
 return {ok:true};
}
export async function setUsedMode(u:Row,customerId:string,mode:string){
 await agencyCustomer(u,customerId);assert(['hide','warn'].includes(mode),'בחירה לא תקינה');
 const rec=await usedRecord(u,customerId);await saveUsedRecord(u,customerId,{mode,entries:rec.entries});
 return {ok:true,mode};
}
// Whether this site was already used for this customer: by a publication through the system, or in the pasted list.
export async function usedSiteHit(u:Row,customerId:string,site:Row){
 const [system,rec]=await Promise.all([systemUsed(u,customerId),usedRecord(u,customerId)]);
 const sys=system.find(s=>s.website_id===site.id);if(sys)return {source:'system',date:sys.last,number:sys.number};
 const manual=rec.entries.find(e=>usedSiteMatches(e,site.url));if(manual)return {source:'manual',date:manual.added_at||''};
 return null;
}

// ---------- overview and to-do (spec 5.1, 5.4) ----------
const monthKey=(iso:string)=>israelMonth(iso);
function lastMonths(n:number){const now=new Date(),[y,m]=israelMonth(now.toISOString()).split('-').map(Number),out:string[]=[];for(let i=n-1;i>=0;i--){const d=new Date(Date.UTC(y,m-1-i,1));out.push(d.getUTCFullYear()+'-'+String(d.getUTCMonth()+1).padStart(2,'0'));}return out;}
// What waits for the agency: an action it has to take, or something it should know about soon.
export async function agencyTasks(u:Row){
 assertAgency(u);
 const [articles,unpaid]=await Promise.all([agencyArticles(u),all("SELECT id,number,created,data FROM orders WHERE user_id=? AND paid=0 AND status IN ('pending','awaiting_approval') AND COALESCE(json_extract(data,'$.demo'),0)=0 AND COALESCE(json_extract(data,'$.on_account'),0)=0 ORDER BY created DESC",u.id)]);
 const rows=articles.map(agencyArticleRow).filter(a=>!a.demo&&a.status!=='cancelled'),nowMs=Date.now(),tasks:Row[]=[];
 for(const a of rows){
  const base={article_id:a.id,customer_id:a.customer_id,customer_name:a.customer_name,title:a.title||a.topic,website_name:a.website_name,number:a.number};
  if(a.status==='review')tasks.push({...base,kind:'review',urgency:1,label:'כתבה מחכה לאישור שלך'});
  else if(a.status==='revisions')tasks.push({...base,kind:'revisions',urgency:2,label:'כתבה הוחזרה לתיקון'});
  else if(a.status==='draft'&&(a.paid||a.on_account)&&nowMs-Date.parse(a.purchased_at||a.updated)>3*86400000)tasks.push({...base,kind:'draft',urgency:3,label:'כתבה בטיוטה שעוד לא נשלחה'});
  if(a.scheduled&&a.status!=='published'){const t=Date.parse(a.scheduled);if(t>=nowMs-86400000&&t-nowMs<=7*86400000)tasks.push({...base,kind:'scheduled',urgency:5,label:'פרסום מתוכנן השבוע',date:a.scheduled});}
 }
 for(const o of unpaid)tasks.push({kind:'payment',urgency:4,label:'הזמנה מחכה לתשלום',order_id:o.id,number:o.number,date:o.created,customer_id:'',customer_name:''});
 tasks.sort((x,y)=>x.urgency-y.urgency||String(x.customer_name).localeCompare(String(y.customer_name),'he'));
 return {tasks};
}
export async function agencyOverview(u:Row){
 assertAgency(u);
 const [{customers,unassigned},articles,{tasks}]=await Promise.all([agencyCustomers(u),agencyArticles(u),agencyTasks(u)]);
 const rows=articles.map(agencyArticleRow).filter(a=>!a.demo&&(a.paid||a.on_account)),months=lastMonths(12),current=months[11],previous=months[10];
 const chart=months.map(m=>({month:m,published:0,spend:0}));const at=new Map(chart.map(c=>[c.month,c]));
 for(const a of rows){const pm=a.status==='published'?monthKey(a.published_at):'';if(pm&&at.has(pm))at.get(pm)!.published++;const sm=monthKey(a.published_at||a.purchased_at);if(at.has(sm))at.get(sm)!.spend+=a.spend;}
 const active=customers.filter(c=>c.status!=='archived');
 const top=active.map(c=>({id:c.id,name:c.name,published:c.stats.month_published,spend:c.stats.month_spend})).filter(c=>c.published||c.spend).sort((x,y)=>y.published-x.published||y.spend-x.spend).slice(0,5);
 const recent=rows.filter(a=>a.status==='published').sort((x,y)=>String(y.published_at).localeCompare(String(x.published_at))).slice(0,5);
 return {kpis:{customers:active.length,customers_new_month:active.filter(c=>monthKey(c.created)===current).length,published_month:at.get(current)!.published,published_prev:at.get(previous)!.published,spend_month:at.get(current)!.spend,waiting:tasks.filter(t=>['review','revisions','draft'].includes(t.kind)).length,urgent:tasks.filter(t=>t.urgency<=2).length},
  chart,tasks:tasks.slice(0,5),tasks_total:tasks.length,top,recent,unassigned_waiting:unassigned.waiting};
}

// ---------- admin view of an agency (spec 10), read only ----------
export async function adminAgencyView(target:Row){
 assert(target?.role==='agency','החשבון אינו חשבון סוכנות',404);
 const [{customers,unassigned},used]=await Promise.all([agencyCustomers(target),all("SELECT id,data FROM records WHERE kind='customer_used_sites' AND user_id=?",target.id)]);
 const usedBy=new Map(used.map(r=>{const d=JSON.parse(r.data||'{}');return [String(r.id).slice('used-sites:'.length),{manual:(d.entries||[]).length,mode:d.mode==='warn'?'warn':'hide'}];}));
 return {customers:[...customers].sort((x,y)=>Number(x.status==='archived')-Number(y.status==='archived')).map(c=>({id:c.id,name:c.name,company:c.company||'',domains:c.domains,tags:c.tags,status:c.status,stats:c.stats,used_sites:usedBy.get(c.id)||{manual:0,mode:'hide'}})),unassigned};
}

// ---------- links and anchors, notes (spec 5.2 tabs 6 and 7) ----------
const targetKey=(url:string)=>{try{const x=new URL(url);return (x.hostname.replace(/^www\./,'')+x.pathname.replace(/\/+$/,'')).toLowerCase();}catch{return String(url||'').trim().toLowerCase();}};
export async function agencyLinks(u:Row,customerId:string){
 await agencyCustomer(u,customerId);
 const rows=(await agencyArticles(u)).map(agencyArticleRow).filter(a=>a.customer_id===customerId&&!a.demo&&a.status!=='cancelled'&&(a.paid||a.on_account));
 const groups=new Map<string,Row>();
 for(const a of rows)for(const [url,anchor] of [[a.target_url,a.anchor],[a.target_url_2,a.anchor_2]] as [string,string][]){
  if(!url)continue;const key=targetKey(url),g=groups.get(key)||{target_url:url,count:0,anchors:new Map<string,number>(),sites:new Set<string>(),last:''};
  g.count++;const an=String(anchor||'').trim()||'(בלי עוגן)';g.anchors.set(an,(g.anchors.get(an)||0)+1);g.sites.add(a.website_name);
  const when=a.published_at||a.purchased_at;if(when>g.last)g.last=when;groups.set(key,g);
 }
 return {links:[...groups.values()].map(g=>({target_url:g.target_url,count:g.count,last:g.last,sites:[...g.sites],anchors:[...g.anchors].map(([anchor,count])=>({anchor,count})).sort((x,y)=>y.count-x.count)})).sort((x,y)=>y.count-x.count)};
}
const NOTE_MAX=200,NOTE_TEXT=4000;
export async function agencyNotes(u:Row,customerId:string){
 await agencyCustomer(u,customerId);
 const rows=await all("SELECT id,data,created,updated FROM records WHERE kind='customer_note' AND user_id=? AND json_extract(data,'$.customer_id')=? ORDER BY created DESC",u.id,customerId);
 const notes=rows.map(r=>{const d=JSON.parse(r.data||'{}');return {id:r.id,text:d.text||'',pinned:!!d.pinned,created:r.created,updated:r.updated};});
 return {notes:[...notes.filter(n=>n.pinned),...notes.filter(n=>!n.pinned)]};
}
export async function addAgencyNote(u:Row,customerId:string,body:Row){
 await agencyCustomer(u,customerId);
 const text=String(body.text??'').trim();assert(text,'יש לכתוב את ההערה');assert(text.length<=NOTE_TEXT,'אפשר עד 4,000 תווים בהערה');
 const n=await one("SELECT COUNT(*) AS n FROM records WHERE kind='customer_note' AND user_id=? AND json_extract(data,'$.customer_id')=?",u.id,customerId);
 assert(Number(n?.n||0)<NOTE_MAX,'אפשר לשמור עד 200 הערות ללקוח',409);
 const id='customer-note:'+uid(),stamp=now();
 await stmt('INSERT INTO records(id,kind,user_id,data,created,updated) VALUES (?,?,?,?,?,?)',id,'customer_note',u.id,JSON.stringify({customer_id:customerId,text,pinned:body.pinned===true}),stamp,stamp).run();
 return {ok:true,id};
}
export async function changeAgencyNote(u:Row,customerId:string,noteId:string,body:Row|null){
 await agencyCustomer(u,customerId);
 const r=await one("SELECT * FROM records WHERE id=? AND kind='customer_note' AND user_id=?",noteId,u.id);
 assert(r&&JSON.parse(r.data||'{}').customer_id===customerId,'ההערה לא נמצאה',404);
 if(!body){await stmt('DELETE FROM records WHERE id=? AND user_id=?',noteId,u.id).run();return {ok:true};}
 const d=JSON.parse(r.data||'{}'),text=body.text===undefined?d.text:String(body.text).trim();
 assert(text,'יש לכתוב את ההערה');assert(text.length<=NOTE_TEXT,'אפשר עד 4,000 תווים בהערה');
 await stmt('UPDATE records SET data=?,updated=? WHERE id=? AND user_id=?',JSON.stringify({...d,text,pinned:body.pinned===undefined?!!d.pinned:body.pinned===true}),now(),noteId,u.id).run();
 return {ok:true};
}

// ---------- agency settings (spec 5.8) ----------
const settingsId=(u:Row)=>'agency-settings:'+u.id;
export async function agencySettings(u:Row){
 assertAgency(u);
 const r=await one("SELECT data FROM records WHERE id=? AND kind='agency_settings' AND user_id=?",settingsId(u),u.id),d=r?JSON.parse(r.data||'{}'):{};
 return {report_name:d.report_name||u.company||u.name||'',report_color:/^#[0-9a-f]{6}$/i.test(d.report_color||'')?d.report_color:'#1673e6',used_mode:d.used_mode==='warn'?'warn':'hide',show_costs:!!d.show_costs};
}
export async function saveAgencySettings(u:Row,body:Row){
 assertAgency(u);
 const data={report_name:String(body.report_name??'').trim().slice(0,120),report_color:/^#[0-9a-f]{6}$/i.test(String(body.report_color||''))?String(body.report_color):'#1673e6',used_mode:body.used_mode==='warn'?'warn':'hide',show_costs:body.show_costs===true},stamp=now();
 await stmt("INSERT INTO records(id,kind,user_id,data,created,updated) VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,updated=excluded.updated WHERE records.user_id=excluded.user_id AND records.kind='agency_settings'",settingsId(u),'agency_settings',u.id,JSON.stringify(data),stamp,stamp).run();
 await audit(u,settingsId(u),'הגדרות מרכז הסוכנות עודכנו',{});
 return {ok:true,...data};
}
