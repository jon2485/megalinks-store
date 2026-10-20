'use client';
import './cart-checkout-refresh.css';
import EditorialAddon from './cart-editorial-addon';
import CheckoutPaymentTiles from './checkout-payment-tiles';
import {MonthlyCheckoutNotice} from './monthly-checkout-notice';
import {BankTransferInstructions} from './payment-review';
import React,{useEffect,useRef,useState} from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Trash2, ShoppingCart, PenLine, Plus, Minus, Bell, ChevronLeft, ReceiptText } from 'lucide-react';
import { api,useData } from '@/lib/client';
import { Row,money } from '@/lib/shared';
import { Ctx,Heading,Field,Pick,Badge,ErrorBox,Empty } from './workspace';
import { toast } from 'sonner';
import PremiumPurchasedView from './purchased-view';
import { WorkspaceAccountControls } from './workspace-account-controls';

const cartButtonStyle = 'min-h-12 h-auto whitespace-normal rounded-full bg-teal-400 px-5 py-3 text-base font-bold text-slate-950 shadow-lg shadow-teal-500/20 transition-all hover:bg-teal-300 hover:shadow-teal-500/30 focus-visible:ring-teal-600';
function CartCheckoutJourney({checkout}:{checkout:boolean}){return <ol className="cart-checkout-steps" aria-label="שלבי הרכישה">{['סל הפרסום','פרטי הזמנה ותשלום','אישור'].map((label,index)=><li key={label} aria-current={index===(checkout?1:0)?'step':undefined}><b>{index+1}</b><span>{label}</span></li>)}</ol>;}

const cartCardStyle = 'cart-item-card min-w-0 gap-0 overflow-hidden rounded-2xl border-cyan-100 bg-white py-0 shadow-sm';

export function PurchaseTopBar({ctx,cartCount,checkoutOnly=false,pageTitle}:{ctx:Ctx;cartCount:number;checkoutOnly?:boolean;pageTitle?:string}) {
    return <div className="workspace-premium-topbar">
        <div className="workspace-topbar-context flex min-w-0 items-center gap-2 text-sm text-slate-400"><button className="hidden whitespace-nowrap hover:text-teal-700 sm:block" onClick={()=>ctx.go('catalog')}>קטלוג אתרים</button><ChevronLeft className="hidden shrink-0 sm:block" size={14}/><span className="truncate font-medium text-slate-700">{pageTitle || (checkoutOnly?'סיכום ותשלום':'סל פרסום')}</span></div>
        <div className="workspace-header-actions"><div className="hidden border-l border-slate-100 pl-4 text-sm text-slate-500 xl:block">היתרה שלך<b className="mt-1 block text-sm text-slate-700">{money(ctx.user?.credits||0)}</b></div><WorkspaceAccountControls ctx={ctx}/><Button className="workspace-header-cart h-10 rounded-full bg-slate-900 px-3 text-sm font-semibold text-white hover:bg-slate-800" onClick={()=>ctx.go('cart')}><ShoppingCart size={16}/>סל פרסום ({cartCount})</Button></div>
    </div>;
}

export function Journey({step=1,premium=false}:{step?:number;premium?:boolean}) {
    if(premium)return <ol className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5" aria-label="שלבי הרכישה">{['בחירת אתר','סל ותשלום הדגמה','הכנת התוכן','אישור מנהל','טיפול הספק'].map((label,i)=><li key={label} aria-current={step===i+1?'step':undefined} className={'flex min-w-0 items-center gap-2 rounded-xl px-2 py-2.5 text-sm leading-snug '+(step===i+1?'bg-orange-50 font-semibold text-orange-900':'text-slate-500')}><b className={'grid size-7 shrink-0 place-items-center rounded-full text-xs '+(step===i+1?'bg-orange-400 text-slate-950':'bg-slate-100 text-slate-500')}>{i+1}</b>{label}</li>)}</ol>;
    return <ol className="journey" aria-label="שלבי הרכישה">{['בחירת אתר','סל ותשלום הדגמה','הכנת התוכן','אישור מנהל','טיפול הספק'].map((label,i)=><li key={label} aria-current={step===i+1?'step':undefined} className={step===i+1?'current':''}><b>{i+1}</b>{label}</li>)}</ol>;}
export function CartFlow({ctx,checkoutOnly=false}:{ctx:Ctx;checkoutOnly?:boolean}) {
    const state=useData('cart',ctx.revision+(ctx.pricingRevision||0)),[quote,setQuote]=useState<Row|null>(null),[coupon,setCoupon]=useState(typeof window==='undefined'?'':new URLSearchParams(window.location.search).get('coupon')||''),[form,setForm]=useState<Row>({name:ctx.user?.name||'',invoice_name:ctx.user?.company||ctx.user?.name||'',phone:ctx.user?.phone||'',payment:'invoice',accepted:false}),[error,setError]=useState(''),[busy,setBusy]=useState(false),[drafts,setDrafts]=useState<Record<string,boolean>>({});
    const monthlyEnabled=!!ctx.user?.monthly_account?.enabled;
    const monthlyOpen=useData('monthly-open',ctx.revision,monthlyEnabled,15000);
    const lock=useRef(false),idem=useRef(crypto.randomUUID()),quantityLocks=useRef(new Set<string>());const [quantityBusy,setQuantityBusy]=useState<Record<string,boolean>>({}); const items:Row[]=state.data?.items||[];
    const billingDraftKey = 'postflow:checkout-billing:' + ctx.user?.id;
    const [billingLoaded, setBillingLoaded] = useState(false);
    useEffect(() => {
        setBillingLoaded(false);
        let saved: Row = {};
        try {
            const draft = JSON.parse(sessionStorage.getItem(billingDraftKey) || '{}');
            for (const key of ['name', 'invoice_name', 'phone', 'payment']) if (typeof draft?.[key] === 'string') saved[key] = key==='payment'&&draft[key].startsWith('demo_')?(draft[key]==='demo_monthly'?'monthly':'invoice'):draft[key];
        } catch { /* The checkout remains usable when browser storage is unavailable. */ }
        setForm(current => ({ ...current, ...saved,phone:saved.phone?.trim()||ctx.user?.phone||current.phone,name:saved.name?.trim()||ctx.user?.name||current.name,invoice_name:saved.invoice_name?.trim()||ctx.user?.company||ctx.user?.name||current.invoice_name }));
        setBillingLoaded(true);
    }, [billingDraftKey]);
    useEffect(() => {
        if (!billingLoaded) return;
        try { sessionStorage.setItem(billingDraftKey, JSON.stringify({ name: form.name, invoice_name: form.invoice_name, phone: form.phone,payment:form.payment })); } catch { }
    }, [billingDraftKey, billingLoaded, form.name, form.invoice_name, form.phone, form.payment]);

    useEffect(()=>{let live=true;setQuote(null);if(items.length)api('quote','POST',{coupon}).then(q=>live&&setQuote(q)).catch(e=>live&&setError(e.message));return()=>{live=false;};},[state.data]);
    const saveItem=async(id:string,b:Row)=>{setQuote(null);try{await api('cart/'+id,'PATCH',b);ctx.refresh();}catch(e){try{setQuote(await api('quote','POST',{coupon}));}catch{}throw e;}};
    const changeQuantity=async(id:string,quantity:number)=>{if(quantityLocks.current.has(id)||!Number.isInteger(quantity)||quantity<1||quantity>20)return;quantityLocks.current.add(id);setQuantityBusy(v=>({...v,[id]:true}));try{await saveItem(id,{quantity});}catch(e){setError((e as Error).message);}finally{quantityLocks.current.delete(id);setQuantityBusy(v=>({...v,[id]:false}));}};
    const checkout=async()=>{if(lock.current)return;setError('');if(!form.invoice_name.trim()){setError('יש למלא שם לחשבונית');return;}const phone=String(form.phone||ctx.user?.phone||'').trim();if(!phone){setError('מלאו טלפון ליצירת קשר');document.getElementById('checkout-phone')?.focus();return;}if(!form.accepted){setError('אשרו את פרטי ההזמנה');return;}lock.current=true;setBusy(true);try{const result=await api('checkout','POST',{...form,phone,monthly_order_id:form.payment==='monthly'?monthlyOpen.data?.order?.id:undefined,coupon:quote?.coupon?.code||'',idempotency:idem.current,expected_total:quote?.total,pricing_token:quote?.pricing_token});try{sessionStorage.removeItem(billingDraftKey);}catch{}ctx.refresh();if(result.payment_required){toast.info('ההזמנה ממתינה לאישור התשלום באשראי');try{const link=await api('orders/'+result.id+'/payment-link','POST',{});window.location.assign(link.payment_url);}catch(e){toast.error((e as Error).message);ctx.go('wallet');}return;}if(form.payment==='invoice'){toast.success('הזמנה '+result.number+' ממתינה לאישור תשלום');ctx.go('wallet');return;}toast.success(form.payment==='credits'?'התשלום הושלם':form.payment==='monthly'?'הרכישה נוספה להתחשבנות החודשית '+result.number:'רכישת ההדגמה הושלמה — אפשר להתחיל להכין תוכן');ctx.go('purchased');}catch(e){setError((e as Error).message);if(form.payment==='monthly')try{const latest=await api('monthly-open','GET',undefined,{background:true});monthlyOpen.setData?.(latest);}catch{}if(items.length)try{setQuote(await api('quote','POST',{coupon}));}catch{}}finally{setBusy(false);lock.current=false;}};
    const productList=<div className="cart-items-column"><h2 className="cart-items-title">פריטי הסל ({items.length})</h2>{!checkoutOnly&&<div className="cart-list-labels" aria-hidden="true"><span>אתר ופרטים</span><span>כמות</span><span>מחיר</span></div>}{items.map(item=><Card key={item.id} className={cartCardStyle}>
                <CardContent className="reference-product-content">
                    <div className="reference-product-heading">
                        {item.logo_url&&<div className="reference-product-logo"><img src={item.logo_url} alt={'לוגו '+item.name}/></div>}
                        <div className="reference-product-identity">
                            <h2>{item.name}</h2>
                            <a dir="ltr" href={item.url} target="_blank" rel="noreferrer">{item.url?.replace(/^https?:\/\//,'').replace(/\/$/,'')}</a>
                            {item.bundle_name&&<p className={item.bundle_applied?'text-teal-700':'text-orange-800'}>{item.bundle_applied?'חלק מחבילת '+item.bundle_name:'הטבת החבילה אינה חלה - נדרשים כל האתרים בכמות אחידה'}</p>}
                            <div className="reference-price-current">
                                <span>המחיר שלך</span>
                                <div className="reference-price-amounts"><strong><bdi>{money(item.publication_price)}</bdi></strong>{item.regular_price>item.publication_price&&<s><bdi>{money(item.regular_price)}</bdi></s>}</div>
                                <small className="reference-price-caption">{item.regular_price>item.publication_price&&<span className="reference-discount">{Math.round((1-item.publication_price/item.regular_price)*100)}% הנחה</span>}<span>לפני מע״מ</span></small>
                            </div>
                        </div>
                        <div className="reference-product-tools">
                            <Button variant="ghost" size="icon" className="reference-remove" aria-label={'הסרת '+item.name+' מהסל'} disabled={busy||quantityBusy[item.id]} onClick={()=>ctx.run(()=>api('cart/'+item.id,'DELETE'),'האתר הוסר מהסל').then(()=>setDrafts(d=>({...d,[item.id]:false}))).catch(()=>{})}><Trash2 size={18}/></Button>
                            <div className="reference-quantity"><label htmlFor={'publication-quantity-'+item.id}>כמות</label><div className="cart-quantity-stepper"><Button type="button" variant="ghost" disabled={busy||quantityBusy[item.id]||item.quantity<=1} aria-label={'הפחתת כמות עבור '+item.name} onClick={()=>changeQuantity(item.id,item.quantity-1)}><Minus size={14} aria-hidden="true"/></Button><select id={'publication-quantity-'+item.id} aria-label={'מספר כתבות לפרסום ב־'+item.name} value={item.quantity} disabled={busy||quantityBusy[item.id]} onChange={e=>changeQuantity(item.id,Number(e.target.value))}>{Array.from({length:20},(_,i)=><option key={i+1} value={i+1}>{i+1}</option>)}</select><Button type="button" variant="ghost" disabled={busy||quantityBusy[item.id]||item.quantity>=20} aria-label={'הגדלת כמות עבור '+item.name} onClick={()=>changeQuantity(item.id,item.quantity+1)}><Plus size={14} aria-hidden="true"/></Button></div></div>
                        </div>
                    </div>
                </CardContent>
                {<EditorialAddon item={item} save={b=>saveItem(item.id,b)} dirty={v=>setDrafts(d=>({...d,[item.id]:v}))}/>}
            </Card>)}</div>;
    return <div dir="rtl" className={'cart-checkout-refresh'+(checkoutOnly?' is-checkout':'') }>
        <section className="cart-hero relative isolate overflow-hidden bg-slate-900 px-4 pb-20 pt-9 sm:px-8" aria-label="סל הפרסום">
            <div className="cart-step-wrap"><CartCheckoutJourney checkout={checkoutOnly}/></div>
            <div className="mx-auto flex max-w-4xl flex-col items-center justify-center gap-5 text-center">
                {!checkoutOnly&&<img className="cart-title-art" src="/brand/cart-publication.webp" width="440" height="330" alt="" aria-hidden="true"/>}<div className="w-full text-center"><h1 className="!text-3xl font-bold !leading-tight text-white sm:!text-4xl">{checkoutOnly?<>פרטי הזמנה <span className="purchase-title-accent">ותשלום</span></>:<><span className="purchase-title-accent">סל</span> הפרסום שלך</>}</h1><p className="cart-hero-copy mx-auto mt-3 max-w-xl text-lg leading-relaxed text-slate-200 sm:text-xl">{checkoutOnly?'בדקו את הפרסומים ושירותי הכתיבה שבחרתם והשלימו את הרכישה.':'האתרים שבחרתם, בדרך לפרסום הבא'}</p></div>
                <Button className="h-11 rounded-full bg-teal-400 px-5 text-sm font-bold text-slate-950 shadow-lg shadow-teal-500/20 hover:bg-teal-300" onClick={()=>ctx.go('catalog')}><Plus size={16}/>הוספת אתר נוסף</Button>
            </div>
            <svg aria-hidden="true" viewBox="0 0 1440 70" preserveAspectRatio="none" className="pointer-events-none absolute bottom-0 left-0 h-12 w-full"><path d="M0 0Q720 120 1440 0V70H0Z" fill="#f3f7fb"/></svg>
        </section>
        <div className="cart-body relative mx-auto flex w-full max-w-4xl min-w-0 flex-col gap-5 px-4 pb-10 sm:px-6">

        <ErrorBox error={state.error}/>
        {state.loading&&!state.data?<p>טוען סל…</p>:!items.length?<Empty title="הסל ריק" action={<Button onClick={()=>ctx.go('catalog')}>בחירת אתר</Button>}/>:<>
            {!checkoutOnly&&productList}
            {checkoutOnly&&<Card className="checkout-customer-card gap-4 rounded-2xl border-slate-200 bg-white shadow-sm">
                <CardHeader><CardTitle className="text-lg text-[#071f4b]">פרטי חשבונית</CardTitle></CardHeader>
                <CardContent><div className="form-grid">
                    <Field label="שם לחשבונית *"><Input value={form.invoice_name} onChange={e=>setForm({...form,invoice_name:e.target.value})}/></Field>
                    <Field label="שם מלא"><Input value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></Field>
                    <div className="checkout-phone-field"><Field label="טלפון ליצירת קשר *"><Input id="checkout-phone" type="tel" dir="rtl" className="text-right" value={form.phone} onChange={e=>{const phone=e.target.value;setForm(current=>({...current,phone}));setError('');}}/></Field></div>
                </div></CardContent>
            </Card>}
                    {checkoutOnly&&<Card className="checkout-payment-card"><CardContent><div className="space-y-4">
                        <fieldset className="checkout-payment-field"><legend>אמצעי תשלום</legend><CheckoutPaymentTiles disabled={busy} value={form.payment} onChange={payment=>setForm({...form,payment})} options={{card:'כרטיס אשראי',invoice:'העברה בנקאית',credits:'יתרה בחשבון',...(ctx.user?.monthly_account?.enabled?{monthly:'התחשבנות חודשית'}:{})}}/></fieldset>
                        {form.payment==='monthly'&&<div className="rounded-xl border border-cyan-200 bg-cyan-50 p-4 text-sm text-slate-800"><ErrorBox error={monthlyOpen.error}/>{monthlyOpen.loading?<p>טוען הזמנה חודשית פתוחה…</p>:<><MonthlyCheckoutNotice order={monthlyOpen.data?.order} closedOrder={monthlyOpen.data?.closed_order} account={monthlyOpen.data?.account||ctx.user?.monthly_account}/></>}</div>}
                        {form.payment==='credits'&&quote&&<div className="rounded-xl border border-cyan-200 bg-cyan-50 p-4 text-sm text-slate-800"><p>מהיתרה: <b>{money(Math.min(quote.total,ctx.user?.credits_available??ctx.user?.credits??0))}</b></p><p>להשלמה באשראי: <b>{money(Math.max(0,quote.total-(ctx.user?.credits_available??ctx.user?.credits??0)))}</b></p><p className="mt-2">ההזמנה וחיוב היתרה יושלמו רק לאחר אישור מלוא התשלום.</p></div>}
                        {form.payment==='invoice'&&quote&&<><p className="checkout-bank-later">אפשר ליצור את ההזמנה עכשיו, ולבצע את ההעברה ולדווח עליה בהמשך באזור האישי.</p><BankTransferInstructions ctx={ctx} total={quote.total}/><Field label="אסמכתת העברה (רשות)"><Input value={form.bank_reference||''} onChange={e=>setForm({...form,bank_reference:e.target.value})} placeholder="אם כבר ביצעתם העברה"/></Field></>}
                        {form.payment==='card'&&<p className="rounded-xl bg-cyan-50 p-4 text-sm leading-6">תועברו לתשלום מאובטח. ההזמנה תושלם רק לאחר אישור עסקה משירות הסליקה.</p>}
                        <label className="checkbox-label"><Checkbox checked={form.accepted} onCheckedChange={accepted=>setForm({...form,accepted})}/><span>קראתי ואני מאשר/ת את <a href="/terms" target="_blank" className="underline">תנאי האתר</a> ואת פרטי ההזמנה.</span></label>
                        {Object.values(drafts).some(Boolean)&&<p className="notice">יש לשמור את מספר המילים לפני הרכישה.</p>}
                        <ErrorBox error={error}/>
                        <Button className={'w-full '+cartButtonStyle} disabled={busy||state.loading||!billingLoaded||!quote||(form.payment==='monthly'&&(monthlyOpen.loading||!!monthlyOpen.error))||Object.values(drafts).some(Boolean)} onClick={checkout}><ShoppingCart size={18}/>{busy?'משלים רכישה…':form.payment==='monthly'?'הוספה להתחשבנות החודשית':form.payment==='invoice'?'יצירת הזמנה לאישור תשלום':'מעבר לתשלום'}</Button><Button type="button" variant="ghost" disabled={busy} onClick={()=>ctx.go('cart')}>חזרה לסל הפרסום</Button>
                    </div></CardContent></Card>}
            <div className="cart-sidebar">{checkoutOnly&&productList}<Card className="cart-summary gap-0 overflow-hidden rounded-2xl border-cyan-100 bg-white py-0 shadow-sm">
                <CardHeader className="border-b border-cyan-100 bg-cyan-50 px-5 py-4 sm:px-6"><CardTitle className="flex items-center gap-2 text-lg text-slate-900"><ReceiptText size={20} className="text-teal-700"/>סיכום ההזמנה</CardTitle></CardHeader>
                <CardContent className="space-y-5 p-5 sm:p-6">
                    <dl className="space-y-3 text-base text-slate-600">
                        <div className="flex items-center justify-between gap-4"><dt>פרסום באתרי מדיה</dt><dd className="font-medium text-slate-800">{money(items.reduce((n,x)=>n+x.publication_price*x.quantity,0))}</dd></div>
                        <div className="flex items-center justify-between gap-4"><dt>שירותי כתיבה ותוכן</dt><dd className="font-medium text-slate-800">{money(items.reduce((n,x)=>n+x.editorial_price*x.quantity,0))}</dd></div>
                        {!!quote?.discount&&<div className="flex items-center justify-between gap-4"><dt>הנחה</dt><dd>−{money(quote.discount)}</dd></div>}
                        <div className="flex items-center justify-between gap-4"><dt>מע״מ {quote?.vatPercent??18}%</dt><dd className="font-medium text-slate-800">{money(quote?.vat||0)}</dd></div>
                    </dl>
                    <div className="reference-summary-total"><div><span>סה״כ לתשלום</span><small>כולל מע״מ</small></div><b aria-label={quote?money(quote.total):undefined}>{quote?<span className="reference-total-amount" dir="ltr"><span>{(Number(quote.total)/100).toLocaleString('he-IL',{minimumFractionDigits:2,maximumFractionDigits:2})}</span><span aria-hidden="true">₪</span></span>:'מחשב…'}</b></div>
                    <div className="reference-coupon flex gap-2 rounded-xl bg-slate-50 p-2"><Input className="h-11 min-w-0 flex-1 rounded-full border-slate-200 bg-white" aria-label="קופון" placeholder="קוד קופון" value={coupon} onChange={e=>setCoupon(e.target.value)}/><Button variant="outline" className="h-11 rounded-full border-slate-200 bg-white px-5 text-slate-700 hover:bg-slate-100" disabled={busy} onClick={()=>{setQuote(null);api('quote','POST',{coupon}).then(setQuote).catch(e=>setError(e.message));}}>החלה</Button></div>

                </CardContent>
            </Card>
            {!checkoutOnly&&<div className="cart-next-actions grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Button variant="outline" className="min-h-12 h-auto w-full whitespace-normal rounded-full border-teal-200 bg-white px-4 py-3 text-base font-semibold text-teal-800 hover:bg-teal-50" disabled={busy||Object.values(drafts).some(Boolean)} onClick={()=>ctx.go('catalog')}>המשך לקניות</Button>
                <Button className={'w-full '+cartButtonStyle} disabled={busy||!quote||Object.values(drafts).some(Boolean)} onClick={()=>ctx.go('checkout')}><ChevronLeft size={18}/>המשך לפרטי תשלום</Button>
            </div>}</div>
        </>}
        </div>
    </div>;
}
export function PurchasedView({ctx}:{ctx:Ctx}) {return <PremiumPurchasedView ctx={ctx}/>;}

export { default as ArticleStudio } from './article-studio';
export function SupplierInbox({ctx}:{ctx:Ctx}) {
 const state=useData('supplier-inbox',ctx.revision),[selected,setSelected]=useState(''),detail=useData('supplier-inbox/'+encodeURIComponent(selected),ctx.revision,!!selected),[url,setUrl]=useState(''),[error,setError]=useState('');const d=detail.data?.delivery,a=detail.data?.article;
 return <><Heading title={ctx.adminMode?'תור פרסום לספקים':'הפרסומים שממתינים לי'} description="כתבות שאושרו מועברות לכאן אוטומטית. ספק רואה רק משלוחים למייל שהוגדר בכרטיס הספק שלו."/><ErrorBox error={state.error||error}/><div className="notice mb-5">קישור כניסת ספק: <a href="/supplier-workspace">פורטל ספקים</a>. הספק מתחבר עם החשבון התואם למייל שבכרטיס שלו.</div><div className="connection-grid">{(state.data?.deliveries||[]).map((j:Row)=><section className="panel" key={j.id}><h3>{j.website_name}{j.supplier_sequence&&<span className="mr-2 font-bold text-teal-800">· כתבה {j.supplier_sequence}{j.supplier_stock_total!=null?' מתוך '+j.supplier_stock_total:''}</span>}</h3><p className="my-3">{j.title}</p>{ctx.adminMode&&<p>{j.supplier_name||'טרם שויך ספק'}</p>}<Badge>{({demo:'ממתין לספק — הדגמה',succeeded:'נמסר לפורטל הספק',blocked:'נדרשת השלמת פרטים',completed:'פורסם',demo_completed:'הדגמה הושלמה',writing:'במסירה'} as Row)[j.status]||j.status}</Badge>{j.error&&<p className="error-box">{j.error}</p>}<div className="flex-row mt-4"><Button variant="outline" onClick={()=>{setSelected(j.id);setUrl('');}}>פתיחת התוכן</Button>{ctx.adminMode&&['demo','succeeded'].includes(j.status)&&<Button variant="outline" onClick={()=>ctx.run(()=>api('articles/'+j.article_id+'/remind','POST',{}),'מצב התזכורת מופיע בהתראות ודיוור').catch(e=>setError(e.message))}>תזכורת לספק</Button>}{ctx.adminMode&&['blocked','failed'].includes(j.status)&&<Button onClick={()=>ctx.run(()=>api('articles/'+j.article_id+'/dispatch','POST',{}),'מצב המסירה עודכן').catch(e=>setError(e.message))}>ניסיון מסירה</Button>}</div></section>)}</div>{!state.loading&&!state.data?.deliveries?.length&&<Empty title="אין עדיין כתבות בתור" text="הכתבה תופיע כאן לאחר אישור המנהל."/>}{selected&&<section className="panel"><ErrorBox error={detail.error}/>{a&&<><h2 className="mb-4">{a.title}</h2>{a.image_id&&<figure><img className="max-h-64 object-contain" alt="תמונת הכתבה" src={'/api/supplier-inbox/'+encodeURIComponent(selected)+'?image=1'}/><figcaption>{a.image_credit}{a.image_credit_url&&<a href={a.image_credit_url} target="_blank" rel="noreferrer"> · מקור התמונה</a>}</figcaption></figure>}{a.secondary_image_id&&<figure><img className="max-h-52 object-contain" src={'/api/supplier-inbox/'+encodeURIComponent(selected)+'?image=1&secondary=1'} alt="תמונה משנית"/><figcaption>{a.secondary_image_credit}</figcaption></figure>}{a.meta_description&&<section dir="rtl" className="notice"><b>תיאור קצר / תיאור מטא</b><p className="whitespace-pre-wrap">{a.meta_description}</p></section>}{a.client_notes&&<section dir="rtl" className="notice"><b>הערות לפרסום</b><p className="whitespace-pre-wrap">{a.client_notes}</p></section>}<div className="article-preview rich-body" dangerouslySetInnerHTML={{__html:a.content}}/><Button variant="outline" onClick={()=>window.open('/api/supplier-inbox/'+encodeURIComponent(selected)+'?asset=word','_blank')}>הורדת Word</Button>{a.cancel_pending&&<p className="account-warning">התקבלה בקשת ביטול. יש לעצור טיפול ולתאם עם המנהל לפני פרסום.</p>}{a.status==='sent'&&!a.cancel_pending&&<div className="stack mt-5">{!d.demo&&<Field label="קישור לכתבה שפורסמה"><Input type="url" dir="ltr" value={url} onChange={e=>setUrl(e.target.value)}/></Field>}<Button onClick={()=>ctx.run(()=>api('supplier-inbox/'+encodeURIComponent(selected),'POST',{url}),d.demo?'הדגמת הפרסום הושלמה':'קישור הפרסום נשמר').catch(e=>setError(e.message))}>{d.demo?'סיום הדגמת פרסום':'דיווח על פרסום בפועל'}</Button></div>}</>}</section>}</>;
}
