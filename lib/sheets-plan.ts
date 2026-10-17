import type {Row} from './shared';
export const SHEET_ID='1_bo5ubja3sLePWSPEVIkc5ySOvhCxRICQBf2VnqNmtE';
export const SHEET_TAB='אתרים';
export const sheetFields:Record<string,string>={
 'מזהה אתר':'id','שם האתר':'name','כתובת אתר':'url','קטגוריה':'category','מחיר מחירון ₪':'price_ils','עלות ₪':'cost_ils','פעיל':'active','DR':'dr','UR':'ur','מחיר מבצע ₪':'sale_price_ils','במבצע':'is_on_sale','הוראות פרסום':'publishing_restrictions','קישור לוגו':'logo_url','ספק':'supplier_id','מלאי':'stock_total','שפה':'language','סוג האתר':'website_type','תגיות (פסיקים)':'tags','סוגי קישור (פסיקים)':'features','ימי אספקה':'turnaround_days','קישור אחד בלבד':'single_link_only','הערות ללקוח':'customer_notes','הערות לאתר':'public_notes','שם המבצע':'sale_title','סיום מבצע':'sale_ends','הסכם פרסום מאומת':'procurement_verified','כתבות לדוגמה (פסיקים)':'example_articles','מייל הספק':'supplier_email','עיר':'city','תג רמה':'tier_badge','סדר תצוגה':'sort_order','אפשרות פיקסל':'pixel_option','מחיר פיקסל ₪':'pixel_price_ils','נושאים מומלצים (פסיקים)':'recommended_topics','תגיות תוכן (פסיקים)':'content_tags'
};
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
 if(flags.has(key))return !!d[key];
 if(lists.has(key))return list(d[key]);
 return Object.hasOwn(w,key)&&key!=='data'?w[key]:d[key];
}
export function planSheets(rows:any[][],existing:Row[]){
 const errors:string[]=[],operations:Row[]=[],entries:Row[]=[],seenIds=new Set<string>(),seenUrls=new Map<string,string>();
 if(!Array.isArray(rows)||rows.length<2||rows.length>5001)throw Error('נדרש גיליון עם 1 עד 5,000 אתרים');
 const heads=rows[0].map(x=>String(x??'').trim()),keys=heads.map(x=>sheetFields[x]||'');
 if(new Set(heads.filter(Boolean)).size!==heads.filter(Boolean).length)throw Error('כותרות העמודות כפולות');
 for(const key of ['id','name','url','category','price_ils'])if(!keys.includes(key))throw Error('עמודת חובה חסרה: '+key);
 const known=new Map(existing.map(w=>[w.id,w])),existingUrls=new Map<string,string[]>();
 for(const w of existing){try{const u=url(w.url);existingUrls.set(u,[...(existingUrls.get(u)||[]),w.id]);}catch{}}
 for(let i=1;i<rows.length;i++){
  const cells=rows[i];if(!Array.isArray(cells)){errors.push('שורה '+(i+1)+': מבנה שורה לא תקין');continue;}if(!cells.some(v=>String(v??'').trim()))continue;
  try{
   const raw:Row=Object.fromEntries(keys.map((k,j)=>[k,String(cells[j]??'').trim()]));
   let id=raw.id;const siteUrl=url(raw.url||'');
   if(!id){const matches=existingUrls.get(siteUrl)||[];if(matches.length>1)throw Error('כתובת קיימת בכמה רשומות; יש למלא מזהה');id=matches[0]||'sheet-'+crypto.randomUUID();}
   if(!/^[a-zA-Z0-9_-]{1,100}$/.test(id)||seenIds.has(id))throw Error('מזהה אתר לא תקין או כפול');seenIds.add(id);
   const before=known.get(id);if(raw.id&&!before)throw Error('המזהה אינו קיים באתר; לאתר חדש יש להשאיר אותו ריק');
   const prevUrlId=seenUrls.get(siteUrl);if(prevUrlId&&(!before||!known.has(prevUrlId)))throw Error('כתובת אתר כפולה');seenUrls.set(siteUrl,id);
   if(!before&&existingUrls.has(siteUrl))throw Error('כתובת האתר כבר קיימת');
   if(!raw.name||!raw.category||raw.price_ils==='')throw Error('שם אתר קטגוריה ומחיר הם חובה');
   const cat=categoryLabels[raw.category]?raw.category:Object.keys(categoryLabels).find(k=>categoryLabels[k]===raw.category);if(!cat)throw Error('קטגוריה לא מוכרת');
   const values:Row={},normalized:Row={};
   for(let j=0;j<keys.length;j++){
    const key=keys[j];if(!key||key==='id')continue;const text=String(cells[j]??'').trim();
    if(!text)continue; // Optional blanks preserve existing information, never turn missing costs into zero.
    let value:any=text;
    if(text==='__CLEAR__'){if(['name','url','category','price_ils','active','dr','ur','turnaround_days','sort_order'].includes(key))throw Error('אין לרוקן שדה חובה');value=lists.has(key)?[]:flags.has(key)?false:'';}
    else if(flags.has(key)){if(/^(כן|true|1)$/i.test(text))value=true;else if(/^(לא|false|0)$/i.test(text))value=false;else throw Error('יש לכתוב כן או לא בשדה '+heads[j]);}
    else if(lists.has(key))value=text.split(',').map(s=>s.trim()).filter(Boolean);
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
   // Unchanged optional legacy fields are intentionally not rewritten.
   if(!before){Object.assign(values,{name:raw.name,url:siteUrl,category:cat,active:values.active!==false});values.features??=['dofollow'];values.language??='he';}
   const sale=Object.hasOwn(values,'is_on_sale')?values.is_on_sale:before&&sheetCurrentValue(before,'is_on_sale');
   if(sale){if(values.sale_price_ils==='')throw Error('יש לבטל מבצע לפני מחיקת מחיר המבצע');const price=Number(values.price_ils??(before&&sheetCurrentValue(before,'price_ils'))),salePrice=Number(values.sale_price_ils??(before&&sheetCurrentValue(before,'sale_price_ils')));if(!Number.isFinite(salePrice)||salePrice>=price)throw Error('מחיר מבצע חייב להיות נמוך ממחיר המחירון');}
   entries.push({id,row:i+1,values:normalized});
   if(Object.keys(values).length)operations.push({id,create:!before,expected_updated:before?.updated||'',values,name:raw.name,row:i+1});
  }catch(e){errors.push('שורה '+(i+1)+': '+(e as Error).message);}
 }
 if(seenIds.size===0&&!errors.length)errors.push('הגיליון אינו מכיל אתרים');
 return {operations,entries,errors,scanned:seenIds.size,additions:operations.filter(r=>r.create).length,updates:operations.filter(r=>!r.create).length,unchanged:seenIds.size-operations.length,missing:existing.filter(w=>!seenIds.has(w.id)).length};
}
