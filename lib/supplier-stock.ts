import {one,all,stmt,db,parse,now,uid,assert,audit,hash} from './server';
import type {Row} from './shared';
import {DEFAULT_SUPPLIER_EMAIL,supplierPaymentMethods} from './supplier-presentation';

// Stock is one lifetime capacity per site, made of packages bought in advance.
// A slot is the place an article took in that capacity. Slots fill in order,
// and a slot freed by a cancellation before publication is reused first.
export const STOCK_LOW=5;
export function stockState(total:number|null,used:number){if(total===null)return 'monthly';const left=Math.max(0,total-used);return left<=0?'empty':left<=STOCK_LOW?'low':'ok';}

// The lowest free slot above the legacy deliveries that predate allocations.
export const freeSlotSql=(site:string,demo:string)=>`(SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM supplier_dispatch_allocations x WHERE x.website_id=${site} AND x.demo=${demo} AND x.sequence=L.base+1) THEN L.base+1 ELSE (SELECT MIN(x.sequence)+1 FROM supplier_dispatch_allocations x WHERE x.website_id=${site} AND x.demo=${demo} AND x.sequence>L.base AND NOT EXISTS(SELECT 1 FROM supplier_dispatch_allocations y WHERE y.website_id=x.website_id AND y.demo=x.demo AND y.sequence=x.sequence+1)) END FROM (SELECT MAX(0,COALESCE((SELECT sent_count FROM supplier_dispatch_counters k WHERE k.website_id=${site} AND k.demo=${demo}),0)-(SELECT COUNT(*) FROM supplier_dispatch_allocations z WHERE z.website_id=${site} AND z.demo=${demo})) AS base) L)`;

// Statements that return a not-yet-published article's slot to the package and
// stop its supplier link. Safe to run when the article never had a slot.
export function releaseSlotStatements(articleId:string,actorId:string,reason:string){
 const stamp=now();
 return [
  stmt(`INSERT OR IGNORE INTO records(id,kind,user_id,data,created,updated) SELECT 'stock-release:'||article_id,'stock_release',?,json_object('article_id',article_id,'website_id',website_id,'demo',demo,'sequence',sequence,'stock_total',stock_total,'reason',?,'released_at',?),?,? FROM supplier_dispatch_allocations WHERE article_id=?`,actorId,reason,stamp,stamp,stamp,articleId),
  stmt('UPDATE supplier_dispatch_counters SET sent_count=sent_count-1 WHERE sent_count>0 AND (website_id,demo)=(SELECT website_id,demo FROM supplier_dispatch_allocations WHERE article_id=?)',articleId),
  stmt('DELETE FROM supplier_dispatch_allocations WHERE article_id=?',articleId),
  stmt("UPDATE tokens SET used=1 WHERE kind='supplier' AND resource=?",articleId),
  stmt("UPDATE jobs SET status='cancelled',updated=? WHERE id=? AND status IN ('requested','blocked','failed','succeeded')",stamp,'publication:'+articleId),
 ];
}

const packageRows=async(websiteId:string)=>(await all("SELECT * FROM records WHERE kind='stock_package' AND json_extract(data,'$.website_id')=? ORDER BY created,id",websiteId)).map(r=>({...parse(r)!,id:r.id}));

// Packages as consecutive slot ranges. Capacity set before packages existed is
// shown as one opening package so every slot still belongs to a package.
export function packageRanges(total:number|null,packages:Row[]){
 const listed=packages.map(p=>({...p,start:Number(p.start_slot),end:Number(p.end_slot)}));
 const first=listed.length?listed[0].start-1:total??0;
 return [...(first>0&&total!==null?[{id:'opening',opening:true,quantity:first,start:1,end:first,total_cents:null,unit_cents:null}]:[]),...listed].map((p,i)=>({...p,number:i+1}));
}
export function slotPlace(slot:number,ranges:Row[]){const p=ranges.find(r=>slot>=r.start&&slot<=r.end);return p?{package:p.number,position:slot-p.start+1,size:p.end-p.start+1}:null;}

export async function siteStock(websiteId:string){
 const w=parse(await one('SELECT * FROM websites WHERE id=?',websiteId));assert(w,'האתר לא נמצא',404);
 const total=w.stock_total===null||w.stock_total===undefined?null:Number(w.stock_total);
 const counter=await one('SELECT sent_count FROM supplier_dispatch_counters WHERE website_id=? AND demo=0',websiteId),used=Number(counter?.sent_count||0);
 const packages=await packageRows(websiteId),ranges=packageRanges(total,packages);
 const slots=(await all(`SELECT d.sequence,d.created,d.stock_total,a.id AS article_id,a.title,a.status,a.published_url,o.number AS order_number,o.id AS order_id,json_extract(a.data,'$.published_at') AS published_at FROM supplier_dispatch_allocations d JOIN articles a ON a.id=d.article_id LEFT JOIN orders o ON o.id=a.order_id WHERE d.website_id=? AND d.demo=0 ORDER BY d.sequence DESC`,websiteId)).map(s=>({...s,place:slotPlace(Number(s.sequence),ranges)}));
 const releases=(await all("SELECT r.data,a.title FROM records r LEFT JOIN articles a ON a.id=json_extract(r.data,'$.article_id') WHERE r.kind='stock_release' AND json_extract(r.data,'$.website_id')=? AND COALESCE(json_extract(r.data,'$.demo'),0)=0 ORDER BY r.created DESC LIMIT 50",websiteId)).map(r=>({...JSON.parse(r.data),title:r.title}));
 const waiting=(await all(`SELECT a.id,a.title,j.updated FROM jobs j JOIN articles a ON a.id=json_extract(j.data,'$.article_id') WHERE j.kind='supplier_publication' AND j.status='blocked' AND a.website_id=? AND a.status='approved' ORDER BY j.updated`,websiteId));
 const supplier=w.supplier_id?parse(await one("SELECT * FROM records WHERE id=? AND kind='supplier'",w.supplier_id)):null;
 return {site:{id:w.id,name:w.name,url:w.url,active:w.active!==0,logo_id:w.logo_id||w.seller_logo_id||'',supplier_id:w.supplier_id||'',supplier_name:supplier?.name||w.supplier_name||'',cost_cents:w.cost_cents??null},total,used,left:total===null?null:Math.max(0,total-used),state:stockState(total,used),packages:ranges,slots,releases,waiting,methods:supplierPaymentMethods};
}

const cents=(v:any)=>{if(v===''||v===null||v===undefined)return null;const n=Math.round(Number(v)*100);assert(Number.isSafeInteger(n)&&n>=0&&n<=100000000,'סכום לא תקין');return n;};

// Stock only grows. A package starts after the current capacity (or after what
// was already sent, when the site moves from monthly billing to packages).
export async function addStockPackage(actor:Row,websiteId:string,b:Row){
 const w=await one('SELECT id,name,data FROM websites WHERE id=?',websiteId);assert(w,'האתר לא נמצא',404);
 const d=JSON.parse(w.data||'{}'),quantity=Number(b.quantity);
 const sup=d.supplier_id?await one("SELECT data FROM records WHERE id=? AND kind='supplier'",d.supplier_id):null,supData=sup?JSON.parse(sup.data||'{}'):{},stocked=d.supplier_id?Number((await one("SELECT COUNT(*) AS n FROM websites WHERE json_extract(data,'$.supplier_id')=? AND json_extract(data,'$.stock_total') IS NOT NULL",d.supplier_id))?.n||0):0;
 assert(supData.billing==='stock'||!supData.billing&&stocked>0,'הספק מוגדר בהתחשבנות חודשית. כדי להוסיף מלאי, שנו בפרטי הספק את סוג התשלום ל"מלאי".',409);
 assert(Number.isSafeInteger(quantity)&&quantity>0&&quantity<=100000,'יש להזין כמות פרסומים שלמה וחיובית');
 const totalCents=cents(b.total_ils);let unit=cents(b.unit_ils);
 assert(totalCents!==null||unit!==null,'יש להזין את עלות החבילה או את המחיר ליחידה');
 const total=totalCents??unit!*quantity;if(unit===null)unit=Math.round(total/quantity);
 const paidOn=String(b.paid_on||'').slice(0,10);assert(!paidOn||/^\d{4}-\d{2}-\d{2}$/.test(paidOn),'תאריך תשלום לא תקין');
 const method=String(b.method||'');assert(!method||method in supplierPaymentMethods,'אמצעי תשלום לא תקין');
 const note=String(b.note||'').trim().slice(0,1000);
 const counter=await one('SELECT sent_count FROM supplier_dispatch_counters WHERE website_id=? AND demo=0',websiteId);
 const before=d.stock_total===null||d.stock_total===undefined?null:Number(d.stock_total),base=before??Number(counter?.sent_count||0),after=base+quantity;
 const id='stock-package:'+uid(),stamp=now(),record={website_id:websiteId,quantity,total_cents:total,unit_cents:unit,paid_on:paidOn,method,note,start_slot:base+1,end_slot:after,stock_before:before,stock_after:after,actor_name:actor.name||''};
 const guard=before===null?"json_extract(data,'$.stock_total') IS NULL":"json_extract(data,'$.stock_total')=?";
 const write=await db().batch([
  stmt(`UPDATE websites SET data=json_set(data,'$.stock_total',?),updated=? WHERE id=? AND ${guard}`,...[after,stamp,websiteId,...(before===null?[]:[before])]),
  stmt("INSERT INTO records(id,kind,user_id,data,created,updated) SELECT ?,'stock_package',?,?,?,? WHERE changes()=1",id,actor.id,JSON.stringify(record),stamp,stamp),
 ]);
 assert(write[0].meta.changes===1,'המלאי השתנה בזמן הפעולה. רעננו ונסו שוב.',409);
 await audit(actor,websiteId,'נוספה חבילת מלאי',{quantity,total_cents:total,unit_cents:unit,stock_after:after});
 return {ok:true,id,stock_total:after,retry:(await all("SELECT a.id FROM jobs j JOIN articles a ON a.id=json_extract(j.data,'$.article_id') WHERE j.kind='supplier_publication' AND j.status='blocked' AND a.website_id=? AND a.status='approved'",websiteId)).map(r=>r.id)};
}

// Every site has a supplier, and every supplier has an email. A site with no
// supplier card is linked to the card for its email (created when missing),
// falling back to the system's default supplier email.
export async function linkOrphanSites(actorId:string){
 const orphans=(await all("SELECT id,data FROM websites WHERE COALESCE(json_extract(data,'$.supplier_id'),'')=''")).map(w=>({id:w.id,data:JSON.parse(w.data||'{}')}));
 if(!orphans.length)return 0;
 const suppliers=(await all("SELECT id,data FROM records WHERE kind='supplier'")).map(r=>({id:r.id,...JSON.parse(r.data||'{}')}));
 const stamp=now(),ops:any[]=[];
 for(const w of orphans){
  const email=String(w.data.supplier_email||'').trim().toLowerCase()||DEFAULT_SUPPLIER_EMAIL;
  let s=suppliers.find(x=>String(x.email||'').toLowerCase()===email);
  if(!s){s={id:'supplier-email-'+(await hash(email)).slice(0,32),name:email,email,partial:true};suppliers.push(s);ops.push(stmt("INSERT OR IGNORE INTO records(id,kind,user_id,data,created,updated) VALUES (?,'supplier',?,?,?,?)",s.id,actorId,JSON.stringify({name:email,email,partial:true}),stamp,stamp));}
  ops.push(stmt("UPDATE websites SET data=json_set(data,'$.supplier_id',?,'$.supplier_name',?,'$.supplier_email',?) WHERE id=? AND COALESCE(json_extract(data,'$.supplier_id'),'')=''",s.id,s.name,email,w.id));
 }
 await db().batch(ops);return orphans.length;
}
