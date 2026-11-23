// Admin coupons (owner, 23.11.2026): permanent delete next to "השבתה", and the list of customers who used each coupon.
// Runs the built server (dist/) in Miniflare with a fresh local D1 and fictional users only. Run `pnpm build` first.
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {readFileSync,realpathSync,readdirSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(realpathSync('node_modules/wrangler')+'/package.json');
const {Miniflare}=require('miniflare');
const mf=new Miniflare({outboundService:async()=>new Response('ok'),modules:[{type:'ESModule',path:'dist/server/index.js'},...readdirSync('dist/server',{recursive:true}).filter(p=>/\.(m?js)$/.test(p)&&p!=='index.js').map(p=>({type:'ESModule',path:'dist/server/'+p}))],compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],r2Buckets:['BUCKET'],bindings:{SETTINGS_ENCRYPTION_KEY:randomBytes(32).toString('base64'),POSTFLOW_OWNER_EMAIL:'owner@example.test'},assets:{directory:'dist/client',binding:'ASSETS',routerConfig:{has_user_worker:true,invoke_user_worker_ahead_of_assets:true}},cf:false});
let checks=0;const check=(test,msg)=>{assert(test,msg);checks++;};
const names={owner:'מנהל בדיקה','cust-a':'דנה לקוחה','cust-b':'יוסי לקוח','cust-c':'רונית לקוחה','cust-d':'אבי לקוח'};
async function req(path,method='GET',body,user='owner',expected=200){
 const headers={'oai-authenticated-user-id':user,'oai-authenticated-user-email':user+'@example.test','oai-authenticated-user-full-name':encodeURIComponent(names[user]||user),'oai-authenticated-user-full-name-encoding':'percent-encoded-utf-8'};
 if(body!==undefined)headers['Content-Type']='application/json';
 if(body&&path.startsWith('records/bundle'))body={acknowledge:true,...body};
 const res=await mf.dispatchFetch('https://postflow.test/api/'+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
 const out=(res.headers.get('Content-Type')||'').includes('json')?await res.json():await res.text();
 assert.equal(res.status,expected,`${method} ${path}: ${JSON.stringify(out)}`);checks++;return out;
}
let site,n=0;
async function buy(user,code){
 await req('cart','POST',{website_id:site.id,topic:'כתבת בדיקה '+(++n),words:500,quantity:1,anchor:'עוגן',target_url:'https://example.com/p'+n},user,201);
 const q=await req('quote','POST',{coupon:code},user);
 return {...await req('checkout','POST',{idempotency:'coupon-test-'+n+'-'+user,payment:'invoice',phone:'0500000000',accepted:true,invoice_name:'חשבונית בדיקה',coupon:code,expected_total:q.total,pricing_token:q.pricing_token},user,201),quote:q};
}
const coupons=async()=>Object.fromEntries((await req('admin/coupons')).coupons.map(c=>[c.code,c]));
try{
 const database=await mf.getD1Database('DB');
 for(const migration of readdirSync('drizzle').filter(x=>x.endsWith('.sql')).sort()){const sql=readFileSync('drizzle/'+migration,'utf8');for(const part of sql.split('--> statement-breakpoint').map(x=>x.trim()).filter(Boolean))await database.prepare(part).run();}
 check((await req('me')).user.role==='admin','owner is admin');
 for(const u of ['cust-a','cust-b','cust-c','cust-d'])await req('me','GET',undefined,u);
 site=(await req('catalog','GET',undefined,'cust-a')).websites.find(w=>w.price_cents===5000);check(!!site,'a 50 ILS site exists');
 await database.prepare('UPDATE websites SET data=json_set(data,?,json(?)) WHERE id=?').bind('$.procurement_verified','true',site.id).run();
 for(const code of ['SAVE10','UNUSED5','BUNDLED20'])await req('admin/coupons','POST',{code,percent:code==='UNUSED5'?5:code==='BUNDLED20'?20:10,max_uses:0});

 // Usage: three customers use SAVE10, one cancels; the list follows the `uses` counter.
 const a=await buy('cust-a','SAVE10'),b=await buy('cust-b','SAVE10'),c=await buy('cust-c','SAVE10');
 check(a.quote.discount===500,'coupon gives its discount');
 await req('orders/'+c.id+'/cancel','POST',{reason:'בדיקה'});
 let list=await coupons();
 check(list.SAVE10.uses===2,'cancel gives the use back');
 check(list.SAVE10.customers.length===2,'usage list skips the cancelled order');
 check(list.SAVE10.customers.map(x=>x.number).join()===[a.number,b.number].join(),'usage list in order of purchase (1, 2, 3)');
 check(list.SAVE10.customers[0].name==='דנה לקוחה'&&list.SAVE10.customers[0].email==='cust-a@example.test'&&list.SAVE10.customers[0].created,'usage row has name, email, order number and date');
 check(list.UNUSED5.customers.length===0,'unused coupon has an empty list');
 await req('admin/coupons','GET',undefined,'cust-a',403);

 // Delete: refused for a customer, for a missing coupon, and while a bundle links to the coupon.
 await req('admin/coupons/'+list.UNUSED5.id+'/permanent','DELETE',undefined,'cust-a',403);
 await req('admin/coupons/missing-coupon/permanent','DELETE',undefined,'owner',404);
 await req('records/bundle','POST',{name:'חבילת קופון',website_ids:[site.id,(await req('catalog','GET',undefined,'cust-a')).websites.find(w=>w.id!==site.id&&w.active!==0).id],coupon:'BUNDLED20'},'owner',201);
 const blocked=await req('admin/coupons/'+list.BUNDLED20.id+'/permanent','DELETE',undefined,'owner',409);
 check(/חבילה/.test(blocked.error||JSON.stringify(blocked)),'delete explains the linked bundle');
 // The old action is unchanged: DELETE without /permanent only deactivates.
 await req('admin/coupons/'+list.UNUSED5.id,'DELETE');
 list=await coupons();check(list.UNUSED5&&list.UNUSED5.active===0,'"השבתה" still only deactivates');

 // Permanent delete of a used coupon: orders keep their code and totals; the code can no longer be used.
 const before=(await req('orders/'+a.id)).order,savedId=list.SAVE10.id;
 await req('admin/coupons/'+list.SAVE10.id+'/permanent','DELETE');
 list=await coupons();check(!list.SAVE10,'deleted coupon is gone from the list');
 const after=(await req('orders/'+a.id)).order;
 check(after.total===before.total&&after.discount===before.discount&&after.discount===500,'order totals unchanged after delete');
 const stored=await database.prepare('SELECT data FROM orders WHERE id=?').bind(a.id).first();
 check(JSON.parse(stored.data).coupon==='SAVE10','order keeps the coupon code');
 await req('cart','POST',{website_id:site.id,topic:'אחרי מחיקה',words:500,quantity:1,anchor:'עוגן',target_url:'https://example.com/x'},'cust-d',201);
 await req('quote','POST',{coupon:'SAVE10'},'cust-d',400);
 await database.prepare('DELETE FROM cart WHERE user_id=?').bind('cust-d').run();
 check(!!await database.prepare("SELECT id FROM activity WHERE action='קופון נמחק' AND resource=?").bind(savedId).first(),'delete is written to the activity log');
 // Cancelling an order whose coupon was deleted still works.
 await req('orders/'+b.id+'/cancel','POST',{reason:'אחרי מחיקת הקופון'});

 // A new coupon with the same code does not inherit the old customers or the old order's cancel.
 await req('admin/coupons','POST',{code:'SAVE10',percent:15,max_uses:0});
 const d=await buy('cust-d','SAVE10');
 list=await coupons();
 check(list.SAVE10.uses===1&&list.SAVE10.customers.length===1&&list.SAVE10.customers[0].number===d.number,'re-created code lists only its own customers');
 await req('orders/'+a.id+'/cancel','POST',{reason:'הזמנה ישנה'});
 check((await coupons()).SAVE10.uses===1,'old order cancel does not lower the new coupon');
 // Orders from before this change hold only the code: they are still listed under it.
 await database.prepare("UPDATE orders SET data=json_remove(data,'$.coupon_id') WHERE id=?").bind(d.id).run();
 check((await coupons()).SAVE10.customers.length===1,'an older order without the coupon id is still listed');

 console.log(JSON.stringify({passed:checks,verified:['coupon_usage_list','coupon_permanent_delete','orders_unchanged','bundle_guard','deactivate_unchanged','same_code_recreated']}));
}finally{await mf.dispose();}
