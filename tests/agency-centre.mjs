// Agency centre (design/agency-dashboard/spec.md): page paths, domain normalization and spend per article.
import assert from 'node:assert/strict';
import {realpathSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(realpathSync('node_modules/wrangler')+'/package.json'),{build}=require('esbuild');
await build({entryPoints:['lib/seo.ts'],outfile:'.sites-runtime/agency-seo.cjs',bundle:true,platform:'node',format:'cjs'});
await build({entryPoints:['lib/agency-shared.ts'],outfile:'.sites-runtime/agency-shared.cjs',bundle:true,platform:'node',format:'cjs'});
const {isWorkspacePath}=require(realpathSync('.sites-runtime/agency-seo.cjs'));
const {normalizeDomain,articleSpend}=require(realpathSync('.sites-runtime/agency-shared.cjs'));
for(const route of ['purchased/agency','purchased/agency/customers','purchased/agency/publications','purchased/agency/customers/new','purchased/agency/customers/customer-1/details','purchased/agency/customers/customer-1/publications','purchased/agency/customers/customer-1/articles'])assert(isWorkspacePath(route.split('/')),route);
for(const route of ['purchased/agency/bogus','purchased/agency/customers/x/bogus','purchased/agency/publications/x','purchased/agency/customers/x/details/more'])assert(!isWorkspacePath(route.split('/')),route);
const cases={'https://www.Example.co.il/path?x=1':'example.co.il','EXAMPLE.co.il':'example.co.il','http://sub.example.com:8080/':'sub.example.com','www.example.com.':'example.com','example':'','not a domain':'','':'','https://xn--4dbrk0ce.example/':'xn--4dbrk0ce.example','https://דוגמה.co.il/a':'xn--6dbbec0c.co.il'};
for(const [input,expected] of Object.entries(cases))assert.equal(normalizeDomain(input),expected,input);
const art=(status,data,paid=1)=>({status,paid,data:JSON.stringify(data)});
assert.equal(articleSpend(art('published',{paid_net_amount:50000,writing_net_amount:10000})),50000,'paid article');
assert.equal(articleSpend(art('published',{paid_net_amount:50000,writing_net_amount:10000,publication_refunded:true})),10000,'publication refunded, writing kept');
assert.equal(articleSpend(art('cancelled',{paid_net_amount:50000,writing_net_amount:10000,publication_refunded:true,writing_refunded:true})),0,'fully refunded');
assert.equal(articleSpend(art('cancelled',{paid_net_amount:50000})),0,'cancelled without refund flags');
assert.equal(articleSpend(art('draft',{paid_net_amount:50000},0)),0,'unpaid order');
assert.equal(articleSpend(art('draft',{paid_net_amount:50000,on_account:true},0)),50000,'monthly account counts');
assert.equal(articleSpend(art('demo_completed',{paid_net_amount:50000,demo:true})),0,'demo');
console.log('agency centre: paths, domains and spend ok');
const {usedSiteKey,usedSiteMatches,parseUsedSites}=require(realpathSync('.sites-runtime/agency-shared.cjs'));
assert.deepEqual(usedSiteKey('https://www.ynet.co.il/capital'),{domain:'ynet.co.il',path:'/capital'});
assert.deepEqual(usedSiteKey('ynet.co.il'),{domain:'ynet.co.il',path:''});
assert.deepEqual(usedSiteKey('https://www.israel-news.example.co.il/article/123'),{domain:'israel-news.example.co.il',path:''});
assert.deepEqual(usedSiteKey('https://healthy.walla.co.il/item/3823998'),{domain:'healthy.walla.co.il',path:''});
assert.equal(usedSiteKey('hello'),null);
assert(usedSiteMatches({domain:'ynet.co.il',path:''},'https://www.ynet.co.il/capital'),'domain entry covers sections');
assert(usedSiteMatches({domain:'ynet.co.il',path:'/capital'},'https://www.ynet.co.il/capital/'),'section entry covers its section');
assert(!usedSiteMatches({domain:'ynet.co.il',path:'/capital'},'https://www.ynet.co.il/laisha'),'but not another section');
assert(!usedSiteMatches({domain:'ynet.co.il',path:''},'https://ynetnews.com'),'other domain');
const parsed=parseUsedSites('a.co.il\nhttps://www.A.co.il/, b.com; bad\tc.org/news/1 c.org',[{domain:'b.com',path:''}]);
assert.deepEqual(parsed.added,[{domain:'a.co.il',path:''},{domain:'c.org',path:''}]);assert.equal(parsed.duplicates,3);assert.deepEqual(parsed.invalid,['bad']);
console.log('agency centre: used sites ok');
// Who gets the centre (owner, 12.11.2026: every customer for now) and its name.
const {hasAgencyCentre,agencyCentreName}=require(realpathSync('.sites-runtime/agency-shared.cjs'));
for(const role of ['customer','agency'])assert.equal(hasAgencyCentre({role}),true,role);
for(const role of ['admin','supplier','',undefined])assert.equal(hasAgencyCentre({role}),false,String(role));
assert.equal(hasAgencyCentre(null),false);
assert.equal(agencyCentreName({role:'agency'}),'מרכז הסוכנות');assert.equal(agencyCentreName({role:'customer'}),'ניהול לקוחות');
console.log('agency centre: access ok');
// Monthly budget (spec 5.8): below 80% fine, 80% to 99% close, from 100% over, no budget no alert. Amounts in agorot.
const {budgetState,safeCell}=require(realpathSync('.sites-runtime/agency-shared.cjs'));
const level=(spend,budget)=>{const b=budgetState(spend,budget);return b&&[b.level,b.pct,b.label];};
assert.deepEqual(level(0,200000),['ok',0,'']);
assert.deepEqual(level(124000,200000),['ok',62,'']);
assert.deepEqual(level(159999,200000),['ok',79,''],'just below 80%');
assert.deepEqual(level(160000,200000),['near',80,'קרוב לתקציב החודשי'],'exactly 80%');
assert.deepEqual(level(199999,200000),['near',99,'קרוב לתקציב החודשי'],'just below 100% is not shown as 100%');
assert.deepEqual(level(200000,200000),['over',100,'חריגה מהתקציב החודשי'],'exactly 100%');
assert.deepEqual(level(260000,200000),['over',130,'חריגה מהתקציב החודשי']);
assert.deepEqual(budgetState(124000,'200000'),{level:'ok',pct:62,spend:124000,budget:200000,label:''},'stored as text');
for(const none of [null,undefined,0,'',-500,'abc',NaN,Infinity,{}])assert.equal(budgetState(500000,none),null,'no budget: '+String(none));
assert.equal(budgetState(undefined,200000).level,'ok','no spend yet');
// Exported cells (CSV and Excel): a value that starts like a formula becomes plain text.
for(const [input,expected] of [['=1+1',"'=1+1"],['+972',"'+972"],['-5',"'-5"],['@x',"'@x"],['\tx',"'\tx"],['רגיל','רגיל'],['a=b','a=b'],[12.5,'12.5'],[null,'']])assert.equal(safeCell(input),expected,String(input));
console.log('agency centre: budget levels and export cells ok');
// Brief defaults of a customer (spec 5.6): what is stored, and how a brief is filled from them.
{const {briefDefaultsInput,fillBriefDefaults,moveBriefDefaults,briefDefaultsUsed}=require(realpathSync('.sites-runtime/agency-shared.cjs'));
 // Owner 13.11.2026: only business name, audience and style are filled; link, anchor and keywords change per article.
 const saved=briefDefaultsInput({brand:'  דנה עיצובים ',audience:'בעלי דירות',style:'מקצועי וסמכותי',keywords:'עיצוב פנים',target_url:'dana.example.co.il/services',anchor:'עיצוב פנים',price_cents:1,topic:'y'});
 assert.deepEqual(saved.values,{brand:'דנה עיצובים',audience:'בעלי דירות',style:'מקצועי וסמכותי'},'only the three fixed fields, trimmed; link, anchor and keywords are never kept');
 assert.equal(saved.error,'');
 assert.deepEqual(briefDefaultsInput({brand:7,audience:['a'],style:'סגנון שלא קיים'}).values,{},'text only, and a style from the list only');
 assert.equal(briefDefaultsInput({brand:'א'.repeat(900)}).values.brand.length,200,'brand cut to the limit of the brief');assert.equal(briefDefaultsInput({audience:'א'.repeat(900)}).values.audience.length,500);
 for(const none of [undefined,null,'text',[1],7])assert.deepEqual(briefDefaultsInput(none),{values:{},error:''});
 const d=saved.values,quick={website_id:'w1',topic:'כתבה עבור אתר',words:500,quantity:1,customer_id:'c1'};
 const full=fillBriefDefaults(quick,d);
 assert.deepEqual(full.brief,{...quick,...d},'an empty brief gets the three fixed fields and keeps its own');assert.deepEqual(full.filled,['brand','audience','style']);
 const older=fillBriefDefaults(quick,{brand:'קפה',target_url:'https://cafe.example/',anchor:'קפה',keywords:'קפה'});
 assert.deepEqual(older.brief,{...quick,brand:'קפה'},'an older record with a link, anchor or keywords fills none of them');
 const typed=fillBriefDefaults({...quick,brand:'מותג אחר',audience:'  '},d);
 assert.equal(typed.brief.brand,'מותג אחר','a typed field is kept');assert.equal(typed.brief.audience,d.audience,'spaces only count as empty');assert.deepEqual(typed.filled,['audience','style']);
 assert.deepEqual(fillBriefDefaults(quick,null),{brief:quick,filled:[]},'no defaults: nothing changes');
 assert.equal(Object.keys(full.brief).some(k=>!['website_id','topic','words','quantity','customer_id','brand','audience','style'].includes(k)),false,'no new field on a cart item');
 // A cart item moved from one customer to another.
 const other={brand:'משה שיפוצים'},item={...full.brief,audience:'קהל שהוקלד'};
 assert.deepEqual(moveBriefDefaults(item,d,other),{brand:'משה שיפוצים',style:''},'old defaults replaced or emptied, typed text kept');
 assert.deepEqual(moveBriefDefaults(item,d,undefined),{brand:'',style:''},'back to no customer: the old defaults are removed');
 assert.deepEqual(moveBriefDefaults({topic:'x',brand:''},undefined,other),{brand:'משה שיפוצים'},'first customer on an item');
 assert.deepEqual(moveBriefDefaults({topic:'x'},undefined,undefined),{},'customers without defaults: nothing changes');
 assert.deepEqual(briefDefaultsUsed(item,d),['brand','style']);assert.deepEqual(briefDefaultsUsed({brand:'אחר'},d),[]);assert.deepEqual(briefDefaultsUsed(item,null),[]);
 console.log('agency centre: brief defaults ok');}
// Guard (12.11.2026): a CSS edit once dropped the calendar, notes, links and reports rules and the screens fell apart.
// Every class the centre's screens use must have a rule in the stylesheet.
{const {readFileSync}=await import('node:fs');const css=readFileSync('app/agency-center.css','utf8');
 const ids=new Set(['ag-title','ag-unused-title','ag-used-text','agc-used-text','agc-used-title']);
 for(const file of ['app/agency-center.tsx','app/agency-buying.tsx'])for(const name of new Set(readFileSync(file,'utf8').match(/\bagc?-[a-z0-9-]+/g)||[]))
  assert(ids.has(name)||new RegExp('\\.'+name+'(?![a-z0-9-])').test(css),file+': class '+name+' has no rule in app/agency-center.css');
 for(const must of ['.ag-cal{','.ag-cal-day{','.ag-note{','.ag-linkcard{','.ag-reports{','.ag-kpi{'])assert(css.includes(must),'missing rule '+must);
 assert.equal((css.match(/\{/g)||[]).length,(css.match(/\}/g)||[]).length,'unbalanced braces in agency-center.css');
 console.log('agency centre: stylesheet covers every class');}
