import type { Row } from './shared';

// Owner approved 26.11.2026 (design/bulk-order/spec.md). The template has a title row, a hint row, an example banner and an
// example row; old files (one header row, "מילים לכתיבה בתשלום") and CSV keep working.
export const bulkContent = { self: 'אני אכין את התוכן', ai: 'כתיבה עם AI', editorial: 'כתיבה מקצועית' } as const;
export type BulkContent = keyof typeof bulkContent;
export const bulkContentChoices = (ai: boolean) => [bulkContent.self, ...(ai ? [bulkContent.ai] : []), bulkContent.editorial];
export const bulkTemplateHeaders = ['אתר ★', 'איך התוכן יוכן', 'נושא הכתבה', 'מספר מילים', 'מותג', 'מילת מפתח (עוגן)', 'קישור', 'לקוח הסוכנות', 'הנחיות', 'סוג שורה'];
/** The old single-sheet template, still accepted on upload. */
export const bulkHeaders = ['אתר', 'נושא הכתבה (לא חובה)', 'מותג (לא חובה)', 'עוגן (לא חובה)', 'קישור (לא חובה)', 'לקוח הסוכנות', 'מילים לכתיבה בתשלום', 'הנחיות (לא חובה)'];
export const bulkExampleMarker = 'דוגמה בלבד — לא להזמנה';
export const BULK_WORD_PRICE_AGOROT = 15;

const norm = (v: unknown) => String(v ?? '').trim().toLocaleLowerCase();
const heading = (v: unknown) => String(v ?? '').replace(/[★*]/g, '').replace(/\(לא חובה\)/g, '').replace(/\s+/g, ' ').trim();
const filled = (v: unknown) => String(v ?? '').trim() !== '';
const wholeWords = (v: unknown) => { const n = Number(String(v ?? '').trim()); return Number.isInteger(n) && n >= 100 && n <= 5000; };
const siteKey = (v: unknown) => norm(v).replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');

export function bulkContentOf(text: unknown): BulkContent | '' {
    const t = norm(text);
    if (!t || t === norm(bulkContent.self)) return 'self';
    if (t === norm(bulkContent.ai) || t === 'ai') return 'ai';
    if (t === norm(bulkContent.editorial)) return 'editorial';
    return '';
}

export function bulkRowError(row: Row, catalog: Row[], customers: Row[], options: { ai?: boolean } = {}): string {
    if (!catalog.some(site => site.id === row.website_id && site.active !== 0)) return row.name ? `האתר „${row.name}” לא נמצא בקטלוג. בחרו אתר מהרשימה` : 'בחרו אתר מהרשימה';
    if (row.customer_ref && !row.customer_id) return row.customer_error || 'בחרו לקוח מהרשימה';
    if (row.customer_id && !customers.some(c => c.id === row.customer_id)) return 'הלקוח אינו זמין בחשבון שלכם';
    if (Number(row.quantity) !== 1) return 'כל שורה מיועדת לכתבה אחת. פצלו כתבות נוספות לשורות נפרדות';
    if (!row.content) return `בחרו איך התוכן יוכן: ${bulkContentChoices(!!options.ai).join(', ')}`;
    if (row.content === 'ai' && !options.ai) return 'כתיבה עם AI לא זמינה כרגע. בחרו „אני אכין את התוכן” או „כתיבה מקצועית”';
    if (row.content === 'editorial' && !wholeWords(row.words)) return 'כתיבה מקצועית: הזינו מספר מילים שלם בין 100 ל־5,000';
    if (row.content !== 'editorial' && filled(row.words) && !wholeWords(row.words)) return 'מספר מילים: מספר שלם בין 100 ל־5,000, או ריק';
    if (row.content === 'ai' && !filled(row.topic) && !filled(row.anchor) && !filled(row.target_url)) return 'כדי שה־AI יכתוב, מלאו נושא, מילת מפתח או קישור';
    if (String(row.notes || '').length > 6000) return 'ההנחיות ארוכות מ־6,000 תווים. קצרו אותן בשורה הזאת';
    if (row.target_url) { try { const url = new URL(row.target_url); if (!['http:', 'https:'].includes(url.protocol)) return 'הקישור חייב להתחיל ב־http או https'; } catch { return 'כתובת הקישור אינה תקינה. היא צריכה להתחיל ב־https://'; } }
    return '';
}

/** The closest active site name for a mistyped one ("אולי התכוונתם?"), or null when nothing is close enough. */
export function bulkSuggestSite(name: string, catalog: Row[]): Row | null {
    const a = siteKey(name); if (a.length < 2) return null;
    const distance = (x: string, y: string) => { const d = Array.from({ length: y.length + 1 }, (_, j) => j); for (let i = 1; i <= x.length; i++) { let prev = d[0]; d[0] = i; for (let j = 1; j <= y.length; j++) { const tmp = d[j]; d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (x[i - 1] === y[j - 1] ? 0 : 1)); prev = tmp; } } return d[y.length]; };
    let best: Row | null = null, score = Infinity;
    for (const site of catalog) { if (site.active === 0) continue; for (const key of [siteKey(site.name), siteKey(site.url)]) { if (!key) continue; const s = key.includes(a) || a.includes(key) ? Math.abs(key.length - a.length) * .5 : distance(a, key); if (s < score) { score = s; best = site; } } }
    return best && score <= Math.max(2, Math.floor(a.length / 4)) ? best : null;
}

export function parseBulkSheet(sheet: string[][], catalog: Row[], customers: Row[]): Row[] {
    const start = sheet.slice(0, 12).findIndex(r => (r || []).some(v => ['אתר', 'website'].includes(heading(v))));
    if (start < 0) throw new Error('חסרה עמודת אתר. השתמשו בתבנית ההזמנה המרוכזת.');
    const headers = (sheet[start] || []).map(heading);
    const markerColumn = headers.indexOf('סוג שורה');
    const source = sheet.slice(start + 1);
    const at = (r: string[], ...keys: string[]) => { const index = headers.findIndex(h => keys.includes(h)); return index < 0 ? '' : String(r[index] ?? '').trim(); };
    // The hint row, the banner and the example are marked in the hidden "סוג שורה" column; an empty row is skipped.
    const rows = source.filter(r => !(markerColumn >= 0 && filled(r[markerColumn])) && (r || []).some(filled));
    if (!rows.length) throw new Error('הקובץ אינו מכיל הזמנות. מלאו שורות מתחת לשורת הדוגמה.');
    if (rows.length > 500) throw new Error('אפשר לייבא עד 500 שורות בכל פעם');
    const hasContent = headers.includes('איך התוכן יוכן');
    return rows.map((r, index) => {
        const name = at(r, 'אתר', 'website');
        const sites = catalog.filter(w => w.active !== 0 && (norm(w.name) === norm(name) || (siteKey(w.url) && siteKey(w.url) === siteKey(name))));
        const customerRef = at(r, 'לקוח הסוכנות', 'לקוח', 'customer', 'customer_id');
        const matches = customerRef ? customers.filter(c => [c.id, c.name, c.email].some(v => norm(v) && norm(v) === norm(customerRef))) : [];
        const oldWords = at(r, 'מילים לכתיבה בתשלום', 'editorial_words');
        const content = hasContent ? bulkContentOf(at(r, 'איך התוכן יוכן')) : filled(oldWords) ? 'editorial' : 'self';
        const row: Row = {
            id: String(index), name, website_id: sites.length === 1 ? sites[0].id : '',
            content, content_text: hasContent ? at(r, 'איך התוכן יוכן') : '',
            words: hasContent ? at(r, 'מספר מילים', 'words') : oldWords,
            topic: at(r, 'נושא הכתבה', 'נושא', 'topic'), brand: at(r, 'מותג', 'brand'), anchor: at(r, 'מילת מפתח (עוגן)', 'עוגן', 'anchor'),
            target_url: at(r, 'קישור', 'target_url'), quantity: at(r, 'כמות', 'quantity') || '1', notes: at(r, 'הנחיות', 'notes'),
            customer_ref: customerRef, customer_id: matches.length === 1 ? matches[0].id : '',
            customer_error: matches.length > 1 ? 'יש כמה לקוחות בשם הזה. בחרו את הלקוח המתאים' : 'הלקוח לא נמצא. בחרו לקוח או הוסיפו אותו ב„הלקוחות שלי”',
        };
        return row;
    });
}

export const bulkEditorialAgorot = (row: Row) => row.content === 'editorial' && wholeWords(row.words) ? Number(row.words) * BULK_WORD_PRICE_AGOROT : 0;

export function bulkCartPayload(row: Row): Row {
    if (Number(row.quantity) !== 1) throw new Error('כל שורה מיועדת לכתבה אחת');
    const editorial = row.content === 'editorial', ai = row.content === 'ai';
    const topic = String(row.topic || '').trim() || (ai && String(row.anchor || '').trim() ? 'כתבה בנושא ' + String(row.anchor).trim() : 'כתבה עבור ' + row.name);
    return {
        website_id: row.website_id, topic, brand: row.brand, notes: row.notes || '', anchor: row.anchor, target_url: row.target_url, quantity: 1,
        customer_id: row.customer_id || '', editorial, ...(editorial ? { editorial_words: Number(row.words) } : {}),
        ...(ai ? { auto_ai: true, ...(filled(row.words) ? { words: Number(row.words) } : {}) } : {}),
        content_type: 'ai', style: 'מקצועי וסמכותי',
    };
}
