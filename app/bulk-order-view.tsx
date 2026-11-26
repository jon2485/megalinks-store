'use client';
import React, { useMemo, useRef, useState } from 'react';
import { AlertCircle, ChevronDown, ClipboardList, Download, Lightbulb, PenLine, Sparkles, Trash2, Upload, UserPen } from 'lucide-react';
import { useData } from '@/lib/client';
import { readSpreadsheet, downloadSpreadsheetBytes } from '@/lib/office';
import { parseBulkSheet, bulkRowError, bulkCartPayload, bulkSuggestSite, bulkContent, bulkContentChoices, bulkContentOf, bulkEditorialAgorot, type BulkContent } from '@/lib/bulk-order';
import { bulkTemplateBytes, bulkTemplateName } from '@/lib/bulk-template';
import { type Row, money } from '@/lib/shared';
import { type Ctx, ErrorBox, categories } from './workspace';
import { toast } from 'sonner';
import { addToCartChecked } from './agency-buying';
import './bulk-order-page.css';

// Owner approved 26.11.2026 (design/bulk-order/mockup.html): the cart look, the full explanation with an action column
// before upload, and cart-style rows with a sticky "סיכום הקובץ" after it.
const pillClass: Record<BulkContent, string> = { self: '', ai: ' is-ai', editorial: ' is-pro' };
const domain = (url: unknown) => String(url || '').replace(/^https?:\/\//, '').replace(/\/$/, '');

export default function BulkView({ ctx }: { ctx: Ctx }) {
    const customersState = useData('records/customer', ctx.revision);
    const customers: Row[] = customersState.data?.records || [];
    const options = useData('bulk-options', ctx.revision); const ai = !!options.data?.ai_available;
    const [rows, setRows] = useState<Row[]>([]), [error, setError] = useState(''), [busy, setBusy] = useState(false), [loading, setLoading] = useState(false);
    const [tab, setTab] = useState<'all' | 'ok' | 'bad'>('all'), [open, setOpen] = useState<string[]>([]), [dragging, setDragging] = useState(false);
    const lock = useRef(false), fileInput = useRef<HTMLInputElement>(null);
    const sites = useMemo(() => ctx.catalog.filter(w => w.active !== 0), [ctx.catalog]);
    const byId = useMemo(() => new Map(sites.map(w => [w.id, w])), [sites]);
    const update = (id: string, patch: Row) => setRows(rs => rs.map(r => r.id === id ? { ...r, ...patch } : r));
    const rowError = (row: Row) => bulkRowError(row, ctx.catalog, customers, { ai });
    const checked = rows.map(row => ({ row, error: rowError(row) }));
    const bad = checked.filter(c => c.error), good = checked.filter(c => !c.error);
    const shown = (tab === 'ok' ? good : tab === 'bad' ? bad : [...bad, ...good]);
    const publication = good.reduce((n, c) => n + Number(byId.get(c.row.website_id)?.price_cents || 0), 0);
    const editorial = good.reduce((n, c) => n + bulkEditorialAgorot(c.row), 0);
    const anyAi = good.some(c => c.row.content === 'ai');
    const ready = !!customersState.data && !customersState.error;
    const load = async (file: File) => {
        setLoading(true); setError('');
        try { setRows(parseBulkSheet(await readSpreadsheet(file), ctx.catalog, customers)); setTab('all'); setOpen([]); window.scrollTo?.({ top: 0, behavior: 'smooth' }); }
        catch (e) { setRows([]); setError((e as Error).message); }
        finally { setLoading(false); }
    };
    const choose = () => fileInput.current?.click();
    const download = () => downloadSpreadsheetBytes(bulkTemplateName, bulkTemplateBytes({ sites: ctx.catalog, customers, ai, categoryLabel: k => categories[k] || k }));
    const add = async () => {
        if (lock.current || !ready || !rows.length || bad.length) return;
        lock.current = true; setBusy(true); setError(''); let added = 0;
        try {
            for (const row of rows) {
                // A site already used for the chosen customer asks first (agency-buying.tsx); "no" keeps the row here.
                if (!await addToCartChecked(bulkCartPayload(row))) continue; added++;
                setRows(rs => rs.filter(r => r.id !== row.id));
            }
            ctx.refresh(); toast.success('ההזמנות נוספו לסל'); ctx.go('cart');
        } catch (e) { ctx.refresh(); setError(`${(e as Error).message} · ${added} שורות נוספו לסל. רק השורות שנותרו מוצגות כאן; אפשר לתקן ולנסות שוב.`); }
        finally { lock.current = false; setBusy(false); }
    };
    const fileField = <input ref={fileInput} type="file" accept=".xlsx,.csv" className="bp-hidden" aria-label="קובץ הזמנות" disabled={!ready || busy || loading} onChange={e => { const f = e.target.files?.[0]; if (f) void load(f); e.target.value = ''; }}/>;
    const stage = rows.length ? 3 : 2;
    return <div dir="rtl" className="bulk-page">
        <ol className="bp-steps" aria-label="שלבי ההזמנה המרוכזת">{['מורידים תבנית', 'ממלאים ומעלים', 'בודקים ומוסיפים לסל'].map((label, i) => <li key={label} className={'bp-step' + (i + 1 === stage ? ' is-on' : '')} aria-current={i + 1 === stage ? 'step' : undefined}><i>{i + 1}</i>{label}</li>)}</ol>
        <header className="bp-hero"><img src="/brand/cart-publication.webp" alt=""/><div><h1><b>הזמנה</b> מרוכזת</h1><p>מעלים קובץ, בודקים את השורות ומוסיפים לסל.</p></div></header>
        {fileField}
        {!rows.length ? <section className="bp-start">
            <div className="bp-panel bp-how">
                <div className="bp-how-head"><h2>איך זה עובד</h2><p>בוחרים עכשיו, מכינים תוכן מתי שנוח</p></div>
                <ol className="bp-steps4">
                    <li><span className="bp-sn">1</span><div><h3>מורידים תבנית ובוחרים אתרים</h3><p>מורידים את קובץ ה־Excel וממלאים שורה נפרדת לכל כתבה שרוצים להזמין. את האתר בוחרים מרשימה נפתחת בקובץ.</p><p>אפשר לבחור אתרים בלבד, גם אם עדיין אין נושא, מאמר או הנחיות.</p></div></li>
                    <li><span className="bp-sn">2</span><div><h3>כל שורה היא כתבה בפני עצמה</h3><p>רוצים שתי כתבות באותו אתר? ממלאים שתי שורות נפרדות. לכל כתבה אפשר לתת נושא והנחיות משלה. הנושא אינו חובה, ואפשר להשלים אותו בהמשך באזור האישי.</p>
                        <div className="bp-mini" role="table" aria-label="דוגמה לשתי שורות"><div role="row" className="bp-mh"><span role="columnheader">#</span><span role="columnheader">אתר</span><span role="columnheader">נושא הכתבה</span></div><div role="row"><span>1</span><span>ישראל היום</span><span>איך לבחור שטיח</span></div><div role="row"><span>2</span><span>כלכליסט</span><span className="bp-mute">משאירים ריק וממלאים בהמשך</span></div></div></div></li>
                    <li><span className="bp-sn">3</span><div><h3>מוסיפים הנחיות עכשיו — או בהמשך</h3><p>כבר יודעים מה לפרסם? ממלאים מראש נושא, מותג, מילת מפתח וקישור. עדיין מתכננים? משאירים ריק, ומשלימים אחרי הרכישה באזור האישי.</p></div></li>
                    <li><span className="bp-sn">4</span><div><h3>בוחרים מי מכין את התוכן</h3><p>בעמודה „איך התוכן יוכן” בוחרים לכל כתבה דרך משלה:</p>
                        <div className={'bp-tiles' + (ai ? '' : ' is-two')}>
                            <div className="bp-tile"><span className="bp-ti"><UserPen size={18}/></span><b>{bulkContent.self}</b><p>כותבים בעורך, מעלים מאמר מוכן מ־Word, או יוצרים טיוטה עם AI. באזור האישי, אחרי הרכישה.</p><em>בלי עלות</em></div>
                            {ai && <div className="bp-tile is-ai"><span className="bp-ti"><Sparkles size={18}/></span><b>{bulkContent.ai}</b><p>המערכת כותבת טיוטה לבד מיד אחרי התשלום, לפי הנושא, מילת המפתח או הקישור. אתם בודקים ושולחים לפרסום.</p><em>בלי עלות</em></div>}
                            <div className="bp-tile is-pro"><span className="bp-ti"><PenLine size={18}/></span><b>{bulkContent.editorial}</b><p>כותב מקצועי שלנו כותב את הכתבה. ממלאים מספר מילים, בין 100 ל־5,000.</p><em>15 אג׳ למילה · 400 מילים = 60 ₪</em></div>
                        </div>
                        <p className="bp-soft">לא בחרתם? אתם מכינים את התוכן. אחרי הרכישה אפשר לשנות, למשל להוסיף כתיבה מקצועית.</p></div></li>
                </ol>
                <p className="bp-lamp"><Lightbulb size={18} aria-hidden="true"/><span><strong>לדוגמה:</strong> בוחרים 10 אתרים עכשיו, ומשלימים את התוכן לכל כתבה כשתהיו מוכנים.</span></p>
                <details className="bp-more"><summary>פרטים נוספים למילוי הקובץ</summary><p>שיוך ללקוח הסוכנות הוא לבחירה: בוחרים מהרשימה הנפתחת בקובץ (הלקוחות מ„הלקוחות שלי”), או מזינים שם, מייל או מזהה. אם יש שמות זהים, בוחרים את הלקוח במסך הבדיקה.</p><p>כתיבה מקצועית עולה 15 אגורות למילה, לפני מע״מ.{ai ? ' כתיבה עם AI מתחילה רק אחרי שההזמנה שולמה.' : ''}</p><p>עד 500 שורות בקובץ, כתבה אחת בכל שורה. שורת הדוגמה בקובץ להמחשה בלבד ואינה נוספת להזמנה.</p></details>
            </div>
            <aside className="bp-panel bp-go" aria-label="מתחילים כאן">
                <h2>מתחילים כאן <ClipboardList size={22} aria-hidden="true"/></h2>
                <div className="bp-act"><span className="bp-an">1</span><div><b>מורידים את התבנית</b><p>קובץ Excel עם רשימת האתרים והמחירים שלכם.</p><button type="button" className="bp-cta bp-dl" onClick={download} disabled={!ready}><Download size={18} aria-hidden="true"/>הורדת תבנית Excel</button><div className="bp-sheets" aria-label="לשוניות בקובץ"><span>הזמנה</span><span>איך ממלאים</span><span>אתרים</span><span>הלקוחות שלי</span></div></div></div>
                <div className="bp-act"><span className="bp-an is-teal">2</span><div><b>מעלים את הקובץ המלא</b>
                    <div className={'bp-drop' + (dragging ? ' is-over' : '')} onDragOver={e => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files?.[0]; if (f && ready && !loading) void load(f); }}>
                        <Upload size={26} aria-hidden="true"/><span>גוררים לכאן את הקובץ</span><button type="button" className="bp-pick" onClick={choose} disabled={!ready || loading}>בחירת קובץ</button></div>
                    <small>{loading ? 'קורא את הקובץ…' : !ready && !customersState.error ? 'טוען את רשימת הלקוחות…' : 'Excel או CSV · עד 500 שורות'}</small></div></div>
                <ErrorBox error={customersState.error || error}/>
                <p className="bp-after"><b>אחרי ההעלאה</b> תראו כל שורה, ומה צריך לתקן לפני ההוספה לסל.</p>
            </aside>
        </section> : <section className="bp-review">
            <div className="bp-panel">
                <div className="bp-panel-head"><h2>השורות מהקובץ ({rows.length})</h2><div className="bp-tabs" role="group" aria-label="סינון השורות">{([['all', 'הכול', rows.length], ['ok', 'תקינות', good.length], ['bad', 'לתיקון', bad.length]] as const).map(([key, label, n]) => <button key={key} type="button" aria-pressed={tab === key} className={key === 'bad' && n ? 'is-bad' : ''} onClick={() => setTab(key)}>{label} {n}</button>)}</div></div>
                {!shown.length && <p className="bp-empty">{tab === 'bad' ? 'אין שורות לתיקון.' : 'אין שורות תקינות עדיין.'}</p>}
                {shown.map(({ row, error: why }) => {
                    const number = Number(row.id) + 1, site = byId.get(row.website_id), expanded = !!why || open.includes(row.id);
                    const suggestion = !site && row.name ? bulkSuggestSite(row.name, ctx.catalog) : null;
                    const content = (row.content || 'self') as BulkContent, words = String(row.words || '').trim();
                    const pill = row.content ? bulkContent[content] + (content === 'editorial' && words ? ` · ${words} מילים` : '') : (row.content_text || 'לא נבחר');
                    const filledCount = [row.topic, row.brand, row.anchor, row.target_url, row.notes].filter(v => String(v || '').trim()).length;
                    const customer = customers.find(c => c.id === row.customer_id);
                    return <article key={row.id} className={'bp-item' + (why ? ' is-bad' : '')} aria-label={'שורה ' + number}>
                        {why && <p className="bp-alert" role="alert"><AlertCircle size={18} aria-hidden="true"/>שורה {number}: {why}</p>}
                        <div className="bp-main">
                            <div className="bp-site"><span className={'bp-logo' + (site ? '' : ' is-q')}>{site?.logo_url ? <img src={site.logo_url} alt="" loading="lazy"/> : site ? site.name.slice(0, 2) : '?'}</span><div><span className="bp-rowno">שורה {number}</span><b>{site?.name || row.name || 'בלי אתר'}</b><small>{site ? domain(site.url) : 'לא זוהה'}</small></div></div>
                            <span className={'bp-pill' + (row.content ? pillClass[content] : ' is-none')}>{pill}</span>
                            {site ? <div className="bp-price"><b>{money(Number(site.price_cents || 0))}</b><small>{bulkEditorialAgorot(row) ? `+ ${money(bulkEditorialAgorot(row))} כתיבה · לפני מע״מ` : 'לפרסום · לפני מע״מ'}</small></div> : <span/>}
                            <button type="button" className="bp-trash" disabled={busy} aria-label={'הסרת שורה ' + number} onClick={() => setRows(rs => rs.filter(r => r.id !== row.id))}><Trash2 size={17}/></button>
                        </div>
                        {!why && <button type="button" className="bp-bar" aria-expanded={expanded} onClick={() => setOpen(o => o.includes(row.id) ? o.filter(x => x !== row.id) : [...o, row.id])}><span>פרטי הכתבה <span className="bp-meta">· {[row.topic || 'בלי נושא עדיין', customer?.name].filter(Boolean).join(' · ')}</span></span><span className="bp-chev"><em>{filledCount === 5 ? 'מלא' : filledCount ? 'חלקי' : 'ריק'}</em><ChevronDown size={17} aria-hidden="true"/></span></button>}
                        {expanded && <div className="bp-fields">
                            <label className="bp-f">אתר לפרסום<select disabled={busy} className={site ? '' : 'is-err'} value={row.website_id || ''} onChange={e => update(row.id, { website_id: e.target.value, name: byId.get(e.target.value)?.name || row.name })}><option value="">{row.name ? 'לא זוהה: ' + row.name : 'בחרו אתר'}</option>{sites.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select>
                                {suggestion && <button type="button" className="bp-suggest" onClick={() => update(row.id, { website_id: suggestion.id, name: suggestion.name })}>אולי התכוונתם ל„{suggestion.name}”?</button>}</label>
                            <label className="bp-f">איך התוכן יוכן<select disabled={busy} className={row.content ? '' : 'is-err'} value={row.content ? bulkContent[content] : ''} onChange={e => update(row.id, { content: bulkContentOf(e.target.value) })}>{!row.content && <option value="">{row.content_text ? 'לא מוכר: ' + row.content_text : 'בחרו'}</option>}{bulkContentChoices(ai || row.content === 'ai').map(label => <option key={label} value={label}>{label}{label === bulkContent.editorial ? ' · 15 אג׳ למילה' : ' · בלי עלות'}</option>)}</select></label>
                            <label className="bp-f">מספר מילים <small>{content === 'editorial' ? '(חובה, 100–5,000)' : '(לא חובה)'}</small><input disabled={busy} inputMode="numeric" className={/מילים/.test(why) ? 'is-err' : ''} value={row.words || ''} onChange={e => update(row.id, { words: e.target.value.replace(/[^\d]/g, '') })} placeholder={content === 'ai' ? 'ריק = 500' : ''}/></label>
                            <label className="bp-f">נושא הכתבה <small>(לא חובה)</small><input disabled={busy} className={/נושא, מילת מפתח/.test(why) ? 'is-err' : ''} value={row.topic || ''} placeholder="אפשר להשלים בהמשך" onChange={e => update(row.id, { topic: e.target.value })}/></label>
                            <label className="bp-f">מותג <small>(לא חובה)</small><input disabled={busy} value={row.brand || ''} onChange={e => update(row.id, { brand: e.target.value })}/></label>
                            <label className="bp-f">מילת מפתח (עוגן) <small>(לא חובה)</small><input disabled={busy} className={/נושא, מילת מפתח/.test(why) ? 'is-err' : ''} value={row.anchor || ''} onChange={e => update(row.id, { anchor: e.target.value })}/></label>
                            <label className="bp-f">קישור <small>(לא חובה)</small><input disabled={busy} dir="ltr" className={/קישור/.test(why) ? 'is-err' : ''} value={row.target_url || ''} placeholder="https://" onChange={e => update(row.id, { target_url: e.target.value })}/></label>
                            <label className="bp-f">לקוח הסוכנות<select disabled={busy} className={row.customer_ref && !row.customer_id ? 'is-err' : ''} value={row.customer_id || (row.customer_ref ? 'unresolved' : '')} onChange={e => update(row.id, { customer_id: e.target.value, customer_ref: customers.find(c => c.id === e.target.value)?.name || '' })}><option value="">ללא שיוך ללקוח</option>{row.customer_ref && !row.customer_id && <option value="unresolved" disabled>לא זוהה: {row.customer_ref}</option>}{customers.map(c => <option key={c.id} value={c.id}>{c.name}{c.email ? ' · ' + c.email : ''}</option>)}</select></label>
                            <label className="bp-f is-wide">הנחיות לכתיבה <small>(לא חובה)</small><textarea disabled={busy} maxLength={6000} value={row.notes || ''} placeholder="מסרים, דגשים או הנחיות שחשוב לכלול. אפשר להשלים בהמשך." onChange={e => update(row.id, { notes: e.target.value })}/></label>
                        </div>}
                    </article>;
                })}
            </div>
            <aside className="bp-panel bp-sum" aria-label="סיכום הקובץ">
                <h2>סיכום הקובץ <ClipboardList size={22} aria-hidden="true"/></h2>
                <dl>
                    <div><dt>שורות בקובץ</dt><dd>{rows.length}</dd></div>
                    <div><dt>תקינות</dt><dd className="is-ok">{good.length}</dd></div>
                    <div><dt>לתיקון</dt><dd className={bad.length ? 'is-bad' : ''}>{bad.length}</dd></div>
                    <div className="bp-sep"/>
                    <div><dt>פרסום באתרי מדיה</dt><dd>{money(publication)}</dd></div>
                    {editorial > 0 && <div><dt>כתיבה מקצועית</dt><dd>{money(editorial)}</dd></div>}
                    {anyAi && <div><dt>כתיבה עם AI</dt><dd>בלי עלות</dd></div>}
                </dl>
                <div className="bp-total"><span>סכום ביניים, לפני מע״מ{bad.length ? ' (שורות תקינות)' : ''}</span><b>{money(publication + editorial)}</b><span>הסיכום המלא, הנחות וקופון — בסל</span></div>
                <div className="bp-actions">
                    <button type="button" className="bp-cta" disabled={!ready || busy || !rows.length || bad.length > 0} onClick={add}>{busy ? 'מוסיף לסל…' : `הוספת ${rows.length} כתבות לסל`}</button>
                    {bad.length > 0 && <p className="bp-why">יש {bad.length} שורות לתיקון לפני ההוספה לסל</p>}
                    <button type="button" className="bp-sec" disabled={busy} onClick={choose}>העלאת קובץ אחר</button>
                </div>
                <ErrorBox error={error}/>
                <p className="bp-after"><b>אחרי התשלום:</b> {anyAi ? 'כתבות עם AI נכתבות אוטומטית ומחכות לכם באזור האישי לבדיקה ושליחה. את השאר מכינים שם.' : 'כל כתבה מופיעה באזור האישי, ושם מכינים לה תוכן.'}</p>
            </aside>
        </section>}
    </div>;
}
