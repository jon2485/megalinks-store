import {sheetCurrentValue,sheetFields} from './sheets-plan';
import type {Row} from './shared';
export const sheetValue=(w:Row,key:string)=>sheetCurrentValue(w,key)??(['tags','features','example_articles','recommended_topics','content_tags'].includes(key)?[]:['active','is_on_sale','single_link_only','procurement_verified'].includes(key)?false:'');
const equal=(a:any,b:any)=>JSON.stringify(a)===JSON.stringify(b);
export function baselineFromPlan(plan:Row,existing:Row[]){const byId=new Map(existing.map(w=>[w.id,w]));return Object.fromEntries(plan.entries.map((entry:Row)=>[entry.id,{...Object.fromEntries(Object.keys(entry.values).map(k=>[k,byId.has(entry.id)?sheetValue(byId.get(entry.id)!,k):''])),...entry.values}]));}
export function mergeSheetPlan(plan:Row,baseline:Row,existing:Row[],resolutions:Row={}):Row{
 const byId=new Map(existing.map(w=>[w.id,w])),conflicts:Row[]=[],operations:Row[]=[],outbound:string[]=[];
 for(const op of plan.operations){if(op.create){operations.push(op);continue;}const w=byId.get(op.id)!;const values:Row={};
  for(const [field,incoming]of Object.entries(op.values)){const current=sheetValue(w,field),before=baseline[op.id]?.[field],hasBase=Object.hasOwn(baseline[op.id]||{},field),token=op.id+':'+field;
   if(hasBase&&equal(incoming,before)){outbound.push(token);continue;}
   if(hasBase&&equal(current,before)||!hasBase&&equal(current,'')){values[field]=incoming;continue;}
   if(resolutions[token]==='sheet'){values[field]=incoming;continue;}if(resolutions[token]==='site'){outbound.push(token);continue;}
   conflicts.push({token,id:op.id,name:op.name,row:op.row,field,label:Object.entries(sheetFields).find(([,key])=>key===field)?.[0]||field,before:hasBase?before:null,site:current,sheet:incoming});
  }
  if(Object.keys(values).length)operations.push({...op,values});
 }
 return {...plan,operations,conflicts,outbound,additions:operations.filter(r=>r.create).length,updates:operations.filter(r=>!r.create).length,unchanged:plan.scanned-operations.length};
}
export function sheetCell(value:any){if(Array.isArray(value))return value.join(', ');if(typeof value==='boolean')return value?'כן':'לא';return value??'';}
// Ignore formula-only, display and unmapped columns: changing cost legitimately recalculates minimum.
export function roundtripRows(rows:any[][]){const cols=rows[0].map((h,i)=>sheetFields[String(h).trim()]?i:-1).filter(i=>i>=0);return [cols.map(i=>String(rows[0][i]).trim()),...rows.slice(1).filter(row=>cols.some(i=>String(row[i]??'').trim())).map(row=>cols.map(i=>String(row[i]??'').trim()))];}
export function writebackPlan(rows:any[][],entries:Row[],websites:Row[]){
 const headers=rows[0].map(v=>String(v??'').trim()),keys=headers.map(h=>sheetFields[h]||''),known=new Map(websites.map(w=>[w.id,w])),represented=new Set(entries.map(e=>e.id)),cells:Row[]=[],append:any[][]=[],target=rows.map(row=>[...row]),baseline:Row={};
 for(const entry of entries){const w=known.get(entry.id);if(!w)continue;baseline[w.id]={};for(let col=0;col<keys.length;col++){const field=keys[col];if(!field)continue;const v=field==='id'?w.id:sheetValue(w,field),after=sheetCell(v),before=rows[entry.row-1]?.[col]??'';if(field!=='id')baseline[w.id][field]=v;
   if(String(before)!==String(after)){cells.push({row:entry.row,column:col+1,field,id:w.id,name:w.name,before,after});target[entry.row-1][col]=after;}
 }}
 for(const w of websites){if(represented.has(w.id))continue;const row=keys.map(field=>!field?'':field==='id'?w.id:sheetCell(sheetValue(w,field)));append.push(row);baseline[w.id]=Object.fromEntries(keys.filter(k=>k&&k!=='id').map(k=>[k,sheetValue(w,k)]));target.push(row);}
 return {cells,append,baseline,target};
}
