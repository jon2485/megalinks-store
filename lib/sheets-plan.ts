import type {Row} from './shared';
export const SHEET_ID='1_bo5ubja3sLePWSPEVIkc5ySOvhCxRICQBf2VnqNmtE';
export const SHEET_TAB='אתרים';
export const MONTHLY='חודשי';
// Owner order (16.11.2026): name, URL, list price, DR, UR, supplier e-mail, supplier name, cost, stock, sale price, then the rest.
// Columns are read by header name, so an existing sheet keeps working in any order; the old header names stay accepted.
export const sheetFields:Record<string,string>={
 'שם האתר':'name','URL':'url','מחיר לפני הנחה ₪':'price_ils','DR':'dr','UR':'ur','מייל ספק':'supplier_email','שם ספק':'supplier_name','עלות ₪':'cost_ils','מלאי':'stock_total','מחיר מבצע ₪':'sale_price_ils',
 'קטגוריה':'category','פעיל':'active','במבצע':'is_on_sale','שם המבצע':'sale_title','סיום מבצע':'sale_ends','הסכם פרסום מאומת':'procurement_verified','הוראות פרסום':'publishing_restrictions','עיר':'city','שפה':'language','סוג האתר':'website_type','תגיות (פסיקים)':'tags','סוגי קישור (פסיקים)':'features','ימי אספקה':'turnaround_days','קישור אחד בלבד':'single_link_only','הערות ללקוח':'customer_notes','הערות לאתר':'public_notes','כתבות לדוגמה (פסיקים)':'example_articles','קישור לוגו':'logo_url','תג רמה':'tier_badge','סדר תצוגה':'sort_order','אפשרות פיקסל':'pixel_option','מחיר פיקסל ₪':'pixel_price_ils','נושאים מומלצים (פסיקים)':'recommended_topics','תגיות תוכן (פסיקים)':'content_tags','מזהה ספק':'supplier_id','מזהה אתר':'id'
};
// Header names used before 16.11.2026. A sheet may hold either name, never both.
export const sheetAliases:Record<string,string>={'כתובת אתר':'url','מחיר מחירון ₪':'price_ils','מייל הספק':'supplier_email','ספק':'supplier_id'};
export const sheetKey=(header:unknown)=>{const h=String(header??'').trim();return sheetFields[h]||sheetAliases[h]||'';};
export const sheetHeaderGroups=()=>Object.entries(sheetFields).map(([name,key])=>[name,...Object.entries(sheetAliases).filter(([,k])=>k===key).map(([a])=>a)]);
const flags=new Set(['active','is_on_sale','single_link_only','procurement_verified']);
const lists=new Set(['tags','features','example_articles','recommended_topics','content_tags']);
const money=new Set(['price_ils','cost_ils','sale_price_ils','pixel_price_ils']);
const numbers=new Set([...money,'dr','ur','turnaround_days','stock_total','sort_order']);
const categoryLabels:Record<string,string>={news_national:'חדשות ארציות',news_local:'חדשות מקומיות',tech:'טכנולוגיה',finance:'כלכלה ופיננסים',business:'עסקים',lifestyle:'לייף סטייל',magazines:'מגזינים',real_estate:'נדל״ן',health:'בריאות',legal:'משפטים',education:'חינוך',tourism:'תיירות',food:'אוכל',sports:'ספורט',entertainment:'בידור',religion:'דת ומסורת',israeli_foreign_lang:'שפות זרות',general:'כללי'};
function url(v:string){const u=new URL(/^https?:\/\//i.test(v)?v:'https://'+v);if(!['https:','http:'].includes(u.protocol)||!u.hostname.includes('.')||u.username||u.password)throw Error('כתובת לא תקינה');return u.href;}
const list=(v:any)=>Array.isArray(v)?v.map(x=>typeof x==='object'?x.url||'':String(x)):[];
export function sheetCurrentValue(w:Row,key:string){const d=typeof w.data==='string'?JSON.parse(w.data):w.data||{};
 if(key==='price_ils')return w.price/100;
 if(key==='cost_ils'||key==='sale_price_ils'||key==='pixel_price_ils'){const field=key.replace('_ils','_cents');return d[field]===undefined?(key==='sale_price_ils'?(d.sale_price||undefined):key==='pixel_price_ils'?(d.pixel_price??undefined):undefined):d[field]/100;}
 if(key==='active')return !!w.active;
 // Per-site billing (16.11.2026): a site without stock is billed monthly, and the sheet says so in words.
 if(key==='stock_total')return d.stock_total===null||d.stock_total===undefined||d.stock_total===''?MONTHLY:Number(d.stock_total);
 if(flags.has(key))return !!d[key];
 if(lists.has(key))return list(d[key]);
 return Object.hasOwn(w,key)&&key!=='data'?w[key]:d[key];
}
// Fields whose sheet check can be stricter than what the site itself stores.
const siteChecked=new Set(['url','logo_url','example_articles','supplier_email','sale_ends']);
// The sheet text of a site value, as the writeback puts it (same as sheetCell in sheets-merge).
const asCell=(value:any)=>Array.isArray(value)?value.join(', '):typeof value==='boolean'?(value?'כן':'לא'):String(value??'');
// Same address with or without www, a trailing slash or capitals is the same site, exactly as the catalog save compares it
// (found on Staging 16.11.2026: "ynet.co.il" in the sheet was planned as a new site and the save refused it as a duplicate).
const urlKey=(href:string)=>{try{const u=new URL(href);return u.hostname.toLowerCase().replace(/^www\./,'')+u.pathname.replace(/\/$/,'')+u.search;}catch{return href;}};
export function planSheets(rows:any[][],existing:Row[]){
 const errors:string[]=[],operations:Row[]=[],entries:Row[]=[],seenIds=new Set<string>(),seenUrls=new Map<string,string>();
 if(!Array.isArray(rows)||rows.length<2||rows.length>5001)throw Error('נדרש גיליון עם 1 עד 5,000 אתרים');
 const heads=rows[0].map(x=>String(x??'').trim()),keys=heads.map(sheetKey);
 if(new Set(heads.filter(Boolean)).size!==heads.filter(Boolean).length)throw Error('כותרות העמודות כפולות');
 if(new Set(keys.filter(Boolean)).size!==keys.filter(Boolean).length)throw Error('אותה עמודה מופיעה פעמיים, בשם הישן ובשם החדש. יש למחוק אחת מהן');
 for(const key of ['id','name','url','category','price_ils'])if(!keys.includes(key))throw Error('עמודת חובה חסרה: '+key);
 const known=new Map(existing.map(w=>[w.id,w])),existingUrls=new Map<string,string[]>();
 for(const w of existing){try{const u=urlKey(url(w.url));existingUrls.set(u,[...(existingUrls.get(u)||[]),w.id]);}catch{}}
 for(let i=1;i<rows.length;i++){
  const cells=rows[i];if(!Array.isArray(cells)){errors.push('שורה '+(i+1)+': מבנה שורה לא תקין');continue;}if(!cells.some(v=>String(v??'').trim()))continue;
  try{
   const raw:Row=Object.fromEntries(keys.map((k,j)=>[k,String(cells[j]??'').trim()]));
   let id=raw.id;const own=raw.id?known.get(raw.id):undefined;let siteUrl:string;
   // A known site whose address is stored on the site exactly like this is not blocked by its own old value.
   try{siteUrl=url(raw.url||'');}catch(e){if(own&&raw.url&&String(own.url??'').trim()===raw.url)siteUrl=raw.url;else throw e;}
   if(!id){const matches=existingUrls.get(urlKey(siteUrl))||[];if(matches.length>1)throw Error('כתובת קיימת בכמה רשומות; יש למלא מזהה');id=matches[0]||'sheet-'+crypto.randomUUID();}
   if(!/^[a-zA-Z0-9_-]{1,100}$/.test(id)||seenIds.has(id))throw Error('מזהה אתר לא תקין או כפול');seenIds.add(id);
   const before=known.get(id);if(raw.id&&!before)throw Error('המזהה אינו קיים באתר; לאתר חדש יש להשאיר אותו ריק');
   const prevUrlId=seenUrls.get(urlKey(siteUrl));if(prevUrlId&&(!before||!known.has(prevUrlId)))throw Error('כתובת אתר כפולה');seenUrls.set(urlKey(siteUrl),id);
   if(!before&&existingUrls.has(urlKey(siteUrl)))throw Error('כתובת האתר כבר קיימת');
   if(!raw.name||!raw.category||raw.price_ils==='')throw Error('שם אתר קטגוריה ומחיר הם חובה');
   const cat=categoryLabels[raw.category]?raw.category:Object.keys(categoryLabels).find(k=>categoryLabels[k]===raw.category);if(!cat)throw Error('קטגוריה לא מוכרת');
   const values:Row={},normalized:Row={};
   for(let j=0;j<keys.length;j++){
    const key=keys[j];if(!key||key==='id')continue;const text=String(cells[j]??'').trim();
    if(!text)continue; // Optional blanks preserve existing information, never turn missing costs into zero.
    // Found on Staging 16.11.2026: the site writes its own values into the sheet (a logo kept on the site as /api/selling/logo/...,
    // free text in example articles) and then rejected them when reading them back, which blocked the whole sync. A cell that
    // still holds exactly the site's value changes nothing, so it is not checked again; only a value someone changed is validated.
    if(before&&siteChecked.has(key)){const current=sheetCurrentValue(before,key);if(current!==undefined&&current!==null&&text===asCell(current).trim()){normalized[key]=current;continue;}}
    let value:any=text;
    if(text==='__CLEAR__'){if(['name','url','category','price_ils','active','dr','ur','turnaround_days','sort_order'].includes(key))throw Error('אין לרוקן שדה חובה');value=lists.has(key)?[]:flags.has(key)?false:'';}
    else if(flags.has(key)){if(/^(כן|true|1)$/i.test(text))value=true;else if(/^(לא|false|0)$/i.test(text))value=false;else throw Error('יש לכתוב כן או לא בשדה '+heads[j]);}
    else if(lists.has(key))value=text.split(',').map(s=>s.trim()).filter(Boolean);
    else if(key==='stock_total'&&text===MONTHLY)value=MONTHLY;
    else if(numbers.has(key)){value=Number(text.replace(/[₪,\s]/g,''));if(!Number.isFinite(value)||value<0||value>1000000||!money.has(key)&&!Number.isInteger(value))throw Error('מספר לא תקין בשדה '+heads[j]);if(['dr','ur'].includes(key)&&value>100||key==='turnaround_days'&&value>365)throw Error('מספר מחוץ לטווח בשדה '+heads[j]);if(money.has(key))value=Math.round(value*100)/100;}
    if(key==='url'||key==='logo_url')value=value?url(value):'';
    if(key==='category')value=cat;
    if(key==='sale_ends'&&value&&!Number.isFinite(Date.parse(value)))throw Error('תאריך סיום מבצע לא תקין');
    if(key==='supplier_email'&&value&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))throw Error('מייל ספק לא תקין');
    if(key==='example_articles')value=value.map((s:string)=>url(s));
    normalized[key]=value;
    let current=before?sheetCurrentValue(before,key):undefined;
    if((key==='url'||key==='logo_url')&&current)try{current=url(String(current));}catch{}
    if(key==='example_articles'&&Array.isArray(current))current=current.map((v:string)=>{try{return url(v);}catch{return v;}});
    if(JSON.stringify(value)!==JSON.stringify(current??(lists.has(key)?[]:flags.has(key)?false:''))){
     if(typeof value==='string'&&value.length>(key.includes('notes')||key==='publishing_restrictions'?6000:1000))throw Error('טקסט ארוך מדי בשדה '+heads[j]);
     if(lists.has(key)&&(value.length>100||value.some((v:string)=>v.length>1000)))throw Error('רשימה ארוכה מדי בשדה '+heads[j]);
     values[key]=value;
    }
   }
   // Owner decision (16.11.2026): typing a sale price turns the sale on; "במבצע" = לא still ends it.
   if(Object.hasOwn(values,'sale_price_ils')&&values.sale_price_ils!==''&&!Object.hasOwn(values,'is_on_sale')&&!(before&&sheetCurrentValue(before,'is_on_sale')))values.is_on_sale=true;
   // Unchanged optional legacy fields are intentionally not rewritten.
   if(!before){Object.assign(values,{name:raw.name,url:siteUrl,category:cat,active:values.active!==false});values.features??=['dofollow'];values.language??='he';}
   const sale=Object.hasOwn(values,'is_on_sale')?values.is_on_sale:before&&sheetCurrentValue(before,'is_on_sale');
   // Checked only when the price, the sale price or the sale switch changed here; the site's own existing values never block the sync.
   const saleTouched=!before||['price_ils','sale_price_ils','is_on_sale'].some(k=>Object.hasOwn(values,k));
   if(sale&&saleTouched){if(values.sale_price_ils==='')throw Error('יש לבטל מבצע לפני מחיקת מחיר המבצע');const price=Number(values.price_ils??(before&&sheetCurrentValue(before,'price_ils'))),salePrice=Number(values.sale_price_ils??(before&&sheetCurrentValue(before,'sale_price_ils')));if(!Number.isFinite(salePrice)||salePrice>=price)throw Error('מחיר מבצע חייב להיות נמוך ממחיר המחירון');}
   entries.push({id,row:i+1,values:normalized});
   if(Object.keys(values).length)operations.push({id,create:!before,expected_updated:before?.updated||'',values,name:raw.name,row:i+1});
  }catch(e){errors.push('שורה '+(i+1)+': '+(e as Error).message);}
 }
 if(seenIds.size===0&&!errors.length)errors.push('הגיליון אינו מכיל אתרים');
 return {operations,entries,errors,scanned:seenIds.size,additions:operations.filter(r=>r.create).length,updates:operations.filter(r=>!r.create).length,unchanged:seenIds.size-operations.length,missing:existing.filter(w=>!seenIds.has(w.id)).length,missing_active:existing.filter(w=>!seenIds.has(w.id)&&w.active).length};
}
