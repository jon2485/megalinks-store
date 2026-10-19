import assert from 'node:assert/strict';
import {compile,reset,render,nodes,text} from './admin-ui-harness.mjs';
const workspace=`import React from 'react';export function Heading(){return null}export function Field({children}){return <label>{children}</label>}export function Pick(){return null}export function Badge(){return null}export function ErrorBox(){return null}export function Empty(){return null}export function WebsiteForm(){return null}export function UploadField(){return null}`;
const stubs={'./workspace':workspace,'./screens':'export function ActionForm(){return null}','./catalog-view':'export function PublicationCard(){return null}'};
const routes=[],dialogs=[],ctx={user:{role:'admin'},adminMode:true,revision:0,catalog:[{id:'w1',name:'אתר א',supplier_id:'s1',price_cents:30000,cost_cents:20000}],open:m=>dialogs.push(m),go:p=>routes.push(p),run:fn=>fn()};
const click=(tree,label)=>{const node=nodes(tree).flatMap(n=>[n,...nodes(n.props.actions)]).find(n=>n.props.onClick&&text(n)===label);assert(node,'Action '+label);return node.props.onClick();};
const {SuppliersView}=await compile('app/commerce.tsx','complete-suppliers',{stubs});
let h=reset({'records/supplier':{data:{records:[{id:'s1',name:'ספק ראשון',email:'s1@example.invalid'},{id:'s2',name:'ספק שני',notes:'הסכם לדוגמה בבדיקת יחידה'}]}}});
let tree=render(SuppliersView,{ctx}),bench=nodes(tree).find(n=>n.type?.name==='AdminWorkbench');
assert.equal(bench.props.items.length,2);assert(!text(tree).includes('קישור להזמנת לקוח'));
bench.props.onSelect('s1');tree=render(SuppliersView,{ctx});assert(text(tree).includes('מחיר ללקוח'));assert(text(tree).includes('עלות'));assert(text(tree).includes('אתר א'));
click(tree,'עריכת ספק');let modal=dialogs.at(-1);assert.equal(modal.render(()=>{}).props.initial.id,'s1');
await modal.render(()=>{}).props.submit({name:'ספק נערך'});assert.deepEqual(h.calls.at(-1),{path:'records/supplier/s1',method:'PATCH',body:{name:'ספק נערך'}});
click(tree,'יצירת אתר חדש');assert.equal(dialogs.at(-1).render(()=>{}).props.defaultSupplier,'s1');
click(tree,'עריכת מחירים ושיוך');assert.equal(dialogs.at(-1).render(()=>{}).props.site.id,'w1');
click(tree,'מחיקה');assert.equal(dialogs.at(-1).title,'מחיקת ספק');assert(text(dialogs.at(-1).render(()=>{})).includes('אישור מחיקת ספק ראשון'));
assert.equal(h.calls.length,1,'Selection and opening confirmations do not write');

const {SupplierSettlements}=await compile('app/supplier-settlements.tsx','complete-settlements',{stubs});
const settlementRows=[{id:'june-a',supplier_name:'ספק א',month:'2026-06',amount:24000,count:1,articles:[{id:'a',website_name:'אתר א',website_url:'https://example.invalid',title:'כתבה',cost_cents:24000,url:'https://example.invalid/article'}]},{id:'july-b',supplier_name:'ספק ב',month:'2026-07',amount:10000,count:0,articles:[],payment:{reference:'PAID',amount_paid:10000,paid_at:'2026-07-30'}}];
h=reset({'supplier-finance':{data:{rows:settlementRows}}});
const inner=SupplierSettlements({ctx});tree=render(inner.type,inner.props);bench=nodes(tree).find(n=>n.type?.name==='AdminWorkbench');assert.equal(bench.props.items.length,2);assert(bench.props.items[0].attention);assert(!bench.props.items[1].attention);assert(text(tree).includes('עלות הפרסומים לספק'));
click(tree,'תיעוד תשלום שבוצע');modal=dialogs.at(-1);assert.equal(modal.kind,'admin-finance');assert.equal(h.calls.length,0);await modal.render(()=>{}).props.submit({reference:'TEST-ONLY'});assert.deepEqual(h.calls[0],{path:'admin/supplier-payment',method:'POST',body:{reference:'TEST-ONLY',settlement_key:'june-a'}});
bench.props.onSelect('july-b');tree=render(inner.type,inner.props);assert(text(tree).includes('PAID'));assert(!nodes(tree).some(n=>n.props.onClick&&text(n)==='תיעוד תשלום שבוצע'));
nodes(tree).find(n=>n.type==='input'&&n.props.type==='month').props.onChange({target:{value:'2026-06'}});tree=render(inner.type,inner.props);assert.equal(nodes(tree).find(n=>n.type?.name==='AdminWorkbench').props.items.length,1);

const {ApprovalBoard}=await compile('app/management.tsx','complete-content',{stubs});
h=reset({'articles?scope=all':{data:{articles:[{id:'a1',title:'כתבה לבדיקה',user_id:'u',user_name:'לקוח',website_id:'w',website_name:'אתר',paid:1,status:'admin_review',updated:'2026-10-19',validation:{ok:true}},{id:'a2',title:'טרם שולמה',paid:0,status:'admin_review',updated:'2026-10-19'}]}}});tree=render(ApprovalBoard,{ctx});bench=nodes(tree).find(n=>n.type?.name==='AdminWorkbench');assert.equal(bench.props.items.length,1);click(tree,'בדיקת המאמר וההזמנה');assert.equal(routes.at(-1),'article/a1');assert.equal(h.calls.length,0);

const {AdminWorkbench,AdminSearch}=await compile('app/admin-workbench.tsx','complete-workbench',{stubs});
h=reset();let selected='a';const props={label:'רשימה',items:[{id:'a',title:'א'},{id:'b',title:'ב'}],selectedId:selected,onSelect:id=>selected=id,children:'פרטים'};
tree=render(AdminWorkbench,props);nodes(tree).find(n=>n.props['aria-pressed']===false).props.onClick();tree=render(AdminWorkbench,{...props,selectedId:selected});assert(tree.props.className.includes('is-detail-open'));assert.equal(selected,'b');let focused=0;globalThis.requestAnimationFrame=fn=>fn();h.refs[0].current={querySelector:()=>({focus(){focused++;}})};click(tree,'חזרה לרשימה');tree=render(AdminWorkbench,{...props,selectedId:selected});assert(!tree.props.className.includes('is-detail-open'));assert.equal(focused,1);
h=reset();let query='חיפוש';tree=render(AdminSearch,{value:query,onChange:v=>query=v,label:'חיפוש ספק'});h.refs[0].current={focus(){focused++;}};nodes(tree).find(n=>n.props['aria-label']==='ניקוי חיפוש ספק').props.onClick();assert.equal(query,'');assert.equal(focused,2);
console.log('ADMIN COMPLETE ACTIONS: supplier selection/edit/site/delete confirmation, settlement filters/paid states/exact payment form payload, content paid gate/studio route, mobile list/detail/back/focus and search clear; isolated fixtures only.');
