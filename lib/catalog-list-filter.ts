export type CatalogSite = { id: string; name: string; url: string };

export type ListMatch = { siteId: string; source: string };
export type ListReview = { matches: ListMatch[]; unmatched: string[] };

const clean = (value: string) => value.trim().replace(/^[\s"'()\[\]{}<>«»]+|[\s"'()\[\]{}<>«».,;:!?]+$/g, '');
const normalizeName = (value: string) => value.trim().toLocaleLowerCase().replace(/[\s\-_]+/g, ' ');

function address(value: string) {
    try {
        const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
        return { host: url.hostname.toLowerCase().replace(/^www\./, ''), path: url.pathname.replace(/\/+$/, '').toLowerCase() };
    } catch { return null; }
}

function match(value: string, sites: CatalogSite[]) {
    const candidate = clean(value);
    const exactName = sites.filter(site => normalizeName(site.name) === normalizeName(candidate));
    if (exactName.length === 1) return exactName[0];
    const parsed = address(candidate);
    if (!parsed || !parsed.host.includes('.')) return undefined;
    const sameHost = sites.filter(site => address(site.url)?.host === parsed.host);
    if (sameHost.length) {
        const byPath = sameHost.filter(site => {
            const path = address(site.url)?.path || '';
            return path && (parsed.path === path || parsed.path.startsWith(`${path}/`));
        }).sort((a, b) => (address(b.url)?.path.length || 0) - (address(a.url)?.path.length || 0));
        if (byPath.length) return byPath[0];
        const root = sameHost.filter(site => !address(site.url)?.path);
        return root.length === 1 ? root[0] : sameHost.length === 1 ? sameHost[0] : undefined;
    }
    // Similar domains can belong to different publishers. Never guess a replacement.
    return undefined;
}

export function extractCatalogAddresses(text: string): string[] {
    const input = text.replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, '');
    const pattern = /https?:\/\/[^\s<>"'״׳()[\]{},;|]+|(?<![\p{L}\p{N}@._-])(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:[a-z]{2,63}|xn--[a-z0-9-]{2,59})(?::\d{1,5})?(?:[/?#][^\s<>"'״׳()[\]{},;|]*)?/giu;
    const seen = new Set<string>();
    return [...input.matchAll(pattern)].flatMap(result => {
        const candidate = clean(result[0]), parsed = address(candidate);
        if (!parsed || !parsed.host.includes('.')) return [];
        const key = parsed.host + parsed.path;
        if (seen.has(key)) return [];
        seen.add(key);
        return [candidate];
    });
}

export function parseCatalogList(text: string, sites: CatalogSite[]): ListReview {
    const matches: ListMatch[] = [], unmatched: string[] = [];
    const seen = new Set<string>();
    const urls = extractCatalogAddresses(text);
    // If a message contains addresses, only those addresses are candidates.
    // Keep exact catalog-name lookup for users who paste a name-only list.
    const candidates = urls.length ? urls : text.split(/[\n\r;,\t]+/).map(clean).filter(value => value && sites.some(site => normalizeName(site.name) === normalizeName(value)));
    for (const value of candidates) {
        const site = match(value, sites);
        if (site) {
            if (!seen.has(site.id)) { matches.push({siteId:site.id,source:value}); seen.add(site.id); }
        } else if (!unmatched.includes(value)) unmatched.push(value);
    }
    return { matches, unmatched };
}
