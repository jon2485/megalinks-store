import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
const baseline='31184232e7fda89259494729efefc52a2a642904';
const changed=new Set(['app/admin-shell.tsx','app/admin-lobby.tsx','app/admin-design-v172.css','app/workspace.tsx',
 'tests/admin-entry-routing.mjs','tests/admin-design-isolation.mjs','tests/admin-full-design-preservation.mjs',
 'tests/admin-lobby-actions.mjs','tests/admin-shell-ui.mjs','tests/admin-ui-harness.mjs','DESIGN.md','UX-CONTRACT.md']);
let checked=0;
for(const path of execFileSync('git',['ls-tree','-r','--name-only',baseline],{encoding:'utf8'}).trim().split('\n')){
 if(changed.has(path))continue;
 const original=execFileSync('git',['show',baseline+':'+path],{maxBuffer:20*1024*1024});
 assert(readFileSync(path).equals(original),'Unexpected change outside Stage 1: '+path);checked++;
}
assert.equal(readFileSync('docs/admin-design-v172/control-preservation.csv','utf8').trim().split('\n').length-1,1002);
assert.equal(readFileSync('docs/admin-design-v172/action-preservation.csv','utf8').trim().split('\n').length-1,93);
console.log(`STAGE 1 ISOLATION PASSED: ${checked} current-base files byte-identical, including API/Auth/DB/business handlers, customer/supplier components and all 1,002/93 mapping rows. Allowed presentation changes are covered by handler/SSR tests.`);
