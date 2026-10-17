import assert from 'node:assert/strict';import {createRequire} from 'node:module';import {realpathSync} from 'node:fs';import {pathToFileURL} from 'node:url';
const require=createRequire(realpathSync('node_modules/wrangler')+'/package.json'),{build}=require('esbuild');await build({entryPoints:['lib/sheets-merge.ts'],bundle:true,platform:'node',format:'esm',outfile:'.sites-runtime/sheets-merge-properties.mjs'});const {mergeSheetPlan,roundtripRows}=await import(pathToFileURL(realpathSync('.sites-runtime/sheets-merge-properties.mjs')));let checks=0;
for(let base=0;base<12;base++)for(let current=0;current<12;current++)for(let incoming=0;incoming<12;incoming++){
 const w={id:'a',name:'A',price:current*100,data:'{}'},op={id:'a',name:'A',values:{price_ils:incoming},row:2},plan={operations:current===incoming?[]:[op],entries:[],errors:[],scanned:1};const out=mergeSheetPlan(plan,{a:{price_ils:base}},[w]);
 if(current===incoming||incoming===base){assert.equal(out.operations.length,0);assert.equal(out.conflicts.length,0);}
 else if(current===base){assert.equal(out.operations[0].values.price_ils,incoming);assert.equal(out.conflicts.length,0);}
 else{assert.equal(out.operations.length,0);assert.equal(out.conflicts.length,1);const site=mergeSheetPlan(plan,{a:{price_ils:base}},[w],{'a:price_ils':'site'});assert.equal(site.conflicts.length,0);assert.equal(site.operations.length,0);const sheet=mergeSheetPlan(plan,{a:{price_ils:base}},[w],{'a:price_ils':'sheet'});assert.equal(sheet.operations[0].values.price_ils,incoming);}
 checks++;
}
const h=['מזהה אתר','שם האתר','מחיר מחירון ₪','מינימום ₪'];assert.deepEqual(roundtripRows([h,['a','A',100,130]]),roundtripRows([h,['a','A',100,150]]));assert.notDeepEqual(roundtripRows([h,['a','A',100,130]]),roundtripRows([h,['a','A',101,130]]));
console.log('THREE-WAY MERGE PROPERTIES PASSED:',checks,'base/site/sheet combinations, both conflict choices, zero prices, and calculated-column isolation.');
