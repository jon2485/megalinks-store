// Agency centre (design/agency-dashboard/spec.md): server side. Only accounts of type "סוכנות" (role 'agency').
// Every number is read from the existing articles, orders and customer records: nothing is copied, so an action in the
// agency centre and in "הכתבות שלי" is the same action on the same rows.
import type {Row} from './shared';
import {assert,all,one,stmt,now,audit,uid} from './server';
import {articleCustomerJoins,articleCustomerColumns} from './article-customer';
import {customerInput,customerErrors} from './customer-fields';
import {normalizeDomain,articleSpend} from './agency-shared';
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
