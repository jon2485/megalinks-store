import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync('lib/catalog-list-filter.ts', 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const { parseCatalogList, extractCatalogAddresses } = await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'));
const catalog = JSON.parse(readFileSync('data/catalog.json', 'utf8'));
const message = `בוקר טוב טל
לאישורך 4 קישורים להוצאה של החודש:
https://www.modiin4u.co.il/\t350
https://hkn.co.il/\t380
https://sderonet.co.il/\t150
https://comfi.co.il/\t580

המחירים שכתובים למעלה הם לפני הנחות, בשבילך כל החבילה יוצאת 1130₪
תאשר לי רק להוציא לדרך ואוציא לפי האנקורים שהחברת קידום שלחה`;
const addresses = ['https://www.modiin4u.co.il/', 'https://hkn.co.il/', 'https://sderonet.co.il/', 'https://comfi.co.il/'];
assert.deepEqual(extractCatalogAddresses(message), addresses);
const review = parseCatalogList(message, catalog);
assert.deepEqual(review.matches.map(m => new URL(catalog.find(s => s.id === m.siteId).url).hostname.replace(/^www\./, '')), ['modiin4u.co.il', 'sderonet.co.il']);
assert.deepEqual(review.unmatched, ['https://hkn.co.il/', 'https://comfi.co.il/']);
assert(!review.matches.some(m => catalog.find(s => s.id === m.siteId).url.includes('hon.co.il')), 'hkn must never match hon');

const sites = [
 { id: 'a', name: 'אתר ראשון', url: 'https://www.alpha.test/' },
 { id: 'b', name: 'אתר שני', url: 'https://beta.test/' },
 { id: 'c', name: 'ערוץ בריאות', url: 'https://alpha.test/health' },
 { id: 'd', name: 'ערוץ בריאות נוסף', url: 'https://alpha.test/health/more' },
];
assert.deepEqual(parseCatalogList('alpha.test\nALPHA.TEST/\nhttps://www.alpha.test/', sites).matches.map(m => m.siteId), ['a']);
assert.deepEqual(parseCatalogList('https://alpha.test/health/more/article', sites).matches.map(m => m.siteId), ['d']);
assert.deepEqual(parseCatalogList('alpha.test.evil.test\nnotalpha.test\nalphb.test', sites).matches, []);
assert.deepEqual(extractCatalogAddresses('https://alpha.test/,https://beta.test/; alpha.test | beta.test'), ['https://alpha.test/', 'https://beta.test/']);
assert.deepEqual(extractCatalogAddresses('בוקר טוב 4 קישורים 350 380 150 580 1130₪ 1,130.00 15.10.2026'), []);
assert.deepEqual(extractCatalogAddresses('דוא״ל sales@alpha.test'), []);
assert.deepEqual(extractCatalogAddresses('קישור \u200fhttps://www.alpha.test/\u200e\t350'), ['https://www.alpha.test/']);
assert.deepEqual(parseCatalogList('אתר ראשון\nאתר שני', sites).matches.map(m => m.siteId), ['a', 'b'], 'exact name-only lists remain supported');
assert.deepEqual(parseCatalogList('אתר ראשון\nhttps://beta.test/\nבוקר טוב\n350', sites).matches.map(m => m.siteId), ['b'], 'address-containing messages ignore all other text, including catalog names');
assert.deepEqual(parseCatalogList('בוקר טוב\n350\n1130₪', sites), { matches: [], unmatched: [] });
assert.deepEqual(parseCatalogList('https://hkn.co.il/ https://hon.co.il/', [{id:'hon',name:'הון',url:'https://hon.co.il/'}]), {matches:[{siteId:'hon',source:'https://hon.co.il/'}],unmatched:['https://hkn.co.il/']});
assert.deepEqual(parseCatalogList(message, addresses.map((url, i) => ({id:String(i),name:'אתר '+i,url}))).matches.map(m => m.siteId), ['0','1','2','3'], 'all four match when exact domains exist');
console.log('Catalog list parsing passed: full Hebrew message, exact domain matching, missing domains, deduplication, path selection, punctuation, prices, emails, bidi text and exact name-only compatibility.');
