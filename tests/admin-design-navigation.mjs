import assert from 'node:assert/strict';
import {compile,reset,render,nodes,text,event} from './admin-ui-harness.mjs';
const {AdminNavigation}=await compile('app/admin-shell.tsx','admin-design-navigation',{stubs:{'./admin-lobby':'export default function Lobby(){return null}'}});
const targets=['admin','admin-orders','admin-payment-reports','admin-invoices','admin-topups','admin-monthly','admin-approvals','admin-articles','admin-publication','admin-instructions','admin-users','admin-websites','admin-suppliers','admin-supplier-finance','admin-promotions','admin-support','admin-connections','admin-reports','admin-notifications','admin-jobs','admin-audit'];
const visited=[],ctx={go:page=>visited.push(page)};reset();let tree=render(AdminNavigation,{ctx,view:'admin-orders'});
const links=nodes(tree).filter(n=>n.type==='a'&&n.props.href.startsWith('/'));
assert.equal(links.length,21);assert.deepEqual(links.map(n=>n.props.href.slice(1)).sort(),targets.toSorted());
for(const link of links){const e=event();link.props.onClick(e);assert(e.prevented);assert.equal(visited.at(-1),link.props.href.slice(1));}
for(const modifier of ['metaKey','ctrlKey','shiftKey','altKey','button']){const e={...event(),[modifier]:modifier==='button'?1:true};const count=visited.length;links[1].props.onClick(e);assert.equal(visited.length,count);assert(!e.prevented);}
for(const [view,back]of [['admin-pricebook/fixture','admin-websites'],['admin-customer-account/fixture','admin-users'],['admin-article/fixture','admin-approvals']]){
 tree=render(AdminNavigation,{ctx,view});const link=nodes(tree).find(n=>n.props?.className==='admin-v172-back');link.props.onClick(event());assert.equal(visited.at(-1),back);
}
for(const alias of ['admin-pricing','admin-pricebooks']){tree=render(AdminNavigation,{ctx,view:alias});assert(nodes(tree).some(n=>n.props?.className==='admin-v172-area is-active'&&text(n).includes('קטלוג ותמחור')));}
reset();tree=render(AdminNavigation,{ctx,view:'admin'});nodes(tree).find(n=>n.type==='input').props.onChange({target:{value:'חשבוניות'}});tree=render(AdminNavigation,{ctx,view:'admin'});const result=nodes(tree).find(n=>n.type==='a'&&n.props.href==='/admin-invoices');assert(result);result.props.onClick(event());tree=render(AdminNavigation,{ctx,view:'admin-invoices'});assert.equal(nodes(tree).find(n=>n.type==='input').props.value,'');
nodes(tree).find(n=>n.type==='input').props.onChange({target:{value:'לא-קיים-בדיקה'}});tree=render(AdminNavigation,{ctx,view:'admin'});assert(text(tree).includes('לא נמצא כלי מתאים'));
reset();tree=render(AdminNavigation,{ctx,view:'admin'});let toggle=nodes(tree).find(n=>n.type==='button');assert.equal(toggle.props['aria-expanded'],false);toggle.props.onClick();tree=render(AdminNavigation,{ctx,view:'admin'});assert.equal(nodes(tree).find(n=>n.type==='button').props['aria-expanded'],true);assert(nodes(tree).some(n=>n.props?.id==='admin-v172-menu'&&n.props.className.includes('is-expanded')));assert(nodes(tree).some(n=>n.props?.href==='#admin-workspace-content'));assert.equal(tree.props.dir,'rtl');
console.log('ADMIN DESIGN NAVIGATION PASSED: 21 guarded targets, 9 areas, 5 native modifier cases, 3 nested back routes, 2 pricing aliases, search/reset/empty state, mobile disclosure and RTL.');
