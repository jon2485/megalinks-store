import {catalogPricingMeta,pricingGuard,warnPricing} from './pricing';
import {minimumWarning,customerPrice} from './pricing-rules';
import {Row,httpUrl} from './shared';
import {admin,all,db,stmt,assert,parse,now,uid,hash,ApiError} from './server';
const texts=['name','url','category','logo_url','language','website_type','sale_title','sale_ends','public_notes','customer_notes','publishing_restrictions','city','tier_badge','pixel_option','wordpress_connection'];
const flags=['active','is_on_sale','single_link_only','procurement_verified'];
const numbers=['price_ils','cost_ils','sale_price_ils','dr','ur','turnaround_days'];
const lists=['tags','features','example_articles','recommended_topics','content_tags'];
const allowed=new Set([...texts,...flags,...numbers,...lists,'supplier_id','supplier_email','stock_total','sort_order','pixel_price_ils']);
export async function saveCatalogBatch(user:Row,input:Row){
 admin(user);assert(Array.isArray(input.rows)&&input.rows.length>0&&input.rows.length<=100,'יש לשלוח בין שורה אחת ל־100 שורות');
 const pausingOnly=input.rows.every((r:Row)=>r&&r.create!==true&&r.values&&Object.keys(r.values).length===1&&r.values.active===false);
 const meta=await catalogPricingMeta(),warnings:string[]=[];if(!pausingOnly&&input.pricing_version!==undefined)assert(input.pricing_version===meta.pricing_version,'התמחור השתנה במקביל. רעננו לפני שמירה; הטיוטה נשמרה',409);const dynamicKeys=meta.pricing_tiers.map(t=>'tier_'+t.id+'_ils');
 const existing=new Map((await all('SELECT * FROM websites')).map(w=>[w.id,w]));
 const suppliers=new Map((await all("SELECT * FROM records WHERE kind='supplier'")).map(w=>[w.id,parse(w)!]));
 const seen=new Set<string>(),seenUrls=new Set<string>(),stamp=now(),statements=[],ids:string[]=[];
 const url=(v:unknown,label:string)=>{try{return httpUrl(String(v||''));}catch{throw new ApiError(400,label+' אינה תקינה. יש להזין קישור מלא שמתחיל ב־https:// או http://' );}};
 for(let i=0;i<input.rows.length;i++){
  const r=input.rows[i];assert(r&&typeof r==='object'&&!Array.isArray(r),`שורה ${i+1}: נתונים לא תקינים`);
  const startStatements=statements.length;
  const id=String(r.id||'');assert(/^[a-zA-Z0-9_-]{1,100}$/.test(id)&&!seen.has(id),`שורה ${i+1}: מזהה חסר או כפול`);seen.add(id);
  const prev=existing.get(id);assert(r.create===true?!prev:!!prev,`שורה ${i+1}: האתר כבר קיים או לא נמצא`,409);
  if(prev)assert(r.expected_updated===prev.updated,`שורה ${i+1}: האתר עודכן במקביל. רעננו את הטבלה לפני השמירה`,409);
  const values=r.values;assert(values&&typeof values==='object'&&!Array.isArray(values),'פרטי השורה חסרים');
  for(const key of Object.keys(values))assert(allowed.has(key)||dynamicKeys.includes(key),'שדה לא נתמך: '+key);
  // Suspension is a visibility action. Preserve legacy URLs, images and all
  // commercial fields byte-for-byte; only the record revision can block it.
  if(prev&&Object.keys(values).length===1&&values.active===false){
   statements.push(stmt("UPDATE websites SET name=CASE WHEN updated=? THEN name ELSE NULL END,active=0,data=json_set(data,'$.active',json('false')),updated=? WHERE id=?",r.expected_updated,stamp,id));
   ids.push(id);continue;
  }
  const d:Row=prev?JSON.parse(prev.data):{active:true,procurement_verified:false,features:[],tags:[],language:'he',turnaround_days:3};
  if(prev)Object.assign(d,{name:prev.name,url:prev.url,category:prev.category,active:!!prev.active,price_ils:prev.price/100});
  for(const k of texts)if(k in values){assert(typeof values[k]==='string'&&values[k].length<=(k.includes('notes')||k==='publishing_restrictions'?6000:1000),'טקסט לא תקין בשדה '+k);d[k]=values[k].trim();}
  for(const k of flags)if(k in values){assert(typeof values[k]==='boolean','ערך כן/לא לא תקין');d[k]=values[k];}
  for(const k of lists)if(k in values){assert(Array.isArray(values[k])&&values[k].length<=100&&values[k].every((v:unknown)=>typeof v==='string'&&v.length<=1000),'רשימה לא תקינה');d[k]=values[k];}
  assert(d.name&&d.url&&d.category,`שורה ${i+1}: שם, כתובת וקטגוריה הם חובה`);d.url=url(d.url,'כתובת האתר');if(d.logo_url)d.logo_url=url(d.logo_url,'כתובת תמונת הלוגו');
  const canonical=(value:string)=>{try{const u=new URL(value);return u.hostname.toLowerCase().replace(/^www\./,'')+u.pathname.replace(/\/$/,'')+u.search;}catch{return '';}};const normalized=canonical(d.url);if(!prev||canonical(prev.url)!==normalized){assert(!seenUrls.has(normalized),'אותה כתובת אתר מופיעה פעמיים בקבוצה',409);seenUrls.add(normalized);assert(![...existing.values()].some(w=>w.id!==id&&canonical(w.url)===normalized),'כבר קיים אתר עם הכתובת הזו. ערכו את האתר הקיים במקום להוסיף כפילות',409);}
  if('example_articles' in values)d.example_articles=values.example_articles.map((value:string,index:number)=>url(value,'כתובת מאמר לדוגמה '+(index+1)));
  const amount=(v:unknown)=>{assert(v!==''&&v!==null&&typeof v!=='boolean','יש להזין מחיר');const n=Math.round(Number(v)*100);assert(Number.isSafeInteger(n)&&n>=0&&n<=100000000,'מחיר חייב להיות מספר לא שלילי');return n;};
  const price=amount('price_ils' in values?values.price_ils:d.price_ils);
  d.price_cents=price;delete d.price_ils;
  if('cost_ils' in values)d.cost_cents=values.cost_ils===''?undefined:amount(values.cost_ils);
  if('sale_price_ils' in values)d.sale_price_cents=values.sale_price_ils===''?undefined:amount(values.sale_price_ils);
  if(d.is_on_sale)assert(Number.isSafeInteger(d.sale_price_cents)&&d.sale_price_cents<price,'מחיר מבצע חייב להיות נמוך מהמחיר הרגיל');
  if(d.sale_ends)assert(Number.isFinite(Date.parse(d.sale_ends)),'תאריך סיום המבצע אינו תקין');
  for(const k of ['dr','ur','turnaround_days'])if(k in values){const n=Number(values[k]);assert(values[k]!==''&&Number.isInteger(n)&&n>=0&&n<=(k==='turnaround_days'?365:100),'דירוג או זמן אספקה לא תקינים');d[k]=n;}
  if('supplier_id' in values){const supplierId=String(values.supplier_id||'');assert(!supplierId||suppliers.has(supplierId),'הספק לא נמצא');d.supplier_id=supplierId;d.supplier_name=suppliers.get(supplierId)?.name||'';}
  if('supplier_email' in values){
   let email=String(values.supplier_email||'').trim().toLowerCase();if(!email&&values.supplier_id)email=String(suppliers.get(String(values.supplier_id))?.email||'').trim().toLowerCase();assert(!email||/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)&&email.length<=254,'מייל הספק אינו תקין');
   d.supplier_email=email;
   if(email){let supplier=[...suppliers.values()].find(s=>String(s.email||'').trim().toLowerCase()===email);if(!supplier){const sid='supplier-email-'+(await hash(email)).slice(0,32);supplier={id:sid,name:email,email};suppliers.set(sid,supplier);statements.push(stmt('INSERT OR IGNORE INTO records(id,kind,user_id,data,created,updated) VALUES (?,?,?,?,?,?)',sid,'supplier',user.id,JSON.stringify({name:email,email}),stamp,stamp));}d.supplier_id=supplier.id;d.supplier_name=supplier.name;
   }else{d.supplier_id='';d.supplier_name='';}
  }else if('supplier_id' in values)d.supplier_email=suppliers.get(d.supplier_id)?.email||'';
  if('sort_order' in values){const n=Number(values.sort_order);assert(Number.isSafeInteger(n)&&n>=0&&n<=1000000,'סדר תצוגה לא תקין');d.sort_order=n;}
  if('pixel_price_ils' in values){d.pixel_price_cents=values.pixel_price_ils===''?undefined:amount(values.pixel_price_ils);d.pixel_price=d.pixel_price_cents===undefined?undefined:d.pixel_price_cents/100;}
  if('stock_total' in values){const n=values.stock_total===''||values.stock_total===null?null:Number(values.stock_total);assert(n===null||typeof values.stock_total!=='boolean'&&Number.isSafeInteger(n)&&n>=0&&n<=1000000,'מלאי חייב להיות מספר שלם לא שלילי, או ריק');d.stock_total=n;}
  for(const tier of meta.pricing_tiers){const key='tier_'+tier.id+'_ils';if(key in values){const old=meta.pricing_overrides.find(o=>o.owner_id===tier.id&&o.website_id===id);if(values[key]===''||values[key]==='הסר'){statements.push(stmt("DELETE FROM pricing_overrides WHERE scope='tier' AND owner_id=? AND website_id=?",tier.id,id));}else{const fixed=amount(values[key]);warnings.push(minimumWarning(d.name+' / '+tier.name,fixed,d.cost_cents));statements.push(stmt("INSERT INTO pricing_overrides(scope,owner_id,website_id,price,checked_cost,updated) VALUES ('tier',?,?,?,?,?) ON CONFLICT(scope,owner_id,website_id) DO UPDATE SET price=excluded.price,checked_cost=excluded.checked_cost,updated=excluded.updated",tier.id,id,fixed,d.cost_cents??null,stamp));}statements.push(stmt('INSERT INTO activity(id,user_id,resource,action,data,created) VALUES (?,?,?,?,?,?)',uid(),user.id,'pricing','מחיר רמה בקטלוג',JSON.stringify({scope:'tier',owner_id:tier.id,rows:[{website_id:id,website_name:d.name,before:old?.price,after:values[key]===''||values[key]==='הסר'?null:amount(values[key])}]}),stamp));}}
  if(!prev||'price_ils' in values||'cost_ils' in values||'sale_price_ils' in values||'is_on_sale' in values){warnings.push(minimumWarning(d.name,price,d.cost_cents));if(d.is_on_sale)warnings.push(minimumWarning(d.name+' מבצע',d.sale_price_cents,d.cost_cents));for(const tier of meta.pricing_tiers){const key='tier_'+tier.id+'_ils',override=meta.pricing_overrides.find(o=>o.owner_id===tier.id&&o.website_id===id);const fixed=key in values?(values[key]===''||values[key]==='הסר'?undefined:amount(values[key])):override?.price;warnings.push(minimumWarning(d.name+' / '+tier.name,customerPrice({...d,price},tier,undefined,fixed).price_cents,d.cost_cents));}statements.push(stmt('INSERT INTO activity(id,user_id,resource,action,data,created) VALUES (?,?,?,?,?,?)',uid(),user.id,id,'עדכון מחירי אתר',JSON.stringify({before_price:prev?.price,after_price:price,before_cost:prev?JSON.parse(prev.data).cost_cents:null,after_cost:d.cost_cents}),stamp));}
  const args=[d.name,d.url,d.category,price,Number(d.dr)||0,d.active===false?0:1,JSON.stringify(d),stamp];
  if(prev){
   // A stale revision causes a NOT NULL violation and rolls back the entire D1 batch.
   statements.push(stmt('UPDATE websites SET name=CASE WHEN updated=? THEN ? ELSE NULL END,url=?,category=?,price=?,dr=?,active=?,data=?,updated=? WHERE id=?',r.expected_updated,...args,id));
  }else statements.push(stmt('INSERT INTO websites(name,url,category,price,dr,active,data,updated,id) VALUES (?,?,?,?,?,?,?,?,?)',...args,id));
  if(!prev){const siteInsert=statements.pop()!;statements.splice(startStatements,0,siteInsert);}
  ids.push(id);
 }
 statements.push(stmt('INSERT INTO activity(id,user_id,resource,action,data,created) VALUES (?,?,?,?,?,?)',uid(),user.id,'catalog','עריכת קטלוג מרוכזת',JSON.stringify({ids,count:ids.length,pricing_warning_acknowledged:input.acknowledge===true,warnings:warnings.filter(Boolean)}),stamp));
 warnPricing(warnings,input.acknowledge);
 try{await db().batch([...(pausingOnly?[]:[pricingGuard(meta.pricing_version)]),...statements]);}catch(e){if(String(e).includes('pricing_state.version')||String(e).includes('NOT NULL constraint failed: websites.name'))throw new ApiError(409,'אתר עודכן במקביל. השמירה נעצרה ללא שינוי בקבוצה הזו');throw e;}
 return {saved:ids.length,rows:ids.map(id=>({id,updated:stamp}))};
}
