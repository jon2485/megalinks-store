// Trash for abandoned orders (owner, 23.11.2026).
// POST admin/orders/trash   {ids:[...]}                        one order (or a few) chosen by the admin
// POST admin/orders/trash   {all_abandoned:true,expected:N}       every abandoned order, as counted on the screen
// POST admin/orders/restore {id}
// Only abandoned orders qualify (the same SQL as the "נזנחו" group), re-checked here inside the UPDATE itself.
// Nothing is deleted: the order keeps its rows and gets 'trashed_at'/'trashed_by' in its data.
import {all,one,parse,stmt,db,assert,admin,now} from './server';
import {adminOrderCte,trashableSql} from './admin-order-data';
import {walletAvailable} from './split-payment';
import type {Row} from './shared';

const activitySql=(action:string)=>`INSERT INTO activity(id,user_id,resource,action,data,created) SELECT lower(hex(randomblob(16))),?,value,'${action}',?,? FROM json_each(?)`;

export async function orderTrash(r:Request,p:string[],u:Row,body:(r:Request)=>Promise<Row>){
 const trash=p[0]==='admin'&&p[1]==='orders'&&p[2]==='trash'&&p.length===3,restore=p[0]==='admin'&&p[1]==='orders'&&p[2]==='restore'&&p.length===3;
 if(!trash&&!restore)return null;
 admin(u);assert(r.method==='POST','פעולה לא נתמכת',405);
 const b=await body(r),stamp=now();
 if(trash){
  const every=b.all_abandoned===true,ids=every?[]:[...new Set((Array.isArray(b.ids)?b.ids:[]).map(String))].filter(Boolean);
  assert(every||(ids.length>0&&ids.length<=200),'לא נבחרו הזמנות להעברה לפח');
  const scope=every?'':' AND id IN (SELECT value FROM json_each(?))',scopeArgs=every?[]:[JSON.stringify(ids)];
  // One read for the answer and the checks, one transaction for the move and its log lines.
  const eligible=await all(`WITH ${adminOrderCte()} SELECT id,number FROM classified WHERE ${trashableSql}${scope} ORDER BY created`,...scopeArgs);
  if(every){assert(eligible.length>0,'אין כרגע הזמנות שנזנחו',409);assert(Number(b.expected)===eligible.length,'רשימת ההזמנות שנזנחו השתנתה. יש לרענן ולנסות שוב',409);}
  else if(eligible.length!==ids.length){
   const refused=await all('SELECT number FROM orders WHERE id IN (SELECT value FROM json_each(?)) AND id NOT IN (SELECT value FROM json_each(?))',JSON.stringify(ids),JSON.stringify(eligible.map(o=>o.id)));
   assert(false,'רק הזמנה שנזנחה (לא שולמה, בלי דיווח תשלום ובלי בקשת ביטול, מעל 14 ימים) עוברת לפח'+(refused.length?': '+refused.map(o=>o.number).join(', '):''),409);
  }
  const list=JSON.stringify(eligible.map(o=>o.id)),note=JSON.stringify({by:u.name||u.email||u.id});
  // The UPDATE re-checks eligibility itself, so an order paid or reported a moment ago is never moved.
  const moved=`(SELECT id FROM classified WHERE ${trashableSql} AND id IN (SELECT value FROM json_each(?)))`;
  await db().batch([
   stmt(`WITH ${adminOrderCte()} ${activitySql('הועברה לפח')} WHERE value IN ${moved}`,u.id,note,stamp,list,list),
   stmt(`WITH ${adminOrderCte()} UPDATE orders SET data=json_set(data,'$.trashed_at',?,'$.trashed_by',?),updated=? WHERE id IN ${moved}`,stamp,u.id,stamp,list),
  ]);
  const done=await all("SELECT id,number FROM orders WHERE id IN (SELECT value FROM json_each(?)) AND json_extract(data,'$.trashed_at')=?",list,stamp);
  return {ok:true,trashed:done.length,orders:done};
 }
 const id=String(b.id||'');assert(id,'לא נבחרה הזמנה לשחזור');
 const raw=await one('SELECT * FROM orders WHERE id=?',id);assert(raw,'ההזמנה לא נמצאה',404);const order=parse(raw)!;
 assert(order.trashed_at,'ההזמנה אינה בפח',409);
 // A split order reserves part of the customer's balance. The reservation is released while the order is in the
 // trash, so it comes back only if that money is still free.
 if(order.payment==='credits_card'&&!order.paid){
  const user=await one('SELECT * FROM users WHERE id=?',order.user_id),wallet=Number(order.wallet_amount||0);
  assert(user&&(await walletAvailable(user))>=wallet,'אי אפשר לשחזר: הלקוח כבר השתמש ביתרה ששוריינה להזמנה הזו',409);
 }
 await db().batch([
  stmt(activitySql('שוחזרה מהפח')+" WHERE value IN (SELECT id FROM orders WHERE id=? AND COALESCE(json_extract(data,'$.trashed_at'),'')<>'')",u.id,JSON.stringify({by:u.name||u.email||u.id}),stamp,JSON.stringify([id]),id),
  stmt("UPDATE orders SET data=json_remove(data,'$.trashed_at','$.trashed_by'),updated=? WHERE id=? AND COALESCE(json_extract(data,'$.trashed_at'),'')<>''",stamp,id),
 ]);
 return {ok:true,restored:1,order:{id,number:order.number}};
}
