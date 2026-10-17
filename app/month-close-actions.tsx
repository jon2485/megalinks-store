'use client';
import React,{useState,useRef} from 'react';
import {Download,LockKeyhole} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {api} from '@/lib/client';
import {Row,money} from '@/lib/shared';
import {Ctx,ErrorBox} from './workspace';
export async function downloadMonthlySummary(row:Row){const data=await api('monthly/statement?month='+encodeURIComponent(row.month||row.billing_month)+'&user='+encodeURIComponent(row.user_id)+'&demo='+(row.demo?1:0));const {downloadStatementPdf}=await import('@/lib/statement-pdf');await downloadStatementPdf(data.summary);}
function CloseMonthConfirm({ctx,row,close}:{ctx:Ctx;row:Row;close:()=>void}){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');const lock=useRef(false);
 return <div dir="rtl" className="month-close-confirm"><p>סגירת החודש תמנע הוספת רכישות נוספות לחשבון של לקוח זה בחודש שנבחר. יופק PDF עם פירוט כל האתרים והסכומים.</p><strong>סה״כ לתשלום: {money(row.amount)}</strong><p>הפעולה אינה מאשרת קבלת תשלום. אישור התשלום מתבצע בנפרד.</p><ErrorBox error={error}/><Button disabled={busy} onClick={async()=>{if(lock.current)return;lock.current=true;setBusy(true);setError('');try{await ctx.run(()=>api('admin/monthly/close','POST',{user_id:row.user_id,month:row.month||row.billing_month,demo:!!row.demo,expected_amount:row.amount,confirmed:true}),'החודש נסגר והסיכום נשמר');await downloadMonthlySummary(row);close();}catch(e){setError((e as Error).message);}finally{lock.current=false;setBusy(false);}}}><LockKeyhole size={18}/>{busy?'סוגר ומפיק PDF…':'אישור סגירת חודש והפקת PDF'}</Button><Button variant="outline" disabled={busy} onClick={close}>חזרה ללא סגירה</Button></div>;
}
export default function MonthCloseActions({ctx,row}:{ctx:Ctx;row:Row}){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');const monthly=!!(row.month||row.billing_month);if(!monthly)return null;
 return <section className="month-close-actions" dir="rtl"><ErrorBox error={error}/>{row.monthly_closed?<Button variant="outline" disabled={busy} onClick={async()=>{setBusy(true);setError('');try{await downloadMonthlySummary(row);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}}><Download size={18}/>{busy?'מפיק PDF…':'הורדת הסיכום שהופק בסגירה (PDF)'}</Button>:ctx.user?.role==='admin'?<><h3>פעולת מנהל</h3><Button onClick={()=>ctx.open({kind:'admin-finance',title:'סגירת חודש והוצאת סיכום חודשי לתשלום',description:'יש לבדוק את הסכום לפני אישור הסגירה.',render:(close:()=>void)=><CloseMonthConfirm ctx={ctx} row={row} close={close}/>})}><LockKeyhole size={18}/>סגירת חודש והוצאת סיכום חודשי לתשלום</Button><p>הסגירה אינה מסמנת את החשבון כשולם.</p></>:null}</section>;
}
