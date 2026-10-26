import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {realpathSync,writeFileSync} from 'node:fs';
const require=createRequire(realpathSync('node_modules/wrangler')+'/package.json'),{build}=require('esbuild');
const bundle=await build({entryPoints:['lib/publication-period.ts'],bundle:true,platform:'node',format:'esm',write:false});writeFileSync('.sites-runtime/publication-period.mjs',bundle.outputFiles[0].text);const{publicationPeriod}=await import('../.sites-runtime/publication-period.mjs');
for(const [timestamp,month] of [['2026-01-31T21:59:59.999Z','2026-01'],['2026-01-31T22:00:00.000Z','2026-02'],['2026-07-31T20:59:59.999Z','2026-07'],['2026-07-31T21:00:00.000Z','2026-08'],['2024-02-29T21:59:59.999Z','2024-02'],['2024-02-29T22:00:00.000Z','2024-03'],['2026-12-31T22:00:00.000Z','2027-01']])assert.deepEqual(publicationPeriod(new Date(timestamp)),{stamp:timestamp,month});
console.log('Publication period: one immutable timestamp/month; Israel winter/summer midnight, leap February and year rollover passed.');
