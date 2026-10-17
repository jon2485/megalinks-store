import type { Row } from './shared';

// Compare the combined offer with the original list prices, before site-level sales.
export function bundlePricing(sites: Row[], bundle: Row) {
    const original = sites.reduce((sum, site) => sum + Number(site.regular_price_cents ?? site.price ?? site.price_cents ?? 0), 0);
    const current = sites.reduce((sum, site) => sum + Number(site.price_cents || 0), 0);
    const final = !sites.length ? 0 : bundle.price_cents != null ? Number(bundle.price_cents) : current - Math.round(current * Number(bundle.discount || 0) / 100);
    const saving = Math.max(0, original - final);
    return { original, current, final, saving, percent: original > 0 ? Math.round(saving * 100 / original) : 0 };
}
