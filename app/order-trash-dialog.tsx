'use client';
// Trash for abandoned orders (23.11.2026): the confirmation window. Title starts with "העברה לפח", so the window
// header shows the trash can (dialog-badge.tsx). Nothing is deleted; restore is on the "פח" filter.
import React,{useRef,useState} from 'react';
import {Trash2} from 'lucide-react';
import {api} from '@/lib/client';
import type {Row} from '@/lib/shared';
import {ErrorBox,type Ctx} from './workspace';
import {ORDER_ABANDONED_DAYS} from '@/lib/admin-order-buckets';

type Target={order:Row}|{abandoned:number};
const many=(n:number)=>n===1?'הזמנה אחת':n+' הזמנות';
export function openOrderTrash(ctx:Ctx,target:Target,done?:()=>void){
 const order='order' in target?target.order:null,count='abandoned' in target?target.abandoned:0;
 ctx.open({kind:'admin-finance',title:order?'העברה לפח':'העברה לפח של כל ההזמנות שנזנחו',description:order?'הזמנה '+String(order.number):many(count)+' שנזנחו',render:(close:()=>void)=><OrderTrashConfirm ctx={ctx} order={order} count={count} close={close} done={done}/>});
}
function OrderTrashConfirm({ctx,order,count,close,done}:{ctx:Ctx;order:Row|null;count:number;close:()=>void;done?:()=>void}){
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),lock=useRef(false);
 const move=async()=>{if(lock.current)return;lock.current=true;setBusy(true);setError('');
  try{await ctx.run(()=>api('admin/orders/trash','POST',order?{ids:[order.id]}:{all_abandoned:true,expected:count}),order?'ההזמנה הועברה לפח':many(count)+' הועברו לפח');close();done?.();}
  catch(e){setError((e as Error).message);}finally{lock.current=false;setBusy(false);}};
 return <section className="om-dialog order-trash-confirm" dir="rtl" aria-busy={busy}>
  <section className="om-dialog-part">
   {order?<p className="om-note">ההזמנה <bdi>{String(order.number)}</bdi>{order.user_name?<> של {String(order.user_name)}</>:null} תעבור לפח.</p>
    :<p className="om-note">{many(count)} שלא שולמו ואין להן דיווח תשלום כבר יותר מ-{ORDER_ABANDONED_DAYS} ימים יעברו לפח.</p>}
   <p className="om-note">{order?'היא לא תופיע':'הן לא יופיעו'} ברשימות, בספירות ובתגים, וגם לא אצל הלקוח. שום דבר לא נמחק: אפשר לשחזר מהמסנן "פח" בראש מסך ההזמנות.</p>
  </section>
  <ErrorBox error={error}/>
  <div className="om-dialog-actions"><button type="button" className="om-btn is-danger" disabled={busy} onClick={move}><Trash2 size={17} aria-hidden="true"/>{busy?'מעביר…':'העברה לפח'}</button><button type="button" className="om-btn" disabled={busy} onClick={close}>ביטול</button></div>
 </section>;
}
export async function restoreOrder(ctx:Ctx,o:Row){return ctx.run(()=>api('admin/orders/restore','POST',{id:o.id}),'ההזמנה '+String(o.number)+' שוחזרה');}
