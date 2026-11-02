'use client';
import React,{useRef,useState} from 'react';
import {CheckCircle2,ChevronDown,Download,ExternalLink,LockKeyhole,Mail,Send} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {api,useData} from '@/lib/client';
import type {Row} from '@/lib/shared';
import {effectiveOrderTotal,orderCancellation} from '@/lib/order-finance';
import {paymentConfirmed} from '@/lib/admin-order-buckets';
import {historyMonthLabel} from '@/lib/order-history';
import {downloadMonthlySummary} from './month-close-actions';
import {assignedPaymentMonth} from './payment-assignment';
import {orderMoney,orderNumber} from './order-presentation';
import {DialogFile,DialogItems,DialogSlip,OrderExport} from './order-list-parts';
import {ErrorBox,type Ctx} from './workspace';

const endpoint=(order:Row)=>'admin/customer-account/'+encodeURIComponent(order.user_id)+'/order-statement/'+encodeURIComponent(order.id);
export function CloseMonthlyOrder({ctx,order,close}:{ctx:Ctx;order:Row;close:()=>void}){
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[result,setResult]=useState<Row|null>(null),lock=useRef(false);
 const detail=useData('orders/'+order.id,ctx.revision),currentOrder=detail.data?.order?{...order,...detail.data.order}:order,amount=orderMoney(effectiveOrderTotal(currentOrder));
 const subject='הזמנה חודשית מספר '+String(order.number).replace(/^#+/,'')+' נסגרה לתשלום';
 return <div className="om-dialog" dir="rtl" aria-busy={busy}>
  <DialogSlip amount={effectiveOrderTotal(currentOrder)} who={order.user_name||order.name} number={orderNumber(order)}/>
  {result?<><div className="om-result is-ok" role="status"><strong>ההזמנה נסגרה לרכישות</strong><span>{result.mail_status==='succeeded'?'המייל עם הסיכום נמסר לשירות הדיוור.':'המייל ממתין לשליחה. אפשר לבדוק ולנסות שוב במסך התראות ודיוור.'}</span>{result.pdf_status==='pending'&&<span>ה־PDF ממתין להפקה. אפשר לנסות להוריד אותו מתוך ההזמנה.</span>}<span>התשלום עדיין לא אושר. כשהכסף יתקבל יש לדווח על קבלת התשלום.</span></div><div className="om-dialog-actions"><OrderExport label="הורדת סיכום ההזמנה" run={async()=>{const r=await api(endpoint(order));const {downloadStatementPdf}=await import('@/lib/statement-pdf');await downloadStatementPdf(r.summary);}}/><button type="button" className="om-btn is-primary" onClick={close}>סיום</button></div></>:<>
   <ul className="om-dialog-points"><li><LockKeyhole size={17} aria-hidden="true"/><span>הלקוח לא יוכל להוסיף רכישות להזמנה</span></li><li><Mail size={17} aria-hidden="true"/><span>סיכום PDF יישלח אל <bdi>{order.email||order.user_email||'כתובת לא ידועה'}</bdi></span></li></ul>
   {detail.data?.order?<details className="om-dialog-details"><summary>אתרים בהזמנה ({(detail.data.articles||[]).length})<ChevronDown size={17} aria-hidden="true"/></summary><DialogItems order={currentOrder} items={detail.data.articles||[]} dates bare/></details>:<p className="om-note" role={detail.error?'alert':'status'}>{detail.error||'טוען את פירוט האתרים…'}</p>}
   <a className="om-rowlink" href={'/api/'+endpoint(order)+'?preview=pdf'} target="_blank" rel="noopener noreferrer"><span>תצוגה מקדימה של הסיכום</span><ExternalLink size={16} aria-hidden="true"/></a>
   <ErrorBox error={error}/>
   <div className="om-dialog-actions"><button type="button" className="om-btn is-primary" disabled={busy||!detail.data?.order||!!detail.error} onClick={async()=>{if(lock.current||!detail.data?.order)return;lock.current=true;setBusy(true);setError('');try{setResult(await ctx.run(()=>api(endpoint(order),'POST',{confirmed:true,expected_amount:effectiveOrderTotal(currentOrder)}),'ההזמנה נסגרה לרכישות נוספות'));}catch(e){setError((e as Error).message);}finally{lock.current=false;setBusy(false);}}}><Send size={17} aria-hidden="true"/>{busy?'סוגר ושולח…':'סגירה ושליחה'}</button><button type="button" className="om-btn" disabled={busy} onClick={close}>ביטול</button></div>
  </>}
 </div>;
}
export function ReceiveMonthlyPayment({ctx,order,close}:{ctx:Ctx;order:Row;close:()=>void}){
 const [reference,setReference]=useState(''),[date,setDate]=useState(''),[confirmed,setConfirmed]=useState(false),[proof,setProof]=useState<File|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[result,setResult]=useState<Row|null>(null),[duplicate,setDuplicate]=useState(false),[duplicateConfirmed,setDuplicateConfirmed]=useState(false),lock=useRef(false),uploaded=useRef<Row|null>(null);
 return <form className="om-dialog" dir="rtl" aria-busy={busy} onSubmit={async e=>{e.preventDefault();if(lock.current||!confirmed)return;lock.current=true;setBusy(true);setError('');try{const response=await ctx.run(async()=>{if(proof&&!uploaded.current){const f=new FormData();f.append('file',proof);uploaded.current=await api('files','POST',f);}return api('admin/monthly/settle','POST',{order_id:order.id,user_id:order.user_id,month:order.billing_month||order.month||order.created.slice(0,7),expected_amount:effectiveOrderTotal(order),confirmed:true,payment_method:'bank_transfer',reference,payment_date:date,proof_file_id:uploaded.current?.id||'',confirm_duplicate_reference:duplicateConfirmed});},'התשלום אושר וההזמנה עברה להזמנות הסגורות');setResult(response);}catch(e){if((e as {warnings?:string[]}).warnings?.length)setDuplicate(true);setError((e as Error).message);}finally{lock.current=false;setBusy(false);}}}>
  <DialogSlip amount={effectiveOrderTotal(order)} who={order.user_name||order.name} number={orderNumber(order)}/>
  {result?<><div className="om-result is-ok" role="status"><strong>התשלום אושר</strong><span>ההזמנה מופיעה בהזמנות הסגורות עם סוג הזמנה ״חודשית״.</span><span>חודש השיוך הסופי נקבע לפי מועד האישור, בשעון ישראל.</span></div><div className="om-dialog-actions"><button type="button" className="om-btn is-primary" onClick={close}>חזרה לחשבונות החודשיים</button></div></>:<>
   <div className="om-dialog-fields"><label><span>אסמכתא *</span><Input required minLength={3} maxLength={200} value={reference} onChange={e=>{setReference(e.target.value);setDuplicate(false);setDuplicateConfirmed(false);}} disabled={busy}/></label><label><span>תאריך התשלום *</span><Input required type="date" value={date} onChange={e=>setDate(e.target.value)} disabled={busy}/></label><div className="is-wide"><DialogFile label="אישור מהבנק" hint="לא חובה" file={proof} disabled={busy} onChange={file=>{setProof(file);uploaded.current=null;}}/></div></div>
   <label className="om-dialog-check"><input type="checkbox" checked={confirmed} disabled={busy} onChange={e=>setConfirmed(e.target.checked)}/><span>הסכום נכנס לחשבון הבנק</span></label>{duplicate&&<label className="om-dialog-check is-warning"><input type="checkbox" checked={duplicateConfirmed} disabled={busy} onChange={e=>setDuplicateConfirmed(e.target.checked)}/><span>האסמכתא הזו כבר נרשמה. בדקתי מול הבנק שמדובר בתשלום נפרד</span></label>}<ErrorBox error={error}/><div className="om-dialog-actions"><button type="submit" className="om-btn is-primary" disabled={busy||!confirmed||duplicate&&!duplicateConfirmed}><CheckCircle2 size={17} aria-hidden="true"/>{busy?'מאשר…':'אישור התשלום'}</button><button type="button" className="om-btn" disabled={busy} onClick={close}>ביטול</button></div>
  </>}
 </form>;
}
export function MonthlyOrderActions({ctx,order,disabled=false}:{ctx:Ctx;order:Row;disabled?:boolean}){
 const [downloading,setDownloading]=useState(false),[downloadError,setDownloadError]=useState('');
 if(ctx.user?.role!=='admin'||!order.on_account&&order.payment!=='monthly')return null;
 const paid=paymentConfirmed(order),closed=!!(order.purchase_closed_at||order.monthly_closed||order.payment_report_status==='pending'),month=assignedPaymentMonth(order),cancelled=orderCancellation(order)==='full';
 return <div className="monthly-order-actions">{!paid&&!cancelled&&!order.demo&&<>{closed?<Button variant="outline" disabled={disabled||downloading} onClick={async()=>{if(downloading)return;setDownloading(true);setDownloadError('');try{if(order.monthly_closed&&!order.purchase_closed_at){await downloadMonthlySummary(order);}else{const r=await api(endpoint(order));const {downloadStatementPdf}=await import('@/lib/statement-pdf');await downloadStatementPdf(r.summary);}}catch(e){setDownloadError((e as Error).message);}finally{setDownloading(false);}}}><Download size={16}/>{downloading?'מפיק PDF…':'סיכום ההזמנה (PDF)'}</Button>:<Button disabled={disabled} onClick={()=>ctx.open({kind:'admin-finance',title:'סגירת חודש',render:(close:()=>void)=><CloseMonthlyOrder ctx={ctx} order={order} close={close}/>})}><LockKeyhole size={17}/>סגירת חודש</Button>}<Button variant="outline" disabled={disabled} onClick={()=>ctx.open({kind:'admin-finance',title:'דיווח על קבלת תשלום',render:(close:()=>void)=><ReceiveMonthlyPayment ctx={ctx} order={order} close={close}/>})}>דיווח על קבלת תשלום</Button></>}<ErrorBox error={downloadError}/><p>{disabled?'יש לשמור או לבטל את העריכה תחילה.':paid?'סוג ההזמנה: חודשית · חודש שיוך סופי: '+(month?historyMonthLabel(month):'מועד האישור לא תועד'):cancelled?'ההזמנה בוטלה.':closed?'ההזמנה נסגרה לרכישות · התשלום טרם אושר · חודש שיוך סופי טרם נקבע.':'המחיר נשמר לכל פריט בעת הרכישה. חודש השיוך הסופי ייקבע לאחר אישור התשלום.'}</p></div>;
}
