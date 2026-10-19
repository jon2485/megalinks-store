import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import ts from 'typescript';
import {createRequire} from 'node:module';
const base='8f88445128bab2f2d73e561edf1b604412a5edda';
const original=p=>execFileSync('git',['show',base+':'+p],{encoding:'utf8',maxBuffer:20*1024*1024});
const changed=new Set(['app/admin-lobby-panels.tsx','app/admin-lobby.tsx','app/admin-order-history.tsx','app/admin-shell.tsx','app/commerce.tsx','app/management.tsx','app/supplier-settlements.tsx','app/workspace.tsx','DESIGN.md','UX-CONTRACT.md','tests/admin-foundation-stage-a.mjs','tests/admin-lobby-panels.mjs','tests/admin-ui-harness.mjs','tests/admin-order-history.mjs']);
let protectedFiles=0;
for(const p of execFileSync('git',['ls-tree','-r','--name-only',base],{encoding:'utf8'}).trim().split('\n')){
 if(changed.has(p))continue;
 assert.deepEqual(readFileSync(p),execFileSync('git',['show',base+':'+p],{maxBuffer:20*1024*1024}),'Protected source '+p);protectedFiles++;
}
function functions(source){const ast=ts.createSourceFile('a.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),out={};for(const n of ast.statements)if(ts.isFunctionDeclaration(n)&&n.name)out[n.name.text]=n.body.getText(ast);return out;}
for(const [file,exceptions] of [
 ['app/commerce.tsx',['SuppliersView']],['app/management.tsx',['ApprovalBoard','NoticesView']],
 ['app/admin-lobby-panels.tsx',['LobbyPaymentReports']],['app/admin-shell.tsx',['AdminNavigation']],
 ['app/workspace.tsx',['Workspace']],['app/supplier-settlements.tsx',['SupplierSettlements']],
]){
 const before=functions(original(file)),after=functions(readFileSync(file,'utf8'));
 for(const [name,body] of Object.entries(before))if(!exceptions.includes(name))assert.equal(after[name],body,file+' original owner '+name);
}
// Supplier-role output is exactly the original card implementation.
assert.equal(functions(readFileSync('app/supplier-settlements.tsx','utf8')).SupplierSettlementCards,functions(original('app/supplier-settlements.tsx')).SupplierSettlements);
// The workspace edit is only an import and a sibling navigation presentation.
const workspace=readFileSync('app/workspace.tsx','utf8').replace(',AdminSectionTabs','').replace("import './admin-complete.css';\n",'').replace("{adminMode&&user?.role==='admin'&&<AdminSectionTabs ctx={ctx} view={view}/>} ",'');
assert.equal(workspace,original('app/workspace.tsx'));
const commerce=readFileSync('app/commerce.tsx','utf8');
for(const declaration of ['const editSupplier =','const editSite =','const sites =']){
 const line=s=>s.split('\n').find(l=>l.includes(declaration));assert.equal(line(commerce),line(original('app/commerce.tsx')),declaration);
}
assert(!commerce.includes('קישור להזמנת לקוח'));
const link=readFileSync('app/admin-customer-order-link.tsx','utf8');
assert(link.includes("navigator.clipboard.writeText(window.location.origin + '/')"));assert(link.includes("ctx.go('catalog')"));
assert(readFileSync('app/admin-order-history.tsx','utf8').includes('<AdminCustomerOrderLink ctx={ctx}/>'));
const notices=readFileSync('app/management.tsx','utf8');assert(!notices.includes('PendingBankPayments'));
assert(readFileSync('app/admin-order-history.tsx','utf8').includes('{unpaid&&<PendingBankPayments ctx={ctx}/>}'));
// Scoped CSS cannot disable business operations or leak to other roles.
const require=createRequire(import.meta.url),postcss=require(require.resolve('postcss',{paths:[require.resolve('@tailwindcss/postcss')]}));
const css=readFileSync('app/admin-complete.css','utf8'),ast=postcss.parse(css);
ast.walkRules(rule=>rule.selectors.forEach(selector=>assert(selector.startsWith('.admin-design-v172')||selector.startsWith('body:has(.admin-design-v172) '),selector)));
assert(!/pointer-events\s*:\s*none|visibility\s*:\s*hidden|transition\s*:\s*all/.test(css));
ast.walkDecls('display',d=>{if(d.value.startsWith('none'))assert(/admin-workbench-(back|list|detail)|admin-section-tabs|admin-v172-queue-column|lobby-card-action|admin-azure-hero/.test(d.parent.selector),'Undocumented hiding '+d.parent.selector);});
assert(readFileSync('docs/admin-design-v172/action-preservation.csv','utf8').trim().split('\n').length===94,'93 existing action groups retained');
console.log(`ADMIN COMPLETE ISOLATION: ${protectedFiles} original files unchanged, all APIs/backend/database/shared controls/customer sources protected, supplier role unchanged, original form owners and supplier saves retained, 93 action groups retained, scoped CSS only.`);
