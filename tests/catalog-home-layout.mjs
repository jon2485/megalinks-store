import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, realpathSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// Render the real Button/Popover primitives: asChild changes the trigger's
// data-slot. A shallow component tree did not catch the old selector mismatch.
const require = createRequire(realpathSync('node_modules/wrangler') + '/package.json');
const { build } = require('esbuild');
const postcss = createRequire(realpathSync('node_modules/@tailwindcss/postcss') + '/package.json')('postcss');
const categorySource = readFileSync('app/workspace.tsx', 'utf8').match(/export const categories: Record<string, string> = (\{[^;]+\});/)[1];
await build({ entryPoints:['app/catalog-view.tsx'], outfile:'.sites-runtime/catalog-home-layout.cjs', bundle:true, platform:'node', format:'cjs', jsx:'automatic', loader:{'.css':'empty'}, external:['react','react/jsx-runtime'], plugins:[{ name:'data-only-fixtures', setup(b) {
  b.onResolve({filter:/^(@\/lib\/client|\.\/workspace|\.\/workspace-account-controls)$/},a=>({path:a.path,namespace:'fixture'}));
  b.onLoad({filter:/.*/,namespace:'fixture'},a=>({loader:'js',contents:a.path==='./workspace'?`export const categories=${categorySource};`:a.path==='./workspace-account-controls'?'export function WorkspaceAccountControls(){return null;}':'export const useData=()=>({data:{favorites:[]},loading:false});export const api=async()=>({});export const csv=()=>"";export function download(){};'}));
}}] });
const {default:Catalog} = require(realpathSync('.sites-runtime/catalog-home-layout.cjs'));
const files = process.argv.includes('--built') ? [...new Set(['dist/server/.vite/manifest.json','dist/client/.vite/manifest.json'].flatMap(f=>Object.values(JSON.parse(readFileSync(f,'utf8'))).flatMap(e=>e.css||[])))].map(f=>'dist/client/'+f) : ['app/globals.css','app/catalog-filter-dialog.css','app/catalog-experience.css','app/catalog-mobile-hero.css'];
const sheet = postcss.parse(files.map(f=>readFileSync(f,'utf8')).join('\n'));
function dom(markup) {
  const all=[],root={tag:'root',attrs:{},parent:null};let parent=root;
  for(const match of markup.matchAll(/<\/?[a-zA-Z][^>]*>/g)) {
    const token=match[0],tag=token.match(/^<\/?([\w-]+)/)[1];
    if(token.startsWith('</')){assert.equal(parent.tag,tag);parent=parent.parent;continue;}
    const attrs={};for(const a of token.matchAll(/([\w:-]+)="([^"]*)"/g))attrs[a[1]]=a[2];
    const el={tag,attrs,parent};all.push(el);if(!['link','img','input','br','hr','meta'].includes(tag))parent=el;
  }
  assert.equal(parent,root);return all;
}
function simple(selector,el) {
  if(/\[[^\]]*[~|^$*]=/.test(selector))return false;
  if(!el||!selector||/[()\\:+~]/.test(selector.replace(/\[[^\]]*\]/g,'')))return false;
  const attrs=[...selector.matchAll(/\[([\w-]+)(?:=["']?([^\]"']+)["']?)?\]/g)];
  if(attrs.some(([,k,v])=>!(k in el.attrs)||(v!==undefined&&el.attrs[k]!==v)))return false;
  selector=selector.replace(/\[[^\]]*\]/g,'');
  const classes=(el.attrs.class||'').split(/\s+/);
  if([...selector.matchAll(/\.([\w-]+)/g)].some(m=>!classes.includes(m[1])))return false;
  const id=selector.match(/#([\w-]+)/);if(id&&el.attrs.id!==id[1])return false;
  const tag=selector.match(/^[a-z][\w-]*/i);return !tag||tag[0]===el.tag;
}
function matches(selector,el) {
  const parts=selector.trim().replace(/\s*>\s*/g,' > ').split(/\s+/);let i=parts.length-1;
  if(!simple(parts[i--],el))return false;
  while(i>=0){if(parts[i]==='>'){el=el.parent;i--;if(!simple(parts[i--],el))return false;}else{let p=el.parent;while(p&&!simple(parts[i],p))p=p.parent;if(!p)return false;el=p;i--;}}
  return true;
}
function active(rule,width){for(let p=rule.parent;p;p=p.parent){if(p.type!=='atrule')continue;if(['keyframes','-webkit-keyframes'].includes(p.name))return false;if(!['media','container'].includes(p.name))continue;const q=p.params;let m;if(/prefers-reduced-motion|print|hover|pointer/.test(q))return false;if((m=q.match(/max-width\s*:\s*([\d.]+)px/))&&width>+m[1])return false;if((m=q.match(/min-width\s*:\s*([\d.]+)px/))&&width<+m[1])return false;if((m=q.match(/width\s*<=\s*([\d.]+)px/))&&width>+m[1])return false;if((m=q.match(/width\s*>=\s*([\d.]+)px/))&&width<+m[1])return false;if((m=q.match(/width\s*>=\s*([\d.]+)rem/))&&width<+m[1]*16)return false;}return true;}
function resolve(el,width){const values={},ranks={};let order=0;sheet.walkRules(rule=>{order++;if(!active(rule,width))return;for(const selector of rule.selector.split(',')){if(!matches(selector,el))continue;const specificity=(selector.match(/\.[\w-]+|\[[^\]]+\]/g)||[]).length;let layered=false;for(let p=rule.parent;p;p=p.parent)if(p.type==='atrule'&&p.name==='layer')layered=true;rule.each(d=>{if(d.type!=='decl')return;const rank=(d.important?100000000:0)+(!layered?1000000:0)+specificity*1000+order/100000;if(!(d.prop in ranks)||rank>=ranks[d.prop]){ranks[d.prop]=rank;values[d.prop]=d.value;}});}});return values;}
for(const search of ['', 'tech']) {
  const nodes=dom(renderToStaticMarkup(React.createElement(Catalog,{ctx:{catalog:[],user:null,revision:0},search,onSearch(){}})));
  const category=nodes.find(n=>n.attrs['aria-label']==='בחירת קטגוריות');
  const input=nodes.find(n=>n.attrs.id==='catalog-inline-search-input');
  const shell=input.parent,slot=shell.parent,tools=slot.parent;
  assert.equal(category.attrs['data-slot'],'popover-trigger','real Radix attribute is included in layout checks');
  // Owner 22.11.2026: the toolbar is compact; categories sit with the other catalog buttons in one row, the search
  // keeps its own place. The compact geometry lives in app/catalog-toolbar-compact.css (checked in the browser).
  assert.equal(category.parent.attrs['aria-label'],'פעולות קטלוג','categories sit with the other catalog buttons');
  assert.equal(slot.parent,tools,'the search keeps its own place in the tools');
  assert(!nodes.some(n=>(n.attrs.class||'').includes('catalog-fav-trigger')),'no favourites button for a visitor who is not signed in');
  assert.equal(shell.attrs['data-open'],String(Boolean(search)));
  for(const width of [320,360,375,393,430,640,700,768,1024,1440,1920,2560]) {
    if(width>=1024){
      assert.equal(resolve(nodes.find(n=>n.attrs.class==='catalog-hero-composition'),width)['max-width'],'1500px');
    }else if(width<=700){
      const hero=resolve(nodes.find(n=>n.attrs.class==='azure-catalog-hero'),width);
      assert.match(hero.background,/checkout-waves/,width+': full-height hero retains the original wave asset');
      assert.match(hero['min-height'],/100svh.*--catalog-mobile-hero-top/,width+': first viewport is reserved without hiding catalog controls');
      assert.equal(resolve(nodes.find(n=>(n.attrs.class||'').split(/\s+/).includes('catalog-mobile-scroll')),width).display,'grid',width+': accessible down-arrow is available on phones');
      const surface=resolve(nodes.find(n=>(n.attrs.class||'').includes('catalog-approved-home')),width);
      assert.match(surface['background-image'],/checkout-waves/,width+': original wave asset continues behind the catalog');
      const art=resolve(nodes.find(n=>n.attrs.class==='catalog-publication-scene'),width);
      assert.equal(art['grid-row']??art['grid-area']?.split('/')[0],'1',width+': original artwork precedes title');
      assert.match(nodes.find(n=>n.tag==='img'&&n.attrs.class==='catalog-home-illustration').attrs.src,/home-publication-20261020\.webp$/,width+': original illustration retained');
      if(width<=440){
        assert.match(resolve(nodes.find(n=>n.attrs.class==='catalog-hero-title'),width)['font-size'],/27px/);
        assert.equal(resolve(nodes.find(n=>n.attrs.class==='catalog-hero-composition'),width)['min-height'],'0');
      }
    }
    if(width>700)assert.equal(resolve(nodes.find(n=>(n.attrs.class||'').split(/\s+/).includes('catalog-mobile-scroll')),width).display,'none',width+': no new desktop control');
  }
}
console.log('CATALOG HOME LAYOUT PASSED: actual Radix/Button markup and resolved CSS at 320–2560px, compact stacked phone intro, the compact toolbar structure (categories with the catalog buttons, search in its own place). CSS/SSR verification; no browser layout was run.');
