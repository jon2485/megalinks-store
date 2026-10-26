import assert from 'node:assert/strict';
import {compile,reset,render,nodes,text} from './admin-ui-harness.mjs';
const {default:View,PurchaseRow}=await compile('app/purchased-view.tsx','article-controls',{stubs:{'./workspace':'export const Empty=()=>null;export const ErrorBox=()=>null;'}});
const ctx={catalog:[],revision:0,go(){}},article={id:'a',status:'draft',paid:1,created_at:'2026-10-26',title:'כתבה',number:'#1010'};
for(const [customers,assigned,error,expected] of [[[],false,'',false],[[{id:'c',name:'לקוח'}],false,'',true],[[],true,'',true],[[],false,'failed',false]]){
 reset({'articles':{data:{articles:[{...article,...(assigned?{customer_id:'c',customer_name:'לקוח'}:{})}]}},'articles/customer-options':{data:{customers},error}});
 const tree=render(View,{ctx});const row=nodes(tree).find(n=>n.type===PurchaseRow);assert(row);assert.equal(row.props.canAssign,expected);
 const record=render(PurchaseRow,row.props);assert.equal(nodes(record).some(n=>n.props?.compact===true&&n.props?.article),expected);
 assert(text(tree).includes('לאישור'));assert(text(tree).includes('לפרסום'));
}
console.log('ARTICLE CONTROLS PASS: no customers, owned customer, existing assignment and failed lookup visibility; original article action retained.');
