import type { Row } from './shared';

export const bulkHeaders = ['אתר', 'נושא הכתבה', 'מותג (לא חובה)', 'עוגן (לא חובה)', 'קישור (לא חובה)', 'כמות', 'לקוח הסוכנות', 'מילים לכתיבה בתשלום'];
const norm = (v: unknown) => String(v ?? '').trim().toLocaleLowerCase();
export function bulkRowError(row: Row, catalog: Row[], customers: Row[]): string {
    if (!catalog.some(site => site.id === row.website_id && site.active !== 0)) return 'בחרו אתר פעיל מהקטלוג';
    if (!String(row.topic || '').trim()) return 'חסר נושא לכתבה';
    if (row.customer_ref && !row.customer_id) return row.customer_error || 'בחרו לקוח מהרשימה';
    if (row.customer_id && !customers.some(c => c.id === row.customer_id)) return 'הלקוח אינו זמין בחשבון שלכם';
    if (!Number.isInteger(Number(row.quantity)) || Number(row.quantity) < 1 || Number(row.quantity) > 20) return 'כמות הכתבות חייבת להיות בין 1 ל־20';
    if (String(row.editorial_words ?? '').trim() && (!Number.isInteger(Number(row.editorial_words)) || Number(row.editorial_words) < 100 || Number(row.editorial_words) > 5000)) return 'כתיבה בתשלום: הזינו מספר שלם בין 100 ל־5,000 מילים, או השאירו ריק';
    if (row.target_url) { try { const url = new URL(row.target_url); if (!['http:', 'https:'].includes(url.protocol)) return 'הקישור חייב להתחיל ב־http או https'; } catch { return 'כתובת הקישור אינה תקינה'; } }
    return '';
}
export function parseBulkSheet(sheet: string[][], catalog: Row[], customers: Row[]): Row[] {
    const [headings = [], ...source] = sheet;
    const headers = headings.map(v => String(v).trim());
    if (!headers.includes('אתר') && !headers.includes('website')) throw new Error('חסרה עמודת אתר. השתמשו בתבנית ההזמנה המרוכזת.');
    if (!headers.includes('נושא הכתבה') && !headers.includes('נושא') && !headers.includes('topic')) throw new Error('חסרה עמודת נושא. השתמשו בתבנית ההזמנה המרוכזת.');
    const rows = source.filter(r => r.some(v => String(v ?? '').trim()));
    if (!rows.length) throw new Error('הקובץ אינו מכיל הזמנות');
    if (rows.length > 500) throw new Error('אפשר לייבא עד 500 שורות בכל פעם');
    const at = (r: string[], ...keys: string[]) => { const index = headers.findIndex(h => keys.includes(h)); return index < 0 ? '' : String(r[index] ?? '').trim(); };
    return rows.map((r, index) => {
        const name = at(r, 'אתר', 'website');
        const sites = catalog.filter(w => norm(w.name) === norm(name) || norm(w.url).replace(/\/$/, '') === norm(name).replace(/\/$/, ''));
        const customerRef = at(r, 'לקוח הסוכנות', 'לקוח', 'customer', 'customer_id');
        const matches = customerRef ? customers.filter(c => [c.id, c.name, c.email].some(v => norm(v) && norm(v) === norm(customerRef))) : [];
        const row: Row = { id: String(index), name, website_id: sites.length === 1 ? sites[0].id : '', topic: at(r, 'נושא הכתבה', 'נושא', 'topic'), brand: at(r, 'מותג (לא חובה)', 'מותג', 'brand'), anchor: at(r, 'עוגן (לא חובה)', 'עוגן', 'anchor'), target_url: at(r, 'קישור (לא חובה)', 'קישור', 'target_url'), quantity: at(r, 'כמות', 'quantity') || '1', editorial_words: at(r, 'מילים לכתיבה בתשלום', 'editorial_words'), customer_ref: customerRef, customer_id: matches.length === 1 ? matches[0].id : '', customer_error: matches.length > 1 ? 'יש כמה לקוחות בשם הזה — בחרו את הלקוח המתאים' : 'הלקוח לא נמצא — בחרו לקוח או הוסיפו אותו ב״הלקוחות שלי״' };
        return row;
    });
}
export function bulkCartPayload(row: Row): Row {
    const editorial = String(row.editorial_words ?? '').trim() !== '';
    return { website_id: row.website_id, topic: row.topic.trim(), brand: row.brand, anchor: row.anchor, target_url: row.target_url, quantity: Number(row.quantity), customer_id: row.customer_id || '', editorial, ...(editorial ? { editorial_words: Number(row.editorial_words) } : {}), content_type: 'ai', style: 'מקצועי וסמכותי' };
}
