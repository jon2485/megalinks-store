// The "סידור העמודות" action of the Google Sheets script, run on a fictional sheet in a small Apps Script stand-in.
// Checks the owner's order (16.11.2026), that every value moves with its column, and that nothing is renamed or deleted.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';import {realpathSync,mkdirSync} from 'node:fs';import {pathToFileURL} from 'node:url';
const require=createRequire(realpathSync('node_modules/wrangler')+'/package.json');const {build}=require('esbuild');
mkdirSync('.sites-runtime',{recursive:true});
await build({entryPoints:['lib/sheets-script.ts','lib/sheets-plan.ts'],bundle:true,platform:'node',format:'esm',outdir:'.sites-runtime/sheets-arrange',write:true});
const {sheetsScript}=await import(pathToFileURL(realpathSync('.sites-runtime/sheets-arrange/sheets-script.js')));
const {SHEET_ID,SHEET_TAB}=await import(pathToFileURL(realpathSync('.sites-runtime/sheets-arrange/sheets-plan.js')));

// The order the sheet had before 16.11 (old names), plus a column of the owner's own with a formula.
const oldHeads=['מזהה אתר','שם האתר','כתובת אתר','קטגוריה','מחיר מחירון ₪','עלות ₪','מינימום ₪','פעיל','DR','UR','מחיר מבצע ₪','במבצע','ספק','מלאי','שפה','מייל הספק','הערות שלי'];
const rows=[1,2,3].map(n=>oldHeads.map(h=>h+' #'+n));
function fakeSheet(heads,data,{dialog='OK'}={}){
 let grid=[heads.slice(),...data.map(r=>r.slice())],maxCols=heads.length+2,moves=0;
 const width=()=>Math.max(...grid.map(r=>r.length));
 const pad=()=>{for(const r of grid)while(r.length<maxCols)r.push('');};pad();
 const lastCol=()=>{let c=0;for(const r of grid)r.forEach((v,i)=>{if(String(v)!=='')c=Math.max(c,i+1);});return c;};
 const range=(r,c,nr,nc)=>({getValues:()=>grid.slice(r-1,r-1+nr).map(row=>row.slice(c-1,c-1+nc)),setValues:v=>{v.forEach((row,i)=>row.forEach((x,j)=>{grid[r-1+i][c-1+j]=x;}));},col:c,cols:nc,getFormula:()=>''});
 const tab={getName:()=>SHEET_TAB,getLastColumn:lastCol,getLastRow:()=>grid.length,getMaxRows:()=>grid.length,getMaxColumns:()=>maxCols,getRange:range,
  insertColumnsAfter:(after,n)=>{maxCols+=n;pad();},
  // Apps Script: destinationIndex is the column the moved one ends up in when moving left.
  moveColumns:(spec,dest)=>{assert.equal(spec.cols,1);const from=spec.col-1,to=dest-1;assert(to<=from,'the arrangement only moves columns to the left');for(const r of grid){const [v]=r.splice(from,1);r.splice(to,0,v);}moves++;}};
 const book={getId:()=>SHEET_ID,getSheetByName:n=>n===SHEET_TAB?tab:null};
 const alerts=[];
 const env={SpreadsheetApp:{getActiveSpreadsheet:()=>book,getUi:()=>({alert:(...a)=>{alerts.push(a);return a.length>2?dialog:'OK';},Button:{OK:'OK'},ButtonSet:{OK:'OK',OK_CANCEL:'OK_CANCEL'}}),flush:()=>{}},
  LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock:()=>{}})},PropertiesService:{getScriptProperties:()=>({getProperty:()=>null,setProperty:()=>{}})},
  ScriptApp:{},UrlFetchApp:{fetch:()=>{throw new Error('the arrangement never calls the site');}},Utilities:{}};
 const run=new Function(...Object.keys(env),sheetsScript()+';return {arrangeMegaLinksColumns};')(...Object.values(env));
 return {run,grid:()=>grid.map(r=>r.slice(0,lastCol())),alerts,moves:()=>moves};
}

const sheet=fakeSheet(oldHeads,rows);
sheet.run.arrangeMegaLinksColumns();
const [heads,...data]=sheet.grid();
// Owner 16.11.2026: the one notes column comes right after DR and UR (added here, as this old sheet has none).
assert.deepEqual(heads.slice(0,11),['שם האתר','כתובת אתר','מחיר מחירון ₪','DR','UR','הערות','מייל הספק','שם ספק','עלות ₪','מלאי','מחיר מבצע ₪'],'the owner order, with the sheet\'s own (old) names kept');
assert.deepEqual(heads.slice(-2),['ספק','מזהה אתר'],'supplier id and site id last');
assert(heads.indexOf('מינימום ₪')>heads.indexOf('במבצע')&&heads.indexOf('הערות שלי')>heads.indexOf('במבצע'),'the owner\'s own columns stay, after the known ones');
for(const h of oldHeads)assert(heads.includes(h),'nothing deleted or renamed: '+h);
assert.equal(heads.length,new Set(heads).size,'no column doubled');
data.forEach((row,i)=>heads.forEach((h,j)=>{if(oldHeads.includes(h))assert.equal(row[j],h+' #'+(i+1),'value moved with its column: '+h);}));
assert(heads.includes('שם ספק')&&data.every(r=>r[heads.indexOf('שם ספק')]===''),'a missing column is added empty');
assert(/הוזזו \d+ עמודות/.test(sheet.alerts.at(-1)[1]),'the owner sees how many columns moved');

// A second run finds everything in place and moves nothing.
const again=fakeSheet(heads,data);again.run.arrangeMegaLinksColumns();
assert.equal(again.moves(),0);assert.deepEqual(again.grid()[0],heads);assert.match(again.alerts.at(-1)[1],/כבר היו בסדר הנכון/);

// "ביטול" in the question leaves the sheet as it was.
const cancelled=fakeSheet(oldHeads,rows,{dialog:'CANCEL'});cancelled.run.arrangeMegaLinksColumns();
assert.equal(cancelled.moves(),0);assert.deepEqual(cancelled.grid()[0],oldHeads);

console.log('SHEETS ARRANGE PASSED: owner order with old names kept, ids last, own columns kept, values move with columns, missing column added, second run moves nothing, cancel changes nothing, no call to the site.');
