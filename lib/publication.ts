import {canWorkOrder} from './payment-state';
import {articleGuard} from './monthly-order';
import {sendQueuedMail} from './mail';
import {one,stmt,parse,db,now,assert,audit,uid,hash} from './server';
import {Row} from './shared';
import {futureArticleDate} from './scheduled-approval';
export function supplierSequenceLabel(sequence:number,total:number|null){return total===null?`כתבה מספר ${sequence}`:`כתבה ${sequence} מתוך ${total}`;}
// Allocate a number, consume capacity and create the portal/email jobs in one
// transaction. The article is the idempotency key; reminders never allocate.
export async function dispatchArticle(article:Row,actor:Row,origin:string){
 assert(!futureArticleDate(article),'טרם הגיע מועד הכתבה לאישור ולמסירה לספק',409);
 assert(!article.cancel_pending&&!article.publication_refunded&&article.status!=='cancelled','הכתבה בביטול ואינה זמינה לפרסום',409);
 const id='publication:'+article.id;
 let job=await one('SELECT * FROM jobs WHERE id=?',id);
 if(job&&['succeeded','demo','writing','completed','demo_completed'].includes(job.status))return parse(job);
 const order=parse(await one('SELECT * FROM orders WHERE id=?',article.order_id))!;
 assert(canWorkOrder(order),'ההזמנה אינה זמינה לפרסום');
 const w=parse(await one('SELECT * FROM websites WHERE id=?',article.website_id))!;
 const supplier=w.supplier_id?parse(await one('SELECT * FROM records WHERE id=? AND kind=?',w.supplier_id,'supplier')):null;
 const email=String(w.supplier_email||supplier?.email||'').trim().toLowerCase(),demo=order.demo?1:0;
 const data:Row={article_id:article.id,website_id:w.id,website_name:w.name,title:article.title,supplier_id:supplier?.id||w.supplier_id||'',supplier_name:supplier?.name||email,recipient_email:email,demo:!!demo};
 const stamp=now();
 if(!job)await stmt('INSERT OR IGNORE INTO jobs(id,user_id,kind,status,data,created,updated) VALUES (?,?,?,?,?,?,?)',id,article.user_id,'supplier_publication','requested',JSON.stringify(data),stamp,stamp).run();
 const claim=await stmt("UPDATE jobs SET status='writing',data=?,updated=? WHERE id=? AND status IN ('requested','blocked','failed')",JSON.stringify(data),stamp,id).run();
 if(!claim.meta.changes)return parse(await one('SELECT * FROM jobs WHERE id=?',id));
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||(!demo&&!w.procurement_verified)){
  data.error=!email?'יש להזין מייל לספק':!demo&&!w.procurement_verified?'יש לאמת את הסכם הפרסום באתר':'מייל הספק אינו תקין';
  await stmt("UPDATE jobs SET status='blocked',data=?,updated=? WHERE id=?",JSON.stringify(data),now(),id).run();return {...data,status:'blocked'};
 }
 const token=demo?'':uid()+uid(),link=demo?origin+'/supplier-workspace':origin+'/supplier/'+token;
 const mailId='email:supplier:'+article.id,mail={to:email,subject:'',text:'',button:{label:'דיווח על פרסום',url:link},attach_article:article.id,demo:!!demo};
 try{
  const statements=[articleGuard(article),
   // Existing deliveries seed the counter once, so adding this feature does
   // not restart a site's previously sent article count at zero.
   stmt(`INSERT OR IGNORE INTO supplier_dispatch_counters(website_id,demo,sent_count) SELECT ?,?,COUNT(*) FROM jobs j JOIN articles a ON a.id=json_extract(j.data,'$.article_id') WHERE j.kind='supplier_publication' AND j.status IN ('succeeded','demo','completed','demo_completed') AND a.website_id=? AND COALESCE(json_extract(j.data,'$.demo'),0)=?`,w.id,demo,w.id,demo),
   stmt(`INSERT OR IGNORE INTO supplier_dispatch_allocations(article_id,website_id,demo,sequence,stock_total,supplier_email,created) SELECT ?,c.website_id,c.demo,c.sent_count+1,json_extract(w.data,'$.stock_total'),?,? FROM supplier_dispatch_counters c JOIN websites w ON w.id=c.website_id JOIN articles a ON a.website_id=w.id WHERE a.id=? AND a.status='approved' AND c.website_id=? AND c.demo=? AND (json_extract(w.data,'$.stock_total') IS NULL OR c.sent_count<CAST(json_extract(w.data,'$.stock_total') AS INTEGER))`,article.id,email,stamp,article.id,w.id,demo),
   stmt('UPDATE supplier_dispatch_counters SET sent_count=sent_count+1 WHERE website_id=? AND demo=? AND EXISTS(SELECT 1 FROM supplier_dispatch_allocations a WHERE a.article_id=? AND a.sequence=sent_count+1)',w.id,demo,article.id),
   stmt(`UPDATE jobs SET status=?,data=json_set(?,'$.delivery','supplier_portal','$.supplier_sequence',(SELECT sequence FROM supplier_dispatch_allocations WHERE article_id=?),'$.supplier_stock_total',(SELECT stock_total FROM supplier_dispatch_allocations WHERE article_id=?)),updated=? WHERE id=? AND EXISTS(SELECT 1 FROM supplier_dispatch_allocations WHERE article_id=?)`,demo?'demo':'succeeded',JSON.stringify(data),article.id,article.id,stamp,id,article.id),
   stmt(`UPDATE articles SET status='sent',version=version+1,updated=?,data=json_set(data,'$.supplier_id',?,'$.supplier_name',?,'$.supplier_email',?,'$.supplier_sequence',(SELECT sequence FROM supplier_dispatch_allocations WHERE article_id=?),'$.supplier_stock_total',(SELECT stock_total FROM supplier_dispatch_allocations WHERE article_id=?)) WHERE id=? AND status='approved' AND EXISTS(SELECT 1 FROM supplier_dispatch_allocations WHERE article_id=?)`,stamp,data.supplier_id,data.supplier_name,email,article.id,article.id,article.id,article.id),
   stmt(`INSERT OR IGNORE INTO jobs(id,user_id,kind,status,data,created,updated) SELECT ?,?,'email','requested',json_set(?,'$.subject',?,'$.text',?),?,? FROM supplier_dispatch_allocations WHERE article_id=?`,mailId,article.user_id,JSON.stringify(mail),'מאמר חדש לפרסום: '+article.title,article.title+'\nאתר: '+w.name,stamp,stamp,article.id)
  ];
  if(!demo)statements.push(stmt(`INSERT INTO tokens(id,hash,kind,user_id,resource,expires,used) SELECT ?,?,'supplier',?,?,?,0 WHERE EXISTS(SELECT 1 FROM supplier_dispatch_allocations WHERE article_id=?)`,uid(),await hash(token),actor.id,article.id,new Date(Date.now()+30*86400000).toISOString(),article.id));
  await db().batch(statements);
 }catch(e){await stmt("UPDATE jobs SET status='failed',data=json_set(data,'$.error',?),updated=? WHERE id=? AND status='writing'",'המסירה לא הושלמה; אפשר לנסות שוב',now(),id).run();throw e;}
 const allocation=await one('SELECT * FROM supplier_dispatch_allocations WHERE article_id=?',article.id);
 if(!allocation){data.error='מלאי הפרסומים באתר הסתיים, או שהכתבה אינה מאושרת. הגדילו את סה״כ המלאי ונסו שוב.';await stmt("UPDATE jobs SET status='blocked',data=?,updated=? WHERE id=?",JSON.stringify(data),now(),id).run();return {...data,status:'blocked'};}
 await sendQueuedMail(mailId);
 await audit(actor,article.id,demo?'הכתבה הועברה לתור הדגמה של הספק':'הכתבה הועברה אוטומטית לפורטל הספק',{supplier_name:data.supplier_name,supplier_sequence:allocation.sequence,stock_total:allocation.stock_total});
 return parse(await one('SELECT * FROM jobs WHERE id=?',id));
}
