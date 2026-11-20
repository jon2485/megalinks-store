// Owner 20.11.2026: DR may have decimals; "-" in DR or UR means no information yet; stock types "מלאי", "חודשי" and "החלפה"
// ("החלפות" is read as "החלפה"); a supplier cell may hold several addresses, kept as one "a, b" value and mailed to all of them.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {realpathSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const require=createRequire(realpathSync('node_modules/wrangler')+'/package.json'),{build}=require('esbuild');
await build({entryPoints:['lib/sheets-plan.ts','lib/catalog-fields.ts'],bundle:true,platform:'node',format:'esm',outdir:'.sites-runtime/sheets-stock-test',write:true});
const {planSheets}=await import(pathToFileURL(realpathSync('.sites-runtime/sheets-stock-test/sheets-plan.js')));
const {emailList,stockWord}=await import(pathToFileURL(realpathSync('.sites-runtime/sheets-stock-test/catalog-fields.js')));

const heads=['מזהה אתר','שם האתר','כתובת אתר','קטגוריה','מחיר מחירון ₪','DR','UR','מלאי','מייל הספק'];
const w={id:'a',name:'אתר א',url:'https://a.example/',category:'news_national',price:20000,dr:10,active:1,updated:'v1',data:JSON.stringify({cost_cents:10000,ur:5})};
const base=['a','אתר א','a.example','חדשות ארציות',200];
const two='x@a.example\n‫Y@b.example‬';

let p=planSheets([heads,[...base,'4.1','-','מלאי',two]],[w]);
assert.deepEqual(p.errors,[],'decimal DR, a dash, the stock word and two addresses all pass');
let v=p.operations[0].values;
assert.equal(v.dr,4.1,'DR keeps its decimal');
assert.equal('ur' in v,false,'a dash in UR changes nothing');
assert.equal(v.stock_total,'מלאי');
assert.equal(v.supplier_email,'x@a.example, y@b.example','both addresses, lower case, without direction marks');

p=planSheets([heads,[...base,'----','','החלפות','']],[w]);
assert.deepEqual(p.errors,[]);assert.equal('dr' in (p.operations[0]?.values||{}),false,'a dash in DR changes nothing');
assert.equal(p.operations[0].values.stock_total,'החלפה','"החלפות" is read as "החלפה"');
p=planSheets([heads,[...base,'','','חודשי','']],[w]);assert.deepEqual(p.errors,[]);assert.equal(p.operations.length,0,'monthly is already the site value');
p=planSheets([heads,[...base,'','','12','']],[w]);assert.equal(p.operations[0].values.stock_total,12,'a number is still a package count');

p=planSheets([heads,[...base,'','','סתם','']],[w]);assert(p.errors.length>0,'an unknown stock word is still an error');
p=planSheets([heads,[...base,'','','','x@a.example ואחר כך טקסט']],[w]);assert(p.errors.some(e=>e.includes('מייל')),'text that is not an address is still an error');
p=planSheets([heads,[...base,'101','','','']],[w]);assert(p.errors.length>0,'DR above 100 is still an error');
// Owner 20.11.2026: UR is the supplier's own number and may be above 100.
p=planSheets([heads,[...base,'','1719','','']],[w]);assert.deepEqual(p.errors,[]);assert.equal(p.operations[0].values.ur,1719,'UR above 100 is kept');

const stored={...w,data:JSON.stringify({cost_cents:10000,ur:5,stock_mode:'exchange',supplier_email:'x@a.example, y@b.example'})};
p=planSheets([heads,[...base,'','','החלפה',two]],[stored]);
assert.deepEqual(p.errors,[]);assert.equal(p.operations.length,0,'the stored type and addresses read back as unchanged');
const stock={...w,data:JSON.stringify({cost_cents:10000,ur:5,stock_mode:'stock',stock_total:30})};
p=planSheets([heads,[...base,'','','מלאי','']],[stock]);assert.equal(p.operations.length,0,'"מלאי" matches a stock site and keeps its package count');

assert.deepEqual(emailList('a@x.co, B@y.co;a@x.co'),['a@x.co','b@y.co']);
assert.equal(stockWord(' החלפה '),'החלפה');assert.equal(stockWord('מלאי'),'מלאי');assert.equal(stockWord('5'),'');
console.log('Sheets stock types, decimal DR, "-" as no information and several supplier addresses: ok');
