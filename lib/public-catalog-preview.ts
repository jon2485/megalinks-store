import {all,one} from './server';
import {pricedSite} from './pricing';
import type {Row} from './shared';

// Deliberately narrower than the customer API. Never serialize raw DB rows,
// arbitrary JSON, supplier identifiers, emails, stock, notes or procurement costs.
const fields=['id','name','url','category','dr','ur','active','logo_url','features','turnaround_days','is_on_sale','price_cents','regular_price_cents','price_source'] as const;
export function previewWebsite(source:Row):Row {
    const result:Row={};
    for(const key of fields){
        const value=source[key];
        if(value===undefined||value===null)continue;
        if(key==='features'){result[key]=Array.isArray(value)?value.filter(x=>typeof x==='string'):[];continue;}
        if(['string','number','boolean'].includes(typeof value))result[key]=value;
    }
    return result;
}
export async function publicCatalogPreview():Promise<Row[]> {
    try {
        // Read-only, anonymous regular-tier prices. Never call actor() or use a
        // signed-in customer's personalized prices in prerendered public HTML.
        const [rows,tier,overrides]=await Promise.all([
            all('SELECT id,name,url,category,dr,active,price,data FROM websites WHERE active=1 ORDER BY dr DESC,name LIMIT 24'),
            one("SELECT * FROM pricing_tiers WHERE id='regular'"),
            all("SELECT website_id,price,scope,owner_id FROM pricing_overrides WHERE scope='tier' AND owner_id='regular'"),
        ]);
        if(!tier)return [];
        return rows.map(row=>previewWebsite(pricedSite(row,{tier,overrides})));
    } catch {
        // The live API remains authoritative; database outages must not remove
        // the public heading or fall back to the old bundled price list.
        console.error('Public catalog prerender unavailable');
        return [];
    }
}
