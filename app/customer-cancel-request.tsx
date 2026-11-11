'use client';
import React,{useRef,useState} from 'react';
import {Check,Clock3,LoaderCircle,Undo2,XCircle} from 'lucide-react';
import {api} from '@/lib/client';
import {money,type Row} from '@/lib/shared';
import {orderCancellation,remainingArticleNet} from '@/lib/order-finance';
import type {Ctx} from './workspace';
import './customer-cancel-request.css';

// Owner rule (11.11.2026): the customer only asks to cancel, one site of the order or the whole order.
// The admin approves or rejects, and a rejection comes back here with the admin's note.
const siteOf=(a:Row)=>String(a.website_url||a.data?.website_url||a.website_name||'').replace(/^https?:\/\//,'').replace(/\/$/,'')||'אתר בהזמנה';
export const articleOpen=(a:Row)=>a.status!=='cancelled'&&!a.publication_refunded&&!a.cancel_pending;
export function cancelOptions(order:Row,articles:Row[]){
 const closed=orderCancellation(order)==='full'||['cancelled','completed'].includes(order.status)||!!order.demo;
 const sites=articles.filter(a=>articleOpen(a)&&a.status!=='published');
 const whole=!closed&&articles.some(articleOpen)&&articles.every(a=>!['sent','published'].includes(a.status));
 return {closed,sites:closed?[]:sites,whole,can:!closed&&(whole||sites.length>0)};
}
export function CancelRequestDialog({ctx,order,articles,close,done}:{ctx:Ctx;order:Row;articles:Row[];close:()=>void;done?:()=>void}){
 const opts=cancelOptions(order,articles),choose=opts.whole&&opts.sites.length>1;
 // One cancellable site with the whole order still open: cancelling that site is the whole order, so no choice is shown.
 const [scope,setScope]=useState<'article'|'order'>(choose||!opts.whole?'article':'order'),[site,setSite]=useState(opts.sites.length===1?opts.sites[0].id:''),[reason,setReason]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),lock=useRef(false);
 const send=async()=>{if(lock.current)return;if(scope==='article'&&!site){setError('יש לבחור את האתר שתרצו לבטל');return;}if(reason.trim().length<2){setError('יש לכתוב את סיבת הביטול');return;}lock.current=true;setBusy(true);setError('');try{await api('orders/'+encodeURIComponent(order.id)+'/cancel','POST',{scope,article_id:scope==='article'?site:undefined,reason:reason.trim()});done?.();ctx.refresh();close();}catch(e){setError((e as Error).message);}finally{lock.current=false;setBusy(false);}};
 const locked=articles.filter(a=>!opts.sites.includes(a)&&a.status!=='cancelled'&&!a.publication_refunded);
 const open=articles.filter(articleOpen),picked=scope==='order'||!!site,written=reason.trim().length>=2;
 const missing=!picked?'בחירת האתר':!written?'סיבת הביטול':'';
 // Same step layout as the AI writing window: numbered nodes on a line, done steps turn blue.
 const node=(n:number,state:string)=><span className="ccr-node" aria-hidden="true">{state==='done'?<Check size={15} strokeWidth={3}/>:n}</span>;
 const first=choose?2:1,siteState=picked?'done':'current',reasonState=written?'done':picked?'current':'todo';
 return <div className="ccr" dir="rtl">
  <div className="ccr-body">
   {choose&&<section className="ccr-step" data-state="done"><h3>{node(1,'done')}מה תרצו לבטל?</h3>
    <div className="ccr-seg" role="radiogroup" aria-label="מה תרצו לבטל?">
     <button type="button" role="radio" aria-checked={scope==='article'} disabled={busy} onClick={()=>{setScope('article');setError('');}}>אתר אחד</button>
     <button type="button" role="radio" aria-checked={scope==='order'} disabled={busy} onClick={()=>{setScope('order');setError('');}}>כל ההזמנה</button>
    </div></section>}
   <section className="ccr-step" data-state={siteState}><h3>{node(first,siteState)}{scope==='article'?'איזה אתר לבטל?':open.length===1?'האתר שיבוטל':'האתרים שיבוטלו'}{scope==='article'&&picked&&<small>✓ נבחר</small>}</h3>
    {scope==='article'?<div className="ccr-sites" role="radiogroup" aria-label="איזה אתר לבטל?">
     {opts.sites.map(a=><button type="button" role="radio" aria-checked={site===a.id} key={a.id} disabled={busy} className="ccr-site" onClick={()=>{setSite(a.id);setError('');}}><span className="ccr-radio" aria-hidden="true"/><span className="ccr-grow"><b dir="ltr">{siteOf(a)}</b><small>{a.title||a.topic||'כתבה'}{a.status==='sent'?' · נשלחה לפרסום, נבדוק מול האתר':''}</small></span><span className="ccr-price"><bdi>{money(remainingArticleNet(a,order))}</bdi></span></button>)}
     {locked.map(a=><div key={a.id} className="ccr-site is-off"><span className="ccr-radio" aria-hidden="true"/><span className="ccr-grow"><b dir="ltr">{siteOf(a)}</b><small>{a.status==='published'?'כבר פורסם · לא ניתן לבטל':'בטיפול ביטול'}</small></span><span className="ccr-price"><bdi>{money(remainingArticleNet(a,order))}</bdi></span></div>)}
    </div>:<div className="ccr-sites">{open.map(a=><div key={a.id} className="ccr-site is-static"><span className="ccr-grow"><b dir="ltr">{siteOf(a)}</b><small>{a.title||a.topic||'כתבה'}</small></span><span className="ccr-price"><bdi>{money(remainingArticleNet(a,order))}</bdi></span></div>)}</div>}
   </section>
   <section className="ccr-step ccr-last" data-state={reasonState}><h3>{node(first+1,reasonState)}<label htmlFor="ccr-reason">סיבת הביטול</label>{written&&<small>✓ מוכן</small>}</h3>
    <textarea id="ccr-reason" value={reason} maxLength={1500} rows={3} disabled={busy} placeholder="כמה מילים על הסיבה. זה עוזר לנו לטפל בבקשה מהר" onChange={e=>{setReason(e.target.value);setError('');}}/>
   </section>
   <p className="ccr-note">הבקשה נשלחת לאישור. עד ההחלטה הכול ממשיך כרגיל. תקבלו עדכון כאן, בעדכונים האישיים ובמייל.</p>
   {error&&<p className="ccr-error" role="alert">{error}</p>}
  </div>
  <div className="ccr-foot"><p className="ccr-ready" role="status">{missing?<>חסר: <b>{missing}</b></>:<><b>הכול מוכן</b> לשליחת הבקשה</>}</p><button type="button" className="ccr-send" disabled={busy||!!missing} onClick={send}>{busy?<LoaderCircle size={18} className="animate-spin" aria-hidden="true"/>:<Undo2 size={18} aria-hidden="true"/>}{busy?'שולח…':'שליחת בקשת ביטול'}</button><button type="button" className="ccr-back" disabled={busy} onClick={close}>חזרה</button></div>
 </div>;
}
export function openCancelRequest(ctx:Ctx,order:Row,articles:Row[],done?:()=>void){ctx.open({kind:'customer-cancel-request',title:'בקשת ביטול',description:'הזמנה '+String(order.number||''),render:(close:()=>void)=><CancelRequestDialog ctx={ctx} order={order} articles={articles} close={close} done={done}/>});}
/** Status of a request on this order, and the button that opens the request form. */
export function CustomerCancelRequest({ctx,order,articles,compact=false}:{ctx:Ctx;order:Row;articles:Row[];compact?:boolean}){
 const [sent,setSent]=useState(false);const status=sent?'pending':order.cancel_request_status,opts=cancelOptions(order,articles);
 const what=order.cancel_request_scope==='article'?'לאתר '+(order.cancel_request_target||''):'להזמנה';
 if(status==='pending')return <section className="ccr-status is-wait" role="status"><Clock3 size={18} aria-hidden="true"/><div><strong>{sent?'בקשת הביטול נשלחה ומחכה לאישור.':'בקשת ביטול '+what+' נשלחה ומחכה לאישור.'}</strong>{!sent&&order.cancel_request_reason&&<p>הסיבה שכתבת: {order.cancel_request_reason}</p>}</div></section>;
 const rejected=status==='rejected'&&<section className="ccr-status is-no" role="status"><XCircle size={18} aria-hidden="true"/><div><strong>בקשת הביטול הקודמת לא אושרה.</strong>{order.cancel_request_note&&<p>תשובת המנהל: {order.cancel_request_note}</p>}</div></section>;
 if(!opts.can)return rejected||null;
 return <>{rejected}{!compact&&<button type="button" className="ccr-open" onClick={()=>openCancelRequest(ctx,order,articles,()=>setSent(true))}><XCircle size={17} aria-hidden="true"/>בקשת ביטול</button>}</>;
}
