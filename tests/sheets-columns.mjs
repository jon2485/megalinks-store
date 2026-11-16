// Owner column order (16.11.2026): new header names, old names still accepted, supplier by e-mail with a name,
// a sale price that turns the sale on, and one name per supplier e-mail. Local fixtures only.
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {readFileSync,realpathSync,readdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
const require=createRequire(realpathSync('node_modules/wrangler')+'/package.json'),{build}=require('esbuild'),{Miniflare}=require('miniflare');
let checks=0;const ok=(c,m)=>{assert(c,m);checks++;};

// Planner and Apps Script, straight from the sources.
await build({entryPoints:['lib/sheets-plan.ts','lib/sheets-script.ts'],bundle:true,platform:'node',format:'esm',outdir:'.sites-runtime/sheets-columns',write:true});
const {planSheets,sheetFields}=await import(pathToFileURL(realpathSync('.sites-runtime/sheets-columns/sheets-plan.js')));
const {sheetsScript}=await import(pathToFileURL(realpathSync('.sites-runtime/sheets-columns/sheets-script.js')));
const order=Object.keys(sheetFields);
ok(JSON.stringify(order.slice(0,10))===JSON.stringify(['שם האתר','URL','מחיר לפני הנחה ₪','DR','UR','מייל ספק','שם ספק','עלות ₪','מלאי','מחיר מבצע ₪']),'the first ten columns follow the owner order');
ok(order.at(-1)==='מזהה אתר','the site id column comes last');
const w={id:'a',name:'אתר א',url:'https://a.example/',category:'general',price:20000,dr:10,active:1,updated:'v1',data:JSON.stringify({cost_cents:10000,ur:5})};
const fresh=['שם האתר','URL','מחיר לפני הנחה ₪','DR','UR','מייל ספק','שם ספק','עלות ₪','מלאי','מחיר מבצע ₪','קטגוריה','מזהה אתר'];
let plan=planSheets([fresh,['אתר א','a.example',200,10,5,'','',100,'','','general','a']],[w]);
ok(plan.errors.length===0&&plan.operations.length===0,'new header names read an unchanged row as unchanged: '+plan.errors);
const legacy=['מזהה אתר','שם האתר','כתובת אתר','קטגוריה','מחיר מחירון ₪','עלות ₪'];
plan=planSheets([legacy,['a','אתר א','a.example','general',250,100]],[w]);
ok(plan.errors.length===0&&plan.operations[0].values.price_ils===250,'old header names still work');
assert.throws(()=>planSheets([[...fresh,'כתובת אתר'],['אתר א','a.example',200,10,5,'','',100,'','','general','a','a.example']],[w]),/פעמיים/);checks++;
plan=planSheets([fresh,['אתר א','a.example',200,10,5,'','',100,'','150','general','a']],[w]);
ok(plan.operations[0].values.sale_price_ils===150&&plan.operations[0].values.is_on_sale===true,'typing a sale price turns the sale on');
plan=planSheets([[...fresh,'במבצע'],['אתר א','a.example',200,10,5,'','',100,'','150','general','a','לא']],[w]);
ok(plan.operations[0].values.is_on_sale===true,'the "לא" the sync writes into every row does not block a newly typed sale price');
const onSale={...w,data:JSON.stringify({cost_cents:10000,ur:5,is_on_sale:true,sale_price_cents:15000})};
plan=planSheets([[...fresh,'במבצע'],['אתר א','a.example',200,10,5,'','',100,'','140','general','a','לא']],[onSale]);
ok(plan.operations[0].values.is_on_sale===false&&plan.operations[0].values.sale_price_ils===140,'changing במבצע from כן to לא ends the sale');
ok(planSheets([fresh,['אתר א','a.example',200,10,5,'','',100,'','250','general','a']],[w]).errors.some(e=>e.includes('מבצע')),'a sale price above the list price is refused');
const source=sheetsScript(),groups=JSON.parse(source.match(/const MEGA_LINKS_HEADERS = (.*);/)[1]);
ok(groups.find(g=>g[0]==='URL').includes('כתובת אתר')&&groups.find(g=>g[0]==='מחיר לפני הנחה ₪').includes('מחיר מחירון ₪'),'the script knows the old names');
const missingFor=headers=>groups.filter(g=>!g.some(h=>headers.includes(h))).map(g=>g[0]);
ok(!missingFor(legacy).includes('URL')&&missingFor(legacy).includes('שם ספק'),'an old sheet gets the new columns but no duplicate URL/price column');

// Through the real API (built Worker): supplier by e-mail and name, sale price, one name per e-mail.
const key=randomBytes(32).toString('base64url');
const mf=new Miniflare({modules:[{type:'ESModule',path:'dist/server/index.js'},...readdirSync('dist/server',{recursive:true}).filter(p=>/\.(m?js)$/.test(p)&&p!=='index.js').map(p=>({type:'ESModule',path:'dist/server/'+p}))],compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],r2Buckets:['BUCKET'],bindings:{SETTINGS_ENCRYPTION_KEY:randomBytes(32).toString('base64'),POSTFLOW_OWNER_EMAIL:'owner@example.test',POSTFLOW_SHEETS_SYNC_KEY:key}});
async function req(path,method='GET',body,user='owner',status=200){const headers={'Content-Type':'application/json'};if(user){headers['oai-authenticated-user-id']=user;headers['oai-authenticated-user-email']=user+'@example.test';}else headers.Authorization='Bearer '+key;const res=await mf.dispatchFetch('https://postflow.test/api/'+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)}),j=await res.json();assert.equal(res.status,status,JSON.stringify(j));checks++;return j;}
const id='1_bo5ubja3sLePWSPEVIkc5ySOvhCxRICQBf2VnqNmtE';
const push=(rows,extra={})=>req('sheets-sync/push','POST',{protocol:2,spreadsheet_id:id,sheet_name:'אתרים',nonce:randomUUID(),sent_at:new Date().toISOString(),rows,...extra},null);
try{
 const db=await mf.getD1Database('DB');for(const m of readdirSync('drizzle').filter(x=>x.endsWith('.sql')).sort())for(const part of readFileSync('drizzle/'+m,'utf8').split('--> statement-breakpoint').map(x=>x.trim()).filter(Boolean))await db.prepare(part).run();
 await req('me');await req('catalog?scope=admin');await db.prepare('DELETE FROM websites').run();
 const sup=(sid,name,email)=>db.prepare("INSERT INTO records(id,kind,user_id,data,created,updated) VALUES (?,'supplier','owner',?,'2026-01-01','2026-01-01')").bind(sid,JSON.stringify({name,email})).run();
 await sup('s-bare','bare@example.test','bare@example.test');await sup('s-old','ספק ותיק','old@example.test');
 const site=(sid,name,url,s,email)=>db.prepare('INSERT INTO websites(id,name,url,category,price,dr,active,data,updated) VALUES (?,?,?,?,?,?,?,?,?)').bind(sid,name,url,'general',20000,10,1,JSON.stringify({cost_cents:10000,ur:5,supplier_id:s,supplier_email:email,supplier_name:email==='old@example.test'?'ספק ותיק':email}),'2026-01-01').run();
 await site('a','אתר א','https://a.example/','s-bare','bare@example.test');await site('b','אתר ב','https://b.example/','s-old','old@example.test');
 await req('admin/sheets/config','POST',{enabled:true});
 let rows=[fresh,
  ['אתר א','https://a.example/',200,10,5,'bare@example.test','ספק חשוף',100,'','','general','a'],
  ['אתר ב','https://b.example/',200,10,5,'old@example.test','שם אחר',100,'','','general','b'],
  ['אתר חדש','https://new.example/',300,20,10,'fresh@example.test','ספק טרי',150,5,250,'general','']];
 let result=await push(rows);
 if(result.status==='conflict'){const preview=await req('admin/sheets/preview','POST',{});result=await req('admin/sheets/apply','POST',{digest:preview.digest,pricing_version:preview.pricing_version,conflict_policy:'sheet',acknowledge:true});}
 ok(['awaiting_ack','success'].includes(result.status),'sync accepted: '+result.status+' '+result.message+' '+(result.errors||[]).join(' | '));
 const supplierBy=async email=>{const r=await db.prepare("SELECT id,data FROM records WHERE kind='supplier' AND lower(json_extract(data,'$.email'))=?").bind(email).first();return r&&{id:r.id,...JSON.parse(r.data)};};
 ok((await supplierBy('bare@example.test')).name==='ספק חשוף','a supplier known only by e-mail takes the name from the sheet');
 ok((await supplierBy('old@example.test')).name==='ספק ותיק','an existing supplier name is not overwritten');
 const created=await supplierBy('fresh@example.test');ok(created&&created.name==='ספק טרי','a new e-mail creates a supplier with the sheet name');
 const newSite=await db.prepare("SELECT id,price,data FROM websites WHERE url LIKE 'https://new.example%'").first(),nd=JSON.parse(newSite.data);
 ok(nd.supplier_id===created.id&&nd.supplier_name==='ספק טרי','the new site is linked to the new supplier');
 ok(nd.is_on_sale===true&&nd.sale_price_cents===25000&&nd.cost_cents===15000&&nd.stock_total===5&&nd.ur===10,'sale on, cost, stock and UR saved from the sheet');
 ok(JSON.parse((await db.prepare("SELECT data FROM websites WHERE id='a'").first()).data).supplier_name==='ספק חשוף','the site copy of the supplier name follows');
 ok(Number((await db.prepare("SELECT dr FROM websites WHERE id='b'").first()).dr)===10,'a DR kept only in the column survives the save (was reset to 0)');
 // The next push writes the system name back over "שם אחר".
 result=await push(rows);ok(result.status==='awaiting_ack'&&result.writeback.cells.some(c=>c.id==='b'&&c.field==='supplier_name'&&c.after==='ספק ותיק'),'the sheet gets the real supplier name back');
 const target=rows.map(r=>[...r]);for(const c of result.writeback.cells)target[c.row-1][c.column-1]=c.after;for(const r of result.writeback.append)target.push(r);rows=target;
 ok((await push(rows,{ack:result.ack})).status==='success','write-back acknowledged');
 // Two names for one e-mail stop the sync.
 rows=[...rows,['אתר נוסף','https://more.example/',300,20,10,'fresh@example.test','שם שונה',150,'','','general','']];
 result=await push(rows);ok(result.status==='invalid'&&result.errors.some(e=>e.includes('fresh@example.test')),'two names for one supplier e-mail are refused');
 ok(!(await db.prepare("SELECT 1 FROM websites WHERE url LIKE 'https://more.example%'").first()),'nothing was saved from the refused sheet');
 console.log('SHEET COLUMNS PASSED:',checks,'checks: owner column order, old names, duplicate column, sale price on, supplier by e-mail and name, name kept, write-back, one name per e-mail.');
}finally{await mf.dispose();}
