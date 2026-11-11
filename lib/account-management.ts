import {releaseSlotStatements} from './supplier-stock';
import {completeOrderPayment} from './split-payment';
import {dispatchStockWaiting} from './scheduled-dispatch';
import {closeOrderForStatement,orderStatementId,prepareOrderStatement,refreshOrderStatement,renderOrderStatementPdf} from './order-statement';
import {paymentEvidenceRows,orderPaymentEvidence} from './payment-evidence';
import {orderSummarySql} from './order-summary';
import type {Row} from './shared';
import {db,stmt,one,all,parse,admin,assert,now,uid,hash,setting,website,ApiError} from './server';
import {pricingContext,pricedSite,pricingVersion,warnPricing} from './pricing';
import {minimumWarning} from './pricing-rules';
import {businessMonth} from './monthly';
import {openMonthlyOrder,lastClosedMonthlyOrder,financialGuard,orderGuard,articleGuard} from './monthly-order';
import {createOrder} from './order-create';
import {articleAmounts,refundAmounts} from './order-finance';
import {statementData,statementId} from './monthly-statement';
import {approveOrderCancel} from './cancel-request';
// A refund after the month was closed must also change the summary the customer sees for that month.
async function refreshClosedMonth(userId:string,month:string,demo:boolean){const id=statementId(userId,month,demo),saved=parse(await one('SELECT * FROM records WHERE id=?',id));if(!saved?.summary)return;const summary=await statementData(userId,month,demo);await stmt("UPDATE records SET data=json_set(data,'$.summary',json(?)),updated=? WHERE id=?",JSON.stringify({...summary,closed_at:saved.summary.closed_at}),now(),id).run();}
const res=(v:any)=>Response.json(v,{headers:{'Cache-Control':'no-store'}});
async function managerQuote(target:Row,b:Row){assert(Array.isArray(b.items)&&b.items.length&&b.items.length<=50,'יש לבחור בין אתר אחד ל־50 אתרים');const context=await pricingContext(target.id),version=await pricingVersion(),items=[];
 for(const [i,x] of b.items.entries()){const w=await one('SELECT * FROM websites WHERE id=? AND active=1',x.website_id);assert(w,'האתר אינו זמין');const site=pricedSite(w,context,true),quantity=Number(x.quantity||1);assert(Number.isSafeInteger(quantity)&&quantity>=1&&quantity<=20,'כמות אינה תקינה');const words=Number(x.editorial_words||400);assert(Number.isSafeInteger(words)&&words>=100&&words<=5000,'כמות מילים אינה תקינה');const editorial=x.editorial===true,editorialPrice=editorial?words*15:0;const brief={editorial,editorial_words:words,topic:String(x.topic||'כתבה עבור '+w.name).slice(0,500),customer_id:''};items.push({id:'admin:'+i,website_id:w.id,name:w.name,quantity,topic:brief.topic,editorial,data:brief,website:site,publication_price:site.price_cents,editorial_price:editorialPrice,price_cents:site.price_cents+editorialPrice});}
 assert(version===await pricingVersion(),'המחירים השתנו; יש לרענן',409);const subtotal=items.reduce((n,x)=>n+x.price_cents*x.quantity,0),vatPercent=Number(await setting('vat',18)),vat=Math.round(subtotal*vatPercent/100);return {items,subtotal,discount:0,vat,total:subtotal+vat,vatPercent,pricing_version:version,pricing_token:await hash(JSON.stringify(items.map(x=>[x.website_id,x.quantity,x.price_cents,x.data]))+':'+vat)};
}
export async function accountManagementRoutes(r:Request,p:string[],actor:Row){
 if(p[0]==='monthly-open'&&r.method==='GET'){const account=await one('SELECT * FROM credit_accounts WHERE user_id=?',actor.id);assert(account?.enabled,'החשבון אינו מאושר לחשבון חודשי',403);return res({month:businessMonth(),order:await openMonthlyOrder(actor.id,new URL(r.url).searchParams.get('demo')==='1'),closed_order:await lastClosedMonthlyOrder(actor.id,new URL(r.url).searchParams.get('demo')==='1'),account});}
 if(p[0]!=='admin'||p[1]!=='customer-account')return null;admin(actor);
 const target=await one('SELECT * FROM users WHERE id=?',p[2]);assert(target,'הלקוח לא נמצא',404);const action=p[3];
 if(action==='order-statement'){
  if(r.method==='GET'){
   const order=await one('SELECT * FROM orders WHERE id=? AND user_id=?',p[4],target.id);assert(order,'ההזמנה לא נמצאה אצל לקוח זה',404);const preview=new URL(r.url).searchParams.get('preview');
   if(preview){assert(preview==='1'||preview==='pdf','תצוגה אינה תקינה');const result=await prepareOrderStatement(target.id,order.id,order.total,actor.id,new URL(r.url).origin);
    if(preview==='pdf'){const bytes=await renderOrderStatementPdf(result.summary,new URL(r.url).origin);return new Response(new Uint8Array(bytes).buffer,{headers:{'Content-Type':'application/pdf','Content-Disposition':'inline; filename="MegaLinks-order-preview.pdf"','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});}
    return res({summary:result.summary,preview:true});
   }
   const saved=parse(await one('SELECT * FROM records WHERE id=?',orderStatementId(p[4])));assert(saved?.summary,'יש להפיק ולסגור את ההזמנה תחילה',409);return res({summary:saved.summary});
  }
  assert(r.method==='POST','פעולה לא נתמכת',405);const input:any=await r.json();assert(input.confirmed===true,'יש לאשר סגירת ההזמנה לרכישות נוספות');return res(await closeOrderForStatement(target.id,p[4],input.expected_amount,actor.id,new URL(r.url).origin));
 }


 if(r.method==='GET'){
  const orders=(await all(`SELECT o.*,${orderSummarySql()},c.month,c.settled FROM orders o LEFT JOIN monthly_charges c ON c.order_id=o.id WHERE o.user_id=? ORDER BY o.created DESC LIMIT 1000`,target.id)).map(parse);
  const receipts=await paymentEvidenceRows(target.id);for(const order of orders){if(order)order.payment_confirmation=orderPaymentEvidence(order,receipts);}
  const articles=(await all('SELECT a.*,w.name AS website_name,w.url AS website_url,o.number,json_extract(o.data,"$.vat_percent") AS order_vat_percent FROM articles a LEFT JOIN websites w ON w.id=a.website_id JOIN orders o ON o.id=a.order_id WHERE a.user_id=? ORDER BY a.updated DESC LIMIT 3000',target.id)).map(parse);
  const history=(await all('SELECT a.*,u.name AS actor FROM activity a JOIN users u ON u.id=a.user_id WHERE resource IN (SELECT id FROM orders WHERE user_id=? UNION SELECT id FROM articles WHERE user_id=? UNION SELECT ?) ORDER BY a.created DESC LIMIT 300',target.id,target.id,target.id)).map(parse);
  const pricing=await pricingContext(target.id);return res({customer:target,account:await one('SELECT * FROM credit_accounts WHERE user_id=?',target.id),orders,articles,history,tier:pricing.tier,open_order:await openMonthlyOrder(target.id),websites:(await all('SELECT * FROM websites WHERE active=1 ORDER BY name')).map(w=>{const x=pricedSite(w,pricing);return {id:x.id,name:x.name,url:x.url,price_cents:x.price_cents,dr:x.dr??null,category:x.category||'',logo_url:(x as Row).logo_url||''};})});
 }
 assert(r.method==='POST','פעולה לא נתמכת',405);const b:any=await r.json();
 if(action==='quote')return res(await managerQuote(target,b));
 if(action==='create-order'){assert(/^[a-zA-Z0-9-]{10,100}$/.test(b.idempotency||''),'מזהה בקשה לא תקין');const prior=await one('SELECT data FROM records WHERE id=?','purchase:'+target.id+':'+b.idempotency);if(prior)return res(JSON.parse(prior.data));const q=await managerQuote(target,b);assert(b.pricing_token===q.pricing_token&&b.expected_total===q.total,'המחירים השתנו; חשבו שוב את ההזמנה',409);assert(b.payment==='monthly','הזמנה בשם לקוח נרשמת לחשבון חודשי מאושר');return res(await createOrder(target,actor,q,{...b,admin_order:true}));}
 const raw=await one('SELECT * FROM articles WHERE id=? AND user_id=?',b.article_id,target.id);assert(raw,'הכתבה לא נמצאה אצל לקוח זה',404);const a=parse(raw)!,order=parse(await one('SELECT * FROM orders WHERE id=?',a.order_id))!;
 assert(Number(b.version)===a.version,'הכתבה השתנתה; יש לרענן לפני הפעולה',409);
 const reason=String(b.reason||'').trim().slice(0,1500);const stamp=now(),event=uid(),ops:any[]=[financialGuard(target),orderGuard(order),articleGuard(a)];
 if(action==='refund'){
  assert(['publication','full'].includes(b.mode),'יש לבחור סוג זיכוי');assert(order.status!=='cancelled','ההזמנה כבר בוטלה',409);
  const amount=refundAmounts(a,b.mode);assert(amount.publication||amount.writing,'החלקים שבחרתם כבר זוכו',409);
  if(['sent','published'].includes(a.status)||a.cancel_pending){if(b.supplier_stopped!==true){assert(!a.cancel_pending,'בקשת הביטול כבר ממתינה לאישור ספק',409);ops.push(stmt("UPDATE articles SET data=json_set(data,'$.cancel_pending',1,'$.cancel_reason',?,'$.cancel_mode',?),updated=? WHERE id=?",reason,b.mode,stamp,a.id));ops.push(stmt('INSERT INTO activity(id,user_id,resource,action,data,created) VALUES (?,?,?,?,?,?)',event,actor.id,a.id,'ביטול ממתין לאישור עצירת פרסום',JSON.stringify({customer_id:target.id,reason}),stamp));await db().batch(ops);return res({ok:true,pending:true});}}
  const charge=await one('SELECT * FROM monthly_charges WHERE order_id=?',order.id),open=!order.paid&&!charge?.settled;
  const destination=open?'unpaid':order.demo?'demo':b.destination==='external'?'external':'wallet',refundNote=String(b.refund_note||'').trim().slice(0,1500);
  assert(destination!=='external'||refundNote.length>=3,'יש לפרט כיצד ומתי הוחזר הכסף מחוץ למערכת');
  // The customer already reported paying, so the manager decides what happens to the difference. Nothing is credited unless chosen.
  const reportId='payment-report:'+order.id,reported=open&&!order.demo?await one("SELECT id FROM records WHERE id=? AND json_extract(data,'$.status')='pending'",reportId):null,overpaid=reported?String(b.overpaid_action||''):'',overpaidNote=overpaid==='manual'?String(b.overpaid_note||'').trim().slice(0,1500):'';
  // Owner decision 11.11.2026: no wallet credit before the bank was checked. Approve the report first, then cancel and credit.
  assert(overpaid!=='credit','אי אפשר לזכות קרדיט לפני שהתשלום אושר. אשרו קודם את דיווח התשלום, ואז בטלו את הפריט וזכו את הלקוח.',409);assert(!reported||['manual','none'].includes(overpaid),'יש לבחור מה לעשות בהפרש');assert(overpaid!=='manual'||overpaidNote.length>=3,'יש לפרט מה נעשה בהפרש');
  // The article is already live: the admin decides at this point whether the supplier is still paid for it
  // (owner decision 11.11.2026). Usually a supplier who agreed to take it down is not paid.
  const live=a.status==='published'&&amount.publication,keepSupplier=live&&b.supplier_payment==='keep';
  assert(!live||['keep','remove'].includes(b.supplier_payment),'הכתבה כבר עלתה. יש לבחור אם להשאיר את התשלום לספק',400);
  const refundEntry={at:stamp,amount:open?0:amount.gross,removed_amount:open?amount.gross:0,destination,note:refundNote,reason,actor_id:actor.id,mode:b.mode,previous_status:a.status,...(live?{supplier_payment:keepSupplier?'keep':'remove'}:{}),...(overpaid?{overpaid_action:overpaid,overpaid_note:overpaidNote}:{})};

  const d={...a.data,publication_refunded:!!a.publication_refunded||amount.publication,writing_refunded:!!a.writing_refunded||amount.writing,refund_total:Number(a.refund_total||0)+amount.gross,refund_net:Number(a.refund_net||0)+amount.net,refund_reason:reason,refunded_at:stamp,refund_destination:destination,refund_note:refundNote,refund_history:[...(a.refund_history||[]),refundEntry],cancel_pending:false,...(live?{supplier_cost_kept:keepSupplier}:{})};
  // Cancelled before publication, or after it when the supplier is not paid: the slot goes back to the site's
  // stock and the supplier link stops working. A live article whose supplier payment is kept keeps its slot.
  if(amount.publication&&!keepSupplier)ops.push(...releaseSlotStatements(a.id,actor.id,reason));
  ops.push(stmt("UPDATE articles SET status='cancelled',data=?,updated=? WHERE id=?",JSON.stringify(d),stamp,a.id));
  const net=amount.net,gross=amount.gross;
  // An unpaid item leaves the order with its share of the coupon too: the price before the discount comes off the
  // subtotal and the item's discount comes off the order discount, so "מחיר רגיל / חיסכון" stay true.
  const paidNet=Number(a.paid_net_amount||0),unit=Number(a.unit_price||0),listNet=paidNet>0&&unit>paidNet?Math.round(unit*net/paidNet):net;
  if(open){if(charge){const col=charge.demo?'demo_balance':'balance';ops.push(stmt(`UPDATE credit_accounts SET ${col}=${col}-? WHERE user_id=?`,gross,target.id),stmt('UPDATE monthly_charges SET amount=CASE WHEN settled=0 THEN amount-? ELSE NULL END WHERE order_id=?',gross,order.id));}ops.push(stmt("UPDATE orders SET subtotal=subtotal-?,discount=MAX(0,discount-?),vat=vat-?,total=total-?,data=json_set(data,'$.refund_total',COALESCE(json_extract(data,'$.refund_total'),0)+?,'$.original_total',COALESCE(json_extract(data,'$.original_total'),total)),updated=? WHERE id=?",listNet,listNet-net,gross-net,gross,gross,stamp,order.id));}
  else{ops.push(stmt("UPDATE orders SET data=json_set(data,'$.refund_total',COALESCE(json_extract(data,'$.refund_total'),0)+?,'$.paid_refund_total',COALESCE(json_extract(data,'$.paid_refund_total'),0)+?),updated=? WHERE id=?",gross,gross,stamp,order.id));if(!order.demo&&destination==='wallet')ops.push(stmt('INSERT INTO ledger(id,user_id,amount,reason,reference,created) VALUES (?,?,?,?,?,?)',uid(),target.id,gross,'זיכוי '+order.number+' · '+reason,'article-refund:'+a.id+':'+(amount.publication?'publication':'writing')+':'+b.mode,stamp),stmt('UPDATE users SET credits=credits+? WHERE id=?',gross,target.id));}
  // Wallet + card order that is still unpaid: the card part shrinks first, then the reserved wallet part,
  // so the payment link and the callback check ask for exactly what is left (owner, 11.11.2026).
  const split=open&&order.payment==='credits_card',leftTotal=Number(order.total)-gross,cardNext=split?Math.max(0,Number(order.card_amount||0)-gross):0,walletNext=split?Math.max(0,leftTotal-cardNext):0;
  if(split)ops.push(stmt("UPDATE orders SET data=json_set(data,'$.card_amount',?,'$.wallet_amount',?) WHERE id=?",cardNext,walletNext,order.id));
  if(open&&charge)ops.push(stmt("UPDATE records SET data=json_set(data,'$.amount',(SELECT COALESCE(SUM(amount),0) FROM monthly_charges WHERE user_id=? AND month=? AND demo=?)) WHERE id=?",target.id,charge!.month,charge!.demo,'monthly:'+charge!.month+':'+target.id+':'+charge!.demo));
  // A cancelled item only lowers what is due: the rest of the order and its pending report stay valid.
  // The report is closed only when nothing is left to pay, or for a split payment whose card part is fixed.
  const nextDue=(charge&&!charge.settled?Number(charge.amount):Number(order.total))-gross;
  if(open)ops.push(nextDue>0&&order.payment!=='credits_card'
   ?stmt("UPDATE records SET data=json_set(data,'$.reported_amount_cents',COALESCE(json_extract(data,'$.reported_amount_cents'),json_extract(data,'$.amount_cents')),'$.amount_cents',?,'$.amount_updated_at',?),updated=? WHERE id=? AND json_extract(data,'$.status')='pending'",nextDue,stamp,stamp,'payment-report:'+order.id)
   :stmt("UPDATE records SET data=json_set(data,'$.status','rejected','$.decision_note',?,'$.handled_at',?),updated=? WHERE id=? AND json_extract(data,'$.status')='pending'",nextDue>0?'פריט בוטל וסכום ההזמנה עודכן; יש לדווח מחדש':'כל פריטי ההזמנה בוטלו',stamp,stamp,'payment-report:'+order.id));
  if(overpaid==='manual')ops.push(stmt("UPDATE records SET data=json_set(data,'$.overpaid_note',?),updated=? WHERE id=?",overpaidNote,stamp,reportId));
  // Two independent claims: publication first, writing later can be refunded once each.
  for(const component of [amount.publication?'publication':'',amount.writing?'writing':''].filter(Boolean))ops.push(stmt('INSERT INTO records(id,kind,user_id,data,created,updated) VALUES (?,?,?,?,?,?)','refund:'+a.id+':'+component,'article_refund',target.id,JSON.stringify({order_id:order.id,...refundEntry,component}),stamp,stamp));
  ops.push(stmt('INSERT INTO activity(id,user_id,resource,action,data,created) VALUES (?,?,?,?,?,?)',event,actor.id,a.id,'כתבה בוטלה וזוכתה',JSON.stringify({customer_id:target.id,reason,mode:b.mode,amount:gross,destination,demo:!!order.demo,overpaid_action:overpaid||undefined,overpaid_note:overpaidNote||undefined}),stamp));await db().batch(ops);await refreshOrderStatement(order.id);
  // Nothing is left for the card: the reserved wallet part alone settles the order.
  if(split&&cardNext===0&&leftTotal>0){const fresh=await one('SELECT * FROM orders WHERE id=?',order.id);if(fresh&&!fresh.paid)await completeOrderPayment(fresh,'payment:wallet-only:'+order.id,{amount_cents:0,payment_method:'credits',reference:'יתרה שמורה',payment_date:stamp}).catch(()=>undefined);}
  // The freed stock slot goes at once to the oldest approved article that was waiting for stock on this site.
  if(amount.publication&&!keepSupplier)await dispatchStockWaiting(new URL(r.url).origin,a.website_id).catch(()=>undefined);
  if(charge)await refreshClosedMonth(target.id,charge.month,!!charge.demo);await approveOrderCancel(order,actor,reason,new URL(r.url).origin,a.id);return res({ok:true,amount:gross,destination:open?(charge?'monthly':'unpaid'):destination,...(overpaid?{overpaid_action:overpaid}:{}),...(!order.demo&&(!open&&destination==='wallet'||overpaid==='credit')?{wallet_balance:(await one('SELECT credits FROM users WHERE id=?',target.id))?.credits}:{})});
 }
 if(action==='price'){
  if(b.order_id)assert(b.order_id===order.id,'הפריט אינו שייך להזמנה הזו',409);
  if(b.expected_total!==undefined)assert(b.expected_total===order.total,'סכום ההזמנה השתנה. יש לרענן לפני שינוי המחיר',409);
  assert(!await one("SELECT id FROM records WHERE id=? AND json_extract(data,'$.status') IN ('pending','approved')",'payment-report:'+order.id),'קיים דיווח תשלום להזמנה. יש לטפל בו לפני שינוי המחיר',409);
  assert(!a.publication_refunded&&!a.cancel_pending,'לא ניתן לערוך מחיר של פרסום שבוטל',409);assert(!['card','credits_card'].includes(order.payment),'יש לבטל תשלום משולב ממתין וליצור הזמנה חדשה לפני שינוי מחיר',409);assert(!order.paid&&!order.invoice_file_id&&!order.purchase_closed_at,'הזמנה ששולמה או הופק לה מסמך אינה ניתנת לשינוי מחיר',409);
  const charge=await one('SELECT * FROM monthly_charges WHERE order_id=?',order.id);assert(!charge?.settled,'החשבון החודשי כבר שולם',409);if(charge)assert(!await one('SELECT id FROM records WHERE id=?','monthly:'+charge.month+':'+target.id+':'+charge.demo),'לא ניתן לשנות מחיר לאחר סגירת החודש',409);
  const price=Math.round(Number(b.price_ils)*100);assert(b.price_ils!==''&&Number.isSafeInteger(price)&&price>=0&&price<=100000000,'מחיר לא תקין');const site=await website(a.website_id,true);warnPricing([minimumWarning(site.name,price,site.cost_cents)],b.acknowledge);
  const old=articleAmounts(a),newGross=Math.round(price*(1+Number(order.vat_percent??18)/100)),deltaNet=price-old.publicationNet,deltaGross=newGross-old.publicationGross;
  const d={...a.data,publication_price:price,unit_price:price+Number(a.editorial_price||0),paid_net_amount:price+old.writingNet,paid_amount:newGross+old.writingGross,writing_net_amount:old.writingNet,writing_gross_amount:old.writingGross,price_reason:reason,price_history:[...(a.price_history||[]),{at:stamp,before:old.publicationNet,after:price,actor_id:actor.id,reason}]};
  ops.push(stmt('UPDATE articles SET data=?,updated=? WHERE id=?',JSON.stringify(d),stamp,a.id),stmt('UPDATE orders SET subtotal=subtotal+?,vat=vat+?,total=total+?,updated=? WHERE id=?',deltaNet,deltaGross-deltaNet,deltaGross,stamp,order.id));
  if(charge){const col=charge.demo?'demo_balance':'balance';ops.push(stmt(`UPDATE credit_accounts SET ${col}=${col}+? WHERE user_id=?`,deltaGross,target.id),stmt('UPDATE monthly_charges SET amount=CASE WHEN settled=0 THEN amount+? ELSE NULL END WHERE order_id=?',deltaGross,order.id));}
  if(charge)ops.push(stmt("UPDATE records SET data=json_set(data,'$.amount',(SELECT COALESCE(SUM(amount),0) FROM monthly_charges WHERE user_id=? AND month=? AND demo=?)) WHERE id=?",target.id,charge.month,charge.demo,'monthly:'+charge.month+':'+target.id+':'+charge.demo));
  ops.push(stmt('INSERT INTO activity(id,user_id,resource,action,data,created) VALUES (?,?,?,?,?,?)',event,actor.id,a.id,'מחיר הפרסום בהזמנה עודכן',JSON.stringify({customer_id:target.id,before:old.publicationNet,after:price,reason}),stamp));await db().batch(ops);return res({ok:true});
 }
 throw new ApiError(404,'הפעולה לא נמצאה');
}
