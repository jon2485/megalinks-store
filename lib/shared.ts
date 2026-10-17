export type Row = Record<string, any>;
export const money = (cents: number) => new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 2 }).format((cents || 0) / 100);
export const when = (value: string) => value ? new Date(value).toLocaleDateString('he-IL', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
export const stages: Record<string, string> = { on_account:'חיוב בחשבון החודשי',demo_monthly:'חשבון חודשי — הדגמה',demo_paid: 'רכישת הדגמה הושלמה', demo_completed: 'הדגמת פרסום הושלמה', pending: 'ממתין לתשלום', awaiting_approval: 'ממתין לאישור מנהל', draft: 'טיוטה', writing: 'בכתיבה', admin_review: 'ממתין לאישור מנהל', review: 'ממתין לאישור לקוח', revisions: 'נדרשים תיקונים', approved: 'מאושר לפרסום', sent: 'נשלח למפרסם', published: 'פורסם', cancelled: 'בוטל', paid: 'שולם', in_progress: 'בטיפול', completed: 'הושלם', open: 'פתוח', closed: 'סגור', requested: 'בקשה חדשה', failed: 'נכשל', succeeded: 'הושלם' };
export const writingStyles = ['מקצועי וסמכותי', 'שיווקי עם הנעה לפעולה', 'SEO עם אזכור מותג', 'SEO ללא אזכור מותג', 'מותאם למנועי AI', 'ראיון ותדמית'];
export const articleTransitions: Record<string, string[]> = { draft: ['writing', 'admin_review', 'review', 'cancelled'], writing: ['admin_review', 'review', 'revisions', 'cancelled'], admin_review: ['approved', 'revisions', 'cancelled'], review: ['admin_review', 'approved', 'revisions', 'cancelled'], revisions: ['writing', 'admin_review', 'review', 'cancelled'], approved: ['sent', 'review', 'cancelled'], sent: ['published', 'revisions'], published: [], cancelled: [] };
export function httpUrl(value: string): string { if (!value)
    return ''; const u = new URL(value); if (!['http:', 'https:'].includes(u.protocol))
    throw new Error('יש להזין כתובת http או https'); return u.href; }
export function calculateQuote(items: {
    price: number;
    quantity: number;
}[], percent: number, vatPercent: number) { const subtotal = items.reduce((n, x) => n + x.price * x.quantity, 0); const discount = Math.round(subtotal * percent / 100); const vat = Math.round((subtotal - discount) * vatPercent / 100); return { subtotal, discount, vat, total: subtotal - discount + vat }; }
export function textToHtml(text: string) { return text.split(/\n\s*\n/).map(p => '<p>' + p.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>') + '</p>').join(''); }
export function plainText(html: string) { return html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim(); }

export function websitePricing(site: Row) {
    const regular = Number(site.price ?? site.regular_price_cents ?? site.price_cents ?? 0);
    const sale = Number(site.sale_price_cents);
    const active = !!site.is_on_sale && (!site.sale_ends || Date.parse(site.sale_ends) >= Date.now());
    return { regular_price_cents: regular, price_cents: active && Number.isSafeInteger(sale) && sale >= 0 && sale < regular ? sale : regular, is_on_sale: active };
}
