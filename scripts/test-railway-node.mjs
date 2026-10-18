// Reuse test assertions verbatim; replace only their runtime constructor.
import {readFileSync,writeFileSync,unlinkSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
const file=process.argv[2]||'integration.mjs';
if(!/^[a-z0-9-]+\.mjs$/.test(file))throw new Error('Expected a test filename');
const source=readFileSync('tests/'+file,'utf8');
const changed="import {NodeTestRuntime} from './railway-node-harness.mjs';\n"+source.replaceAll("require('miniflare')","({...require('miniflare'),Miniflare:NodeTestRuntime})");
if(!source.includes("require('miniflare')"))throw new Error('Test runtime declaration was not recognized');
const target='tests/.railway-node-'+randomUUID()+'.mjs';
try{writeFileSync(target,changed);const result=spawnSync(process.execPath,[target],{stdio:'inherit'});process.exitCode=result.status??1;}finally{unlinkSync(target);}
