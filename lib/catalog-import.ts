import type { Row } from './shared';

export type ImportColumn = { key: string; label: string; kind?: 'number' | 'flag' | 'list' | 'supplier' | 'readonly' };
export type CatalogImportOperation = { id: string; create: boolean; expected_updated: string; values: Row; name: string; url: string; rowNumber: number };
export type CatalogImportPlan = { operations: CatalogImportOperation[]; missing: Row[]; errors: string[]; additions: number; updates: number };

function catalogUrl(value: string) {
    const raw = value.trim();
    if (!raw) throw Error('כתובת האתר חסרה');
    let parsed: URL;
    try { parsed = new URL(/^https?:\/\//i.test(raw) ? raw : 'https://' + raw); }
    catch { throw Error('כתובת האתר אינה תקינה'); }
    if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname.includes('.') || parsed.username || parsed.password)
        throw Error('כתובת האתר אינה תקינה');
    parsed.hash = '';
    return { url: parsed.href, key: parsed.host.toLowerCase() + parsed.pathname.replace(/\/$/, '') + parsed.search };
}

export function planCatalogImport(sheet: string[][], existing: Row[], columns: ImportColumn[], categories: Record<string, string>): CatalogImportPlan {
    const errors: string[] = [], operations: CatalogImportOperation[] = [];
    const labels = new Map(columns.map(column => [column.label.trim(), column]));
    const header = (sheet[0] || []).map(value => String(value ?? '').trim());
    const keys = header.map(label => label === 'מזהה אתר (קיים בלבד)' ? 'id' : labels.get(label)?.key || '');
    if (new Set(header.filter(Boolean)).size !== header.filter(Boolean).length) errors.push('כותרת עמודה מופיעה יותר מפעם אחת.');
    header.forEach((label, index) => { if (label && !keys[index]) errors.push('עמודה לא מוכרת: ' + label); });
    for (const key of ['name', 'url', 'category', 'price_ils']) if (!keys.includes(key)) errors.push('העמודה '+ columns.find(c => c.key === key)?.label +' חסרה. הורידו תבנית עדכנית.');
    if (errors.length) return { operations, missing: [], errors, additions: 0, updates: 0 };

    const existingById = new Map(existing.map(item => [String(item.id), item]));
    const existingByUrl = new Map<string, Row[]>();
    for (const item of existing) {
        try { const key = catalogUrl(String(item.url)).key; existingByUrl.set(key, [...(existingByUrl.get(key) || []), item]); } catch { /* Existing legacy URLs can still be matched by ID. */ }
    }
    const seenUrls = new Set<string>(), seenIds = new Set<string>();
    if (sheet.length < 2) errors.push('הקובץ ריק. מלאו שורות מתחת לכותרות.');
    if (sheet.length > 5001) errors.push('ניתן לייבא עד 5,000 אתרים בכל קובץ.');
    for (let i = 1; i < Math.min(sheet.length, 5001); i++) {
        const cells = sheet[i] || [];
        if (!cells.some(cell => String(cell ?? '').trim())) continue;
        const rowNumber = i + 1, values: Row = {};
        const record = Object.fromEntries(keys.map((key, index) => [key, String(cells[index] ?? '').trim()])) as Record<string, string>;
        try {
            const name = record.name?.trim(), categoryValue = record.category?.trim();
            if (!name) throw Error('שם האתר חסר');
            if (!categoryValue) throw Error('קטגוריה חסרה');
            const category = categories[categoryValue] ? categoryValue : Object.keys(categories).find(key => categories[key] === categoryValue);
            if (!category) throw Error('קטגוריה לא מוכרת: ' + categoryValue);
            const canonical = catalogUrl(record.url || '');
            if (seenUrls.has(canonical.key)) throw Error('כתובת האתר מופיעה פעמיים בקובץ');
            seenUrls.add(canonical.key);
            const matches = existingByUrl.get(canonical.key) || [];
            const item = record.id ? existingById.get(record.id) : matches.length === 1 ? matches[0] : undefined;
            if (record.id && !item) throw Error('מזהה האתר לא נמצא בקטלוג');
            if (!record.id && matches.length > 1) throw Error('נמצאו כמה אתרים עם אותה כתובת. השתמשו במזהה האתר מתוך הייצוא.');
            if (item && matches.some(match => match.id !== item.id)) throw Error('הכתובת משויכת לאתר אחר בקטלוג');
            if (item && seenIds.has(item.id)) throw Error('האתר מופיע פעמיים בקובץ');
            if (item) seenIds.add(item.id);
            values.name = name;
            values.url = canonical.url;
            values.category = category;
            for (let j = 0; j < keys.length; j++) {
                const key = keys[j], column = columns.find(c => c.key === key);
                if (!column || column.kind === 'readonly' || ['name', 'url', 'category'].includes(key)) continue;
                const value = String(cells[j] ?? '').trim();
                if (!value) continue; // Blank optional cells leave an existing value untouched.
                if (column.kind === 'flag') {
                    if (/^(כן|1|true|פעיל)$/i.test(value)) values[key] = true;
                    else if (/^(לא|0|false|לא פעיל)$/i.test(value)) values[key] = false;
                    else throw Error('בשדה '+column.label+' יש לכתוב כן או לא');
                } else if (column.kind === 'list') values[key] = value.split(',').map(part => part.trim()).filter(Boolean);
                else if (column.kind === 'number') {
                    if(key.startsWith('tier_')&&value==='הסר'){values[key]='הסר';continue;}
                    const number = Number(value.replace(/[₪,\s]/g, ''));
                    if (!Number.isFinite(number) || number < 0 || (['dr','ur','turnaround_days','stock_total'].includes(key) && !Number.isInteger(number)) ||
                        (['dr','ur'].includes(key) && number > 100) || (key === 'turnaround_days' && number > 365) || (key === 'stock_total' && number > 1000000) ||
                        (['price_ils','cost_ils','sale_price_ils'].includes(key) && number > 1000000))
                        throw Error('מספר לא תקין בשדה '+column.label);
                    values[key] = String(number);
                } else values[key] = value;
            }
            if (!Object.hasOwn(values, 'price_ils')) throw Error('מחיר ללקוח חסר');
            if (values.supplier_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.supplier_email)) throw Error('מייל הספק אינו תקין');
            if (values.logo_url) catalogUrl(values.logo_url);
            if (values.example_articles) for (const example of values.example_articles) catalogUrl(example);
            if (values.sale_ends && !Number.isFinite(Date.parse(values.sale_ends))) throw Error('תאריך סיום המבצע אינו תקין');
            if (values.is_on_sale === true || (values.is_on_sale !== false && item?.is_on_sale)) {
                const sale = Number(values.sale_price_ils ?? item?.sale_price_ils ?? NaN);
                if (!Number.isFinite(sale) || sale >= Number(values.price_ils)) throw Error('מחיר מבצע חייב להיות נמוך מהמחיר הרגיל');
            }
            if (!item) {
                values.features ||= ['dofollow'];
                values.language ||= 'he';
                values.turnaround_days ||= '3';
                values.cost_ils ||= '0';
            }
            if (!Object.hasOwn(values, 'active')) values.active = true;
            operations.push({ id: item?.id || crypto.randomUUID(), create: !item, expected_updated: item?.updated || '', values, name, url: canonical.url, rowNumber });
        } catch (error) { errors.push('שורה '+rowNumber+': '+(error as Error).message); }
    }
    if (!operations.length && !errors.length) errors.push('לא נמצאו אתרים בקובץ.');
    const missing = existing.filter(item => item.active && !seenIds.has(item.id));
    return { operations, missing, errors, additions: operations.filter(item => item.create).length, updates: operations.filter(item => !item.create).length };
}
