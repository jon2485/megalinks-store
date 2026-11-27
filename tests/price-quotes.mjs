import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {realpathSync} from 'node:fs';
const require=createRequire(realpathSync('node_modules/wrangler')+'/package.json'),{build}=require('esbuild');
// "הצעות מחיר" (owner 27.11.2026). The real module, with the database and the mail queue replaced by small fakes:
// 1. nothing about cost, profit, supplier or the chat reaches what the customer sees (JSON and e-mail);
// 2. quote prices apply in the cart only while the quote is approved, in date, complete and the customer's own.
const fakes={
 './server':`
  export const T=globalThis.__pq={records:new Map(),websites:new Map(),users:new Map(),mail:[]};
  export class ApiError extends Error{constructor(status,message){super(message);this.status=status;}}
  export function assert(ok,message,status=400){if(!ok)throw new ApiError(status,message);}
  export const now=()=>new Date().toISOString();export const uid=()=>crypto.randomUUID();
  export const parse=row=>row?{...row,...JSON.parse(row.data||'{}'),data:JSON.parse(row.data||'{}')}:null;
  export const admin=u=>assert(u.role==='admin','admin only',403);
  export async function mapIn(table,column,ids,where,arg){const out=new Map();for(const id of ids){const row=T[table].get(String(id));if(row&&(!where||row.kind===arg))out.set(String(id),row);}return out;}
  export async function one(sql,...a){if(/FROM records/.test(sql)){const r=T.records.get(a[0]);return r&&r.kind===a[1]?r:null;}if(/FROM users/.test(sql))return T.users.get(a[0])||null;return null;}
  export async function all(){return [...T.records.values()];}
  export const stmt=(sql,...a)=>({sql,a,run:async()=>{if(/^UPDATE records SET data/.test(sql)){const r=T.records.get(a[2]);r.data=a[0];}}});
  export const db=()=>({batch:async list=>{for(const s of list)await s.run();}});
  export const setting=async(k,f)=>f;export const saveSetting=async()=>{};export const audit=async()=>{};export const connection=async()=>({});export const externalFetch=async()=>{throw new Error('no network in tests');};`,
 './pricing':`export const pricingContext=async()=>({});export const pricedSite=row=>({...row,...JSON.parse(row.data||'{}'),price_cents:row.price});`,
 './mail':`export const queueMail=async(id,user,data)=>{globalThis.__pq.mail.push({id,user,data});};`,
 './site-match':`export const domainHistory=async()=>({used:[],anchors:[]});`,
 './anthropic-request':`export const anthropicClient=()=>{throw new Error('no Claude in tests');};export const anthropicFailure=e=>e;`,
 './anthropic-model':`export const aiProvider=()=>'anthropic';`
};
const out=await build({entryPoints:['lib/price-quotes.ts'],bundle:true,platform:'node',format:'esm',write:false,plugins:[{name:'fakes',setup(b){b.onResolve({filter:/^\.\//},a=>fakes[a.path]?{path:a.path,namespace:'fake'}:null);b.onLoad({filter:/.*/,namespace:'fake'},a=>({contents:fakes[a.path],loader:'js'}));}}]});
const m=await import('data:text/javascript;base64,'+Buffer.from(out.outputFiles[0].text).toString('base64'));
const T=globalThis.__pq;
const site=(id,name,price,cost)=>T.websites.set(id,{id,name,url:'https://'+id+'.example',price,active:1,dr:40,category:'sport',data:JSON.stringify({cost_cents:cost,supplier_id:'sup-secret',supplier_email:'supplier@secret.example'})});
site('a','אתר א',100000,62000);site('b','אתר ב',45000,26000);
T.users.set('cust',{id:'cust',name:'דני',email:'dani@example.com'});
const future=new Date(Date.now()+5*86400000).toISOString(),past=new Date(Date.now()-1000).toISOString();
const record=(id,data,user='cust')=>{T.records.set(id,{id,kind:'price_quote',user_id:user,created:new Date().toISOString(),data:JSON.stringify(data)});return {id,kind:'price_quote',user_id:user,...data,data};};
const items=[{website_id:'a',price_cents:92000,list_cents:100000},{website_id:'b',price_cents:42000,list_cents:45000}];
const base={number:1042,status:'sent',target_url:'run-shop.example',budget_ils:1500,days:14,expires:future,sent_at:new Date().toISOString(),items,messages:[{role:'user',text:'כמה עולה לי אתר א? העלות 620'},{role:'assistant',text:'העלות שלך 620 והרווח 300'}]};

// --- 1. the customer's view ---
const q=record('q1',base);
const view=await m.customerQuote(q);
assert.deepEqual(Object.keys(view).sort(),['before_cents','budget_ils','count','domain','expires','id','items','number','saving_cents','status','target_url','total_cents'].sort());
assert.deepEqual(Object.keys(view.items[0]).sort(),['before_cents','name','price_cents','url','website_id']);
assert.equal(view.before_cents,145000);assert.equal(view.total_cents,134000);assert.equal(view.saving_cents,11000);assert.equal(view.count,2);
const leak=/cost|profit|supplier|sup-secret|620|260|300|messages|העלות|רווח|ספק/i;
assert(!leak.test(JSON.stringify(view)),'the customer JSON must not carry cost, profit, supplier or the chat');
const html=m.quoteMailHtml(view,'דני','https://app.example',false);
assert(!leak.test(html.replace(/#[0-9a-f]{6}/gi,'').replace(/font-weight:\d+|font-size:\d+px|padding:[^;"]+|max-width:\d+px|border-radius:\d+px|line-height:[\d.]+/g,'')),'the e-mail must not carry cost, profit or supplier');
for(const text of ['הצעת מחיר מס׳ 1042','run-shop.example','אתר א','https://a.example','₪1,000','₪920','₪1,340','₪1,450','₪110','בתוקף עד','https://app.example/catalog?quote=q1'])assert(html.includes(text),'e-mail misses '+text);
assert(m.quoteMailHtml(view,'דני','https://app.example',true).includes('בתוקף לעוד 24 שעות'));
// a price above the list price is never shown as a "discount"
const up=await m.customerQuote(record('q-up',{...base,items:[{website_id:'a',price_cents:110000,list_cents:100000}]}));
assert.equal(up.items[0].before_cents,110000);assert.equal(up.saving_cents,0);
// the admin's view does carry them
const adminView=await m.adminQuote(q);
assert.equal(adminView.items[0].cost_cents,62000);assert.equal(adminView.items[0].profit_cents,30000);assert.equal(adminView.totals.profit_cents,134000-88000);
assert.equal((await m.adminQuote(record('q-low',{...base,items:[{website_id:'a',price_cents:50000,list_cents:100000}]}))).items[0].below_cost,true);

// --- 2. status and expiry ---
assert.equal(m.quoteStatus({status:'sent',expires:future}),'sent');assert.equal(m.quoteStatus({status:'sent',expires:past}),'expired');
assert.equal(m.quoteStatus({status:'accepted',expires:past}),'expired');assert.equal(m.quoteStatus({status:'ordered',expires:past}),'ordered');assert.equal(m.quoteStatus({}),'draft');

// --- 3. the cart ---
const line=(id,wid,quote_id,price,extra={})=>({id,website_id:wid,quote_id,active:1,quantity:1,publication_price:price,sale_price:price,editorial_price:0,price,price_cents:price,...extra});
const cart=()=>[line('l1','a','q2',100000),line('l2','b','q2',45000),line('l3','b',undefined,45000)];
record('q2',{...base,status:'accepted'});
let c=await m.applyQuotePrices({id:'cust'},cart());
assert.deepEqual(c.map(i=>i.price),[92000,42000,45000]);assert.equal(c[0].quote_applied,true);assert.equal(c[0].bundle_applied,true,'no coupon on top of a quote price');assert.equal(c[0].quote_normal_price,100000);assert.equal(c[2].quote_applied,undefined);
// the writing add-on stays on top of the quote price
c=await m.applyQuotePrices({id:'cust'},[line('l1','a','q2',100000,{editorial_price:6000,price:106000}),line('l2','b','q2',45000)]);assert.equal(c[0].price,98000);assert.equal(c[0].publication_price,92000);
// one site missing: the regular prices
c=await m.applyQuotePrices({id:'cust'},[line('l1','a','q2',100000)]);assert.equal(c[0].price,100000);assert.equal(c[0].quote_applied,false);assert.equal(c[0].quote_number,1042);
// expired, not approved yet, cancelled, another customer's quote, an unknown quote: the regular prices
for(const [id,data,user] of [['q3',{...base,status:'accepted',expires:past}],['q4',{...base,status:'sent'}],['q5',{...base,status:'cancelled'}],['q6',{...base,status:'accepted'},'other']]){record(id,data,user);c=await m.applyQuotePrices({id:'cust'},[line('l1','a',id,100000),line('l2','b',id,45000)]);assert.deepEqual(c.map(i=>i.price),[100000,45000],id);assert.equal(c[0].quote_applied,false,id);}
c=await m.applyQuotePrices({id:'cust'},[line('l1','a','nope',100000)]);assert.equal(c[0].price,100000);
// a site that left the catalog blocks the quote price
c=await m.applyQuotePrices({id:'cust'},[line('l1','a','q2',100000,{active:0}),line('l2','b','q2',45000)]);assert.equal(c[1].price,45000);

// --- 4. a quote line removed from the cart: the approved quote is closed ---
await m.quoteLineRemoved({id:'cust'},{data:JSON.stringify({quote_id:'q2'})});
assert.equal(JSON.parse(T.records.get('q2').data).status,'declined');
await m.quoteLineRemoved({id:'cust'},{data:'{}'});
// --- 5. after an order ---
record('q7',{...base,status:'accepted'});await m.quotesOrdered([{quote_id:'q7',quote_applied:true},{quote_id:'q4',quote_applied:false}],'order-1');
assert.equal(JSON.parse(T.records.get('q7').data).status,'ordered');assert.equal(JSON.parse(T.records.get('q4').data).status,'sent');
console.log('price-quotes: ok');
