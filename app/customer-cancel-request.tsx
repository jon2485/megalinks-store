'use client';
import React,{useRef,useState} from 'react';
import {Clock3,XCircle} from 'lucide-react';
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
 const opts=cancelOptions(order,articles),many=opts.sites.length>1||!opts.whole;
 const [scope,setScope]=useState<'article'|'order'>(opts.whole&&!many?'order':opts.sites.length?'article':'order'),[site,setSite]=useState(opts.sites.length===1?opts.sites[0].id:''),[reason,setReason]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),lock=useRef(false);
 const send=async()=>{if(lock.current)return;if(scope==='article'&&!site){setError('יש לבחור את האתר שתרצו לבטל');return;}if(reason.trim().length<2){setError('יש לכתוב את סיבת הביטול');return;}lock.current=true;setBusy(true);setError('');try{await api('orders/'+encodeURIComponent(order.id)+'/cancel','POST',{scope,article_id:scope==='article'?site:undefined,reason:reason.trim()});done?.();ctx.refresh();close();}catch(e){setError((e as Error).message);}finally{lock.current=false;setBusy(false);}};
 const locked=articles.filter(a=>!opts.sites.includes(a)&&a.status!=='cancelled'&&!a.publication_refunded);
 return <div className="ccr" dir="rtl">
  {opts.whole&&opts.sites.length>0&&<><div className="ccr-label">מה תרצו לבטל?</div><div className="ccr-choice" role="radiogroup">
   <button type="button" role="radio" aria-checked={scope==='article'} className={'ccr-opt'+(scope==='article'?' is-on':'')} onClick={()=>setScope('article')}><span className="ccr-radio" aria-hidden="true"/><span><b>אתר אחד מההזמנה</b><small>בוחרים את האתר מהרשימה</small></span></button>
   <button type="button" role="radio" aria-checked={scope==='order'} className={'ccr-opt'+(scope==='order'?' is-on':'')} onClick={()=>setScope('order')}><span className="ccr-radio" aria-hidden="true"/><span><b>את כל ההזמנה</b><small>כל האתרים בהזמנה</small></span></button>
  </div></>}
  {scope==='article'?<><div className="ccr-label">איזה אתר?</div><div className="ccr-sites" role="radiogroup">
   {opts.sites.map(a=><button type="button" role="radio" aria-checked={site===a.id} key={a.id} className={'ccr-site'+(site===a.id?' is-on':'')} onClick={()=>setSite(a.id)}><span className="ccr-radio" aria-hidden="true"/><span className="ccr-grow"><b dir="ltr">{siteOf(a)}</b><small>{a.title||a.topic||'כתבה'}{a.status==='sent'?' · נשלחה לפרסום, נבדוק מול האתר':''}</small></span><span className="ccr-price"><bdi>{money(remainingArticleNet(a,order))}</bdi></span></button>)}
   {locked.map(a=><div key={a.id} className="ccr-site is-off"><span className="ccr-radio" aria-hidden="true"/><span className="ccr-grow"><b dir="ltr">{siteOf(a)}</b><small>{a.status==='published'?'כבר פורסם · לא ניתן לבטל':'בטיפול ביטול'}</small></span><span className="ccr-price"><bdi>{money(remainingArticleNet(a,order))}</bdi></span></div>)}
  </div></>:<div className="ccr-note"><b>יבוטלו כל האתרים בהזמנה:</b> {articles.filter(articleOpen).map(siteOf).join(' · ')}</div>}
  <label className="ccr-field"><span className="ccr-label">סיבת הביטול *</span><textarea value={reason} maxLength={1500} rows={3} disabled={busy} onChange={e=>{setReason(e.target.value);setError('');}}/></label>
  <p className="ccr-note">הבקשה נשלחת לאישור. עד ההחלטה הכול ממשיך כרגיל. תקבלו עדכון כאן, בעדכונים האישיים ובמייל.</p>
  {error&&<p className="ccr-error" role="alert">{error}</p>}
  <div className="ccr-foot"><button type="button" className="ccr-send" disabled={busy} onClick={send}>{busy?'שולח…':'שליחת בקשת ביטול'}</button><button type="button" className="ccr-back" disabled={busy} onClick={close}>חזרה</button></div>
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
