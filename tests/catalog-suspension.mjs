// Real isolated Worker/D1 regression for visibility-only administrative suspension.
import assert from 'node:assert/strict';
import {createAdminFixture} from './admin-glass.mjs';
const f=await createAdminFixture();
const read=()=>f.db.prepare("SELECT * FROM websites WHERE id='site'").first();
const write=async(values,revision,expected=200,user='owner',pricingVersion)=>{
 const response=await f.mf.dispatchFetch('http://admin.test/api/admin/catalog-bulk',{method:'POST',headers:{'oai-authenticated-user-id':user,'oai-authenticated-user-email':user+'@example.test','content-type':'application/json'},body:JSON.stringify({acknowledge:true,pricing_version:pricingVersion,rows:[{id:'site',expected_updated:revision,values}]})});
 const result=await response.json();assert.equal(response.status,expected,JSON.stringify(result));return result;
};
try{
 let before=await read();const legacy={...JSON.parse(before.data),logo_url:'/legacy/logo.png',is_on_sale:true,sale_price_cents:-1,sale_ends:'invalid-date',stock_total:20};
 await f.db.prepare("UPDATE websites SET url='legacy-invalid-url',data=? WHERE id='site'").bind(JSON.stringify(legacy)).run();before=await read();
 await write({active:false},before.updated,200,'owner',-100);
 const paused=await read();assert.equal(paused.active,0);assert.equal(paused.url,before.url);assert.equal(paused.price,before.price);assert.equal(paused.name,before.name);assert.equal(paused.category,before.category);assert.equal(paused.dr,before.dr);assert.deepEqual(JSON.parse(paused.data),{...legacy,active:false},'pause changes no other saved field');
 assert(!(await f.json('/api/catalog')).websites.some(w=>w.id==='site'),'paused site is absent from customer catalog');
 assert((await f.json('/api/catalog?scope=admin')).websites.some(w=>w.id==='site'),'administrator can still find suspended site');
 const stale=await write({active:false},'stale-revision',409);assert(stale.error.includes('עודכן במקביל'));assert(!stale.error.includes('תמונה'));
 await write({active:false},paused.updated,403,'buyer');
 await write({active:false},paused.updated,403,'supplier');
 const invalidSite=await write({active:true,url:'javascript:alert(1)'},paused.updated,400);assert(invalidSite.error.startsWith('כתובת האתר אינה תקינה'));assert(!invalidSite.error.includes('תמונת הלוגו'));
 const invalidImage=await write({url:'https://valid.example',logo_url:'javascript:alert(1)'},paused.updated,400);assert(invalidImage.error.startsWith('כתובת תמונת הלוגו אינה תקינה'));
 await f.db.prepare("UPDATE websites SET url='https://valid.example',data=? WHERE id='site'").bind(JSON.stringify({procurement_verified:true,cost_cents:70000})).run();
 const invalidExample=await write({example_articles:['https://valid.example/article','not-a-url']},paused.updated,400);assert(invalidExample.error.startsWith('כתובת מאמר לדוגמה 2 אינה תקינה'));
 assert.equal((await read()).active,0,'failed edits never reactivate');
 await f.db.prepare("UPDATE websites SET data=json_set(data,'$.logo_url','/legacy/logo.png') WHERE id='site'").run();
 const invalidActivation=await write({active:true},paused.updated,400);assert(invalidActivation.error.includes('תמונת הלוגו'),'activation retains its existing full validation');
 console.log('PASS catalog suspension: invalid legacy URL/logo/sale fields and unrelated pricing changes do not block admin suspension; other fields, historical records, customer visibility, admin access, role guards, revision conflicts and field-specific errors verified.');
}finally{await f.mf.dispose();}
