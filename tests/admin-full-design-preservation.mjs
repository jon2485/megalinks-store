import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {createRequire} from 'node:module';
import {compile,reset,render,nodes,text} from './admin-ui-harness.mjs';

const original=execFileSync('git',['show','80b1aac9be6ac5a0ce3f053ae9ed9be7d0c1b366:app/admin-lobby.tsx'],{encoding:'utf8'});
const current=readFileSync('app/admin-lobby.tsx','utf8');
function contracts(source){
 const ast=ts.createSourceFile('lobby.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 const calls=[],props=[];
 function visit(node){
  // Calls include hook initializers/effects, all navigation/guards and modal closures.
  if(ts.isCallExpression(node))calls.push(node.getText(ast));
  if(ts.isJsxAttribute(node)&&/^(on[A-Z]|value$|checked$|disabled$|ref$|id$|aria-controls$|aria-selected$)/.test(node.name.getText(ast)))props.push(node.getText(ast));
  ts.forEachChild(node,visit);
 }
 visit(ast);return {calls:calls.sort(),props:props.sort()};
}
assert.deepEqual(contracts(current),contracts(original),'Lobby requests, hooks, handler expressions, dirty guard, refs and selection props must be byte-identical AST contracts');
assert(current.includes('admin-v172-dashboard')&&current.includes('admin-v172-queue-column'));

const {AdminNavigation}=await compile('app/admin-shell.tsx','admin-full-navigation',{stubs:{'./admin-lobby':'export default function Lobby(){return null}'}});
reset();const ctx={go(){}};
let tree=render(AdminNavigation,{ctx,view:'admin-orders'});
let groups=nodes(tree).filter(n=>n.type==='details');
assert.equal(groups.length,4,'four grouped categories use native accessible disclosure');
assert.equal(groups.filter(n=>n.props.open).length,1);
const orderGroup=groups.find(n=>text(n).includes('הזמנות וכספים'));
assert(orderGroup.props.open);assert.equal(nodes(orderGroup).filter(n=>n.type==='a').length,5);
assert(nodes(orderGroup).some(n=>n.type==='a'&&n.props.href==='/admin-orders'&&n.props['aria-current']==='page'));
assert.equal(nodes(tree).filter(n=>n.type==='a'&&n.props.href.startsWith('/')).length,21);
nodes(tree).find(n=>n.type==='input').props.onChange({target:{value:'ספקים'}});
tree=render(AdminNavigation,{ctx,view:'admin-orders'});
const clear=nodes(tree).find(n=>n.type==='button'&&n.props['aria-label']==='ניקוי חיפוש כלי ניהול');
assert(clear);let focused=0;globalThis.adminHandlerHarness.refs[0].current={focus(){focused++;}};
clear.props.onClick();tree=render(AdminNavigation,{ctx,view:'admin-orders'});
assert.equal(nodes(tree).find(n=>n.type==='input').props.value,'');assert.equal(focused,1);

const require=createRequire(import.meta.url),postcss=require(require.resolve('postcss',{paths:[require.resolve('@tailwindcss/postcss')]}));
const css=readFileSync('app/admin-design-v172.css','utf8'),ast=postcss.parse(css);
let scoped=0,portals=0;
ast.walkRules(rule=>{for(const selector of rule.selectors){
 assert(selector.startsWith('.admin-design-v172')||selector.startsWith('body:has(.admin-design-v172) '),selector);
 if(selector.startsWith('body:has('))portals++;else scoped++;
}});
for(const family of ['lobby-work-panel','users-admin','client-selected-panel','admin-mega-finance-row','financial-order-card','account-tabs','admin-suppliers-page','supplier-settlements','catalog-sheets-panel','admin-promotions-page','support-ticket-row','article-studio','report-bars','code-block','catalog-pricing-workspace','admin-confirmed-orders'])assert(css.includes('.'+family),'Missing family '+family);
assert(portals>0&&scoped>200);
assert(css.includes('max-height:calc(100dvh - 40px'));
assert(css.includes('@media(prefers-reduced-motion:reduce)')&&css.includes('@media(forced-colors:active)'));
assert(css.includes('@container admin-v172 (max-width:720px)'));
assert(!/pointer-events\s*:\s*none|visibility\s*:\s*hidden|transition\s*:\s*all/.test(css),'Cannot disable or hide product controls through presentation');
// Every display:none must have an explicit, non-business reason.
ast.walkDecls('display',decl=>{if(decl.value==='none'){
 const selector=decl.parent.selector||'';
 assert(/admin-v172-mobile-heading|admin-v172-menu|admin-order-list-heading|catalog-compact-header|lobby-payment-heading|support-wave|studio-hero > svg|admin-v172-navigation|summary::-webkit-details-marker/.test(selector),'Unexpected hidden surface '+selector);
}});
console.log(`FULL ADMIN PRESENTATION PASSED: identical lobby call/handler contracts, all 21 destinations, native groups/active route, localized search clear/focus, ${scoped} scoped selectors and ${portals} live-admin portal selectors; all screen families covered and no business-control hiding.`);
