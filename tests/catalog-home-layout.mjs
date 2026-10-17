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
const files = process.argv.includes('--built') ? [...new Set(['dist/server/.vite/manifest.json','dist/client/.vite/manifest.json'].flatMap(f=>Object.values(JSON.parse(readFileSync(f,'utf8'))).flatMap(e=>e.css||[])))].map(f=>'dist/client/'+f) : ['app/globals.css','app/catalog-filter-dialog.css','app/catalog-experience.css'];
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
  if(!el||/[\\:+~]/.test(selector.replace(/\[[^\]]*\]/g,'')))return false;
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
  assert.equal(category.parent,tools,'both controls share the same grid parent');
  assert.equal(shell.attrs['data-open'],String(Boolean(search)));
  for(const width of [320,360,375,393,430,640,700,768,1024,1440,1920,2560]) {
    const row=resolve(tools,width),button=resolve(category,width),holder=resolve(slot,width),field=resolve(shell,width);
    assert.equal(row.display,'grid',width+': shared grid');
    const actions=resolve(nodes.find(n=>n.attrs['aria-label']==='פעולות קטלוג'),width);
    if(width>=1024){
      assert.equal(row.width,actions.width,width+': search and all three actions end at the same edge');
      assert.match(row.width,/--catalog-desktop-tools-width/);
      assert.equal(resolve(nodes.find(n=>n.attrs.class==='catalog-hero-composition'),width)['max-width'],'1600px');
    }else if(width<=700){
      assert.equal(row.width,actions.width,width+': mobile search ends above bulk-order edge');
      assert.equal(row['max-width'],'510px');
      const label=resolve(category===undefined?null:nodes.find(n=>n.tag==='span'&&n.parent===category),width);
      assert.equal(label['white-space'],'normal',width+': full category label can wrap');
      assert.equal(label['text-overflow'],'clip',width+': no ellipsis');
      if(width<=440){
        assert.match(resolve(nodes.find(n=>n.attrs.class==='catalog-hero-title'),width)['font-size'],/25px/);
        assert.equal(resolve(nodes.find(n=>n.attrs.class==='catalog-hero-composition'),width)['min-height'],'340px');
      }
    }else assert.equal(row.width,'100%',width+': existing tablet row preserved');
    assert.equal(button['margin-top']??button.margin,'0',width+': no legacy top margin');
    assert.equal(button['min-width'],'0',width+': no legacy minimum width');
    assert.equal(button.width,'100%',width+': button fits its own track');
    assert.equal(button.height,'52px');assert.equal(field.height,'52px');
    // Production CSS minifies grid-row/grid-column to grid-area.
    const gridRow=value=>value['grid-row']??value['grid-area']?.split('/')[0];
    const gridColumn=value=>value['grid-column']??value['grid-area']?.split('/')[1];
    assert.equal(gridRow(button),'1');assert.equal(gridRow(holder),'1');
    assert.equal(gridColumn(button),'1');assert.equal(gridColumn(holder),'2');
    const track=Number(row['grid-template-columns'].match(/^(\d+)px/)[1]),gap=parseFloat(row.gap),content=width-(width<640?32:64);
    assert(content-track-gap>=52,width+': search track fits beside category without overlap');
    assert.equal(field.width,search?'100%':'52px',width+': search expands inside the reserved track');
  }
}
console.log('CATALOG HOME LAYOUT PASSED: actual Radix/Button markup and resolved CSS at 320–2560px, larger phone intro, complete category labels, aligned tools/actions, equal heights, no overlap, and open/closed search widths. CSS/SSR verification; no browser layout was run.');
