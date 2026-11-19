import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {realpathSync,mkdirSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import vm from 'node:vm';
const require=createRequire(realpathSync('node_modules/wrangler')+'/package.json'),{build}=require('esbuild');
const bundle=await build({entryPoints:['lib/sheets-plan.ts','lib/sheets-script.ts'],bundle:true,platform:'node',format:'esm',outdir:'.sites-runtime/sheets-test',write:true});
const {planSheets,SHEET_ID}=await import(pathToFileURL(realpathSync('.sites-runtime/sheets-test/sheets-plan.js')));
const {sheetsScript}=await import(pathToFileURL(realpathSync('.sites-runtime/sheets-test/sheets-script.js')));
const headings=['מזהה אתר','שם האתר','כתובת אתר','קטגוריה','מחיר מחירון ₪','עלות ₪','פעיל','הערות לאתר','קישור לוגו'];
const w={id:'a',name:'אתר א',url:'https://a.example/',category:'general',price:20000,dr:0,active:0,updated:'v1',data:JSON.stringify({cost_cents:10000,public_notes:'הערה קיימת',logo_url:'https://a.example/logo.png'})};
const row=['a','אתר א','a.example','כללי',200,'','לא','',''];
assert.equal(planSheets([headings,row],[w]).operations.length,0,'Unchanged rows do not reactivate hidden sites or erase missing costs/notes');
let plan=planSheets([headings,[...row.slice(0,4),250,120,'כן','הערה חדשה','']],[w]);assert.deepEqual(plan.operations[0].values,{price_ils:250,cost_ils:120,active:true,public_notes:'הערה חדשה'});
const clearing=[...row];clearing[7]='__CLEAR__';assert.equal(planSheets([headings,clearing],[w]).operations[0].values.public_notes,'');
const zero=[...row];zero[4]=0;assert.equal(planSheets([headings,zero],[w]).operations[0].values.price_ils,0);
const invalid=[...row];invalid[4]='oops';assert(planSheets([headings,invalid],[w]).errors.length>0);
assert(planSheets([headings,row,row],[w]).errors.some(e=>e.includes('כפול')));
const missing=planSheets([headings,row],[w,{...w,id:'b',name:'ב',url:'https://b.example'}]);assert.equal(missing.missing,1);assert(!missing.operations.some(o=>o.values.active===false),'Missing rows never delete/deactivate a site');
// The site's own values written back to the sheet never block a sync (Staging 16.11.2026): a logo kept on the site as /api/selling/logo/...
// and free text in example articles pass while unchanged; a changed value is still checked.
{const heads=[...headings,'כתבות לדוגמה (פסיקים)'],site={...w,data:JSON.stringify({cost_cents:10000,public_notes:'הערה קיימת',logo_url:'/api/selling/logo/abc',example_articles:['טקסט חופשי, עם פסיק']})};
 const same=['a','אתר א','a.example','כללי',200,'','לא','','/api/selling/logo/abc','טקסט חופשי, עם פסיק'];
 let own=planSheets([heads,same],[site]);assert.deepEqual(own.errors,[],'the site values pass unchanged');assert.equal(own.operations.length,0,'and change nothing');
 own=planSheets([heads,[...same.slice(0,8),'not a link',same[9]]],[site]);assert(own.errors.some(e=>e.includes('שורה 2')),'a changed logo is still checked');
 own=planSheets([heads,[...same.slice(0,9),'עוד טקסט']],[site]);assert(own.errors.length>0,'changed example articles are still checked');}
// A sale price equal to the list price that is already on the site, and an address stored on the site as it is, do not block the sync;
// changing the price, the sale price or the address in that row is still checked.
{const heads=[...headings,'מחיר מבצע ₪','במבצע'],site={...w,data:JSON.stringify({cost_cents:10000,public_notes:'הערה קיימת',logo_url:'https://a.example/logo.png',sale_price_cents:20000,is_on_sale:true})};
 const same=['a','אתר א','a.example','כללי',200,'','לא','','',200,'כן'];
 let own=planSheets([heads,same],[site]);assert.deepEqual(own.errors,[],'the site sale price passes while nothing about the sale changed');
 own=planSheets([heads,[...same.slice(0,4),190,...same.slice(5)]],[site]);assert(own.errors.some(e=>e.includes('מחיר מבצע')),'changing the price checks the sale again');
 own=planSheets([heads,[...same.slice(0,9),210,'כן']],[site]);assert(own.errors.some(e=>e.includes('מחיר מבצע')),'changing the sale price checks it');
 const broken={...w,url:'לרוץ על החוף',data:JSON.stringify({cost_cents:10000})};
 own=planSheets([headings,['a','אתר א','לרוץ על החוף','כללי',200,'','לא','','']],[broken]);assert.deepEqual(own.errors,[],'an address stored on the site as it is passes');assert.equal(own.operations.length,0);
 own=planSheets([headings,['a','אתר א','גם לא כתובת','כללי',200,'','לא','','']],[broken]);assert(own.errors.length>0,'a changed address is still checked');
 own=planSheets([headings,['','אתר ב','לרוץ על החוף','כללי',200,'','כן','','']],[broken]);assert(own.errors.length>0,'a new row is always checked');}
// The same address with or without www or a trailing slash matches the existing site (Staging 16.11.2026: "ynet.co.il" vs "https://www.ynet.co.il/").
{const site={...w,url:'https://www.a.example/'};let m=planSheets([headings,['','אתר א','a.example','כללי',200,'','לא','','']],[site]);assert.deepEqual(m.errors,[]);assert.equal(m.additions,0,'not a new site');assert.equal(m.entries[0].id,'a','matched to the existing site');
 m=planSheets([headings,['','אתר א','A.example/','כללי',200,'','לא',''],['','שוב','https://www.a.example','כללי',200,'','לא','']],[site]);assert(m.errors.some(e=>e.includes('כפול')),'two rows of the same address are a duplicate');}
const newRow=['','חדש','https://new.example','general',300,100,'כן','',''];plan=planSheets([headings,newRow],[w]);assert.equal(plan.additions,1);assert.equal(plan.operations[0].create,true);
// Owner 16.11.2026: one notes column, "הערות", right after DR and UR, feeds the notes in the price list. The old name still works,
// both names together are refused, and the notes and pixel columns the sync had added on its own are no longer read.
{const {sheetFields}=await import(pathToFileURL(realpathSync('.sites-runtime/sheets-test/sheets-plan.js')));
 assert.deepEqual(Object.keys(sheetFields).slice(0,6),['שם האתר','URL','מחיר לפני הנחה ₪','DR','UR','הערות'],'notes right after DR and UR');assert.equal(sheetFields['הערות'],'public_notes');
 for(const gone of ['הוראות פרסום','הערות ללקוח','הערות לאתר','אפשרות פיקסל','מחיר פיקסל ₪'])assert(!(gone in sheetFields),gone+' is no longer a sheet column');
 const heads=['מזהה אתר','שם האתר','כתובת אתר','קטגוריה','מחיר מחירון ₪','עלות ₪','פעיל','הערות','הוראות פרסום','הערות ללקוח','אפשרות פיקסל','מחיר פיקסל ₪'];
 const m=planSheets([heads,['a','אתר א','a.example','כללי',200,'','לא','רק דרך קישור','ישן','ישן','free',50]],[w]);assert.deepEqual(m.errors,[]);assert.deepEqual(m.operations[0].values,{public_notes:'רק דרך קישור'},'only the notes column is read');
 assert.throws(()=>planSheets([[...headings,'הערות'],[...row,'כפול']],[w]),/פעמיים/,'"הערות" and the old "הערות לאתר" together are refused');
 const script=sheetsScript();assert(script.includes('DR, UR, הערות, מייל ספק'),'the column arrangement names the notes after DR and UR');}
// Owner 19.11.2026: UR may have decimals; DR stays a whole number.
{const heads=[...headings,'DR','UR'];let m=planSheets([heads,[...row,'',1.8]],[w]);assert.deepEqual(m.errors,[]);assert.equal(m.operations[0].values.ur,1.8,'UR 1.8 accepted');
 m=planSheets([heads,[...row,1.5,'']],[w]);assert(m.errors.some(e=>e.includes('DR')),'DR 1.5 refused');
 m=planSheets([headings,['a','אתר א','a.example','חדשות מקומיות',200,'','לא','','']],[{...w,category:'news_local'}]);assert.equal(m.operations.length,0,'the Hebrew category name is the same category');}
// Owner 19.11.2026: several categories per site, comma separated; the first is the main one. No "כללי" in the list.
{const {categoryLabels}=await import(pathToFileURL(realpathSync('.sites-runtime/sheets-test/sheets-plan.js')));assert(!Object.values(categoryLabels).includes('כללי'),'no general category offered');
 let m=planSheets([headings,['','חדש','https://multi.example','מגזינים, לייף סטייל, בריאות',300,100,'כן','','']],[w]);assert.deepEqual(m.errors,[]);assert.deepEqual(m.operations[0].values.category,['magazines','lifestyle','health'],'all categories kept, main first');
 m=planSheets([headings,['','חדש','https://multi.example','מגזינים, משהו לא קיים',300,100,'כן','','']],[w]);assert(m.errors.some(e=>e.includes('משהו לא קיים')),'an unknown category is named');
 const site={...w,category:'magazines',data:JSON.stringify({cost_cents:10000,public_notes:'הערה קיימת',logo_url:'https://a.example/logo.png',categories:['magazines','health']})};
 m=planSheets([headings,['a','אתר א','a.example','מגזינים, בריאות',200,'','לא','','']],[site]);assert.equal(m.operations.length,0,'the same list is no change');
 m=planSheets([headings,['a','אתר א','a.example','בריאות',200,'','לא','','']],[site]);assert.deepEqual(m.operations[0].values.category,['health'],'a changed list is saved');}
const source=sheetsScript();assert(source.includes('everyMinutes(5)'));assert(!source.includes('token = \''),'No credential embedded in script');
const triggers=[],properties=new Map(),calls=[];let prompts=0;
const fullHeads=JSON.parse(source.match(/const MEGA_LINKS_HEADERS = (.*);/)[1]).map(g=>g[0]);const book={getId:()=>SHEET_ID,getSheetByName:()=>({getLastRow:()=>2,getLastColumn:()=>fullHeads.length,getRange:(r,c,n)=>({getValues:()=>n===1?[fullHeads]:[fullHeads,row]})})};
const context={SpreadsheetApp:{getActiveSpreadsheet:()=>book,getUi:()=>({ButtonSet:{OK_CANCEL:'oc',OK:'o'},Button:{OK:'ok'},prompt:()=>({getSelectedButton:()=> 'ok',getResponseText:()=> 'x'.repeat(43)}),createMenu:()=>{const m={addItem:()=>m,addToUi(){}};return m;},alert(){}})},PropertiesService:{getScriptProperties:()=>({getProperty:k=>properties.get(k),setProperty:(k,v)=>properties.set(k,v),deleteProperty:k=>properties.delete(k)})},ScriptApp:{getProjectTriggers:()=>[],newTrigger:name=>{triggers.push(name);const t={forSpreadsheet:()=>t,onEdit:()=>t,onChange:()=>t,timeBased:()=>t,everyMinutes:n=>{assert.equal(n,5);return t;},create(){}};return t;}},LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock(){}})},UrlFetchApp:{fetch:(url,args)=>{calls.push({url,args});return {getContentText:()=>JSON.stringify({status:'received',message:'ok'}),getResponseCode:()=>200};}},Utilities:{getUuid:()=>crypto.randomUUID()},Date,JSON,Error};
vm.createContext(context);vm.runInContext(source,context);context.installMegaLinksSync();assert.equal(triggers.length,3);assert.equal(calls.length,1);assert.equal(JSON.parse(calls[0].args.payload).spreadsheet_id,SHEET_ID);assert.equal(calls[0].args.followRedirects,false);assert(calls[0].args.headers.Authorization.startsWith('Bearer '));assert(!source.includes('console.log'));
console.log('Sheets planner and Apps Script: diffs, price values, blank preservation, explicit clears, validation, duplicate IDs, additions, no deletions, periodic/edit triggers and credential handling passed.');
