'use client';
import React,{useState,useRef} from 'react';
import {Download} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {api} from '@/lib/client';
import {money,type Row} from '@/lib/shared';
import {effectiveOrderTotal} from '@/lib/order-finance';
import {Ctx,ErrorBox} from './workspace';
const endpoint=(o:Row)=>'admin/customer-account/'+encodeURIComponent(o.user_id)+'/order-statement/'+encodeURIComponent(o.id);
async function downloadSummary(summary:Row){const {downloadStatementPdf}=await import('@/lib/statement-pdf');await downloadStatementPdf(summary);}
function ConfirmStatement({ctx,order,close}:{ctx:Ctx;order:Row;close:()=>void}){
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),lock=useRef(false);
 return <div className="month-close-confirm" dir="rtl"><p>הפקת ה־PDF תסגור את הזמנה <bdi>{order.number}</bdi> לרכישות נוספות. הרכישה הבאה תפתח הזמנה חדשה.</p><strong>סכום כולל מע״מ: {money(effectiveOrderTotal(order))}</strong><p>הפקת המסמך אינה מאשרת קבלת תשלום.</p><ErrorBox error={error}/><Button disabled={busy} onClick={async()=>{if(lock.current)return;lock.current=true;setBusy(true);setError('');try{const result=await ctx.run(()=>api(endpoint(order),'POST',{confirmed:true,expected_amount:effectiveOrderTotal(order)}),'ההזמנה נסגרה לרכישות נוספות');await downloadSummary(result.summary);close();}catch(e){setError((e as Error).message);}finally{lock.current=false;setBusy(false);}}}>{busy?'מפיק PDF…':'יצירת PDF וסגירת ההזמנה לרכישות'}</Button><Button variant="outline" disabled={busy} onClick={close}>ביטול</Button></div>;
}
export default function OrderStatementAction({ctx,order}:{ctx:Ctx;order:Row}){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');if(ctx.user?.role!=='admin')return null;
 return <div className="simple-order-pdf"><ErrorBox error={error}/><Button disabled={busy} onClick={async()=>{if(!order.purchase_closed_at){ctx.open({kind:'admin-finance',title:'יצירת PDF להזמנה '+order.number,description:'סיכום הזמנה לתשלום',render:(close:()=>void)=><ConfirmStatement ctx={ctx} order={order} close={close}/>});return;}setBusy(true);setError('');try{const result=await api(endpoint(order));await downloadSummary(result.summary);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}}><Download size={17}/>{busy?'מפיק PDF…':order.purchase_closed_at?'הורדת PDF ההזמנה':'יצירת PDF להזמנה'}</Button></div>;
}
