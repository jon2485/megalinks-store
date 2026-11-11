import {env} from 'cloudflare:workers';
import {orderCloseEmail} from './order-close-email';
import {one,all,parse,assert,stmt,db,now,uid,setting} from './server';
import type {Row} from './shared';
import {financialGuard,orderGuard} from './monthly-order';
import {orderSummarySql} from './order-summary';
import {effectiveOrderAmounts,remainingArticleNet,orderCancellation} from './order-finance';
export const orderStatementId=(orderId:string)=>'order-statement:'+orderId;
const statementItems=(articles:any[],order:any)=>articles.map(a=>({id:a.id,name:a.website_name||a.data?.website_name||'אתר שנרכש',url:a.data?.website_url||a.website_url||'',date:a.purchased_at||order.created,order_number:order.number,title:a.title||a.topic||'',net:remainingArticleNet(a,order),cancelled:!!(a.publication_refunded||a.writing_refunded||orderCancellation(order)==='full'),reason:a.refund_reason||''}));
// The PDF prints the bank details the admin saved in settings (the same ones the screens show).
// The fixed details stay only as a fallback for a system where none were saved yet.
async function statementBank(){
 const saved=await setting('bank_details',null) as Row|null;
 if(saved?.account&&saved?.holder)return {name:[saved.bank_name,saved.bank_number&&'('+saved.bank_number+')'].filter(Boolean).join(' '),branch:String(saved.branch||''),account:String(saved.account),beneficiary:String(saved.holder)};
 return {name:'בנק פאג״י - פועלי אגודת ישראל',branch:'174',account:'064314',beneficiary:'גרינטק - מגלינקס'};
}
export async function prepareOrderStatement(userId:string,orderId:string,expected:number,actorId:string,origin:string){
 const raw=await one(`SELECT o.*,${orderSummarySql()},(SELECT settled FROM monthly_charges c WHERE c.order_id=o.id) AS settled FROM orders o WHERE o.id=? AND o.user_id=?`,orderId,userId);assert(raw,'ההזמנה לא נמצאה אצל לקוח זה',404);
 const saved=parse(await one('SELECT * FROM records WHERE id=?',orderStatementId(orderId)));if(saved?.summary)return {already_closed:true,summary:saved.summary,target:await one('SELECT * FROM users WHERE id=?',userId),operations:[]};
 const order=parse(raw)!,amounts=effectiveOrderAmounts(order);assert(Number.isSafeInteger(expected)&&expected===amounts.total,'סכום ההזמנה השתנה. יש לרענן לפני הפקת PDF',409);
 const target=await one('SELECT * FROM users WHERE id=?',userId);assert(target,'הלקוח לא נמצא',404);
 const articles=(await all('SELECT a.*,w.name AS website_name,w.url AS website_url FROM articles a LEFT JOIN websites w ON w.id=a.website_id WHERE a.order_id=? ORDER BY a.updated,a.id',orderId)).map(a=>parse(a)!);assert(articles.length,'אין פריטים בהזמנה',409);
 const stamp=now(),summary={document_type:'order',order_id:order.id,order_number:order.number,order_date:order.created,order_type:order.on_account||order.payment==='monthly'?'monthly':'regular',month:order.billing_month||order.created.slice(0,7),closed_at:stamp,demo:!!order.demo,vat_percent:order.vat_percent??18,paid:!!(order.paid||order.settled),customer:{id:target.id,name:target.name,company:target.company,email:target.email},items:statementItems(articles,order),...amounts,bank:await statementBank()};
 const operations=[orderGuard(raw),stmt("UPDATE orders SET data=json_set(data,'$.purchase_closed_at',?,'$.purchase_closed_by',?),updated=? WHERE id=?",stamp,actorId,stamp,orderId),stmt('INSERT INTO records(id,kind,user_id,data,created,updated) VALUES (?,?,?,?,?,?)',orderStatementId(orderId),'order_statement',userId,JSON.stringify({order_id:orderId,summary}),stamp,stamp),stmt('INSERT INTO activity(id,user_id,resource,action,data,created) VALUES (?,?,?,?,?,?)',uid(),actorId,orderId,'הזמנה נסגרה לרכישות והופק סיכום PDF',JSON.stringify({amount:amounts.total,customer_id:userId}),stamp),stmt('INSERT OR IGNORE INTO jobs(id,user_id,kind,status,data,created,updated) VALUES (?,?,?,?,?,?,?)','email:order-statement:'+orderId,userId,'email','requested',JSON.stringify(orderCloseEmail(summary,origin)),stamp,stamp)];
 return {already_closed:false,summary,target,operations};
}

// A closed order keeps its statement. After an item is cancelled the statement shows it as cancelled and the new total.
export async function refreshOrderStatement(orderId:string){
 const saved=parse(await one('SELECT * FROM records WHERE id=?',orderStatementId(orderId)));if(!saved?.summary)return;
 const order=parse(await one(`SELECT o.*,${orderSummarySql()} FROM orders o WHERE o.id=?`,orderId))!,articles=(await all('SELECT a.*,w.name AS website_name,w.url AS website_url FROM articles a LEFT JOIN websites w ON w.id=a.website_id WHERE a.order_id=? ORDER BY a.updated,a.id',orderId)).map(a=>parse(a)!),stamp=now();
 await stmt('UPDATE records SET data=?,updated=? WHERE id=?',JSON.stringify({order_id:orderId,summary:{...saved.summary,...effectiveOrderAmounts(order),items:statementItems(articles,order)}}),stamp,orderStatementId(orderId)).run();
 try{await env.BUCKET?.delete('order-summaries/'+orderId+'.pdf');}catch{/* the next download rebuilds it only if the stored copy is gone */}
}
export async function closeOrderForStatement(userId:string,orderId:string,expected:number,actorId:string,origin:string){const p=await prepareOrderStatement(userId,orderId,expected,actorId,origin);if(p.operations.length)await db().batch([financialGuard(p.target!),...p.operations]);let pdf_status='ready';try{await storedOrderPdf(orderId,origin);}catch{pdf_status='pending';}const {sendQueuedMail}=await import('./mail');const mail=await sendQueuedMail('email:order-statement:'+orderId);return {ok:true,already_closed:p.already_closed,summary:p.summary,pdf_status,mail_status:mail?.status||'requested'};}
export async function renderOrderStatementPdf(summary:any,origin:string){
 const assets=(env as typeof env & {ASSETS?:Fetcher}).ASSETS;assert(assets,'קבצי הפקת המסמך אינם זמינים',503);
 const [font,logo]=await Promise.all([assets.fetch(new Request(origin+'/brand/pdf-hebrew.ttf')),assets.fetch(new Request(origin+'/brand/megalinks-logo.png'))]);assert(font.ok&&logo.ok,'קבצי המיתוג להפקת PDF אינם זמינים',503);
 const {makeOrderPdf}=await import('./order-pdf-server');return makeOrderPdf(summary,new Uint8Array(await font.arrayBuffer()),new Uint8Array(await logo.arrayBuffer()));
}
export async function storedOrderPdf(orderId:string,origin:string){const assets=(env as typeof env & {ASSETS?:Fetcher}).ASSETS;const saved=parse(await one('SELECT * FROM records WHERE id=?',orderStatementId(orderId)));assert(saved?.summary,'סיכום ההזמנה עדיין לא הופק',409);assert(env.BUCKET&&assets,'אחסון המסמכים אינו זמין',503);const key='order-summaries/'+orderId+'.pdf';let stored=await env.BUCKET.get(key);if(!stored){const bytes=await renderOrderStatementPdf(saved.summary,origin);await env.BUCKET.put(key,bytes,{httpMetadata:{contentType:'application/pdf'}});stored=await env.BUCKET.get(key);}assert(stored,'מסמך ההזמנה אינו זמין',503);return {bytes:new Uint8Array(await stored.arrayBuffer()),filename:'MegaLinks-order-'+String(saved.summary.order_number).replace(/[^0-9a-zA-Z-]/g,'')+'.pdf'};}
