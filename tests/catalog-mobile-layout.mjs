import assert from 'node:assert/strict';
import {readFileSync,realpathSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(realpathSync('node_modules/@tailwindcss/postcss')+'/package.json');
const postcss=require('postcss');
const files=process.argv[2]==='--built'?[...new Set(['dist/server/.vite/manifest.json','dist/client/.vite/manifest.json'].flatMap(f=>Object.values(JSON.parse(readFileSync(f,'utf8'))).flatMap(entry=>entry.css||[])))].map(f=>'dist/client/'+f):process.argv.slice(2),source=files.length?files.map(f=>readFileSync(f,'utf8')).join('\n'):['app/globals.css','app/admin-reviewed-controls.css','app/catalog-pricing-workspace.css','app/catalog-sheets.css'].map(f=>readFileSync(f,'utf8')).join('\n');
const sheet=postcss.parse(source);
// Resolve the actual action-container rules and their media queries together,
// including the shared button rule responsible for the reported regression.
function selectors(s){const list=[];let start=0,depth=0;for(let i=0;i<s.length;i++){if(s[i]==='('||s[i]==='[')depth++;if(s[i]===')'||s[i]===']')depth--;if(s[i]===','&&depth===0){list.push(s.slice(start,i).trim());start=i+1;}}list.push(s.slice(start).trim());return list;}
function active(rule,width){for(let p=rule.parent;p;p=p.parent){if(p.type==='atrule'&&p.name==='media'){const q=p.params;let m;if((m=q.match(/max-width\s*:\s*([\d.]+)px/))&&width>+m[1])return false;if((m=q.match(/min-width\s*:\s*([\d.]+)px/))&&width<+m[1])return false;if((m=q.match(/width\s*<=\s*([\d.]+)px/))&&width>+m[1])return false;if((m=q.match(/width\s*>=\s*([\d.]+)px/))&&width<+m[1])return false;if(/prefers-reduced-motion|print/.test(q))return false;}}return true;}
function resolve(target,width){const values={},ranks={};let order=0;sheet.walkRules(rule=>{order++;if(!active(rule,width))return;const matched=selectors(rule.selector).filter(s=>target(s));if(!matched.length)return;for(const selector of matched){const specificity=(selector.match(/\.[\w-]+|\[[^\]]+\]/g)||[]).length;rule.each(d=>{if(d.type!=='decl')return;const rank=(d.important?1000000:0)+specificity*1000+order/100000;if(!(d.prop in ranks)||rank>=ranks[d.prop]){ranks[d.prop]=rank;values[d.prop]=d.value;}});}});return values;}
const group=s=>s==='.catalog-sync-actions',child=s=>/^\.catalog-sync-actions\s*>\s*\*$/.test(s);
for(const width of [320,375,393,430,600,760,761,1024]){
 const actions=resolve(group,width),items=resolve(child,width);
 assert.equal(actions.display,'grid',width+': action group must never use the collapsing flex row');
 if(width<=760)assert.equal(actions['grid-template-columns'].replaceAll(' ',''),'minmax(0,1fr)',width+': one full-width action per row');
 else assert(actions['grid-template-columns'].includes('auto-fit'),width+': wider screens allocate columns with an intrinsic minimum');
 assert.equal(items.width,'100%',width+': each action fills its assigned track');
 const main=resolve(s=>s==='.catalog-toolbar',width),membership=resolve(s=>s==='.pricebook-membership-actions',width);
 if(width<=760){assert.equal(main.display,'grid',width+': catalog toolbar stacks its actions');assert.equal(membership.display,'grid',width+': membership controls stack');}
}
const text=resolve(s=>s.includes('reviewed-connections')&&s.endsWith(' [data-slot=button]'),393);
assert.equal(text['overflow-wrap'],'normal','action labels wrap between words, never between letters');assert.equal(text['word-break'],'normal');
const sheets=readFileSync('app/catalog-sheets.tsx','utf8');for(const label of ['פתיחת השיטס','בדיקת שינויים','חיבור והוראות הפעלה','הפעלת סנכרון','רענון מצב'])assert(sheets.includes(label),'existing action preserved: '+label);
console.log('CATALOG MOBILE LAYOUT PASSED: resolved CSS/media rules at 320, 375, 393, 430, 600, 760, 761 and 1024px; full-width mobile sync/catalog/membership actions, desktop intrinsic columns and normal word wrapping. CSS verification only; no browser layout was run.');
