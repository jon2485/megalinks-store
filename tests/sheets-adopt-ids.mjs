import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {realpathSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const require=createRequire(realpathSync('node_modules/wrangler')+'/package.json'),{build}=require('esbuild');
await build({entryPoints:['lib/sheets-plan.ts'],bundle:true,platform:'node',format:'esm',outdir:'.sites-runtime/sheets-adopt-test',write:true});
const {planSheets}=await import(pathToFileURL(realpathSync('.sites-runtime/sheets-adopt-test/sheets-plan.js')));
const headings=['מזהה אתר','שם האתר','כתובת אתר','קטגוריה','מחיר מחירון ₪','עלות ₪','פעיל','הערות לאתר','קישור לוגו'];
const row=['sheet-abc','אתר א','a.example','כללי',200,'','כן','',''];
// An empty catalog (new environment or after "התחלה מאפס") takes the sheet's id as a new site.
const fresh=planSheets([headings,row],[]);
assert.deepEqual(fresh.errors,[],'empty catalog accepts the sheet id');
assert.equal(fresh.operations.length,1);assert.equal(fresh.operations[0].id,'sheet-abc');
// A catalog that already has sites still refuses an unknown id.
const w={id:'other',name:'אתר ב',url:'https://b.example/',category:'general',price:20000,dr:0,active:1,updated:'v1',data:'{}'};
assert.match(planSheets([headings,row],[w]).errors.join(' '),/המזהה אינו קיים באתר/);
console.log('SHEETS ADOPT IDS PASSED');
