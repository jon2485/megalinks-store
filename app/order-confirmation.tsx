'use client';
import React, { useEffect, useRef, useState } from 'react';
import { Check, PenLine, Upload, CreditCard, ChevronDown, MessageCircle } from 'lucide-react';
import { api, useData } from '@/lib/client';
import { type Row } from '@/lib/shared';
import { isBankPayment, isCardPayment } from '@/lib/payment-state';
import { effectiveOrderTotal, orderCancellation } from '@/lib/order-finance';
import { PaymentReportForm } from './payment-reports';
import { ErrorBox, type Ctx } from './workspace';
import './order-confirmation.css';

const money = (cents: unknown) => { const value = Number(cents) || 0, digits = Math.round(value) % 100 ? 2 : 0; return new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value / 100); };
const WHATSAPP = 'https://wa.me/972507508850';
type State = 'paid' | 'bank' | 'checking' | 'card' | 'monthly';

/** Which version of the screen an order gets right after checkout (and after returning from card payment). */
export function confirmationState(order: Row, reportStatus?: string): State {
    if (order.paid || order.payment_settled || order.demo) return 'paid';
    if (order.on_account || order.payment === 'monthly') return 'monthly';
    if (isCardPayment(order)) return 'card';
    if (isBankPayment(order)) return reportStatus === 'pending' || order.payment_report_status === 'pending' ? 'checking' : 'bank';
    return 'paid';
}

function Mark({ tone }: { tone: 'green' | 'blue' | 'wait' }) {
    if (tone === 'wait') return <div className="oc-mark oc-clock" aria-hidden="true"><svg viewBox="0 0 84 84"><circle cx="42" cy="42" r="38" fill="#fff4e2" stroke="#f5b14d" strokeWidth="5"/><line className="oc-hand" x1="42" y1="42" x2="42" y2="20" stroke="#b25e00" strokeWidth="5" strokeLinecap="round"/><line x1="42" y1="42" x2="56" y2="48" stroke="#b25e00" strokeWidth="5" strokeLinecap="round"/><circle cx="42" cy="42" r="4" fill="#b25e00"/></svg></div>;
    const color = tone === 'green' ? '#2fc06b' : '#1673e6';
    return <div className="oc-mark oc-play" aria-hidden="true"><svg viewBox="0 0 84 84"><circle className="oc-ring" cx="42" cy="42" r="38" stroke={color}/><circle className="oc-disc" cx="42" cy="42" r="30" fill={color}/><path className="oc-tick" d="M29 43l9 9 17-19"/></svg></div>;
}

type Step = { tone?: 'done' | 'now' | 'wait'; title: string; text: React.ReactNode; tag?: string };
function Steps({ steps }: { steps: Step[] }) {
    return <ol className="oc-steps">{steps.map((step, index) => <li key={step.title} className={'oc-step' + (step.tone ? ' is-' + step.tone : '')}><span className="oc-node">{step.tone === 'done' ? <Check size={16} strokeWidth={3}/> : index + 1}</span><div><b>{step.title}{step.tag && <span className="oc-tag">{step.tag}</span>}</b><small>{step.text}</small></div></li>)}</ol>;
}

function CopyRow({ label, value, copy }: { label: string; value: React.ReactNode; copy: string }) {
    const [done, setDone] = useState(false), timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
    const run = async () => { try { await navigator.clipboard.writeText(copy); } catch { /* the value stays visible to copy by hand */ } setDone(true); if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(() => setDone(false), 2000); };
    return <div className="oc-bank-row"><div><span>{label}</span><strong>{value}</strong></div><button type="button" className="oc-copy" data-done={done} onClick={run}>{done ? 'הועתק' : 'העתקה'}</button></div>;
}

export default function OrderConfirmation({ ctx, id }: { ctx: Ctx; id: string }) {
    const state = useData('orders/' + id, ctx.revision, true, 15000);
    const order: Row | undefined = state.data?.order, articles: Row[] = state.data?.articles || [];
    const bank = useData('bank-details', ctx.revision, !!order && isBankPayment(order)).data?.bank;
    const card = useData('wallet-topups/config', ctx.revision, !!order && (isCardPayment(order) || order.payment === 'monthly')).data;
    const report = useData('orders/' + id + '/payment-report', ctx.revision, !!order && isBankPayment(order) && !order.paid, 15000).data?.report;
    const [busy, setBusy] = useState(false), [error, setError] = useState('');
    if (!order) return <section className="order-confirm" dir="rtl"><div className="oc-wrap"><ErrorBox error={state.error}/>{!state.error && <p role="status" className="oc-loading">טוען את פרטי ההזמנה…</p>}</div></section>;
    const view = confirmationState(order, report?.status), number = String(order.number || '').replace(/^#/, '');
    const sites = articles.length || Number(order.article_count) || 0, siteWord = sites === 1 ? 'אתר אחד' : sites + ' אתרים';
    const net = Number(order.subtotal || 0) - Number(order.discount || 0), due = effectiveOrderTotal(order);
    const payByCard = async () => { if (busy) return; setBusy(true); setError(''); try { const result = await api('orders/' + order.id + '/payment-link', 'POST', {}); window.location.assign(result.payment_url); } catch (e) { setError((e as Error).message); setBusy(false); } };
    const reportPayment = () => ctx.open({ kind: 'payment-report', title: 'דיווח תשלום להזמנה ' + number, description: 'הדיווח יועבר לאישור מנהל', render: (close: () => void) => <PaymentReportForm ctx={ctx} order={order} amount={due} close={close}/> });
    const toContent = <button type="button" className="oc-btn1" onClick={() => ctx.go('purchased/articles')}><PenLine size={18}/>להכנת התוכן לכתבות</button>;
    const cancelled = orderCancellation(order) === 'full';
    const hero = cancelled
        ? { mark: <Mark tone="blue"/>, pill: ['check', 'ההזמנה בוטלה · הזמנה #' + number], title: 'ההזמנה בוטלה.', text: 'אפשר לראות את הפרטים ואת הזיכוי בעמוד ההזמנות.' }
        : view === 'paid' ? { mark: <Mark tone="green"/>, pill: ['ok', (order.demo ? 'הדגמה' : 'שולם') + ' · הזמנה #' + number], title: 'ההזמנה התקבלה. אפשר להתחיל.', text: `${siteWord} שמורים עבורך. נשאר רק להכין את התוכן לכל אתר, ואנחנו נדאג לפרסום.` }
        : view === 'monthly' ? { mark: <Mark tone="blue"/>, pill: ['check', 'נוסף לחשבון החודשי · הזמנה #' + number], title: 'ההזמנה אושרה ונוספה לחיוב החודשי.', text: 'אין צורך לשלם עכשיו. הסכום יופיע בסיכום החודשי שלך, ואפשר כבר להתחיל להכין תוכן.' }
        : view === 'card' ? { mark: <Mark tone="wait"/>, pill: ['check', 'מאשרים את התשלום · הזמנה #' + number], title: 'ההזמנה נשמרה. מאשרים את התשלום באשראי.', text: 'זה לוקח בדרך כלל כמה רגעים. המסך יתעדכן לבד ברגע שהתשלום יאושר.' }
        : view === 'checking' ? { mark: <Mark tone="wait"/>, pill: ['check', 'בבדיקה · הזמנה #' + number], title: 'קיבלנו את האסמכתא. התשלום בבדיקה.', text: 'אין צורך לעשות דבר נוסף. נעדכן אותך כאן ובמייל ברגע שהתשלום יאושר.' }
        : { mark: <Mark tone="wait"/>, pill: ['wait', 'ממתין להעברה · הזמנה #' + number], title: 'ההזמנה נשמרה. נשאר רק להעביר את התשלום.', text: 'ברגע שההעברה תאושר נשלח לך הודעה, ואפשר יהיה להתחיל. העבירו בדיוק את הסכום, וכתבו את מספר ההזמנה בהערה.' };
    const steps: Step[] = view === 'paid' ? [
        { tone: 'done', title: order.demo ? 'הזמנת ההדגמה התקבלה' : 'ההזמנה והתשלום התקבלו', text: order.email ? <>החשבונית תישלח ל-<bdi>{order.email}</bdi></> : 'החשבונית תישלח למייל שלך' },
        { tone: 'now', title: 'מכינים את התוכן', tag: 'השלב שלך', text: 'כותבים בעצמכם, עם כלי ה-AI המובנה בלי עלות, או מזמינים כתיבה מקצועית.' },
        { title: 'בדיקה ופרסום באתר', text: 'אחרי שהתוכן נשלח, האתר בודק ומפרסם. זמן הפרסום של כל אתר מופיע בכרטיס שלו.' },
        { title: 'הקישור לכתבה החיה', text: 'נעדכן אותך כאן ובמייל ברגע שהכתבה עולה.' },
    ] : view === 'monthly' ? [
        { tone: 'done', title: 'נוסף לחיוב החודשי', text: 'ההזמנה נוספה לחשבון החודשי הפתוח שלך.' },
        { tone: 'now', title: 'מכינים את התוכן', tag: 'השלב שלך', text: 'כותבים בעצמכם, עם ה-AI המובנה, או מזמינים כתיבה מקצועית.' },
        { title: 'בדיקה ופרסום באתר', text: 'זמן הפרסום של כל אתר מופיע בכרטיס שלו.' },
        { title: 'חיוב בסוף החודש', text: 'חשבונית מרוכזת אחת לכל ההזמנות של החודש.' },
    ] : view === 'card' ? [
        { tone: 'done', title: 'ההזמנה נשמרה', text: `${siteWord}, ${money(net)} לפני מע״מ.` },
        { tone: 'wait', title: 'אישור התשלום באשראי', tag: 'מתעדכן', text: 'חברת הסליקה מעדכנת אותנו. אם התשלום לא הושלם, אפשר לנסות שוב מכאן.' },
        { title: 'מכינים תוכן ומפרסמים', text: 'אחרי האישור ממשיכים להכנת התוכן.' },
    ] : [
        { tone: 'done', title: 'ההזמנה נשמרה', text: `${siteWord}, ${money(net)} לפני מע״מ.` },
        view === 'checking' ? { tone: 'done', title: 'העברה בנקאית ואסמכתא', text: 'קיבלנו את פרטי ההעברה.' } : { tone: 'wait', title: 'העברה בנקאית', tag: 'השלב שלך', text: 'מעבירים את הסכום ומעלים אסמכתא. זה מזרז את האישור.' },
        view === 'checking' ? { tone: 'wait', title: 'אישור התשלום', tag: 'בבדיקה', text: 'אנחנו בודקים את ההעברה ומאשרים. נשלח הודעה ברגע שאושר.' } : { title: 'אישור התשלום', text: 'אנחנו בודקים את ההעברה ומאשרים. נשלח הודעה ברגע שאושר.' },
        { title: 'מכינים תוכן ומפרסמים', text: 'אחרי האישור ממשיכים בדיוק כמו בתשלום באשראי.' },
    ];
    const rows = articles.map(article => ({ id: article.id, name: String(article.website_name || '').trim() || 'אתר', url: String(article.website_url || '').replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''), price: Number(article.unit_price ?? article.publication_price ?? 0) + (article.editorial ? Number(article.editorial_price || 0) : 0), logo: ctx.catalog.find(site => site.id === article.website_id)?.logo_url }));
    const initial = (name: string) => name.trim().slice(0, 1).toUpperCase();
    return <section className="order-confirm" dir="rtl">
        <div className="oc-wrap">
            <div className="oc-card oc-hero">
                {hero.mark}
                <span className={'oc-pill is-' + hero.pill[0]}><span className="oc-dot"/>{hero.pill[1]}</span>
                <h1>{hero.title}</h1>
                <p>{hero.text}</p>
                <ErrorBox error={error}/>
                {!cancelled && (view === 'paid' || view === 'monthly') && <div className="oc-cta">{toContent}<button type="button" className="oc-btn2" onClick={() => ctx.go('purchased/orders')}>{view === 'monthly' ? 'לסיכום החודשי' : 'לצפייה בהזמנה'}</button></div>}
                {!cancelled && view === 'card' && <div className="oc-cta">{card?.card_enabled && <button type="button" className="oc-btn1" disabled={busy} onClick={payByCard}><CreditCard size={18}/>{busy ? 'פותח תשלום…' : 'השלמת התשלום באשראי'}</button>}<button type="button" className="oc-btn2" onClick={() => ctx.go('purchased/orders')}>לצפייה בהזמנה</button></div>}
                {cancelled && <div className="oc-cta"><button type="button" className="oc-btn2" onClick={() => ctx.go('purchased/orders')}>לצפייה בהזמנה</button></div>}
            </div>
            <div className="oc-main">
            {!cancelled && view === 'bank' && <div className="oc-card oc-sec">
                <h2>פרטי ההעברה</h2>
                <div className="oc-bank">
                    <CopyRow label="סכום להעברה (כולל מע״מ)" value={money(due)} copy={String(Math.round(due) / 100)}/>
                    <CopyRow label="הערה להעברה" value={'הזמנה ' + number} copy={'הזמנה ' + number}/>
                    {bank ? <><CopyRow label="שם המוטב" value={bank.holder} copy={String(bank.holder || '')}/><CopyRow label="בנק · סניף · חשבון" value={<bdi>{bank.bank_number} · {bank.branch} · {bank.account}</bdi>} copy={String(bank.account || '')}/></>
                        : <div className="oc-bank-row"><div><span>פרטי החשבון</span><strong>פנו אלינו לקבלת פרטי החשבון</strong></div><a className="oc-copy" href={WHATSAPP} target="_blank" rel="noreferrer">וואטסאפ</a></div>}
                </div>
                {bank?.bank_name && <p className="oc-hint">{bank.bank_name}</p>}
                <div className="oc-upload"><button type="button" className="oc-btn1" onClick={reportPayment}><Upload size={18}/>ביצעתי העברה · העלאת אסמכתא</button></div>
            </div>}
            <div className="oc-card oc-sec"><h2>מה קורה עכשיו</h2><Steps steps={steps}/></div>
            {!cancelled && (view === 'paid' || view === 'monthly') && articles.some(article => !article.editorial) && <div className="oc-soft"><span className="oc-soft-ic"><PenLine size={20}/></span><div><b>אין זמן לכתוב?</b><small>אפשר להוסיף כתיבה מקצועית לכל אחד מהאתרים גם עכשיו.</small></div><button type="button" onClick={() => ctx.go('purchased/articles')}>הוספת כתיבה</button></div>}
            </div>
            <aside className="oc-side">
            <div className="oc-card oc-sec oc-sum">
                <h2>סיכום ההזמנה</h2>
                {rows.length > 0 && <details className="oc-items">
                    <summary><span className="oc-stack" aria-hidden="true">{rows.slice(0, 3).map(row => <i key={row.id}>{row.logo ? <img src={row.logo} alt="" loading="lazy"/> : initial(row.name)}</i>)}</span><span className="oc-items-label"><b>{siteWord} בהזמנה</b><small>כתבה אחת בכל אתר</small></span><ChevronDown size={18} className="oc-chev" aria-hidden="true"/></summary>
                    <ul>{rows.map(row => <li key={row.id}><span className="oc-logo">{row.logo ? <img src={row.logo} alt="" loading="lazy"/> : initial(row.name)}</span><span className="oc-name"><b>{row.name}</b><small dir="ltr">{row.url}</small></span><strong className="oc-price">{money(row.price)}</strong></li>)}</ul>
                    <p className="oc-items-note">מחירים לפני מע״מ{Number(order.discount) > 0 ? '. ההנחה מחושבת על כל ההזמנה.' : '.'}</p>
                </details>}
                {Number(order.discount) > 0 && <><div className="oc-line"><span>מחיר רגיל</span><strong>{money(order.subtotal)}</strong></div><div className="oc-line is-save"><span>חיסכון</span><strong>−{money(order.discount)}</strong></div></>}
                <div className="oc-line"><span>לפני מע״מ</span><strong>{money(net)}</strong></div>
                <div className="oc-line"><span>מע״מ {Number(order.vat_percent ?? 18)}%</span><strong>{money(order.vat)}</strong></div>
                <div className="oc-line is-total"><span>סה״כ</span><strong>{money(order.total)}</strong></div>
            </div>
            <p className="oc-help">שאלה על ההזמנה? <a href={WHATSAPP} target="_blank" rel="noreferrer"><MessageCircle size={15} aria-hidden="true"/>דברו איתנו בוואטסאפ</a> · <bdi>050-750-8850</bdi></p>
            </aside>
        </div>
    </section>;
}
