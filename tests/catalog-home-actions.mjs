import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// Exercise the production component's callbacks with isolated hooks/data. No live APIs.
const require = createRequire(realpathSync('node_modules/wrangler') + '/package.json');
const { build } = require('esbuild');
const react = realpathSync('node_modules/react/index.js');
const categorySource = readFileSync('app/workspace.tsx', 'utf8').match(/export const categories: Record<string, string> = (\{[^;]+\});/)[1];
let cells = [], cursor = 0, search = '', calls = [];
globalThis.homeHooks = {
  state(initial) {
    const i = cursor++;
    if (!(i in cells)) cells[i] = typeof initial === 'function' ? initial() : initial;
    return [cells[i], value => cells[i] = typeof value === 'function' ? value(cells[i]) : value];
  },
};
globalThis.homeApi = (...args) => { calls.push(['api', ...args]); return Promise.resolve({}); };
globalThis.homeDownload = (...args) => calls.push(['download', ...args]);
await build({
  entryPoints: ['app/catalog-view.tsx'], outfile: '.sites-runtime/catalog-home-actions.mjs',
  bundle: true, platform: 'node', format: 'esm', jsx: 'automatic', loader: { '.css': 'empty' },
  external: [react, 'react/jsx-runtime'], plugins: [{ name: 'isolated-home-fixtures', setup(b) {
    b.onResolve({ filter: /^(react|@\/lib\/client|\.\/workspace|\.\/workspace-account-controls)$/ }, a => ({ path: a.path, namespace: 'fixture' }));
    b.onLoad({ filter: /.*/, namespace: 'fixture' }, a => ({ loader: 'js', contents:
      a.path === 'react' ? `export * from ${JSON.stringify(react)};export {default} from ${JSON.stringify(react)};export const useState=v=>globalThis.homeHooks.state(v),useEffect=()=>{},useMemo=f=>f(),useRef=v=>({current:v});` :
      a.path === './workspace' ? `export const categories=${categorySource};` :
      a.path === './workspace-account-controls' ? 'export function WorkspaceAccountControls(){return null;}' :
      'export const useData=()=>({data:{favorites:[{kind:"favorite",website_id:"b"}]},loading:false});export const api=(...args)=>globalThis.homeApi(...args);export const csv=(rows,columns)=>({rows,columns});export const download=(...args)=>globalThis.homeDownload(...args);'
    }));
  } }],
});
const { default: Catalog, PublicationCard } = await import(pathToFileURL(realpathSync('.sites-runtime/catalog-home-actions.mjs')));
const ctx = {
  user: { role: 'customer' }, revision: 0,
  catalog: [
    { id: 'a', name: 'טכנולוגיה לדוגמה', url: 'https://tech.example.test', category: 'tech', active: 1, price_cents: 30000, dr: 70 },
    { id: 'b', name: 'חדשות לדוגמה', url: 'https://news.example.test', category: 'news_national', active: 1, price_cents: 20000, dr: 50, is_on_sale: true },
    { id: 'hidden', name: 'אתר לא פעיל', url: 'https://inactive.example.test', active: 0, price_cents: 1, dr: 99 },
  ],
  go: page => calls.push(['go', page]), open: config => calls.push(['open', config]), run: fn => fn(),
};
const nodes = n => !n || typeof n !== 'object' ? [] : [n, ...[n.props?.children].flat(Infinity).flatMap(nodes)];
const text = n => n == null ? '' : typeof n === 'string' || typeof n === 'number' ? String(n) : [n.props?.children].flat(Infinity).map(text).join('');
const render = () => { cursor = 0; return Catalog({ ctx, search, onSearch: value => search = value }); };
const find = (tree, predicate) => { const n = nodes(tree).find(predicate); assert(n, 'expected control exists'); return n; };
const label = (tree, value) => find(tree, n => n.props?.onClick && text(n) === value);
const ids = tree => nodes(tree).filter(n => n.type === PublicationCard).map(n => n.props.site.id);
const reset = () => { cells = []; cursor = 0; search = ''; calls = []; };
reset(); let tree = render();
assert.deepEqual(ids(tree), ['a', 'b'], 'inactive sites excluded; default DR sorting preserved');
assert.equal(find(tree, n => n.props?.type === 'search').props.disabled, true, 'collapsed input is outside keyboard navigation');
find(tree, n => n.props?.['aria-label'] === 'פתיחת חיפוש בקטלוג').props.onClick(); tree = render();
assert.equal(find(tree, n => n.props?.className === 'catalog-inline-search').props['data-open'], true, 'search opens inside its row');
assert.equal(find(tree, n => n.props?.type === 'search').props.disabled, false);
find(tree, n => n.props?.type === 'search').props.onChange({ target: { value: 'news.example' } });
tree = render(); assert.deepEqual(ids(tree), ['b']);
find(tree, n => n.props?.['aria-label'] === 'סגירת החיפוש').props.onClick();
tree = render(); assert.deepEqual(ids(tree), ['a', 'b']);
assert.equal(find(tree, n => n.props?.type === 'search').props.disabled, true);
find(tree, n => n.props?.['aria-label'] === 'פתיחת חיפוש בקטלוג').props.onClick(); tree = render();
find(tree, n => n.props?.type === 'search').props.onKeyDown({key:'Escape',preventDefault(){},stopPropagation(){}});
tree = render(); assert.equal(find(tree, n => n.props?.className === 'catalog-inline-search').props['data-open'], false, 'Escape collapses search');
const categoryPanel = find(tree, n => n.props?.className?.includes('catalog-home-category-panel'));
const categoryLabels = nodes(categoryPanel).filter(n => n.type === 'label');
assert.equal(categoryLabels.length, 18, 'all real categories available');
find(categoryLabels.find(n => text(n) === 'טכנולוגיה'), n => n.props?.onCheckedChange).props.onCheckedChange(true);
tree = render(); label(tree, 'הצגת אתרים').props.onClick();
tree = render(); assert.deepEqual(ids(tree), ['a']);
label(tree, 'הכול').props.onClick(); tree = render(); assert.deepEqual(ids(tree), ['a', 'b']);
label(tree, 'סינון ומיון').props.onClick(); tree = render();
assert(nodes(tree).some(n => n.props?.open === true && nodes(n).some(child => child.props?.className === 'catalog-sort-dialog')));
find(tree, n => n.props?.role === 'switch').props.onChange();
tree = render(); assert.deepEqual(ids(tree), ['b'], 'sale toggle filters actual catalog');
label(tree, 'איפוס סינונים').props.onClick(); tree = render();
find(tree, n => typeof n.props?.onValueChange === 'function').props.onValueChange('low');
tree = render(); assert.deepEqual(ids(tree), ['b', 'a'], 'price sorting preserved');
find(tree, n => n.props?.['aria-label'] === 'מחיר מרבי בש״ח').props.onChange({ target: { value: '250' } });
tree = render(); assert.deepEqual(ids(tree), ['b']);
label(tree, 'ייצוא קטלוג').props.onClick();
assert.deepEqual(calls.at(-1), ['download', 'megalinks-catalog.csv', { rows: [{ name: ctx.catalog[1].name, url: ctx.catalog[1].url, category: 'חדשות ארציות', price_ils: 200, DR: 50 }], columns: ['name', 'url', 'category', 'price_ils', 'DR'] }]);
label(tree, 'הזמנה מרוכזת').props.onClick(); assert.deepEqual(calls.at(-1), ['go', 'bulk']);
label(tree, 'איפוס סינונים').props.onClick(); tree = render();
const switches = nodes(tree).filter(n => n.props?.role === 'switch'); switches[1].props.onChange();
tree = render(); assert.deepEqual(ids(tree), ['b'], 'favorites toggle preserved');
nodes(tree).find(n => n.type === PublicationCard).props.onFavorite();
assert.deepEqual(calls.at(-1), ['api', 'favorites', 'POST', { website_id: 'b', kind: 'favorite' }]);
cursor = 0; const card = PublicationCard({ site: ctx.catalog[1], ctx, favorite: true, onFavorite() {} });
find(card, n => n.props?.label === 'הוספה לסל').props.onClick(); assert.equal(calls.at(-1)[1].kind, 'order'); assert.equal(calls.at(-1)[1].site.id, 'b');
reset(); tree = render();
globalThis.document = { getElementById: id => ({ scrollIntoView: options => calls.push(['scroll', id, options]) }) };
globalThis.window = { matchMedia: () => ({ matches: false }) };
label(tree, 'לצפייה בקטלוג').props.onClick();
assert.deepEqual(calls.at(-1), ['scroll', 'catalog-home-results', { behavior: 'smooth', block: 'start' }]);
window.matchMedia = () => ({ matches: true }); label(tree, 'לצפייה בקטלוג').props.onClick();
assert.equal(calls.at(-1)[2].behavior, 'auto', 'reduced-motion honored');
console.log('CATALOG HOME ACTIONS PASSED: real search/clear, all 18 categories/apply/all, filters/reset/sorting, filtered public export, bulk route, favorites, original order dialog and accessible CTA scrolling. Isolated fixtures, no live writes.');
