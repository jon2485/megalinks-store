// Exchange suppliers (owner, 23.11.2026; spec docs/exchange-suppliers-spec.md).
// A supplier whose sites the sheet marks "החלפה" publishes our customers' articles and is paid with links, not money:
// every verified publication there earns one exchange, and the supplier spends it on one article at a site we approved
// for exchanges. The cost of the publication at the supplier is what we pay for the site taken in return; until then a
// default (₪50, a setting) is counted. A choice made after the source order's month ended leaves that month as it was
// and books the difference in the month of the choice. The supplier never sees prices or costs.
// Balances start at 0: only publications from the day the feature started count (setting exchange_started_at).
import {all,one,stmt,db,now,uid,assert,setting,saveSetting,audit,websitesById,admin} from './server';
import {queueMail} from './mail';
import type {Row} from './shared';

export const exchangeSiteSql=(w='w')=>`COALESCE(json_extract(${w}.data,'$.stock_mode'),'')='exchange'`;
// A publication that earns (or keeps) an exchange: live, not refunded, a real (not demo) order, not itself an exchange order.
const validSource=`a.status='published' AND COALESCE(json_extract(a.data,'$.publication_refunded'),0)=0 AND COALESCE(json_extract(o.data,'$.demo'),0)=0 AND COALESCE(json_extract(o.data,'$.exchange'),0)=0`;
export const israelMonth=(d:Date|string=new Date())=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jerusalem',year:'numeric',month:'2-digit'}).format(typeof d==='string'?new Date(d):d).slice(0,7);
export async function exchangeDefaultCents(){const v=Number(await setting('exchange_default_cents',5000));return Number.isSafeInteger(v)&&v>=0?v:5000;}
async function startedAt(){let s=String(await setting('exchange_started_at','')||'');if(!s){s=now();await saveSetting('exchange_started_at',s);}return s;}

// Is this user an exchange supplier? Their seller account is linked to a supplier that has an exchange site.
export async function exchangeSupplierOf(userId:string){
 return (await one(`SELECT p.supplier_id,r.data AS supplier_data FROM seller_profiles p JOIN records r ON r.id=p.supplier_id AND r.kind='supplier'
  WHERE p.user_id=? AND (json_extract(r.data,'$.billing_default')='exchange' OR EXISTS(SELECT 1 FROM websites w WHERE json_extract(w.data,'$.supplier_id')=p.supplier_id AND ${exchangeSiteSql()}))`,userId))?.supplier_id as string|undefined;
}

// Brings the exchanges up to date in a few set-based statements (no query per row). Safe to run often.
export async function syncExchanges(origin=''){
 const stamp=now(),start=await startedAt(),def=await exchangeDefaultCents(),month=israelMonth();
 await db().batch([
  // New exchanges for new verified publications at exchange sites.
  stmt(`INSERT OR IGNORE INTO exchanges(id,supplier_id,source_article_id,source_order_id,earned_at,status,booked_cents,created,updated)
   SELECT 'xch-'||a.id,json_extract(w.data,'$.supplier_id'),a.id,a.order_id,COALESCE(json_extract(a.data,'$.published_at'),a.updated),'open',?,?,?
   FROM articles a JOIN websites w ON w.id=a.website_id JOIN orders o ON o.id=a.order_id
   WHERE ${exchangeSiteSql()} AND COALESCE(json_extract(w.data,'$.supplier_id'),'')<>'' AND ${validSource}
    AND COALESCE(json_extract(a.data,'$.published_at'),a.updated)>=?`,def,stamp,stamp,start),
  // A source that is no longer live: an unused exchange is void, a used one becomes a debt the next publication covers.
  stmt(`UPDATE exchanges SET status=CASE status WHEN 'taken' THEN 'debt' ELSE 'void' END,updated=?
   WHERE status IN ('open','taken') AND source_article_id IS NOT NULL
    AND NOT EXISTS(SELECT 1 FROM articles a JOIN orders o ON o.id=a.order_id WHERE a.id=exchanges.source_article_id AND ${validSource})`,stamp),
 ]);
 // The month of each new exchange's customer order (Israel time), for the closed-month rule.
 const fresh=await all(`SELECT x.id,x.supplier_id,COALESCE(json_extract(o.data,'$.paid_at'),json_extract(o.data,'$.payment_approved_at'),o.created) AS paid_at
  FROM exchanges x JOIN orders o ON o.id=x.source_order_id WHERE x.source_month IS NULL`);
 // A taken exchange whose order the supplier cancelled (or we refused) before publication goes back to open.
 const reverted=await all(`SELECT x.*,(SELECT COALESCE(SUM(j.amount_cents),0) FROM exchange_adjustments j WHERE j.exchange_id=x.id) AS adj
  FROM exchanges x JOIN articles t ON t.id=x.target_article_id WHERE x.status IN ('taken','debt') AND t.status='cancelled'`);
 const ops:any[]=fresh.map(r=>stmt('UPDATE exchanges SET source_month=? WHERE id=?',israelMonth(String(r.paid_at)),r.id));
 for(const x of reverted){
  if(x.status==='debt'){ops.push(stmt("UPDATE exchanges SET status='void',target_order_id=NULL,target_article_id=NULL,updated=? WHERE id=?",stamp,x.id));continue;}
  const closed=!!x.source_month&&x.source_month<month,effective=Number(x.booked_cents)+Number(x.adj);
  ops.push(stmt("UPDATE exchanges SET status='open',target_order_id=NULL,target_article_id=NULL,target_website_id=NULL,chosen_at=NULL,site_cost_cents=NULL,booked_cents=?,updated=? WHERE id=?",closed?x.booked_cents:def,stamp,x.id));
  if(closed&&effective!==def)ops.push(stmt('INSERT INTO exchange_adjustments(id,exchange_id,month,amount_cents,reason,created) VALUES (?,?,?,?,?,?)',uid(),x.id,month,def-effective,'revert',stamp));
 }
 if(ops.length)await db().batch(ops);
 // A debt is covered by the supplier's next open exchange: the order taken in return moves to it.
 const pending=await all("SELECT * FROM exchanges WHERE status IN ('open','debt') ORDER BY supplier_id,earned_at,id");
 const bySupplier=new Map<string,{open:Row[];debt:Row[]}>();for(const x of pending){const g=bySupplier.get(x.supplier_id)||{open:[],debt:[]};(x.status==='open'?g.open:g.debt).push(x);bySupplier.set(x.supplier_id,g);}
 const moves:any[]=[];
 for(const g of bySupplier.values())for(let i=0;i<Math.min(g.open.length,g.debt.length);i++){const d=g.debt[i],o=g.open[i];
  moves.push(stmt("UPDATE exchanges SET status='void',target_order_id=NULL,target_article_id=NULL,note='הכתבה בוטלה; ההחלפה עברה לפרסום הבא',updated=? WHERE id=?",stamp,d.id),
   stmt("UPDATE exchanges SET status='taken',target_order_id=?,target_article_id=?,target_website_id=?,chosen_at=?,site_cost_cents=?,booked_cents=?,updated=? WHERE id=? AND status='open'",d.target_order_id,d.target_article_id,d.target_website_id,d.chosen_at,d.site_cost_cents,d.site_cost_cents??o.booked_cents,stamp,o.id));}
 if(moves.length)await db().batch(moves);
 // Tell each supplier with an account that a new exchange is waiting (one mail per exchange).
 const created=await all(`SELECT x.id,u.id AS user_id,u.email,r.data AS supplier_data FROM exchanges x JOIN seller_profiles p ON p.supplier_id=x.supplier_id JOIN users u ON u.id=p.user_id
  JOIN records r ON r.id=x.supplier_id WHERE x.created=? AND x.status='open'`,stamp);
 for(const c of created)try{await queueMail('email:exchange-earned:'+c.id,c.user_id,{to:c.email,subject:'נוספה לכם החלפה',text:'כתבה שפרסמתם אושרה, ונוספה לכם החלפה.\nאפשר לבחור אתר לקבלת קישור בתמורה.',button:{label:'לבחירת אתר בתמורה',url:(origin||'')+'/purchased/selling?tab=exchanges'},origin});}catch{/* the exchange exists; the mail can be resent */}
 return {created:created.length,reverted:reverted.length,moved:moves.length/2};
}

// What the supplier sees: counts and pairs, never money.
export async function supplierExchanges(supplierId:string){
 const rows=await all(`SELECT x.id,x.status,x.earned_at,x.chosen_at,a.title AS source_title,a.published_url AS source_url,sw.name AS source_site,sw.url AS source_site_url,
  ta.id AS target_article_id,ta.status AS target_status,ta.published_url AS target_url,tw.name AS target_site,tw.url AS target_site_url,x.target_order_id
  FROM exchanges x LEFT JOIN articles a ON a.id=x.source_article_id LEFT JOIN websites sw ON sw.id=(SELECT website_id FROM articles WHERE id=x.source_article_id)
  LEFT JOIN articles ta ON ta.id=x.target_article_id LEFT JOIN websites tw ON tw.id=x.target_website_id
  WHERE x.supplier_id=? AND x.status<>'void' ORDER BY x.earned_at DESC,x.id DESC`,supplierId);
 const open=rows.filter(r=>r.status==='open').length,debt=rows.filter(r=>r.status==='debt').length;
 const published=rows.filter(r=>r.source_title&&r.status!=='debt').length,taken=rows.filter(r=>['taken','debt'].includes(r.status)).length;
 return {balance:open-debt,published,taken,exchanges:rows.map((r,i)=>({...r,n:rows.length-i}))};
}

// The sites a supplier may take: approved for exchanges, live, with a known cost, not its own and not another
// exchange supplier's. No prices in the answer.
export async function exchangeSites(supplierId:string){
 return (await all(`SELECT w.id,w.name,w.url,json_extract(w.data,'$.logo_url') AS logo_url,w.dr,w.category
  FROM websites w WHERE w.active=1 AND COALESCE(json_extract(w.data,'$.exchange_available'),0)=1 AND json_extract(w.data,'$.cost_cents') IS NOT NULL
   AND COALESCE(json_extract(w.data,'$.supplier_id'),'')<>? AND NOT ${exchangeSiteSql()} ORDER BY w.name`,supplierId));
}

// The supplier takes a site: one open exchange is claimed, a free order is made like a customer's, and the cost is booked.
export async function takeExchange(user:Row,b:Row,makeOrder:(q:Row,b:Row)=>Promise<Row>){
 const supplierId=await exchangeSupplierOf(user.id);assert(supplierId,'החשבון אינו של ספק החלפות',403);
 const request=String(b.request_id||'');assert(/^[\w-]{8,80}$/.test(request),'מזהה בקשה אינו תקין');
 const done=await one('SELECT target_order_id FROM exchanges WHERE claim=? OR id=(SELECT id FROM exchanges WHERE note=?)',request,'request:'+request);
 if(done?.target_order_id)return {order_id:done.target_order_id,duplicate:true};
 const [site]=await websitesById([String(b.website_id||'')]).catch(()=>[] as Row[]);
 assert(site&&(await exchangeSites(supplierId)).some((s:Row)=>s.id===site.id),'האתר אינו זמין להחלפה',409);
 await syncExchanges();
 const stamp=now();
 const claim=await stmt(`UPDATE exchanges SET status='claiming',claim=?,updated=? WHERE id=(SELECT id FROM exchanges WHERE supplier_id=? AND status='open' ORDER BY earned_at,id LIMIT 1) AND status='open'`,request,stamp,supplierId).run();
 assert(claim.meta.changes,'אין לכם כרגע החלפה פנויה לבחירה',409);
 const x=(await one("SELECT * FROM exchanges WHERE claim=? AND status='claiming'",request))!;
 let order:Row;
 try{
  const vatPercent=Number(await setting('vat',18)),version=(await one('SELECT version FROM pricing_state WHERE id=1'))?.version;
  const item={id:'exchange:'+request,website_id:site.id,name:site.name,url:site.url,quantity:1,price_cents:0,editorial_price:0,publication_price:0,topic:'כתבה בהחלפה',data:{exchange:1,exchange_request:request}};
  order=await makeOrder({items:[item],subtotal:0,discount:0,vat:0,total:0,vatPercent,pricing_version:version,coupon:null},{payment:'exchange',accepted:true,idempotency:'exchange-'+request,phone:b.phone||user.phone||'0000000000',invoice_name:user.company||user.name||'ספק'});
 }catch(e){await stmt("UPDATE exchanges SET status='open',claim=NULL,updated=? WHERE id=? AND status='claiming'",now(),x.id).run();throw e;}
 const month=israelMonth(),closed=!!x.source_month&&x.source_month<month,cost=Number(site.cost_cents);
 const effective=Number(x.booked_cents)+Number((await one('SELECT COALESCE(SUM(amount_cents),0) AS s FROM exchange_adjustments WHERE exchange_id=?',x.id))?.s||0);
 await db().batch([
  stmt(`UPDATE exchanges SET status='taken',target_order_id=?,target_article_id=(SELECT id FROM articles WHERE order_id=? ORDER BY id LIMIT 1),target_website_id=?,chosen_at=?,site_cost_cents=?,booked_cents=?,claim=NULL,note=?,updated=? WHERE id=? AND status='claiming'`,
   order.id,order.id,site.id,stamp,cost,closed?x.booked_cents:cost,'request:'+request,stamp,x.id),
  ...(closed&&cost!==effective?[stmt('INSERT INTO exchange_adjustments(id,exchange_id,month,amount_cents,reason,created) VALUES (?,?,?,?,?,?)',uid(),x.id,month,cost-effective,'chosen_after_close',stamp)]:[]),
 ]);
 await audit(user,order.id,'הזמנה בהחלפה',{exchange_id:x.id,website_id:site.id});
 return {order_id:order.id,number:order.number};
}

// Admin view of one supplier: pairs with costs, totals and this month's adjustments.
export async function adminSupplierExchanges(supplierId:string){
 const month=israelMonth(),def=await exchangeDefaultCents();
 const rows=await all(`SELECT x.*,a.title AS source_title,a.published_url AS source_url,cu.name AS customer_name,
  tw.name AS target_site,tw.url AS target_site_url,ta.status AS target_status,ta.published_url AS target_url,tor.number AS target_number,
  (SELECT COALESCE(SUM(j.amount_cents),0) FROM exchange_adjustments j WHERE j.exchange_id=x.id) AS adjustments
  FROM exchanges x LEFT JOIN articles a ON a.id=x.source_article_id LEFT JOIN users cu ON cu.id=a.user_id
  LEFT JOIN websites tw ON tw.id=x.target_website_id LEFT JOIN articles ta ON ta.id=x.target_article_id LEFT JOIN orders tor ON tor.id=x.target_order_id
  WHERE x.supplier_id=? ORDER BY x.earned_at DESC,x.id DESC`,supplierId);
 const live=rows.filter(r=>r.status!=='void'),costs=live.map(r=>Number(r.booked_cents)+Number(r.adjustments));
 const monthAdj=Number((await one('SELECT COALESCE(SUM(j.amount_cents),0) AS s FROM exchange_adjustments j JOIN exchanges x ON x.id=j.exchange_id WHERE x.supplier_id=? AND j.month=?',supplierId,month))?.s||0);
 const isExchange=!!(await one(`SELECT 1 AS y FROM records r WHERE r.id=? AND r.kind='supplier' AND (json_extract(r.data,'$.billing_default')='exchange' OR EXISTS(SELECT 1 FROM websites w WHERE json_extract(w.data,'$.supplier_id')=r.id AND ${exchangeSiteSql()}))`,supplierId));
 return {is_exchange:isExchange,default_cents:def,month,balance:live.filter(r=>r.status==='open').length-live.filter(r=>r.status==='debt').length,
  published:live.filter(r=>r.source_article_id&&r.status!=='debt').length,taken:live.filter(r=>['taken','debt'].includes(r.status)).length,
  average_cents:costs.length?Math.round(costs.reduce((s,c)=>s+c,0)/costs.length):null,month_adjustments:monthAdj,
  exchanges:rows.map((r,i)=>({...r,n:rows.length-i,estimate:r.status==='open',effective_cents:Number(r.booked_cents)+Number(r.adjustments)}))};
}

// Manual correction by the admin: +1 adds an exchange (no source article), -1 voids the newest open one.
export async function adjustExchangeBalance(u:Row,supplierId:string,b:Row){
 admin(u);const delta=Number(b.delta),note=String(b.note||'').trim().slice(0,300);assert(delta===1||delta===-1,'אפשר להוסיף או להוריד החלפה אחת בכל פעם');assert(note,'יש לכתוב סיבה');
 const stamp=now();
 if(delta===1)await stmt("INSERT INTO exchanges(id,supplier_id,earned_at,status,booked_cents,source_month,note,created,updated) VALUES (?,?,?,'open',?,?,?,?,?)",'xch-manual-'+uid(),supplierId,stamp,await exchangeDefaultCents(),israelMonth(),'ידני: '+note,stamp,stamp).run();
 else{const r=await stmt("UPDATE exchanges SET status='void',note=?,updated=? WHERE id=(SELECT id FROM exchanges WHERE supplier_id=? AND status='open' ORDER BY earned_at DESC,id DESC LIMIT 1)",'הורד ידנית: '+note,stamp,supplierId).run();assert(r.meta.changes,'אין החלפה פתוחה להורדה',409);}
 await audit(u,supplierId,delta===1?'נוספה החלפה ידנית':'הורדה החלפה ידנית',{note});
 return {ok:true};
}

// Cost fields for article queries (alias a): the cost booked on a source article, and the mark of an article
// taken in return (its cost is counted once, on the source). For purchaseCosts.
export const exchangeCostColumns=`(SELECT x.booked_cents FROM exchanges x WHERE x.source_article_id=a.id AND x.status NOT IN ('void')) AS exchange_booked_cents,
 (SELECT x.status FROM exchanges x WHERE x.source_article_id=a.id) AS exchange_source_status,
 EXISTS(SELECT 1 FROM exchanges x WHERE x.target_article_id=a.id) AS exchange_target`;
export async function exchangeAdjustmentsBetween(fromMonth:string,toMonth:string){return Number((await one('SELECT COALESCE(SUM(amount_cents),0) AS s FROM exchange_adjustments WHERE month>=? AND month<=?',fromMonth,toMonth))?.s||0);}
