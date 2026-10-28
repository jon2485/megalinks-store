'use client';
import React,{useRef,useState} from 'react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {pricingApi} from '@/lib/client';
import {articleAmounts,effectiveOrderAmounts,remainingArticleNet} from '@/lib/order-finance';
import type {Row} from '@/lib/shared';
import {orderMoney,orderNumber} from './order-presentation';
import {useAdminDraftGuard} from './admin-draft-guard';
import {ErrorBox,type Ctx} from './workspace';
import './finance-records.css';

export function OrderItemPriceEditor({ctx,article,order,close,onBusyChange}:{ctx:Ctx;article:Row;order:Row;close:()=>void;onBusyChange:(busy:boolean)=>void}){
 const guard=useAdminDraftGuard(ctx);
 const current=remainingArticleNet(article,order),writing=articleAmounts(article).writingNet,[value,setValue]=useState((current/100).toFixed(2)),[busy,setBusy]=useState(false),[error,setError]=useState(''),lock=useRef(false);
 const cents=Math.round(Number(value)*100),valid=value.trim()!==''&&Number.isSafeInteger(cents)&&cents>=writing&&cents<=100000000,rate=Number(order.vat_percent??18),old=articleAmounts(article),publicationGross=valid?Math.round((cents-writing)*(1+rate/100)):old.publicationGross,total=order.total+publicationGross-old.publicationGross,net=effectiveOrderAmounts(order).net+cents-current;
 return <form className="finance-price-editor" aria-busy={busy} onSubmit={async e=>{e.preventDefault();if(lock.current||!valid)return;lock.current=true;setBusy(true);onBusyChange(true);setError('');try{await ctx.run(()=>pricingApi('admin/customer-account/'+encodeURIComponent(order.user_id)+'/price','POST',{article_id:article.id,order_id:order.id,expected_total:order.total,version:article.version,price_ils:((cents-writing)/100).toFixed(2)}),'מחיר הפריט בהזמנה עודכן');guard.mark('item-price',false);close();}catch(e){setError((e as Error).message);}finally{lock.current=false;setBusy(false);onBusyChange(false);}}}>
 <h3>עדכון מחיר לפריט</h3><div className="finance-price-field"><label>מחיר חדש לפני מע״מ (₪)<Input autoFocus required type="number" step="0.01" min={writing/100} max="1000000" value={value} disabled={busy} onChange={e=>{setValue(e.target.value);guard.mark('item-price',e.target.value!==(current/100).toFixed(2));}}/></label><p className="finance-note">מחיר נוכחי: <bdi>{orderMoney(current)}</bdi>{writing>0&&<><br/>מתוכו שירות כתיבה בסך <bdi>{orderMoney(writing)}</bdi> נשמר ללא שינוי.</>}</p></div><div className="finance-price-preview"><div><span>סה״כ ההזמנה לאחר שמירה</span><strong className="block"><bdi>{valid?orderMoney(total):'—'}</bdi></strong><small>לפני מע״מ: <bdi>{valid?orderMoney(net):'—'}</bdi> · מע״מ: <bdi>{valid?orderMoney(total-net):'—'}</bdi></small></div><p className="finance-note">השינוי חל רק על פריט זה בהזמנה {orderNumber(order)}.<br/>מחירון הלקוח אינו משתנה.</p></div><ErrorBox error={error}/><div className="finance-decision-actions"><Button type="submit" disabled={busy||!valid||cents===current}>{busy?'שומר…':'שמירת מחיר לפריט'}</Button><Button type="button" variant="outline" disabled={busy} onClick={()=>{guard.mark('item-price',false);close();}}>ביטול העריכה</Button></div></form>;
}
