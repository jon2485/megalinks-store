'use client';
import React,{lazy,Suspense} from 'react';
import {FileText,Loader2,ReceiptText} from 'lucide-react';
import {useData} from '@/lib/client';
import type {Ctx} from './workspace';
import './cancel-focus.css';

const RefundForm=lazy(()=>import('./refund-dialog').then(m=>({default:m.RefundForm})));
// Cancellation alerts open only that article's cancellation form, not the whole order (08.11.2026).
export function CancelFocus({ctx,id,close}:{ctx:Ctx;id:string;close:()=>void}){
 const state=useData('articles/'+id,ctx.revision),a=state.data?.article,o=state.data?.order;
 const leave=(page:string)=>{close();ctx.go(page);};
 const wait=<p role="status" className="wc2-cancel-load"><Loader2 className="wc2-spin" size={18} aria-hidden="true"/>טוען את פרטי הביטול…</p>;
 if(state.error&&!a)return <p role="alert" className="wc2-cancel-load is-error">{state.error}</p>;
 if(!a||!o)return wait;
 return <div className="wc2-cancel"><Suspense fallback={wait}><RefundForm ctx={ctx} userId={a.user_id||o.user_id} article={a} order={o} close={close}/></Suspense>
  <nav className="wc2-cancel-links" aria-label="מעבר למסכים נוספים"><button type="button" onClick={()=>leave('admin-article/'+a.id)}><FileText size={16} aria-hidden="true"/><span>פתיחת הכתבה</span></button><button type="button" onClick={()=>leave('admin-order/'+o.id)}><ReceiptText size={16} aria-hidden="true"/><span>ההזמנה המלאה <bdi>{o.number}</bdi></span></button></nav></div>;
}
export function openCancelFocus(ctx:Ctx,articleId:string){ctx.open({kind:'admin-finance',title:'טיפול בביטול וזיכוי',description:'הכתבה הזו בלבד. מאשרים עצירת פרסום מול הספק ואז מזכים.',render:(close:()=>void)=><CancelFocus ctx={ctx} id={articleId} close={close}/>});}
