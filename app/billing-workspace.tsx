'use client';
import {CustomerOrdersView,FinancialOrderDetails} from './customer-orders';
import WalletUsageHistory from './wallet-usage-history';
import WalletTransactions from './wallet-transactions';
import CustomerOrderDialog from './customer-order-dialog';
import {CustomerPaymentReport} from './payment-reports';
import SiteReference from './site-reference';
import {OrderPaymentFooter} from './order-payment-footer';
import {PaymentOrderActions} from './payment-review';
import {paymentStatusLabel} from '@/lib/payment-state';
import {articleAmounts,effectiveOrderTotal,orderCancellation,orderCancellationLabel} from '@/lib/order-finance';
import React, {useState,useRef} from 'react';
import {Wallet, History, Plus, Download, ReceiptText, FileText, CalendarDays, ShoppingCart, Eye, ArrowDownLeft, ArrowUpLeft, CreditCard, Landmark, LockKeyhole, Upload, LoaderCircle} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Card, CardContent} from '@/components/ui/card';
import {Tabs, TabsList, TabsTrigger} from '@/components/ui/tabs';
import {Accordion, AccordionItem, AccordionTrigger, AccordionContent} from '@/components/ui/accordion';
import {api, useData, download, csv} from '@/lib/client';
import {type Row, money, when} from '@/lib/shared';
import {type Ctx, ErrorBox, UploadField} from './workspace';
import {Input} from '@/components/ui/input';
import {Select,SelectTrigger,SelectValue,SelectContent,SelectItem} from '@/components/ui/select';

const cardStyle='min-w-0 gap-0 rounded-2xl border-slate-200 bg-white py-0 shadow-sm';
const primaryStyle='min-h-11 h-auto whitespace-normal rounded-full bg-orange-400 px-5 py-3 text-sm font-bold text-slate-950 shadow-sm shadow-orange-500/20 hover:bg-orange-300';
const outlineStyle='min-h-11 h-auto whitespace-normal rounded-full border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-teal-200 hover:bg-teal-50 hover:text-teal-800';
const miniStyle='h-auto min-h-10 whitespace-normal rounded-full border-cyan-200 bg-cyan-50 px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm shadow-cyan-900/5 transition-colors hover:border-teal-300 hover:bg-teal-100 focus-visible:ring-teal-500 disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-500 disabled:opacity-100';
const viewActionStyle='h-auto min-h-10 whitespace-normal rounded-full border-teal-300 bg-teal-400 px-4 py-2 text-sm font-bold text-slate-950 shadow-sm shadow-teal-500/20 hover:bg-teal-300 focus-visible:ring-teal-600';
function InvoiceAction({order,compact=false}:{order:Row;compact?:boolean}) {
    const actionStyle='invoice-download-action h-auto min-h-11 whitespace-normal rounded-xl bg-teal-600 px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-teal-700 focus-visible:ring-teal-500';
    return order.invoice_file_id ? <a href={'/api/orders/'+order.id+'/invoice'} className={'inline-flex items-center justify-center gap-2 '+actionStyle} aria-label={'הורדת חשבונית מס או קבלה להזמנה '+order.number}><Download size={15}/>חשבונית / קבלה</a> : <span className="invoice-pending-badge inline-flex min-h-11 items-center gap-2 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm font-semibold text-orange-900"><ReceiptText size={16}/>חשבונית / קבלה טרם צורפה</span>;
}
export function InvoiceAttachment({ctx,id,existing,onAttached}:{ctx:Ctx;id:string;existing?:Row;onAttached?:()=>void}) {
    const [file,setFile]=useState<Row|null>(null),[type,setType]=useState('invoice_receipt'),[number,setNumber]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[result,setResult]=useState<Row|null>(null),[replace,setReplace]=useState(false);
    if(ctx.user?.role!=='admin')return null;
    return <section className="space-y-4 rounded-xl border border-cyan-200 bg-cyan-50/50 p-4"><h3 className="!text-base font-bold text-slate-900">{existing?.invoice_file_id?'עדכון מסמך התשלום':'צירוף חשבונית / קבלה להזמנה'}</h3><div className="grid gap-3 sm:grid-cols-2"><label className="space-y-2 text-sm font-semibold text-slate-800"><span className="block">סוג המסמך</span><Select dir="rtl" value={type} onValueChange={setType}><SelectTrigger className="h-12 w-full rounded-xl bg-white"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="invoice_receipt">חשבונית מס / קבלה</SelectItem><SelectItem value="invoice">חשבונית מס</SelectItem><SelectItem value="receipt">קבלה</SelectItem></SelectContent></Select></label><label className="space-y-2 text-sm font-semibold text-slate-800"><span className="block">מספר מסמך (רשות)</span><Input className="h-12 rounded-xl bg-white text-base" maxLength={100} value={number} onChange={e=>setNumber(e.target.value)}/></label></div><UploadField accept="application/pdf,.pdf" label="בחירת מסמך PDF" onUploaded={uploaded=>{setFile(uploaded);setResult(null);}}/>{file&&<p className="break-all text-base font-semibold text-teal-800">קובץ שנבחר: {file.name}</p>}{existing?.invoice_file_id&&<label className="flex items-start gap-2 text-sm leading-6 text-slate-800"><input type="checkbox" className="mt-1 size-4" checked={replace} onChange={e=>setReplace(e.target.checked)}/><span>החלפת המסמך הנוכחי. המסמך הקודם יישמר בהיסטוריה.</span></label>}<ErrorBox error={error}/><Button disabled={busy||!file||(!!existing?.invoice_file_id&&!replace)} className="h-auto min-h-11 w-full rounded-full bg-teal-400 py-3 text-base font-bold text-slate-950 hover:bg-teal-300" onClick={async()=>{if(!file||busy)return;setBusy(true);setError('');try{const response=await ctx.run(()=>api('orders/'+id+'/invoice','POST',{file_id:file.id,document_type:type,document_number:number,expected_file_id:existing?.invoice_file_id||''}),'המסמך צורף וזמין ללקוח');setResult(response);setFile(null);setReplace(false);onAttached?.();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}}><Upload size={17}/>שמירה והודעה ללקוח</Button>{result&&<p className={'rounded-lg p-3 text-sm leading-6 '+(result.mail_status==='succeeded'?'bg-teal-100 text-teal-900':'bg-orange-100 text-orange-900')}>{result.mail_status==='succeeded'?'המסמך נשמר וההודעה נמסרה לשירות הדיוור.':result.mail_status==='demo'?'המסמך נשמר להזמנת ההדגמה. לא נשלח מייל אמיתי.':'המסמך נשמר וזמין ללקוח. המייל ממתין לטיפול במסך התראות ודיוור.'}</p>}</section>;
}
export function OrderBreakdown({id,ctx,invoiceControls=true}:{id:string;ctx:Ctx;invoiceControls?:boolean}) {
    const state=useData('orders/'+id,ctx.revision,true,15000), order=state.data?.order;
    return <div className="space-y-3 text-right"><ErrorBox error={state.error}/>{state.loading&&!order ? <p role="status" className="text-base text-slate-600">טוען את פרטי ההזמנה…</p> : order && <>
        {ctx.user?.role!=='admin'&&!ctx.adminMode?<CustomerOrderDialog ctx={ctx} order={order} articles={state.data?.articles||[]}/>:<FinancialOrderDetails ctx={ctx} order={order} providedArticles={state.data?.articles}/>}
        {ctx.user?.role==='admin'&&<OrderPaymentFooter order={order} admin/>}
        {invoiceControls&&<InvoiceAttachment ctx={ctx} id={id} existing={order}/>}

    </>}</div>;
}
function MonthlyOrders({ctx}:{ctx:Ctx}) {return <CustomerOrdersView ctx={ctx} monthlyOnly/>;}
function BalanceTopUp({ctx,close}:{ctx:Ctx;close:()=>void}) {
    const bankState=useData('bank-details',ctx.revision),requestId=useRef(''),proofSaved=useRef<Row|null>(null);
    const [method,setMethod]=useState('bank'), [amount,setAmount]=useState(''), [reference,setReference]=useState(''), [proof,setProof]=useState<File|null>(null), [busy,setBusy]=useState(false), [error,setError]=useState('');
    const submit=async(e:React.FormEvent)=>{
        e.preventDefault();setError('');
        const value=Number(amount), amountCents=Math.round(value*100);
        if(!Number.isFinite(value)||value<=0||!Number.isSafeInteger(amountCents)||Math.abs(value*100-amountCents)>0.000001){setError('יש להזין סכום חיובי בשקלים, עד שתי ספרות אחרי הנקודה.');return;}
        if(method==='card'){setError('סליקת אשראי להטענת יתרה טרם חוברה. לא בוצע חיוב ולא עודכנה היתרה. אפשר לבחור העברה בנקאית ולשלוח בקשה לאימות מנהל.');return;}
        if(!reference.trim()){setError('יש להזין מספר אסמכתא להעברה.');return;}
        if(proof&&proof.size>15*1024*1024){setError('גודל הקובץ המרבי הוא 15MB.');return;}
        if(busy)return;setBusy(true);
        try {await ctx.run(async()=>{
            if(!requestId.current)requestId.current=crypto.randomUUID();
            let proofFile:Row|null=proofSaved.current;
            if(proof&&!proofFile){const form=new FormData();form.append('file',proof);const upload=await api('files','POST',form);proofFile=upload;proofSaved.current=upload;}
            return api('wallet-topups','POST',{request_id:requestId.current,amount_cents:amountCents,reference:reference.trim(),proof_file_id:proofFile?.id||''});
        },'בקשת ההטענה נשלחה לאימות מנהל. היתרה טרם עודכנה.');close();}catch(err){setError(err instanceof Error?err.message:'שליחת הבקשה נכשלה');}finally{setBusy(false);}
    };
    return <form onSubmit={submit} dir="rtl" className={'min-w-0 space-y-5 text-right'+(!ctx.adminMode&&ctx.user?.role!=='admin'?' customer-topup-glass':'')}>
        <Tabs dir="rtl" value={method} onValueChange={value=>{if(!busy){setMethod(value);setError('');}}}>
            <TabsList aria-label="אמצעי תשלום להטענת יתרה" className="grid w-full grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1.5 group-data-[orientation=horizontal]/tabs:h-auto">
                <TabsTrigger disabled value="card" className="h-auto min-h-12 whitespace-normal rounded-lg px-2 py-3 font-semibold data-[state=active]:bg-white data-[state=active]:text-slate-900"><CreditCard size={17}/>אשראי - טרם זמין</TabsTrigger>
                <TabsTrigger disabled={busy} value="bank" className="h-auto min-h-12 whitespace-normal rounded-lg px-2 py-3 font-semibold data-[state=active]:bg-white data-[state=active]:text-slate-900"><Landmark size={17}/>העברה בנקאית</TabsTrigger>
            </TabsList>
        </Tabs>
        {method==='bank'&&<div className="space-y-2 rounded-xl border border-cyan-100 bg-cyan-50 p-4 text-base leading-7 text-slate-800"><ErrorBox error={bankState.error}/>{bankState.loading?<p>טוען פרטי בנק…</p>:bankState.data?.bank?<><p className="font-bold">פרטי הבנק להעברה</p><p>{bankState.data.bank.bank_name} ({bankState.data.bank.bank_number}) · סניף {bankState.data.bank.branch}</p><p>חשבון: <b dir="ltr">{bankState.data.bank.account}</b> · ע״ש {bankState.data.bank.holder}</p></>:<p>פרטי הבנק טרם הוגדרו. יש לפנות למנהל לקבלת פרטי העברה.</p>}</div>}
        <label className="block space-y-2 text-sm font-semibold text-slate-800"><span>{method==='card'?'סכום להטענה (₪)':'סכום שהועבר (₪)'}</span><Input disabled={busy} value={amount} onChange={e=>setAmount(e.target.value)} type="number" inputMode="decimal" min="0.01" step="0.01" required placeholder="0.00" className="h-12 rounded-xl bg-white text-base"/></label>
        {method==='bank'&&<><label className="block space-y-2 text-sm font-semibold text-slate-800"><span>מספר אסמכתא (חובה)</span><Input disabled={busy} value={reference} onChange={e=>setReference(e.target.value)} required maxLength={200} className="h-12 rounded-xl bg-white text-base"/></label><label className="block space-y-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-800"><span className="flex items-center gap-2 font-semibold"><Upload size={18}/>צילום מסך של ההעברה (מומלץ)</span><input disabled={busy} type="file" accept="image/png,image/jpeg,image/webp,application/pdf" className="block w-full min-w-0 text-sm file:me-3 file:rounded-lg file:border-0 file:bg-white file:px-3 file:py-2 file:font-semibold file:text-slate-800" onChange={e=>{setProof(e.target.files?.[0]||null);proofSaved.current=null;}}/><span className="block text-sm text-slate-600">תמונה או קובץ PDF · הצירוף אינו אישור תשלום</span></label></>}
        <ErrorBox error={error}/>
        <div className="space-y-3"><Button type="submit" disabled={busy} className="h-auto min-h-12 w-full rounded-xl bg-slate-900 px-4 py-3 text-base font-bold text-white hover:bg-slate-800">{busy?<LoaderCircle size={18} className="animate-spin"/>:method==='card'?<LockKeyhole size={18}/>:<Landmark size={18}/>} {method==='card'?'מעבר לתשלום מאובטח':'שליחת בקשה לאישור'}</Button><p className="text-center text-sm leading-6 text-slate-600">{method==='card'?'היתרה תעודכן באופן מיידי לאחר אישור העסקה.':'הבקשה תועבר לאישור. היתרה תעודכן לאחר אימות הכספים בדרך כלל עד 48 שעות.'}</p>{method==='card'&&<p className="rounded-lg bg-slate-50 p-3 text-sm leading-6 text-slate-600">סליקת אשראי להטענת יתרה עדיין אינה מחוברת. אין בשלב זה חיוב או הטענה אוטומטית.</p>}</div>
    </form>;
}
function CustomerTopups({ctx}:{ctx:Ctx}) {
 const state=useData('wallet-topups',ctx.revision);const rows:Row[]=state.data?.requests||[];
 return <section className="customer-finance-topups space-y-3"><h2 className="!text-xl font-bold text-slate-900">בקשות הטענת יתרה</h2><ErrorBox error={state.error}/>{state.loading?<p role="status" className="text-base text-slate-700">טוען בקשות…</p>:rows.length?<ul>{rows.map(row=><li key={row.id} data-decision={row.decision||'pending'} className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 py-4"><div><strong className="text-lg text-slate-900">{money(row.amount_cents)}</strong><p className="mt-1 break-all text-sm text-slate-700">{when(row.created)} · אסמכתא: {row.reference}</p>{row.decision_note&&<p className="mt-2 text-base text-slate-800">{row.decision_note}</p>}{!['approved','rejected'].includes(row.decision)&&<p className="customer-finance-pending-note">הסכום יתווסף ליתרה לאחר אישור מנהל.</p>}</div><span className={'rounded-full px-3 py-2 text-sm font-bold '+(row.decision==='approved'?'bg-teal-100 text-teal-900':row.decision==='rejected'?'bg-rose-100 text-rose-800':'bg-orange-100 text-orange-900')}>{row.decision==='approved'?'אושרה · היתרה עודכנה':row.decision==='rejected'?'נדחתה':'ממתינה לאימות מנהל'}</span></li>)}</ul>:<p className="text-base text-slate-700">אין כרגע בקשות הטענה.</p>}</section>;
}
export default function BillingWorkspace({ctx,monthly=false,balanceOnly=false}:{ctx:Ctx;monthly?:boolean;balanceOnly?:boolean}) {
    const hasCreditAccount=ctx.user?.monthly_account?.enabled===1||ctx.user?.monthly_account?.enabled===true;
    const credit=useData('credits',ctx.revision,!monthly,5000), orders=useData('orders',ctx.revision,!monthly,15000), packages=useData('records/package',ctx.revision,!monthly);
    const viewOrder=(order:Row)=>ctx.open({kind:'bulk',title:(orderCancellation(order)==='full'?'פרטי הביטול - ':'פרטי הזמנה ')+order.number,description:'האתרים שנרכשו, סיכום התשלום ומסמכי ההזמנה.',render:()=> <><OrderBreakdown id={order.id} ctx={ctx}/><PaymentOrderActions ctx={ctx} order={order}/></>});
    const loadBalance=()=>ctx.open({kind:'wallet-topup',title:'הטענת יתרה לחשבון',description:'בחרו אמצעי תשלום וסכום להטענה.',render:(close:()=>void)=><BalanceTopUp ctx={ctx} close={close}/>});
    const usageHistory=()=>ctx.open({kind:'admin-finance',title:'היסטוריית שימושים ביתרה',description:'תאריך, הזמנה, אתר וסכום שנוכה מהיתרה',render:()=> <WalletUsageHistory ctx={ctx}/>});
    const allOrders:Row[]=orders.data?.orders||[];
    const ledger:Row[]=credit.data?.transactions||[];
    // Order payments are shown once in the order list; other ledger entries remain visible.
    const transactions=ledger.filter(entry=>!String(entry.reference||'').startsWith('order:')||!allOrders.some(order=>'order:'+order.id===entry.reference));
    return <div dir="rtl" className={'billing-page azure-page-theme min-w-0 px-4 py-7 text-right sm:px-8'+(balanceOnly&&!ctx.adminMode&&ctx.user?.role!=='admin'?' customer-finance-glass':'')}><div className="mx-auto max-w-5xl space-y-6">
        <header className="billing-hero flex flex-wrap items-center justify-between gap-4"><div><h1 className="!text-2xl font-bold text-slate-900 sm:!text-3xl">{balanceOnly?'יתרה וזיכויים':'ארנק וחשבוניות'}</h1><p className="mt-2 text-base text-slate-600">{balanceOnly?'היתרה הזמינה, טעינות וזיכויים בחשבון שלך.':'היתרה, ההזמנות ומסמכי התשלום שלכם.'}</p></div>{hasCreditAccount&&!balanceOnly&&<Tabs className="w-full min-w-0 sm:w-auto sm:min-w-80" dir="rtl" value={monthly?'monthly':'wallet'} onValueChange={value=>ctx.go(value)}><TabsList className="grid w-full grid-cols-2 gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm group-data-[orientation=horizontal]/tabs:h-auto"><TabsTrigger value="wallet" className="h-auto min-h-12 min-w-0 whitespace-normal rounded-xl px-3 py-3 text-sm font-bold leading-snug text-slate-700 hover:bg-slate-50 data-[state=active]:border-cyan-200 data-[state=active]:bg-cyan-100 data-[state=active]:text-slate-900 data-[state=active]:shadow-sm">ארנק וחשבוניות</TabsTrigger><TabsTrigger value="monthly" className="h-auto min-h-12 min-w-0 whitespace-normal rounded-xl px-3 py-3 text-sm font-bold leading-snug text-slate-700 hover:bg-slate-50 data-[state=active]:border-cyan-200 data-[state=active]:bg-cyan-100 data-[state=active]:text-slate-900 data-[state=active]:shadow-sm">חשבון חודשי</TabsTrigger></TabsList></Tabs>}</header>
        {monthly?hasCreditAccount?<MonthlyOrders ctx={ctx}/>:<Card className={cardStyle}><CardContent className="space-y-4 p-6"><p className="text-base text-slate-600">חשבון חודשי זמין ללקוחות שאושרו על ידי המנהל.</p><Button variant="outline" className={outlineStyle} onClick={()=>ctx.go('wallet')}>חזרה לארנק וחשבוניות</Button></CardContent></Card>:<>
            <ErrorBox error={credit.error||orders.error||packages.error}/><Card className="billing-balance-card w-full gap-0 overflow-hidden rounded-2xl border-0 bg-slate-900 py-0 text-white shadow-md" style={{background:'radial-gradient(ellipse at 10% 20%,#1e5e72,transparent 65%),linear-gradient(120deg,#071f4b,#0f172a)'}}><CardContent className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8"><div><p className="flex items-center gap-2 text-base font-semibold text-teal-200"><Wallet size={20}/>יתרה זמינה</p><strong className="mt-3 block break-words text-4xl font-extrabold tabular-nums tracking-tight text-white sm:text-5xl">{credit.loading&&!credit.data?'…':money(credit.data?.available??credit.data?.balance??0)}</strong><p className="mt-3 text-sm text-slate-300">לרכישת פרסום ושירותי תוכן</p>{credit.data?.available!=null&&credit.data.available<credit.data.balance&&<p className="mt-2 text-sm leading-6">יתרה כוללת: {money(credit.data.balance)}. מתוכה {money(credit.data.balance-credit.data.available)} שמורים להזמנה שממתינה לאשראי, וטרם חויבו.</p>}</div><div className="billing-balance-actions"><Button className="min-h-12 h-auto rounded-full bg-teal-400 px-6 py-3 text-base font-bold text-slate-950 shadow-lg shadow-teal-500/20 hover:bg-teal-300" onClick={loadBalance}><Plus size={19}/>הטענת יתרה</Button><Button className="wallet-usage-open" variant="outline" onClick={usageHistory}><History size={19}/>היסטוריית שימושים</Button></div></CardContent></Card>
            {!balanceOnly&&<CustomerOrdersView ctx={ctx} providedOrders={orders.data?.orders}/>}

            <CustomerTopups ctx={ctx}/><section className="customer-finance-transactions space-y-3"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="!text-xl font-bold text-slate-900">טעינות וזיכויים</h2><Button variant="outline" className={miniStyle} onClick={()=>download('credits.csv',csv(ledger,['created','amount','reason','reference']))}><Download size={15}/>ייצוא תנועות</Button></div>{transactions.length?<WalletTransactions ctx={ctx} entries={transactions}/>:<p className="py-6 text-base text-slate-600">אין כרגע תנועות נוספות.</p>}<p className="customer-finance-note">חיובים על רכישות מופיעים בהיסטוריית השימושים.</p></section>
            {!!packages.data?.records?.length&&<section className="space-y-3"><h2 className="!text-xl font-bold text-slate-900">חבילות לטעינת יתרה</h2><div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{packages.data.records.map((pack:Row)=><Card key={pack.id} className={cardStyle}><CardContent className="space-y-3 p-5"><h3 className="!text-lg font-bold text-slate-800">{pack.name}</h3><p className="text-sm leading-6 text-slate-600">{pack.description}</p><strong className="block text-2xl font-bold text-slate-900">{money(Number(pack.price||0)*100)}</strong><Button variant="outline" className={viewActionStyle} onClick={()=>ctx.run(()=>api('records/ticket','POST',{name:'רכישת חבילה '+pack.name,subject:'בקשת רכישת חבילת יתרה',message:pack.description,package_id:pack.id,status:'open'}),'בקשת הרכישה נשלחה').catch(()=>{})}>בקשת רכישה</Button></CardContent></Card>)}</div></section>}
        </>}
    </div></div>;
}
