'use client';
import React, { useRef, useState } from 'react';
import { Download, Upload, ShoppingCart, X, FileSpreadsheet, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api, useData } from '@/lib/client';
import { exportSpreadsheet, readSpreadsheet } from '@/lib/office';
import { bulkHeaders, parseBulkSheet, bulkRowError, bulkCartPayload } from '@/lib/bulk-order';
import { type Row, money } from '@/lib/shared';
import { type Ctx, ErrorBox } from './workspace';
import { toast } from 'sonner';
import {bulkTemplateBytes} from '@/lib/bulk-template';
import {downloadSpreadsheetBytes} from '@/lib/office';
import BulkInstructions from './bulk-instructions';
import './bulk-order-approved.css';

export default function BulkView({ ctx }: { ctx: Ctx }) {
    const customersState = useData('records/customer', ctx.revision);
    const customers: Row[] = customersState.data?.records || [];
    const [rows, setRows] = useState<Row[]>([]), [error, setError] = useState(''), [busy, setBusy] = useState(false), [loading, setLoading] = useState(false);
    const lock = useRef(false);
    const update = (id: string, patch: Row) => setRows(rs => rs.map(r => r.id === id ? { ...r, ...patch } : r));
    const rowError = (row: Row) => bulkRowError(row, ctx.catalog, customers);
    const articles = rows.reduce((n, row) => n + (Number(row.quantity) || 0), 0);
    const editorialTotal = rows.reduce((n, row) => n + (Number(row.editorial_words) || 0) * 15 * (Number(row.quantity) || 0), 0);
    const invalid = rows.filter(row => rowError(row)).length;
    const ready = !!customersState.data && !customersState.error;
    const load = async (file: File) => {
        setLoading(true); setError('');
        try { setRows(parseBulkSheet(await readSpreadsheet(file), ctx.catalog, customers)); }
        catch (e) { setRows([]); setError((e as Error).message); }
        finally { setLoading(false); }
    };
    const add = async () => {
        if (lock.current || !ready || !rows.length || invalid) return;
        lock.current = true; setBusy(true); setError(''); let added = 0;
        try {
            for (const row of rows) {
                await api('cart', 'POST', bulkCartPayload(row)); added++;
                setRows(rs => rs.filter(r => r.id !== row.id));
            }
            ctx.refresh(); toast.success('ההזמנות נוספו לסל'); ctx.go('cart');
        } catch (e) { ctx.refresh(); setError(`${(e as Error).message} · ${added} שורות נוספו לסל. רק השורות שנותרו מוצגות כאן; אפשר לתקן ולנסות שוב.`); }
        finally { lock.current = false; setBusy(false); }
    };
    return <div dir="rtl" className="bulk-order-approved mx-auto max-w-5xl space-y-5 text-right">
        <header className="bulk-order-intro"><h1>הזמנה מרוכזת</h1><p>מעלים קובץ, בודקים את השורות ומוסיפים לסל.</p></header>
        <BulkInstructions download={() => downloadSpreadsheetBytes('megalinks-bulk-order-template.xlsx',bulkTemplateBytes())}/>
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><label className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-cyan-200 bg-slate-50 p-5 text-center"><Upload size={27} className="text-teal-700"/><span className="text-lg font-bold text-slate-900">מעלים את הקובץ ובודקים את השורות</span><span className="text-sm text-slate-700">Excel או CSV לפי התבנית</span><Input aria-label="קובץ הזמנות" type="file" accept=".xlsx,.csv" className="max-w-sm bg-white" disabled={!ready || busy || loading} onChange={e => { const f = e.target.files?.[0]; if (f) void load(f); e.target.value = ''; }}/>{!ready && !customersState.error && <span>טוען את רשימת הלקוחות…</span>}{loading && <span>קורא את הקובץ…</span>}</label><ErrorBox error={customersState.error || error}/></section>
        {!!rows.length && <><div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-4 text-slate-800"><b>{rows.length} שורות · {articles} כתבות</b><span>{invalid ? `${invalid} שורות דורשות תיקון` : 'כל השורות תקינות'}</span></div><div className="space-y-3">{rows.map((row, index) => <article key={row.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="mb-3 flex items-center justify-between"><b className="text-base text-slate-900">שורה {index + 1}</b><Button variant="ghost" size="icon" className="rounded-full text-red-600 hover:bg-red-50" disabled={busy} aria-label={'הסרת שורה ' + (index + 1)} onClick={() => setRows(rs => rs.filter(r => r.id !== row.id))}><X size={17}/></Button></div><div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="grid gap-1.5 text-sm font-semibold text-slate-800"><span>אתר לפרסום</span><Select dir="rtl" disabled={busy} value={row.website_id || 'missing'} onValueChange={v => update(row.id, { website_id: v, name: ctx.catalog.find(w=>w.id===v)?.name||row.name })}><SelectTrigger className="h-11 w-full min-w-0 bg-white"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="missing">{row.name ? 'לא זוהה: ' + row.name : 'בחרו אתר'}</SelectItem>{ctx.catalog.filter(w => w.active !== 0).map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent></Select></label>
            <label className="grid gap-1.5 text-sm font-semibold text-slate-800"><span>נושא הכתבה (לא חובה)</span><Input placeholder="אפשר להשלים בהמשך" disabled={busy} value={row.topic} onChange={e => update(row.id, { topic: e.target.value })} className="h-11 bg-white"/></label>
            <label className="grid gap-1.5 text-sm font-semibold text-slate-800"><span>לקוח הסוכנות</span><Select dir="rtl" disabled={busy} value={row.customer_id || (row.customer_ref ? 'unresolved' : 'none')} onValueChange={v => update(row.id, { customer_id: v === 'none' ? '' : v, customer_ref: v === 'none' ? '' : customers.find(c => c.id === v)?.name || '' })}><SelectTrigger className="h-11 w-full min-w-0 bg-white"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="none">ללא שיוך ללקוח</SelectItem>{row.customer_ref && !row.customer_id && <SelectItem value="unresolved" disabled>לא זוהה: {row.customer_ref}</SelectItem>}{customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}{c.email ? ' · ' + c.email : ' · ' + c.id}</SelectItem>)}</SelectContent></Select></label>
            <label className="grid gap-1.5 text-sm font-semibold text-slate-800"><span>כמות — כתבה אחת בכל שורה</span><Input disabled={busy} type="number" min={1} max={1} value={row.quantity} onChange={e => update(row.id, { quantity: e.target.value })} className="h-11 bg-white"/></label>
            <label className="grid gap-1.5 text-sm font-semibold text-slate-800"><span>מילים לכתיבה בתשלום</span><Input disabled={busy} type="number" min={100} max={5000} placeholder="ריק = ללא תוספת" value={row.editorial_words} onChange={e => update(row.id, { editorial_words: e.target.value })} className="h-11 bg-white"/></label>
            <label className="grid gap-1.5 text-sm font-semibold text-slate-800"><span>מותג (לא חובה)</span><Input disabled={busy} value={row.brand} onChange={e => update(row.id, { brand: e.target.value })} className="h-11 bg-white"/></label>
            <label className="grid gap-1.5 text-sm font-semibold text-slate-800"><span>עוגן — המילים שיהיו קישור (לא חובה)</span><Input disabled={busy} value={row.anchor} onChange={e => update(row.id, { anchor: e.target.value })} className="h-11 bg-white"/></label>
            <label className="grid gap-1.5 text-sm font-semibold text-slate-800"><span>קישור למאמר (לא חובה)</span><Input disabled={busy} dir="ltr" value={row.target_url} onChange={e => update(row.id, { target_url: e.target.value })} className="h-11 bg-white"/></label>
            <label className="grid gap-1.5 text-sm font-semibold text-slate-800 sm:col-span-2 lg:col-span-3"><span>הנחיות לכתיבה (לא חובה)</span><Textarea disabled={busy} maxLength={6000} value={row.notes||''} onChange={e=>update(row.id,{notes:e.target.value})} placeholder="מסרים, דגשים או הנחיות שחשוב לכלול. אפשר להשלים בהמשך." className="min-h-24 resize-none bg-white"/></label>
        </div><div className="mt-3 flex flex-wrap gap-3 text-sm font-medium text-teal-800"><span>{row.editorial_words ? `תוספת כתיבה לשורה: ${money(Number(row.editorial_words) * 15 * Number(row.quantity))} לפני מע״מ` : 'ללא שירות כתיבה בתשלום'}</span>{row.customer_id && <span className="inline-flex items-center gap-1"><Users size={15}/>{customers.find(c => c.id === row.customer_id)?.name}</span>}</div><ErrorBox error={rowError(row)}/></article>)}</div><section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-teal-100 bg-teal-50 p-5"><div><b className="text-lg text-slate-900">תוספות כתיבה: {money(editorialTotal)}</b><p className="mt-1 text-sm text-slate-700">לפני מע״מ. מחירי הפרסום והסיכום המלא יוצגו בסל.</p></div><Button disabled={busy || invalid > 0 || !ready} onClick={add} className="min-h-12 w-full rounded-full bg-teal-300 px-5 font-bold text-slate-950 hover:bg-teal-200 sm:w-auto"><ShoppingCart size={18}/>{busy ? 'מוסיף לסל…' : `הוספת ${articles} כתבות לסל`}</Button></section></>}
    </div>;
}
