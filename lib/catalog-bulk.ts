import {catalogPricingMeta,pricingGuard,warnPricing} from './pricing';
import {minimumWarning,customerPrice} from './pricing-rules';
import {Row,httpUrl} from './shared';
import {admin,all,db,stmt,assert,parse,now,uid,hash,ApiError} from './server';
import {liveSites} from './site-archive';
import {MONTHLY,STOCK_WORD,EXCHANGE,emailList} from './catalog-fields';
const texts=['name','url','category','logo_url','language','website_type','sale_title','sale_ends','public_notes','customer_notes','admin_notes','publishing_restrictions','city','tier_badge','pixel_option','wordpress_connection'];
const flags=['active','is_on_sale','single_link_only','procurement_verified'];
const numbers=['price_ils','cost_ils','sale_price_ils','dr','ur','turnaround_days'];
const lists=['tags','features','example_articles','recommended_topics','content_tags'];
const allowed=new Set([...texts,...flags,...numbers,...lists,'supplier_id','supplier_email','supplier_name','stock_total','sort_order','pixel_price_ils']);
export async function saveCatalogBatch(user:Row,input:Row){
 admin(user);assert(Array.isArray(input.rows)&&input.rows.length>0&&input.rows.length<=100,'יש לשלוח בין שורה אחת ל־100 שורות');
 const pausingOnly=input.rows.every((r:Row)=>r&&r.create!==true&&r.values&&Object.keys(r.values).length===1&&r.values.active===false);
 const meta=await catalogPricingMeta(),warnings:string[]=[];if(!pausingOnly&&input.pricing_version!==undefined)assert(input.pricing_version===meta.pricing_version,'התמחור השתנה במקביל. רעננו לפני שמירה; הטיוטה נשמרה',409);const dynamicKeys=meta.pricing_tiers.map(t=>'tier_'+t.id+'_ils');
 // Archived sites (lib/site-archive.ts) cannot be edited, and the address they held is free for a new site.
 const existing=new Map((await all('SELECT * FROM websites WHERE '+liveSites)).map(w=>[w.id,w]));
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
  if(prev)Object.assign(d,{name:prev.name,url:prev.url,category:prev.category,active:!!prev.active,price_ils:prev.price/100,...(d.dr===undefined&&prev.dr!=null?{dr:Number(prev.dr)}:{})}); // a DR kept only in the column must survive a save
  // Owner 19.11.2026: a list of categories; the first is the main one (the column), all of them are kept in data.categories.
  if(Array.isArray(values.category)){const list=[...new Set(values.category.map((x:unknown)=>String(x).trim()).filter(Boolean))] as string[];assert(list.length>=1&&list.length<=8&&list.every(x=>x.length<=60),'קטגוריות לא תקינות');d.categories=list;values.category=list[0];}
  else if(typeof values.category==='string'&&Array.isArray(d.categories)&&d.categories.length){const main=values.category.trim();d.categories=[main,...d.categories.filter((x:string)=>x!==main)];}
  for(const k of texts)if(k in values){assert(typeof values[k]==='string'&&values[k].length<=(k.includes('notes')||k==='publishing_restrictions'?6000:1000),'טקסט לא תקין בשדה '+k);d[k]=values[k].trim();}
  for(const k of flags)if(k in values){assert(typeof values[k]==='boolean','ערך כן/לא לא תקין');d[k]=values[k];}
  for(const k of lists)if(k in values){assert(Array.isArray(values[k])&&values[k].length<=100&&values[k].every((v:unknown)=>typeof v==='string'&&v.length<=1000),'רשימה לא תקינה');d[k]=values[k];}
  assert(d.name&&d.url&&d.category,`שורה ${i+1}: שם, כתובת וקטגוריה הם חובה`);
  // Like suspension (above): a stored address or logo that this save does not change is kept as it is and never blocks the save
  // (found on Staging 16.11.2026, a legacy invalid address stopped a whole Sheets sync). A new site, a site being made visible again
  // and a changed field are fully checked, as before.
  const strict=!prev||(values.active===true&&!prev.active);
  if(strict||'url' in values)d.url=url(d.url,'כתובת האתר');if(d.logo_url&&(strict||'logo_url' in values))d.logo_url=url(d.logo_url,'כתובת תמונת הלוגו');
  const canonical=(value:string)=>{try{const u=new URL(value);return u.hostname.toLowerCase().replace(/^www\./,'')+u.pathname.replace(/\/$/,'')+u.search;}catch{return '';}};const normalized=canonical(d.url);if(!prev||canonical(prev.url)!==normalized){assert(!seenUrls.has(normalized),'אותה כתובת אתר מופיעה פעמיים בקבוצה',409);seenUrls.add(normalized);assert(![...existing.values()].some(w=>w.id!==id&&canonical(w.url)===normalized),'כבר קיים אתר עם הכתובת הזו. ערכו את האתר הקיים במקום להוסיף כפילות',409);}
  if('example_articles' in values)d.example_articles=values.example_articles.map((value:string,index:number)=>url(value,'כתובת מאמר לדוגמה '+(index+1)));
  const amount=(v:unknown)=>{assert(v!==''&&v!==null&&typeof v!=='boolean','יש להזין מחיר');const n=Math.round(Number(v)*100);assert(Number.isSafeInteger(n)&&n>=0&&n<=100000000,'מחיר חייב להיות מספר לא שלילי');return n;};
  const price=amount('price_ils' in values?values.price_ils:d.price_ils);
  d.price_cents=price;delete d.price_ils;
  if('cost_ils' in values)d.cost_cents=values.cost_ils===''?undefined:amount(values.cost_ils);
  if('sale_price_ils' in values)d.sale_price_cents=values.sale_price_ils===''?undefined:amount(values.sale_price_ils);
  // The sale rule is checked when this save touches the price, the sale price or the sale switch, adds a site or makes one visible again.
  if(d.is_on_sale&&(strict||['price_ils','sale_price_ils','is_on_sale'].some(k=>k in values)))assert(Number.isSafeInteger(d.sale_price_cents)&&d.sale_price_cents<price,'מחיר מבצע חייב להיות נמוך מהמחיר הרגיל');
  if(d.sale_ends)assert(Number.isFinite(Date.parse(d.sale_ends)),'תאריך סיום המבצע אינו תקין');
  for(const k of ['dr','ur','turnaround_days'])if(k in values){const n=Number(values[k]);// Owner: UR (19.11.2026) and DR (20.11.2026) may have decimals, for example 4.1; delivery days stay whole numbers.
  assert(values[k]!==''&&Number.isFinite(n)&&(k!=='turnaround_days'||Number.isInteger(n))&&n>=0&&n<=(k==='turnaround_days'?365:100),'דירוג או זמן אספקה לא תקינים');d[k]=k==='turnaround_days'?n:Math.round(n*100)/100;}
  if('supplier_id' in values){const supplierId=String(values.supplier_id||'');assert(!supplierId||suppliers.has(supplierId),'הספק לא נמצא');d.supplier_id=supplierId;d.supplier_name=suppliers.get(supplierId)?.name||'';}
  if('supplier_email' in values){
   let email=String(values.supplier_email||'').trim().toLowerCase();if(!email&&values.supplier_id)email=String(suppliers.get(String(values.supplier_id))?.email||'').trim().toLowerCase();
   // Several addresses for one supplier (owner, 20.11.2026) are kept as one "a, b" value, so the supplier card stays one card.
   if(email){const list=emailList(email);assert(list.length>=1&&list.length<=5&&list.every(e=>e.length<=254),'מייל הספק אינו תקין');email=list.join(', ');}
   d.supplier_email=email;
   if(email){let supplier=[...suppliers.values()].find(s=>String(s.email||'').trim().toLowerCase()===email);if(!supplier){const sid='supplier-email-'+(await hash(email)).slice(0,32);const given=String(values.supplier_name||'').trim().slice(0,200)||email;supplier={id:sid,name:given,email};suppliers.set(sid,supplier);statements.push(stmt('INSERT OR IGNORE INTO records(id,kind,user_id,data,created,updated) VALUES (?,?,?,?,?,?)',sid,'supplier',user.id,JSON.stringify({name:given,email}),stamp,stamp));}d.supplier_id=supplier.id;d.supplier_name=supplier.name;
   }else{d.supplier_id='';d.supplier_name='';}
  }else if('supplier_id' in values)d.supplier_email=suppliers.get(d.supplier_id)?.email||'';
  // Owner decision (16.11.2026): a supplier name from the sheet names a supplier that has none yet (or only its e-mail).
  // An existing different name is kept; the next sync writes it back to the sheet.
  if('supplier_name' in values){const name=String(values.supplier_name??'').trim();assert(name.length<=200,'שם הספק ארוך מדי');const s=d.supplier_id?suppliers.get(d.supplier_id):undefined;const current=String(s?.name||'').trim();
   if(name&&s&&(!current||current.toLowerCase()===String(s.email||'').trim().toLowerCase())&&current!==name){s.name=name;statements.push(stmt("UPDATE records SET data=json_set(data,'$.name',?),updated=? WHERE id=? AND kind='supplier'",name,stamp,s.id),stmt("UPDATE websites SET data=json_set(data,'$.supplier_name',?) WHERE json_extract(data,'$.supplier_id')=?",name,s.id));}}
  if(d.supplier_id&&suppliers.has(d.supplier_id))d.supplier_name=suppliers.get(d.supplier_id)!.name||'';
  if('sort_order' in values){const n=Number(values.sort_order);assert(Number.isSafeInteger(n)&&n>=0&&n<=1000000,'סדר תצוגה לא תקין');d.sort_order=n;}
  if('pixel_price_ils' in values){d.pixel_price_cents=values.pixel_price_ils===''?undefined:amount(values.pixel_price_ils);d.pixel_price=d.pixel_price_cents===undefined?undefined:d.pixel_price_cents/100;}
  // Stock types (owner, 20.11.2026): "מלאי" and "החלפה" set the type and keep the package count as it is.
  if(values.stock_total===STOCK_WORD||values.stock_total===EXCHANGE){d.stock_mode=values.stock_total===STOCK_WORD?'stock':'exchange';delete values.stock_total;}
  else if('stock_total' in values)delete d.stock_mode;
  if('stock_total' in values){const n=values.stock_total===''||values.stock_total===null||values.stock_total===MONTHLY?null:Number(values.stock_total); // "חודשי" or empty: back to monthly billing from the next article (owner, 16.11.2026)
  assert(n===null||typeof values.stock_total!=='boolean'&&Number.isSafeInteger(n)&&n>=0&&n<=1000000,'מלאי חייב להיות מספר שלם לא שלילי, או ריק');assert(n===null||d.stock_total===null||d.stock_total===undefined||n>=Number(d.stock_total),'אפשר רק להוסיף מלאי. כדי להוסיף חבילה השתמשו ב"הוספת מלאי" בדף הספק.');d.stock_total=n;}
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
