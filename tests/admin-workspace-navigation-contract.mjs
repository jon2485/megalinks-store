import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import ts from 'typescript';
import {compile,nodes,text} from './admin-ui-harness.mjs';
const source=readFileSync('app/workspace.tsx','utf8'),sf=ts.createSourceFile('workspace.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),declarations={};let historyEffect;
function visit(n){if(ts.isVariableDeclaration(n)&&['go','navigate'].includes(n.name.getText(sf)))declarations[n.name.getText(sf)]=n.getText(sf);if(ts.isCallExpression(n)&&n.expression.getText(sf)==='useEffect'&&n.arguments[0]?.getText(sf).includes("window.addEventListener('popstate'"))historyEffect=n.arguments[0].getText(sf);ts.forEachChild(n,visit);}visit(sf);assert(declarations.go&&declarations.navigate&&historyEffect);
// Execute the source's actual closures, not a rewritten copy of the guard.
writeFileSync('.sites-runtime/admin-navigation-source-contract.tsx',`import {clientHubRoute} from '@/lib/client-hub-navigation';
export function scenario(dirty:boolean,view:string,adminMode:boolean){
 const events:any[]=[],listeners:any={};let modal:any;const Button='button',clientContentView=clientHubRoute;
 const window={location:{pathname:'/admin-orders'},history:{pushState(...args:any[]){events.push(['push',...args])},replaceState(...args:any[]){events.push(['replace',...args])}},scrollTo(...args:any[]){events.push(['scroll',...args])},addEventListener(type:string,listener:any){listeners[type]=listener},removeEventListener(){}};
 const setDirty=(v:boolean)=>events.push(['dirty',v]),setView=(v:string)=>events.push(['view',v]),setModal=(v:any)=>modal=v;
 const ${declarations.navigate};const ${declarations.go};const cleanup=(${historyEffect})();
 return {go,navigate,events,listeners,window,cleanup,get modal(){return modal}};
}`);
const {scenario}=await compile('.sites-runtime/admin-navigation-source-contract.tsx','admin-workspace-navigation-contract');
let s=scenario(true,'admin-pricebook/fixture',true);s.go('admin-orders');assert.equal(s.events.length,0);assert.equal(s.modal.title,'יש שינויים שלא נשמרו');let closed=0;let dialog=s.modal.render(()=>closed++);nodes(dialog).find(n=>text(n)==='חזרה לעריכה').props.onClick();assert.equal(closed,1);assert.equal(s.events.length,0);nodes(dialog).find(n=>text(n)==='יציאה ללא שמירה').props.onClick();assert(s.events.some(e=>e[0]==='push'&&e.at(-1)==='/admin-orders'));
s=scenario(false,'admin-orders',true);s.go('article/fixture');assert(s.events.some(e=>e[0]==='view'&&e[1]==='admin-article/fixture'));assert.equal(s.modal,undefined);
s=scenario(false,'admin-websites',true);s.go('admin-pricebook/fixture');assert(s.events.some(e=>e[0]==='push'&&e.at(-1)==='/admin-pricebook/fixture'));
s=scenario(false,'admin-orders',true);s.window.location.pathname='/admin-websites';s.listeners.popstate();assert(s.events.some(e=>e[0]==='view'&&e[1]==='admin-websites'));assert(!s.events.some(e=>e[0]==='push'));
// Capture the pre-existing limitation explicitly: popstate bypasses the dirty guard.
s=scenario(true,'admin-pricebook/fixture',true);s.window.location.pathname='/admin-orders';s.listeners.popstate();assert.equal(s.modal,undefined);assert(s.events.some(e=>e[0]==='view'&&e[1]==='admin-orders'));
console.log('WORKSPACE NAVIGATION CONTRACT PASSED: original dirty cancel/confirm, history push and popstate, nested pricebook and admin-article normalization. Known original popstate dirty-guard gap reproduced; no router code changed.');
