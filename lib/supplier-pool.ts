import {one,all,stmt,db,now,uid,assert,audit} from './server';
import type {Row} from './shared';
import {supplierPaymentMethods} from './supplier-presentation';

// Supplier stock pool (owner, 23.11.2026): stock belongs to the supplier and is shared by all its sites.
// The supplier card holds the pool size (`stock_pool` in the supplier record); every article sent to any of its
// sites takes one place (supplier_pool_allocations). A site keeps its own separate stock only when it is marked
// `stock_own`: the owner gave that site a stock number of its own (e.g. site A 50, site B 20). The pool number is set
// only on the supplier card; the sheet's stock column keeps its per-site meaning and is not read for the pool. A supplier without `stock_pool`
// works exactly as before: per-site stock, or monthly.

/** Heads-up when 2 or fewer are left, or 10% of the pool, whichever is larger. */
export const poolLowLimit=(total:number)=>Math.max(2,Math.floor(total*0.1));
export function poolState(total:number,used:number){const left=Math.max(0,total-used);return left<=0?'empty':left<=poolLowLimit(total)?'low':'ok';}
/** The stored reason of a delivery blocked by an ended pool. deliveryReason and the lobby look for this start. */
export const POOL_ENDED='המלאי של הספק';
export const poolEndedError=(name:string)=>`${POOL_ENDED} ${name||''} נגמר. הוסיפו מלאי לספק או העבירו את האתר לספק אחר, והכתבה תישלח.`.replace(/\s+/g,' ');

/** True when a site draws from its supplier's pool (SQL, for a websites alias and a supplier records alias). */
export const poolSiteSql=(w:string,s:string)=>`(${s}.id IS NOT NULL AND json_extract(${s}.data,'$.stock_pool') IS NOT NULL AND COALESCE(json_extract(${w}.data,'$.stock_own'),0)=0)`;
/** Places used in a supplier's pool. */
export const poolUsedSql=(supplier:string,demo:string|number)=>`(SELECT COUNT(*) FROM supplier_pool_allocations p WHERE p.supplier_id=${supplier} AND p.demo=${demo})`;
/** The lowest free place in a supplier's pool, so a place freed by a cancellation is used first (like site stock). */
export const poolFreeSlotSql=(supplier:string,demo:string|number)=>`(SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM supplier_pool_allocations x WHERE x.supplier_id=${supplier} AND x.demo=${demo} AND x.sequence=1) THEN 1 ELSE (SELECT MIN(x.sequence)+1 FROM supplier_pool_allocations x WHERE x.supplier_id=${supplier} AND x.demo=${demo} AND NOT EXISTS(SELECT 1 FROM supplier_pool_allocations y WHERE y.supplier_id=x.supplier_id AND y.demo=x.demo AND y.sequence=x.sequence+1)) END)`;
export const sitePoolOf=(supplier:Row|null|undefined,site:Row)=>!!supplier&&supplier.stock_pool!==null&&supplier.stock_pool!==undefined&&!site.stock_own;

const STOCK_WORDS=['stock','exchange'];
/** The pool block of one supplier page. `sites` are the supplier's own sites with `stock_sent` (lib/admin-suppliers.ts). */
export async function supplierPoolInfo(supplier:Row,sites:Row[]){
 const total=supplier.stock_pool===null||supplier.stock_pool===undefined?null:Number(supplier.stock_pool);
 const own=sites.filter(w=>w.stock_own&&w.stock_total!=null).map(w=>({id:w.id,name:w.name,total:Number(w.stock_total),used:Number(w.stock_sent||0),left:Math.max(0,Number(w.stock_total)-Number(w.stock_sent||0))}));
 // A sheet "מלאי"/"החלפה" with no number: still unlimited, as before, but shown (owner: it must not be silent).
 const unnumbered=sites.filter(w=>STOCK_WORDS.includes(String(w.stock_mode||''))&&w.stock_total==null&&(total===null||w.stock_own)).length;
 const leftovers=total===null?sites.filter(w=>!w.stock_own&&w.stock_total!=null).map(w=>({id:w.id,name:w.name,left:Math.max(0,Number(w.stock_total)-Number(w.stock_sent||0))})).filter(w=>w.left>0):[];
 if(total===null)return {total:null,used:0,left:null,state:'none',sites:sites.length,own,unnumbered,leftovers,waiting:0,last:null};
 const [used,waiting,last]=await Promise.all([
  one(`SELECT ${poolUsedSql('?',0)} AS n`,supplier.id),
  one(`SELECT COUNT(*) AS n FROM jobs j JOIN articles a ON a.id=json_extract(j.data,'$.article_id') JOIN websites w ON w.id=a.website_id WHERE j.kind='supplier_publication' AND j.status='blocked' AND a.status='approved' AND json_extract(w.data,'$.supplier_id')=? AND json_extract(j.data,'$.error') LIKE ?`,supplier.id,POOL_ENDED+'%'),
  one("SELECT data,created FROM records WHERE kind='stock_package' AND json_extract(data,'$.supplier_id')=? AND json_extract(data,'$.pool')=1 ORDER BY created DESC,id DESC LIMIT 1",supplier.id),
 ]);
 const u=Number(used?.n||0),pack=last?JSON.parse(last.data):null;
 return {total,used:u,left:Math.max(0,total-u),state:poolState(total,u),low_limit:poolLowLimit(total),sites:sites.filter(w=>!w.stock_own).length,own,unnumbered,leftovers,waiting:Number(waiting?.n||0),last:pack&&last?{quantity:pack.quantity,created:last.created}:null};
}

const cents=(v:any)=>{if(v===''||v===null||v===undefined)return null;const n=Math.round(Number(v)*100);assert(Number.isSafeInteger(n)&&n>=0&&n<=100000000,'סכום לא תקין');return n;};

// Stock is only added. The first time, sites that still hold per-site stock either add what is left to the pool
// (`merge_sites`, the default) or keep it as their own separate stock.
export async function addPoolStock(actor:Row,supplierId:string,b:Row){
 const s=await one("SELECT id,data FROM records WHERE id=? AND kind='supplier'",supplierId);assert(s,'הספק לא נמצא',404);
 const d=JSON.parse(s.data||'{}'),quantity=Number(b.quantity);
 assert(Number.isSafeInteger(quantity)&&quantity>0&&quantity<=100000,'יש להזין כמות כתבות שלמה וחיובית');
 const totalCents=cents(b.total_ils);let unit=cents(b.unit_ils);
 assert(totalCents!==null||unit!==null,'יש להזין את עלות המלאי או את המחיר לכתבה');
 const total=totalCents??unit!*quantity;if(unit===null)unit=Math.round(total/quantity);
 const paidOn=String(b.paid_on||'').slice(0,10);assert(!paidOn||/^\d{4}-\d{2}-\d{2}$/.test(paidOn),'תאריך תשלום לא תקין');
 const method=String(b.method||'');assert(!method||method in supplierPaymentMethods,'אמצעי תשלום לא תקין');
 const note=String(b.note||'').trim().slice(0,1000);
 const before=d.stock_pool===null||d.stock_pool===undefined?null:Number(d.stock_pool);
 let merged:Row[]=[],kept:Row[]=[];
 if(before===null){
  const rows=(await all("SELECT w.id,w.name,json_extract(w.data,'$.stock_total') AS total,COALESCE(c.sent_count,0) AS sent FROM websites w LEFT JOIN supplier_dispatch_counters c ON c.website_id=w.id AND c.demo=0 WHERE json_extract(w.data,'$.supplier_id')=? AND json_extract(w.data,'$.stock_total') IS NOT NULL AND COALESCE(json_extract(w.data,'$.stock_own'),0)=0",supplierId)).map(w=>({id:w.id,name:w.name,left:Math.max(0,Number(w.total)-Number(w.sent))})).filter(w=>w.left>0);
  if(b.merge_sites===false)kept=rows;else merged=rows;
 }
 const extra=merged.reduce((n,w)=>n+w.left,0),base=before??0,after=base+quantity+extra;
 const id='stock-package:'+uid(),stamp=now(),record={supplier_id:supplierId,pool:1,quantity,merged:extra,merged_sites:merged,kept_sites:kept.map(w=>w.id),total_cents:total,unit_cents:unit,paid_on:paidOn,method,note,start_slot:base+1,end_slot:after,stock_before:before,stock_after:after,actor_name:actor.name||''};
 const guard=before===null?"json_extract(data,'$.stock_pool') IS NULL":"json_extract(data,'$.stock_pool')=?";
 const write=await db().batch([
  stmt(`UPDATE records SET data=json_set(data,'$.stock_pool',?),updated=? WHERE id=? AND kind='supplier' AND ${guard}`,...[after,stamp,supplierId,...(before===null?[]:[before])]),
  stmt("INSERT INTO records(id,kind,user_id,data,created,updated) SELECT ?,'stock_package',?,?,?,? WHERE changes()=1",id,actor.id,JSON.stringify(record),stamp,stamp),
  ...kept.map(w=>stmt("UPDATE websites SET data=json_set(data,'$.stock_own',1),updated=? WHERE id=? AND EXISTS(SELECT 1 FROM records WHERE id=?)",stamp,w.id,id)),
 ]);
 assert(write[0].meta.changes===1,'המלאי השתנה בזמן הפעולה. רעננו ונסו שוב.',409);
 await audit(actor,supplierId,'נוסף מלאי לספק',{quantity,merged:extra,total_cents:total,unit_cents:unit,stock_after:after});
 return {ok:true,id,stock_pool:after,retry:await poolWaiting(supplierId)};
}

/** Approved articles of the supplier's pool sites that wait for stock, oldest first. */
export async function poolWaiting(supplierId:string){
 return (await all(`SELECT a.id FROM jobs j JOIN articles a ON a.id=json_extract(j.data,'$.article_id') JOIN websites w ON w.id=a.website_id WHERE j.kind='supplier_publication' AND j.status='blocked' AND a.status='approved' AND json_extract(w.data,'$.supplier_id')=? AND COALESCE(json_extract(w.data,'$.stock_own'),0)=0 AND json_extract(j.data,'$.error') LIKE '%מלאי%' ORDER BY j.updated,a.id`,supplierId)).map(r=>String(r.id));
}

/** Packages added to a supplier's pool, as orders for the billing tab. Used per package = pool places in its range. */
export async function poolPackages(supplierId:string){
 const [packs,slots]=await Promise.all([
  all("SELECT id,data,created FROM records WHERE kind='stock_package' AND json_extract(data,'$.supplier_id')=? AND json_extract(data,'$.pool')=1 ORDER BY created,id",supplierId),
  all('SELECT sequence FROM supplier_pool_allocations WHERE supplier_id=? AND demo=0',supplierId),
 ]);
 const seqs=slots.map(r=>Number(r.sequence)),low=(qty:number)=>poolLowLimit(qty);
 return packs.map((r,i)=>{const p=JSON.parse(r.data),qty=Number(p.end_slot)-Number(p.start_slot)+1,u=seqs.filter(n=>n>=Number(p.start_slot)&&n<=Number(p.end_slot)).length;
  return {site_id:'',site_name:'מלאי הספק',pool:true,number:i+1,id:r.id,opening:false,quantity:qty,used:u,left:qty-u,published:0,created:r.created,paid_on:p.paid_on||'',method:p.method||'',total_cents:p.total_cents??null,unit_cents:p.unit_cents??null,merged:Number(p.merged||0),status:u>=qty?'done':qty-u<=low(qty)?'low':u===0?'queued':'active',paid:!!p.paid_on,code:'STK-'+String(r.id).replace('stock-package:','').slice(0,4).toUpperCase()};
 });
}
