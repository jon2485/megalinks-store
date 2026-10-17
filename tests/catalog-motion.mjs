import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const require = createRequire(realpathSync('node_modules/wrangler') + '/package.json');
await require('esbuild').build({entryPoints:['app/catalog-motion.tsx'],outfile:'.sites-runtime/catalog-motion-test.mjs',bundle:true,platform:'node',format:'esm',external:['react','react/jsx-runtime']});
const { observeCatalogCards } = await import(pathToFileURL(realpathSync('.sites-runtime/catalog-motion-test.mjs')));
class Card {
    dataset = { catalogReveal:'initial' };
    values = {};
    style = { setProperty:(key,value)=>this.values[key]=value };
    closest() { return this; }
}
globalThis.Element = Card;
let instance;
class Observer {
    observed = new Set(); disconnected = false;
    constructor(callback) { this.callback=callback; instance=this; }
    observe(card) { this.observed.add(card); }
    unobserve(card) { this.observed.delete(card); }
    disconnect() { this.disconnected=true; this.observed.clear(); }
}
globalThis.IntersectionObserver=Observer;
function setup(matches=false) {
    const cards=Array.from({length:9},()=>new Card()),listeners=new Map(),changes=new Map();
    const root={querySelectorAll:()=>cards,addEventListener:(key,fn)=>listeners.set(key,fn),removeEventListener:key=>listeners.delete(key)};
    const preference={matches,addEventListener:(key,fn)=>changes.set(key,fn),removeEventListener:key=>changes.delete(key)};
    return {cards,listeners,changes,root,preference};
}
let s=setup(),cleanup=observeCatalogCards(s.root,s.preference);
assert(s.cards.every(c=>c.dataset.catalogReveal==='pending'));
// IO entries need not arrive in DOM order; stagger follows the RTL document order.
instance.callback([s.cards[2],s.cards[0],s.cards[1]].map(target=>({target,isIntersecting:true})));
assert.deepEqual(s.cards.slice(0,3).map(c=>c.values['--catalog-reveal-delay']),['0ms','55ms','110ms']);
assert(!instance.observed.has(s.cards[0]));
s.listeners.get('focusin')({target:s.cards[8]});
assert.equal(s.cards[8].dataset.catalogReveal,'visible');assert.equal(s.cards[8].values['--catalog-reveal-delay'],'0ms');
s.preference.matches=true;s.changes.get('change')();
assert(s.cards.every(c=>c.dataset.catalogReveal==='visible'));assert(instance.disconnected);
cleanup();assert.equal(s.listeners.size,0);assert.equal(s.changes.size,0);
s=setup();cleanup=observeCatalogCards(s.root,s.preference);cleanup();
assert(s.cards.every(c=>c.dataset.catalogReveal==='visible'),'cleanup cannot leave retained results hidden');
s=setup();s.cards[0].dataset.catalogReveal='visible';cleanup=observeCatalogCards(s.root,s.preference);
assert(!instance.observed.has(s.cards[0]),'retained cards never restart animation');
instance.callback(s.cards.map(target=>({target,isIntersecting:true})));
assert.equal(s.cards[8].values['--catalog-reveal-delay'],'110ms','large batches have bounded waiting time');cleanup();
s=setup(true);observeCatalogCards(s.root,s.preference);
assert(s.cards.every(c=>c.dataset.catalogReveal==='visible'));assert.equal(s.changes.size,0);
delete globalThis.IntersectionObserver;s=setup();observeCatalogCards(s.root,s.preference);
assert(s.cards.every(c=>c.dataset.catalogReveal==='visible'),'unsupported IO fails visible');
console.log('CATALOG MOTION PASSED: ordered stagger, bounded delay, keyboard reveal, live reduced-motion change, no-IO fallback, retained results and listener/observer cleanup.');

// Pointer depth must be bounded, cancelable, mouse-only and preference-aware.
const { attachCatalogDepth } = await import(pathToFileURL(realpathSync('.sites-runtime/catalog-motion-test.mjs')));
const pointerListeners=new Map(),pointerPreferenceListeners=new Map(),variables={},classes=new Set();
let rafCallback,rafCanceled=false;
globalThis.requestAnimationFrame=fn=>{rafCallback=fn;return 1;};
globalThis.cancelAnimationFrame=()=>{rafCanceled=true;};
globalThis.window={matchMedia:()=>({matches:true})};
const depthCard=new Card();
depthCard.style={setProperty:(key,value)=>variables[key]=value,removeProperty:key=>delete variables[key]};
depthCard.classList={add:key=>classes.add(key),remove:key=>classes.delete(key)};
depthCard.getBoundingClientRect=()=>({left:0,top:0,width:200,height:300});
const depthRoot={contains:card=>card===depthCard,addEventListener:(key,fn)=>pointerListeners.set(key,fn),removeEventListener:key=>pointerListeners.delete(key)};
const pref={matches:false,addEventListener:(key,fn)=>pointerPreferenceListeners.set(key,fn),removeEventListener:key=>pointerPreferenceListeners.delete(key)};
const stopDepth=attachCatalogDepth(depthRoot,pref);
pointerListeners.get('pointermove')({pointerType:'touch',target:depthCard,clientX:500,clientY:500});
assert.equal(rafCallback,undefined,'touch cannot start tilt');
pointerListeners.get('pointermove')({pointerType:'mouse',target:depthCard,clientX:500,clientY:500});rafCallback();
assert.equal(variables['--catalog-tilt-x'],'-1.6deg');assert.equal(variables['--catalog-tilt-y'],'1.6deg');
assert(classes.has('catalog-depth-tracking'));
pref.matches=true;pointerPreferenceListeners.get('change')();
assert.equal(Object.keys(variables).length,0);assert.equal(classes.size,0);assert(rafCanceled);
stopDepth();assert.equal(pointerListeners.size,0);assert.equal(pointerPreferenceListeners.size,0);
console.log('CATALOG DEPTH PASSED: touch exclusion, bounded mouse tilt, reduced-motion reset, animation-frame cancellation and event cleanup.');
