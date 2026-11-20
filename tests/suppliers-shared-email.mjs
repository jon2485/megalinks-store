// Isolated Worker/D1, fictional data only.
// Owner 20.11.2026: several suppliers may share one email address (the owner handles בסט לינקס, ספונסרד, העלאה עצמאית and
// others from his own mailbox). They are different suppliers: separate cards, sites and settlements. The shared address never
// merges them; only the name decides which supplier a site belongs to.
import assert from 'node:assert/strict';
import {createAdminFixture} from './admin-glass.mjs';
const f=await createAdminFixture({SETTINGS_ENCRYPTION_KEY:btoa('s'.repeat(32))});
const get=async p=>f.json('/api/'+p);
const post=async(path,body)=>{const r=await f.request(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:r.status,data:await r.json()};};
const MAIL='owner-shared@example.test';
const version=async()=>(await get('admin/pricing')).version;
const save=async rows=>{const r=await post('/api/admin/catalog-bulk',{pricing_version:await version(),rows});assert.equal(r.status,200,JSON.stringify(r.data));return r.data;};
const site=(id,name,extra={})=>({id,create:true,expected_updated:'',values:{name:'אתר '+id,url:'https://'+id+'.example.test',category:'news_national',price_ils:300,cost_ils:100,dr:30,ur:10,active:true,turnaround_days:3,supplier_email:MAIL,supplier_name:name,...extra}});
const cards=async()=>(await get('admin/suppliers?q=owner-shared')).suppliers.filter(s=>String(s.email||'').toLowerCase()===MAIL);
const byName=async()=>Object.fromEntries((await cards()).map(s=>[s.name,s]));
try{
 // 1. Four sites, one address, three names: three separate suppliers.
 await save([site('a1','בסט לינקס'),site('a2','בסט לינקס'),site('b1','ספונסרד'),site('c1','העלאה עצמאית')]);
 let named=await byName();
 assert.deepEqual(Object.keys(named).sort(),['בסט לינקס','העלאה עצמאית','ספונסרד'].sort(),'one card per name');
 assert.equal(named['בסט לינקס'].site_count,2);assert.equal(named['ספונסרד'].site_count,1);assert.equal(named['העלאה עצמאית'].site_count,1);
 assert.equal(new Set(Object.values(named).map(s=>s.id)).size,3,'three different supplier ids');
 // 2. Each card lists only its own sites.
 const list=async name=>(await get('admin/suppliers/'+encodeURIComponent(named[name].id)+'?page=1&q=&all=0&selected=')).sites.map(w=>w.id).sort();
 assert.deepEqual(await list('בסט לינקס'),['a1','a2']);assert.deepEqual(await list('ספונסרד'),['b1']);assert.deepEqual(await list('העלאה עצמאית'),['c1']);
 // 3. Changing a site's name moves it to that supplier; nothing else moves.
 const updatedOf=async id=>{const r=await f.db.prepare('SELECT updated FROM websites WHERE id=?').bind(id).first();return r.updated;};
 await save([{id:'a2',create:false,expected_updated:await updatedOf('a2'),values:{supplier_name:'ספונסרד'}}]);
 named=await byName();
 assert.equal(named['בסט לינקס'].site_count,1);assert.equal(named['ספונסרד'].site_count,2,'the site moved to ספונסרד');assert.equal((await cards()).length,3,'no extra card');
 // 4. The same address with the same name never makes a second card; an address change alone keeps the name.
 await save([site('b2','ספונסרד')]);named=await byName();assert.equal(named['ספונסרד'].site_count,3);assert.equal((await cards()).length,3);
 // 5. A name written with other spacing or letter case is the same supplier.
 await save([site('b3','  ספונסרד ')]);assert.equal((await byName())['ספונסרד'].site_count,4);
 // 6. A card that has only the address (no real name yet) takes the first name instead of a new card.
 const lone='lone@example.test';
 await save([{id:'l1',create:true,expected_updated:'',values:{name:'אתר l1',url:'https://l1.example.test',category:'news_national',price_ils:300,cost_ils:100,dr:30,ur:10,active:true,turnaround_days:3,supplier_email:lone}}]);
 await save([{id:'l1',create:false,expected_updated:await updatedOf('l1'),values:{supplier_name:'ספק בודד'}}]);
 const loneCards=(await get('admin/suppliers?q=lone')).suppliers.filter(s=>s.email===lone);assert.equal(loneCards.length,1);assert.equal(loneCards[0].name,'ספק בודד');
 // 7. Creating a supplier by hand with a shared address and a new name is a new supplier; the same name returns the existing one.
 let r=await post('/api/records/supplier',{name:'לירן',email:MAIL});assert(r.status<300,JSON.stringify(r.data));assert.notEqual(r.data.existing,true,'a new name is a new supplier');
 r=await post('/api/records/supplier',{name:'בסט לינקס',email:MAIL});assert.equal(r.data.existing,true);assert.equal(r.data.id,named['בסט לינקס'].id,'the same name finds its own card');
 // 8. Each site keeps its own supplier id and name, so settlements and reports (grouped by supplier id) stay apart.
 const rows=await f.db.prepare("SELECT id,json_extract(data,'$.supplier_id') AS sid,json_extract(data,'$.supplier_name') AS sname FROM websites WHERE id IN ('a1','a2','b1','c1')").all();
 const by=Object.fromEntries(rows.results.map(x=>[x.id,x]));
 assert.equal(by.a1.sname,'בסט לינקס');assert.equal(by.a2.sname,'ספונסרד');assert.equal(by.b1.sname,'ספונסרד');assert.equal(by.c1.sname,'העלאה עצמאית');
 assert.notEqual(by.a1.sid,by.b1.sid);assert.notEqual(by.b1.sid,by.c1.sid);assert.equal(by.a2.sid,by.b1.sid);
 // 9. Settlements: published articles of two suppliers that share the address are settled apart, each with its own amount.
 const art=async(id,siteId,sid,sname,cost)=>f.db.prepare('INSERT INTO articles(id,order_id,user_id,website_id,status,title,content,data,updated) VALUES(?,?,?,?,?,?,?,?,?)').bind(id,'order-'+id,'buyer',siteId,'published','כתבה '+id,'תוכן',JSON.stringify({supplier_id:sid,supplier_name:sname,cost_cents:cost,published_month:'2026-11'}),'2026-11-15T10:00:00Z').run();
 await art('x1','a1',by.a1.sid,'בסט לינקס',10000);await art('x2','a1',by.a1.sid,'בסט לינקס',10000);await art('y1','b1',by.b1.sid,'ספונסרד',7000);
 const settle=await get('admin/supplier-settlements?stage=all&page=1');
 const groups=(Object.values(settle).find(v=>Array.isArray(v)&&v.some(g=>g&&g.supplier_id))||[]).filter(g=>[by.a1.sid,by.b1.sid].includes(g.supplier_id)&&g.month==='2026-11');
 const best=groups.find(g=>g.supplier_id===by.a1.sid),spons=groups.find(g=>g.supplier_id===by.b1.sid);
 assert(best&&spons,'two separate settlements '+JSON.stringify(groups.map(g=>g.supplier_id)));
 assert.equal(best.count,2);assert.equal(spons.count,1);assert.equal(best.supplier_name,'בסט לינקס');assert.equal(spons.supplier_name,'ספונסרד');
 assert.equal(Number(best.net),20000);assert.equal(Number(spons.net),7000,'amounts are not mixed');
 console.log('SHARED SUPPLIER EMAIL PASSED: one card per name under one address, own sites per card, moving by name, no duplicate cards, unnamed card takes the name, manual creation by name, separate supplier ids for settlements.');
}finally{await f.mf.dispose();}
