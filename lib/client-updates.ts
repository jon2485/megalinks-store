import type {Row} from './shared';
import {publicationLink} from './purchased-history';
import {paymentMethodLabel} from './payment-state';

export type ClientUpdate={id:string;kind:'published'|'payment'|'credit'|'cancelled'|'revision';date:string;dateLabel:string;title:string;status:string;articleId?:string;orderId?:string;orderNumber?:string;siteName?:string;image?:string;logo?:string;url?:string;amount?:number;method?:string;note?:string};
export function updateDate(value:unknown){const n=Date.parse(String(value||''));return Number.isFinite(n)?n:0;}
export function displayUpdateDate(value:string){return updateDate(value)?new Intl.DateTimeFormat('he-IL',{timeZone:'Asia/Jerusalem',day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(value)):'לא תועד';}
export function buildClientUpdates(articles:Row[],orders:Row[],transactions:Row[],notifications:Row[]):ClientUpdate[]{
 const result:ClientUpdate[]=[];
 for(const a of articles){
  if(a.demo)continue;
  const common={articleId:a.id,orderId:a.order_id,orderNumber:a.number,siteName:a.website_name,title:a.title||a.topic||'כתבה ללא כותרת',image:a.image_id?'/api/files/'+encodeURIComponent(a.image_id):undefined,logo:a.website_logo};
  if(a.status==='published')result.push({...common,id:'published:'+a.id,kind:'published',status:'הכתבה פורסמה',date:a.published_at||a.updated||'',dateLabel:a.published_at?'תאריך הפרסום':'עודכן בתאריך',url:publicationLink(a)});
  if(a.status==='cancelled'||a.publication_refunded)result.push({...common,id:'cancelled:'+a.id,kind:'cancelled',status:a.publication_refunded?'פרסום הכתבה בוטל':'הכתבה בוטלה',date:a.cancelled_at||a.refunded_at||a.updated||'',dateLabel:a.cancelled_at||a.refunded_at?'תאריך הביטול':'עודכן בתאריך',note:a.refund_reason||a.cancel_reason||''});
  if(a.status==='revisions'){
   const message=notifications.filter(n=>{
    if(n.subject!=='המאמר הוחזר לתיקון')return false;
    try{return decodeURIComponent(new URL(n.button?.url,'https://megalinks.invalid').pathname).replace(/\/$/,'')==='/article/'+a.id;}catch{return false;}
   }).sort((x,y)=>updateDate(y.created)-updateDate(x.created))[0];
   // Only the existing customer-addressed message may supply a manager reply.
   // Internal admin_notes and raw audit payloads are never displayed.
   const body=String(message?.text||''),note=body.startsWith(a.title+'\n')?body.slice(String(a.title).length+1):body;
   result.push({...common,id:'revision:'+a.id,kind:'revision',status:'נדרשים תיקונים',date:message?.created||a.updated||'',dateLabel:message?.created?'תאריך הבקשה':'עודכן בתאריך',note});
  }
 }
 for(const o of orders){
  if(o.demo||!(o.paid||o.settled||o.payment_settled))continue;
  const date=o.paid_at||o.payment_date||o.paid_date||'';
  result.push({id:'payment:'+o.id,kind:'payment',title:'תשלום להזמנה '+o.number,status:'התשלום אושר',orderId:o.id,orderNumber:o.number,date:date||o.created||'',dateLabel:date?'תאריך התשלום':'תאריך ההזמנה',amount:Number(o.total)||0,method:paymentMethodLabel({...o,payment:o.settlement_payment_method||o.payment_method||o.payment})||'לא תועד'});
 }
 for(const t of transactions){
  if(!Number.isFinite(Number(t.amount))||Number(t.amount)<=0)continue;
  result.push({id:'credit:'+t.id,kind:'credit',title:t.reason||'זיכוי בחשבון',status:'היתרה זוכתה',date:t.created||'',dateLabel:'תאריך הזיכוי',orderId:t.order_id,orderNumber:t.order_number,amount:Number(t.amount)});
 }
 return result.sort((a,b)=>updateDate(b.date)-updateDate(a.date)||a.id.localeCompare(b.id));
}

