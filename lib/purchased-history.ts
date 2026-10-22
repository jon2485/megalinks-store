import type { Row } from './shared';

const timeZone = 'Europe/Bucharest';
export function validPurchaseDate(value: unknown): Date | null {
    if (typeof value !== 'string' || !value.trim()) return null;
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date : null;
}
export function publicationDate(article: Row): Date | null {
    if (article.demo || article.status !== 'published') return null;
    // Published articles are locked; updated records the publication report.
    return validPurchaseDate(article.published_at) || validPurchaseDate(article.updated);
}
export function publicationLink(article: Row): string {
    if (article.demo || article.status !== 'published') return '';
    try { const url = new URL(article.published_url); return ['http:', 'https:'].includes(url.protocol) ? url.href : ''; } catch { return ''; }
}
export function displayPurchaseDate(date: Date): string {
    return new Intl.DateTimeFormat('he-IL', { timeZone, day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
}
export function groupPurchasesByMonth(articles: Row[]): { key: string; label: string; articles: Row[] }[] {
    const groups = new Map<string, { key: string; label: string; articles: Row[] }>();
    const dateOf = (article: Row) => validPurchaseDate(article.purchased_at) || validPurchaseDate(article.created);
    const sorted = [...articles].sort((a, b) => (dateOf(b)?.getTime() ?? 0) - (dateOf(a)?.getTime() ?? 0) || String(a.id).localeCompare(String(b.id)));
    for (const article of sorted) {
        const date = dateOf(article);
        const parts = date ? new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit' }).formatToParts(date) : [];
        const key = date ? `${parts.find(part => part.type === 'year')!.value}-${parts.find(part => part.type === 'month')!.value}` : 'unknown';
        const label = date ? new Intl.DateTimeFormat('he-IL', { timeZone, month: 'long', year: 'numeric' }).format(date) : 'ללא תאריך רכישה';
        if (!groups.has(key)) groups.set(key, { key, label, articles: [] });
        groups.get(key)!.articles.push(article);
    }
    return [...groups.values()].sort((a, b) => a.key === 'unknown' ? 1 : b.key === 'unknown' ? -1 : b.key.localeCompare(a.key));
}

export type PurchaseStage = 'editing' | 'approval' | 'publication' | 'published';
export const purchaseStages: { key: PurchaseStage; label: string }[] = [
    { key: 'editing', label: 'קישורים בעריכה' },
    { key: 'approval', label: 'ממתינים לאישור' },
    { key: 'publication', label: 'ממתינים לפרסום' },
    { key: 'published', label: 'קישורים שפורסמו' },
];
export function purchaseStage(article: Row): PurchaseStage | 'demo-completed' | null {
    if (article.status === 'cancelled') return null;
    if (article.status === 'demo_completed' || (article.status === 'published' && article.demo)) return 'demo-completed';
    if (article.status === 'published') return 'published';
    if (['admin_review', 'scheduled'].includes(article.status)) return 'approval';
    if (['approved', 'sent'].includes(article.status)) return 'publication';
    return 'editing';
}
