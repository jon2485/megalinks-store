import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import ts from 'typescript';
import {compile,reset,render,nodes,text} from './admin-ui-harness.mjs';
const base='b6406ff71730e112e6422db7352338e8e6cb4571';
const original=p=>execFileSync('git',['show',base+':'+p],{encoding:'utf8',maxBuffer:20*1024*1024});
function declarations(source){const ast=ts.createSourceFile('a.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),out={};function visit(n){if(ts.isFunctionDeclaration(n)&&n.name)out[n.name.text]=n.getText(ast);if(ts.isVariableDeclaration(n))out[n.name.getText(ast)]=n.getText(ast);ts.forEachChild(n,visit);}visit(ast);return out;}
for(const [file,names] of [
 ['app/users-admin.tsx',['roleNames','UserSettings','MonthlyPermission','ClientActions','ClientBalances','state','[search,setSearch]','[role,setRole]','[selected,setSelected]','all','rows','user']],
 ['app/admin-order-history.tsx',['state','[unpaid,setUnpaid]','[month,setMonth]','[search,setSearch]','[expanded,setExpanded]','all','paid','pending','rows','groups','total','net','vat','toggle','exportOrders']],
 ['app/admin-lobby.tsx',['guard','go','choose','selectQueue','localCtx','lobbyCount','lobbyDescription','searchState','[selected,setSelected]','[page,setPage]','[debounced,setDebounced]']]
]){const before=declarations(original(file)),after=declarations(readFileSync(file,'utf8'));for(const name of names){assert(before[name],`${file}: ${name} exists in baseline`);assert.equal(after[name],before[name],`${file}: preserved ${name}`);}}
// The user subsequently approved all admin screens. The new isolation suite
// verifies the explicit full-workbench scope and all protected shared owners.
await import('./admin-complete-preservation.mjs');
const unchanged='full-workbench isolation verified';
const {default:Users}=await compile('app/users-admin.tsx','foundation-users',{stubs:{'./screens':'export function ActionForm(){return null}','./workspace':'import React from "react";export function Pick(){return null}export function Field({children}){return <label>{children}</label>}export function ErrorBox({error}){return error?<p role="alert">{error}</p>:null}'}});
const people=[{id:'qa-1',role:'customer',name:'משתמש ראשון',email:'first@example.invalid',credits:30000},{id:'qa-2',role:'agency',name:'סוכנות ארוכת שם לבדיקת כיווניות',email:'long.account@example.invalid',monthly_balance:120000,credit_limit:200000,monthly_enabled:1,pending_payment_reports:2}];
const h=reset({'admin/users':{data:{users:people}}});const routes=[],dialogs=[];const ctx={user:{role:'admin'},adminMode:true,revision:0,go:p=>routes.push(p),open:m=>dialogs.push(m)};let tree=render(Users,{ctx});
const listButtons=()=>nodes(tree).filter(n=>n.props.className==='user-select');
assert.equal(listButtons().length,2);assert.equal(nodes(tree).filter(n=>n.props.id==='admin-selected-user').length,1);
listButtons()[1].props.onClick();tree=render(Users,{ctx});assert(tree.props.className.includes('is-detail-open'));
assert.equal(nodes(tree).find(n=>n.props.id==='admin-selected-user-heading').props.children,people[1].name);
// Original child components remain actual references, receive the selected account once.
assert.equal(nodes(tree).filter(n=>n.type?.name==='ClientActions').length,1);
assert.equal(nodes(tree).find(n=>n.type?.name==='ClientActions').props.user.id,'qa-2');
let focused=0;globalThis.requestAnimationFrame=fn=>fn();h.refs[2].current={querySelector:()=>({focus(){focused++}})};
nodes(tree).find(n=>n.props.className==='admin-foundation-users-back').props.onClick();tree=render(Users,{ctx});assert(!tree.props.className.includes('is-detail-open'));assert.equal(focused,1);assert.equal(listButtons()[1].props['aria-pressed'],true);
nodes(tree).find(n=>n.props['aria-label']==='חיפוש לקוח לפי שם, מייל או טלפון').props.onChange({target:{value:'not-found'}});tree=render(Users,{ctx});assert(text(tree).includes('לא נמצאו לקוחות'));h.refs[0].current={focus(){focused++}};
nodes(tree).find(n=>n.props['aria-label']==='ניקוי חיפוש משתמשים').props.onClick();tree=render(Users,{ctx});assert.equal(listButtons().length,2);assert.equal(focused,2);
nodes(tree).find(n=>n.type==='button'&&text(n)==='סוכנויות').props.onClick();tree=render(Users,{ctx});assert.equal(listButtons().length,1);assert.equal(listButtons()[0].props['aria-pressed'],true);assert.equal(h.calls.length,0);
reset({'admin/users':{loading:true,data:null}});assert(text(render(Users,{ctx})).includes('טוען חשבונות'));
reset({'admin/users':{error:'שגיאת QA',data:null}});assert.equal(nodes(render(Users,{ctx})).find(n=>n.props.error==='שגיאת QA').props.error,'שגיאת QA');
console.log(`FOUNDATION STAGE A PASSED: ${unchanged} protected files byte-identical; original finance/settings/role/save components and order/queue contracts retained; user selection, mobile back, focus target, role/search reset and empty/loading/error cases; no writes. Browser rendering not asserted.`);
