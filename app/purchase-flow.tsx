'use client';
import './cart-checkout-refresh.css';
import EditorialAddon from './cart-editorial-addon';
import CheckoutPaymentTiles from './checkout-payment-tiles';
import {MonthlyCheckoutNotice} from './monthly-checkout-notice';
import {BankTransferInstructions} from './payment-review';
import React,{useEffect,useRef,useState} from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Trash2, ShoppingCart, Plus, Minus, ChevronLeft, ChevronDown, Check, Pencil, ReceiptText, Download } from 'lucide-react';
import {exportCart} from '@/lib/cart-export';
import { api,useData } from '@/lib/client';
import { Row,money } from '@/lib/shared';
import { Ctx,Heading,Field,Badge,ErrorBox,Empty } from './workspace';
import { toast } from 'sonner';
import PremiumPurchasedView from './purchased-view';
import { WorkspaceAccountControls } from './workspace-account-controls';

export const formatPurchaseMoney = (cents: number) => '₪ ' + ((Number(cents) || 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });


function CartCheckoutJourney({checkout}:{checkout:boolean}){return <ol className="cart-checkout-steps" aria-label="שלבי הרכישה">{['סל הפרסום','פרטי הזמנה ותשלום','אישור'].map((label,index)=><li key={label} data-complete={checkout&&index===0} aria-current={index===(checkout?1:0)?'step':undefined}><b>{checkout&&index===0?<><Check size={17} aria-hidden="true"/><span className="sr-only">הושלם</span></>:index+1}</b><span>{label}</span></li>)}</ol>;}

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
    const cartCustomers=useData('records/customer',ctx.revision,!!ctx.user);
    const monthlyEnabled=!!ctx.user?.monthly_account?.enabled;
    const monthlyOpen=useData('monthly-open',ctx.revision,monthlyEnabled,15000);
    const lock=useRef(false),idem=useRef(crypto.randomUUID()),quantityLocks=useRef(new Set<string>());const [quantityBusy,setQuantityBusy]=useState<Record<string,boolean>>({}); const items:Row[]=state.data?.items||[];
    const billingDraftKey = 'postflow:checkout-billing:' + ctx.user?.id;
    const [billingLoaded, setBillingLoaded] = useState(false);
    useEffect(() => {
        setBillingLoaded(false);
        const saved: Row = {};
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
    const [showAllItems,setShowAllItems]=useState(false),[summaryOpen,setSummaryOpen]=useState(false);
    const money=formatPurchaseMoney;
    const pricedItems:Row[]=quote?.items||items;
    const publicationListTotal=pricedItems.reduce((sum,item)=>sum+Math.max(Number(item.regular_price)||0,Number(item.publication_price)||0)*item.quantity,0);
    const publicationTotal=pricedItems.reduce((sum,item)=>sum+Number(item.publication_price)*item.quantity,0);
    const writingTotal=pricedItems.reduce((sum,item)=>sum+Number(item.editorial_price||0)*item.quantity,0);
    const discountsTotal=publicationListTotal-publicationTotal+Number(quote?.discount||0);
    const publicationCount=items.reduce((sum,item)=>sum+Number(item.quantity),0);
    const checkoutDisabled=busy||state.loading||!billingLoaded||!quote||(form.payment==='monthly'&&(monthlyOpen.loading||!!monthlyOpen.error))||Object.values(drafts).some(Boolean);
    const productList=<section className="cart-items-column" aria-label="הפרסומים שבחרת" data-expanded={showAllItems}>
        <div className="cart-items-toolbar"><h2 className="cart-items-title">הפרסומים שבחרת ({publicationCount})</h2></div>
        {items.map(item=><Card key={item.id} className={cartCardStyle}>
            <CardContent className="reference-product-content"><div className="reference-product-heading">
                <div className="reference-product-brand">{item.logo_url&&<div className="reference-product-logo"><img src={item.logo_url} alt={'לוגו '+item.name} width={64} height={48}/></div>}<div className="reference-product-identity"><h2>{item.name}</h2><a dir="ltr" href={item.url} target="_blank" rel="noreferrer">{item.url?.replace(/^https?:\/\//,'').replace(/\/$/,'')}</a>{item.bundle_name&&<p className={item.bundle_applied?'text-teal-700':'text-orange-800'}>{item.bundle_applied?'חלק מחבילת '+item.bundle_name:'הטבת החבילה אינה חלה - נדרשים כל האתרים בכמות אחידה'}</p>}</div></div>
                <div className="reference-quantity"><label htmlFor={'publication-quantity-'+item.id}>כמות פרסומים</label><div className="cart-quantity-stepper"><Button type="button" variant="ghost" disabled={busy||quantityBusy[item.id]||item.quantity<=1} aria-label={'הפחתת כמות עבור '+item.name} onClick={()=>changeQuantity(item.id,item.quantity-1)}><Minus size={14} aria-hidden="true"/></Button><select id={'publication-quantity-'+item.id} aria-label={'מספר כתבות לפרסום ב־'+item.name} value={item.quantity} disabled={busy||quantityBusy[item.id]} onChange={e=>changeQuantity(item.id,Number(e.target.value))}>{Array.from({length:20},(_,i)=><option key={i+1} value={i+1}>{i+1}</option>)}</select><Button type="button" variant="ghost" disabled={busy||quantityBusy[item.id]||item.quantity>=20} aria-label={'הגדלת כמות עבור '+item.name} onClick={()=>changeQuantity(item.id,item.quantity+1)}><Plus size={14} aria-hidden="true"/></Button></div></div>
                <div className="reference-price-current">{item.regular_price>item.publication_price&&<s><bdi dir="ltr">{money(item.regular_price)}</bdi></s>}<strong><bdi dir="ltr">{money(item.publication_price)}</bdi></strong>{item.regular_price>item.publication_price&&<span className="reference-discount"><bdi dir="ltr">{Math.round((1-item.publication_price/item.regular_price)*100)}%</bdi> הנחה</span>}<small>לפרסום אחד · לפני מע״מ</small>{item.quantity>1&&<small className="cart-line-total">סה״כ פרסום: <bdi dir="ltr">{money(item.publication_price*item.quantity)}</bdi></small>}</div>
                <Button variant="ghost" size="icon" className="reference-remove" aria-label={'הסרת '+item.name+' מהסל'} disabled={busy||quantityBusy[item.id]} onClick={()=>ctx.run(()=>api('cart/'+item.id,'DELETE'),'האתר הוסר מהסל').then(()=>setDrafts(d=>({...d,[item.id]:false}))).catch(()=>{})}><Trash2 size={17}/></Button>
            </div></CardContent><EditorialAddon customers={cartCustomers.data?.records||[]} customersError={cartCustomers.error} customersLoading={cartCustomers.loading} item={item} save={b=>saveItem(item.id,b)} dirty={v=>setDrafts(d=>({...d,[item.id]:v}))}/>
        </Card>)}
        {items.length>2&&<Button variant="outline" className="cart-show-more" aria-expanded={showAllItems} disabled={Object.values(drafts).some(Boolean)} onClick={()=>setShowAllItems(!showAllItems)}>{showAllItems?'הצגת פחות פריטים':`הצגת יתר הפריטים (${items.length-2})`}<ChevronDown size={18}/></Button>}
    </section>;
    const checkoutItems=<section className="checkout-items-summary" aria-label="פריטי ההזמנה"><p className="checkout-item-count">{publicationCount} פרסומים</p>{pricedItems.map(item=><div className="checkout-item-summary" key={item.id}>{item.logo_url&&<img src={item.logo_url} alt={'לוגו '+item.name} width={44} height={44}/>}<div className="checkout-item-identity"><h3>{item.name}</h3><span>כמות: {item.quantity}</span></div><bdi dir="ltr" className="checkout-item-price">{money(item.price_cents*item.quantity)}</bdi></div>)}</section>;
    const summary=<aside className="cart-sidebar" aria-label="סיכום ההזמנה" data-expanded={summaryOpen}>
        {checkoutOnly&&<button type="button" className="checkout-summary-toggle" aria-expanded={summaryOpen} aria-controls="purchase-summary-details" onClick={()=>setSummaryOpen(!summaryOpen)}><span><strong>סיכום ההזמנה · {publicationCount} פרסומים</strong><bdi dir="ltr">{quote?money(quote.total):'מחשב…'}</bdi></span><ChevronDown size={20}/></button>}
        <Card className="cart-summary" id="purchase-summary-details"><CardHeader><CardTitle>סיכום ההזמנה<ReceiptText size={26} aria-hidden="true"/></CardTitle></CardHeader><CardContent>
            {checkoutOnly&&checkoutItems}
            <dl className="purchase-breakdown">
                <div><dt>פרסום באתרי מדיה</dt><dd><bdi dir="ltr">{money(publicationListTotal)}</bdi></dd></div>
                <div><dt>שירותי כתיבה ותוכן</dt><dd><bdi dir="ltr">{money(writingTotal)}</bdi></dd></div>
                {discountsTotal>0&&<div className="purchase-discount-row"><dt>הנחות</dt><dd><bdi dir="ltr">{'−'+money(discountsTotal)}</bdi></dd></div>}
                <div className="purchase-subtotal"><dt>סכום ביניים</dt><dd><bdi dir="ltr">{quote?money(quote.subtotal-quote.discount):'מחשב…'}</bdi></dd></div>
                <div><dt>מע״מ {quote?.vatPercent??18}%</dt><dd><bdi dir="ltr">{quote?money(quote.vat):'מחשב…'}</bdi></dd></div>
            </dl>
            <div className="reference-summary-total"><div><span>סה״כ לתשלום</span><small>כולל מע״מ</small></div><bdi dir="ltr">{quote?money(quote.total):'מחשב…'}</bdi></div>
            {!checkoutOnly&&<details className="purchase-coupon"><summary>יש לך קוד קופון?<ChevronDown size={16}/></summary><div className="reference-coupon"><Input aria-label="קופון" placeholder="קוד קופון" value={coupon} disabled={busy} onChange={e=>setCoupon(e.target.value)}/><Button variant="outline" disabled={busy} onClick={()=>{setQuote(null);api('quote','POST',{coupon}).then(setQuote).catch(e=>setError(e.message));}}>החלה</Button></div></details>}
            {checkoutOnly?<Button variant="outline" className="purchase-edit-cart" disabled={busy} onClick={()=>ctx.go('cart')}><Pencil size={17}/>עריכת הסל</Button>:<div className="cart-next-actions"><div className="cart-action-bar"><span className="mobile-purchase-total"><bdi dir="ltr">{quote?money(quote.total):'מחשב…'}</bdi><small>כולל מע״מ</small></span><Button className="purchase-primary" disabled={busy||!quote||Object.values(drafts).some(Boolean)} onClick={()=>ctx.go('checkout')}><span className="desktop-action-label">המשך לפרטי הזמנה ותשלום</span><span className="mobile-action-label">להמשך לתשלום</span><ChevronLeft size={18}/></Button></div><Button variant="outline" disabled={busy||Object.values(drafts).some(Boolean)} onClick={()=>ctx.go('catalog')}>המשך לקנות</Button></div>}
        </CardContent></Card>
    </aside>;
    return <div dir="rtl" className={'cart-checkout-refresh'+(checkoutOnly?' is-checkout':'')}>
        <svg className="purchase-waves" viewBox="0 0 1440 240" preserveAspectRatio="none" aria-hidden="true"><path d="M0 38 C220 -55 340 180 650 110 S1100 -10 1440 65 L1440 240 L0 240Z" fill="#75d5f2" opacity=".2"/><path d="M0 144 C270 15 380 190 690 128 S1120 190 1440 40 L1440 240 L0 240Z" fill="#49d7e5" opacity=".14"/><path d="M0 184 C300 80 480 220 800 165 S1160 80 1440 115 L1440 240 L0 240Z" fill="#b3e9fa" opacity=".22"/></svg><section className="cart-hero" aria-label={checkoutOnly?'פרטי הזמנה ותשלום':'סל הפרסום'}>
            <div className="cart-step-wrap"><CartCheckoutJourney checkout={checkoutOnly}/></div>
            <div className="purchase-intro">{!checkoutOnly&&<img className="cart-title-art" src="/brand/cart-publication.webp" width="160" height="120" alt="" aria-hidden="true"/>}<div><h1>{checkoutOnly?'פרטי הזמנה ותשלום':<><span className="purchase-title-accent">סל</span> הפרסום שלך</>}</h1><p className="cart-hero-copy">{checkoutOnly?'עוד רגע וההזמנה מוכנה.':'האתרים שבחרתם, בדרך לפרסום הבא'}</p></div><div className="purchase-hero-actions"><Button variant="outline" className="purchase-back" onClick={()=>ctx.go(checkoutOnly?'cart':'catalog')}>{checkoutOnly?<ChevronLeft size={16}/>:<Plus size={16}/>}<span>{checkoutOnly?'חזרה לסל':'הוספת אתר נוסף'}</span></Button>{!checkoutOnly&&<Button type="button" variant="outline" className="cart-export-button" disabled={busy||state.loading||!!state.error||!quote?.items?.length||Object.values(quantityBusy).some(Boolean)||Object.values(drafts).some(Boolean)} onClick={()=>{try{exportCart(quote!);toast.success('קובץ האקסל מוכן להורדה');}catch(e){toast.error((e as Error).message);}}}><Download size={17} aria-hidden="true"/>ייצוא לאקסל</Button>}</div></div>
        </section>
        <div className="cart-body"><ErrorBox error={state.error}/>
        {state.loading&&!state.data?<p role="status">טוען סל…</p>:!items.length?<Empty title="הסל ריק" action={<Button onClick={()=>ctx.go('catalog')}>בחירת אתר</Button>}/>:<>
            {!checkoutOnly&&productList}{summary}
            {checkoutOnly&&<section className="checkout-form-surface" aria-label="פרטי החשבונית ואמצעי התשלום">
                <Card className="checkout-customer-card"><CardHeader><CardTitle>פרטי החשבונית</CardTitle></CardHeader><CardContent><div className="form-grid">
                    <Field label="שם לחשבונית *"><Input id="checkout-invoice-name" autoComplete="organization" aria-required="true" value={form.invoice_name} onChange={e=>setForm({...form,invoice_name:e.target.value})}/></Field>
                    <div className="checkout-name-field"><Field label="שם מלא"><Input autoComplete="name" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></Field></div>
                    <div className="checkout-phone-field"><Field label="טלפון ליצירת קשר *"><Input id="checkout-phone" type="tel" dir="ltr" autoComplete="tel" aria-required="true" value={form.phone} onChange={e=>{const phone=e.target.value;setForm(current=>({...current,phone}));setError('');}}/></Field></div>
                </div></CardContent></Card>
                <Card className="checkout-payment-card"><CardContent><div className="checkout-payment-content">
                    <fieldset className="checkout-payment-field"><legend>איך תרצו לשלם?</legend><CheckoutPaymentTiles disabled={busy} value={form.payment} onChange={payment=>setForm({...form,payment})} options={{card:'כרטיס אשראי',invoice:'העברה בנקאית',credits:'יתרה בחשבון',...(ctx.user?.monthly_account?.enabled?{monthly:'הזמנה פתוחה חודשית'}:{})}}/></fieldset>
                    {form.payment==='monthly'&&<div className="purchase-payment-guidance"><ErrorBox error={monthlyOpen.error}/>{monthlyOpen.loading?<p>טוען הזמנה חודשית פתוחה…</p>:<MonthlyCheckoutNotice order={monthlyOpen.data?.order} closedOrder={monthlyOpen.data?.closed_order} account={monthlyOpen.data?.account||ctx.user?.monthly_account}/>}</div>}
                    {form.payment==='credits'&&quote&&<div className="purchase-payment-guidance"><p>מהיתרה: <bdi dir="ltr">{money(Math.min(quote.total,ctx.user?.credits_available??ctx.user?.credits??0))}</bdi></p><p>להשלמה באשראי: <bdi dir="ltr">{money(Math.max(0,quote.total-(ctx.user?.credits_available??ctx.user?.credits??0)))}</bdi></p><p>ההזמנה וחיוב היתרה יושלמו רק לאחר אישור מלוא התשלום.</p></div>}
                    {form.payment==='invoice'&&<><div className="purchase-payment-guidance"><strong>העברה בנקאית</strong><p>אפשר לדווח על התשלום גם לאחר אישור ההזמנה, דרך האזור האישי.</p><p>ההזמנה תיפתח לטיפול לאחר אימות קבלת התשלום.</p></div>{quote&&<details className="purchase-bank-details"><summary>פרטי ההעברה הבנקאית<ChevronDown size={16}/></summary><BankTransferInstructions ctx={ctx} total={quote.total}/></details>}<Field label="אסמכתת העברה (רשות)"><Input value={form.bank_reference||''} onChange={e=>setForm({...form,bank_reference:e.target.value})} placeholder="אם כבר ביצעתם העברה"/></Field></>}
                    {form.payment==='card'&&<p className="purchase-payment-guidance">תועברו לתשלום מאובטח. ההזמנה תושלם רק לאחר אישור עסקה משירות הסליקה.</p>}
                    <label className="checkbox-label"><Checkbox disabled={busy} checked={form.accepted} onCheckedChange={accepted=>setForm({...form,accepted})}/><span>קראתי ואני מאשר/ת את <a href="/terms" target="_blank" rel="noreferrer">תנאי השימוש</a> ואת פרטי ההזמנה</span></label>
                    <ErrorBox error={error}/>
                    {Object.values(drafts).some(Boolean)&&<p role="status" className="notice">יש לשמור את שירותי הכתיבה לפני המשך ההזמנה.</p>}
                    <div className="checkout-action-bar"><span className="mobile-purchase-total"><bdi dir="ltr">{quote?money(quote.total):'מחשב…'}</bdi><small>כולל מע״מ</small></span><Button className="purchase-primary" disabled={checkoutDisabled} onClick={checkout}><ChevronLeft size={18}/>{busy?'משלים רכישה…':form.payment==='monthly'?'הוספה להתחשבנות החודשית':form.payment==='invoice'?<><span className="desktop-action-label">אישור הזמנה בהעברה בנקאית</span><span className="mobile-action-label">אישור ההזמנה</span></>:form.payment==='credits'?'המשך לתשלום מהיתרה':'מעבר לתשלום באשראי'}</Button></div>
                </div></CardContent></Card>
            </section>}
            {!checkoutOnly&&error&&<div className="purchase-cart-error"><ErrorBox error={error}/></div>}
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
