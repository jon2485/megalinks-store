// Stock photos for articles (owner 23.11.2026): Pixabay next to Pexels, searched in Hebrew or English.
// Pixabay's API has no Hebrew language (`lang` accepts cs, da, de, en, es, fr, id, it, hu, nl, no, pl, pt, ro, sk, fi,
// sv, tr, vi, th, bg, ru, el, ja, ko, zh), so Hebrew words are turned into English before the search: with the
// "כתיבה עם AI" connection when it is set, otherwise with a short dictionary of common topics.
// Pixabay's terms: search requests are cached for 24 hours, and a chosen image is copied to our storage (no hotlinking).
import {ApiError,externalFetch,now,one,stmt} from './server';

export const PIXABAY_API='https://pixabay.com/api/';
export const SEARCH_CACHE_MS=24*60*60*1000;
const TRANSLATION_CACHE_MS=30*24*60*60*1000;
const HEBREW=/[֐-׿]/;
const HEBREW_WORD=/[֐-׿][֐-׿"'״׳]*/g;

export const hasHebrew=(text:string)=>HEBREW.test(text);
const clean=(text:string)=>text.replace(/[\u0000-\u001f‎‏‪-‮]/g,' ').replace(/\s+/g,' ').trim();

// Common article topics. Keys are Hebrew without the one-letter prefixes (ה, ו, ב, ל, מ, ש, כ); phrases first.
const PHRASES:Record<string,string>={'אוכל לכלבים':'dog food','אוכל לכלב':'dog food','אוכל לחתולים':'cat food','אוכל לחתול':'cat food','בית קפה':'coffee shop','חוף ים':'beach','ים המלח':'dead sea','תל אביב':'tel aviv','רכב חשמלי':'electric car','בינה מלאכותית':'artificial intelligence','אנרגיה סולארית':'solar energy','ביטוח בריאות':'health insurance','ביטוח רכב':'car insurance','ביטוח חיים':'life insurance','שוק ההון':'stock market','עורך דין':'lawyer','רופא שיניים':'dentist','חדר כושר':'gym','יום הולדת':'birthday','עבודה מהבית':'remote work','קניות אונליין':'online shopping','משכנתא':'mortgage','נדל"ן':'real estate','נדל״ן':'real estate','נדלן':'real estate','הייטק':'technology','סייבר':'cyber security','בית חולים':'hospital','בית ספר':'school','בעלי חיים':'animals'};
const WORDS:Record<string,string>={
 'כלב':'dog','כלבים':'dogs','חתול':'cat','חתולים':'cats','אוכל':'food','מזון':'food','מסעדה':'restaurant','מסעדות':'restaurants','קפה':'coffee','יין':'wine','בירה':'beer','עוגה':'cake','פיצה':'pizza','בשר':'meat','ירקות':'vegetables','פירות':'fruit','לחם':'bread','בישול':'cooking','מטבח':'kitchen','שף':'chef',
 'בית':'house','בתים':'houses','דירה':'apartment','דירות':'apartments','שיפוץ':'renovation','שיפוצים':'renovation','ריהוט':'furniture','רהיטים':'furniture','עיצוב':'design','גינה':'garden','פרחים':'flowers','פרח':'flower','בנייה':'construction','בניין':'building','משרד':'office','משרדים':'offices',
 'עסק':'business','עסקים':'business','כסף':'money','כספים':'finance','בנק':'bank','הלוואה':'loan','הלוואות':'loans','השקעה':'investment','השקעות':'investments','מניות':'stocks','קריפטו':'crypto','ביטקוין':'bitcoin','ביטוח':'insurance','מס':'tax','מיסים':'taxes','חיסכון':'savings','פנסיה':'retirement','חשבונאות':'accounting','רואה':'accountant','שיווק':'marketing','פרסום':'advertising','מכירות':'sales','קניות':'shopping','חנות':'store','סטארטאפ':'startup','יזם':'entrepreneur','צוות':'team','פגישה':'meeting','כנס':'conference','משפט':'law','משפטים':'law','חוזה':'contract',
 'בריאות':'health','רופא':'doctor','רופאה':'doctor','רפואה':'medicine','תרופות':'medicine','שיניים':'teeth','כושר':'fitness','ספורט':'sport','יוגה':'yoga','ריצה':'running','דיאטה':'diet','תזונה':'nutrition','שינה':'sleep','יופי':'beauty','קוסמטיקה':'cosmetics','שיער':'hair','עור':'skin','אופנה':'fashion','בגדים':'clothes','נעליים':'shoes','תכשיטים':'jewelry',
 'משפחה':'family','ילדים':'children','ילד':'child','תינוק':'baby','תינוקות':'babies','הריון':'pregnancy','הורים':'parents','קשישים':'elderly','זוג':'couple','חתונה':'wedding','נשים':'women','גברים':'men','סטודנטים':'students','חינוך':'education','לימודים':'studying','ספר':'book','ספרים':'books',
 'טכנולוגיה':'technology','מחשב':'computer','מחשבים':'computers','טלפון':'phone','סמארטפון':'smartphone','אינטרנט':'internet','אפליקציה':'app','תוכנה':'software','אבטחה':'security','משחקים':'gaming','מצלמה':'camera','צילום':'photography','רובוט':'robot',
 'רכב':'car','רכבים':'cars','מכונית':'car','אופנוע':'motorcycle','אופניים':'bicycle','תחבורה':'transport','טיסה':'flight','מטוס':'airplane','נסיעה':'travel','טיול':'trip','טיולים':'travel','חופשה':'vacation','מלון':'hotel','מלונות':'hotels',
 'ים':'sea','חוף':'beach','הרים':'mountains','הר':'mountain','טבע':'nature','יער':'forest','מדבר':'desert','עיר':'city','ערים':'cities','ישראל':'israel','ירושלים':'jerusalem','חיפה':'haifa','אילת':'eilat','קיץ':'summer','חורף':'winter','שמש':'sun','גשם':'rain','שלג':'snow',
 'אנרגיה':'energy','חשמל':'electricity','מים':'water','סביבה':'environment','מחזור':'recycling','חג':'holiday','חגים':'holidays','פסח':'passover','חנוכה':'hanukkah','מוזיקה':'music','סרט':'movie','סרטים':'movies','אמנות':'art','קולנוע':'cinema','מתנה':'gift','מתנות':'gifts','סוס':'horse','ציפור':'bird'};
const PREFIXES=['ו','ה','ב','ל','מ','ש','כ'];

function lookupWord(word:string):string{
 const bare=word.replace(/["'״׳]+$/,'');
 if(WORDS[bare])return WORDS[bare];if(PHRASES[bare])return PHRASES[bare];
 // One or two one-letter prefixes: "לכלב" → "כלב", "והבית" → "בית".
 for(let i=1;i<=2&&i<bare.length-1;i++){if(!PREFIXES.includes(bare[i-1]))break;const rest=bare.slice(i);if(WORDS[rest])return WORDS[rest];if(PHRASES[rest])return PHRASES[rest];}
 return '';
}

// Dictionary path: Hebrew phrases and words become English, English stays as written, unknown Hebrew words are dropped.
// Returns '' when no Hebrew word was recognised (the caller then searches the text as written).
export function dictionaryQuery(raw:string):string{
 let text=` ${clean(raw)} `;const parts:string[]=[];let matched=false;
 for(const [he,en] of Object.entries(PHRASES).sort((a,b)=>b[0].length-a[0].length)){
  const re=new RegExp(`(^|[\\s\\-])[ובלמשכה]{0,2}${he.replace(/["'״]/g,'["\'״]')}(?=$|[\\s\\-.,!?])`,'g');
  if(re.test(text)){text=text.replace(re,` ${en} `);matched=true;}
 }
 for(const token of text.split(/[\s\-–—/,.;:!?()]+/).filter(Boolean)){
  if(!hasHebrew(token)){parts.push(token);continue;}
  const words=token.match(HEBREW_WORD)||[];
  for(const w of words){if(w.length<2)continue;const en=lookupWord(w);if(en){parts.push(en);matched=true;}}
  const latin=token.replace(HEBREW_WORD,' ').trim();if(latin&&/[a-z0-9]/i.test(latin))parts.push(latin);
 }
 return matched?clean(parts.join(' ')).slice(0,100):'';
}

type Ai=(prompt:string)=>Promise<string>;
export type EnglishQuery={query:string;translated:boolean;via:'none'|'ai'|'dictionary'|'as_written'};

// Hebrew → English search words. Text with no Hebrew letters is used exactly as written.
export async function englishQuery(raw:string,ai?:Ai|null):Promise<EnglishQuery>{
 const text=clean(raw).slice(0,100);
 if(!hasHebrew(text))return {query:text,translated:false,via:'none'};
 const cacheKey='tr:'+text;
 const cached=await cacheGet(cacheKey,TRANSLATION_CACHE_MS);
 if(cached?.query)return {query:cached.query,translated:true,via:cached.via||'ai'};
 if(ai){
  try{
   const out=await ai(`Turn this stock-photo search into short English search words for an image library. Translate only the Hebrew words; keep any English words exactly as written. No quotes, no explanations. Return JSON only: {"query":"..."}.\nSearch: ${JSON.stringify(text)}`);
   const parsed=JSON.parse(String(out).replace(/^```(?:json)?|```$/g,'').trim());
   const query=clean(String(parsed?.query||'')).replace(/[^\p{L}\p{N}\s'\-&]/gu,' ').replace(/\s+/g,' ').trim().slice(0,100);
   if(query&&!hasHebrew(query)){await cachePut(cacheKey,{query,via:'ai'});return {query,translated:true,via:'ai'};}
  }catch{/* fall back to the dictionary below */}
 }
 const fromDictionary=dictionaryQuery(text);
 if(fromDictionary){await cachePut(cacheKey,{query:fromDictionary,via:'dictionary'});return {query:fromDictionary,translated:true,via:'dictionary'};}
 return {query:text,translated:false,via:'as_written'};
}

// 24-hour cache in D1 (one row per request). Old rows are removed when a new row is written.
export async function cacheGet(key:string,maxAgeMs=SEARCH_CACHE_MS):Promise<any>{
 const row=await one('SELECT data FROM image_search_cache WHERE key=? AND created>?',key,new Date(Date.now()-maxAgeMs).toISOString());
 if(!row)return null;try{return JSON.parse(row.data);}catch{return null;}
}
export async function cachePut(key:string,data:unknown){
 await stmt('INSERT OR REPLACE INTO image_search_cache(key,data,created) VALUES (?,?,?)',key,JSON.stringify(data),now()).run();
 await stmt("DELETE FROM image_search_cache WHERE (key NOT LIKE 'tr:%' AND created<?) OR (key LIKE 'tr:%' AND created<?)",new Date(Date.now()-SEARCH_CACHE_MS).toISOString(),new Date(Date.now()-TRANSLATION_CACHE_MS).toISOString()).run();
}
export async function cacheDrop(key:string){await stmt('DELETE FROM image_search_cache WHERE key=?',key).run();}

export type StockPhoto={id:number;source:'pixabay'|'pexels';src:string;fallbacks?:string[];url:string;photographer:string;width?:number;height?:number;alt?:string};
// Pixabay's public image server keeps a 640px copy next to every 150px preview (…_150.jpg → …_640.jpg). The browser loads
// it straight from there, so a search costs one Pixabay request instead of one per photo (owner 24.11.2026: "שתמיד יוצגו תמונות").
export const pixabayCdn640=(preview:string)=>{try{const u=new URL(preview);if(u.protocol!=='https:'||u.hostname!=='cdn.pixabay.com'||!/_150\.(jpe?g|png)$/i.test(u.pathname))return '';u.pathname=u.pathname.replace(/_150\.(jpe?g|png)$/i,'_640.$1');return u.href;}catch{return '';}};

async function pixabayFailure(res:Response|number):Promise<never>{
 const status=typeof res==='number'?res:res.status;
 // Server log for diagnosis (never the key): Pixabay's status and the start of its answer.
 if(typeof res!=='number'){const text=await res.text().catch(()=>'');console.warn('pixabay request failed',status,text.slice(0,200).replace(/key=[^&\s]+/g,'key=…'));}
 // The customer sees a plain message; the admin checks the key with "בדיקה" in חיבורים והגדרות.
 throw new ApiError(status===429?429:502,status===429?'מאגר התמונות עמוס כרגע. נסו שוב בעוד דקה.':'מאגר התמונות Pixabay אינו זמין כרגע. אפשר להעלות תמונה מהמכשיר או לנסות שוב מאוחר יותר.');
}
const pixabayParams=(key:string,extra:Record<string,string>)=>PIXABAY_API+'?'+new URLSearchParams({key,...extra}).toString();

export async function pixabaySearch(key:string,query:string):Promise<StockPhoto[]>{
 const q=clean(query).toLowerCase().slice(0,100);
 const cacheKey='pixabay:s2:'+q;
 const cached=await cacheGet(cacheKey);
 if(Array.isArray(cached))return cached;
 const ask=()=>externalFetch(pixabayParams(key,{q,lang:'en',image_type:'photo',orientation:'horizontal',safesearch:'true',per_page:'30'}),{});
 let res=await ask();
 // Pixabay allows a limited number of requests a minute: when it says so, wait a moment and ask once more.
 if(res.status===429){await res.text().catch(()=>'');await new Promise(r=>setTimeout(r,2500));res=await ask();}
 if(!res.ok)await pixabayFailure(res);
 const payload:any=await res.json().catch(()=>null);
 if(!payload||!Array.isArray(payload.hits))await pixabayFailure(502);
 const photos:StockPhoto[]=payload.hits.slice(0,30).filter((h:any)=>Number.isSafeInteger(Number(h?.id))&&(h.webformatURL||h.previewURL)).map((h:any)=>{
  // Each preview has fallbacks: the public 640px copy, then the 150px preview, then Pixabay's own address (through our server).
  const preview=String(h.previewURL||''),list=[pixabayCdn640(preview),preview,String(h.webformatURL||'')].filter((v,i,a)=>v&&pixabayImageHost(v)&&a.indexOf(v)===i);
  return {id:Number(h.id),source:'pixabay' as const,src:list[0],fallbacks:list.slice(1),url:String(h.pageURL||''),photographer:String(h.user||'Pixabay').slice(0,120),width:Number(h.webformatWidth)||undefined,height:Number(h.webformatHeight)||undefined,alt:String(h.tags||'').slice(0,200)};}).filter((p:StockPhoto)=>p.src);
 await cachePut(cacheKey,photos);
 // Keep each result's download details too, so choosing a photo needs no second request to Pixabay (one statement for all hits).
 const byId=payload.hits.slice(0,30).filter((h:any)=>Number.isSafeInteger(Number(h?.id))&&(h.largeImageURL||h.webformatURL)).map((h:any)=>({id:Number(h.id),largeImageURL:String(h.largeImageURL||h.webformatURL),pageURL:String(h.pageURL||''),user:String(h.user||'Pixabay').slice(0,120)}));
 if(byId.length)await stmt("INSERT OR REPLACE INTO image_search_cache(key,data,created) SELECT 'pixabay:id:'||json_extract(value,'$.id'),value,? FROM json_each(?)",now(),JSON.stringify(byId)).run();
 return photos;
}

// Few results for a long phrase: search again with fewer words and add what is new (at most one more request).
export async function pixabaySearchBroad(key:string,query:string):Promise<StockPhoto[]>{
 const photos=await pixabaySearch(key,query),words=clean(query).split(' ').filter(Boolean);
 if(photos.length>=8||words.length<2)return photos;
 const wider=await pixabaySearch(key,words.slice(0,words.length>2?2:1).join(' ')).catch(()=>[] as StockPhoto[]);
 const seen=new Set(photos.map(p=>p.id));return [...photos,...wider.filter(p=>!seen.has(p.id))].slice(0,30);
}

// One photo by id (cached like a search). `fresh` skips the cache when a cached download address has expired.
export async function pixabayPhoto(key:string,id:number,fresh=false):Promise<{hit:any;cached:boolean}>{
 const cacheKey='pixabay:id:'+id;
 if(!fresh){const cached=await cacheGet(cacheKey);if(cached?.id)return {hit:cached,cached:true};}
 const res=await externalFetch(pixabayParams(key,{id:String(id)}),{});
 if(res.status===400||res.status===404){const text=await res.text().catch(()=>'');if(!/key/i.test(text))throw new ApiError(404,'התמונה לא נמצאה במאגר');await pixabayFailure(400);}
 if(!res.ok)await pixabayFailure(res);
 const payload:any=await res.json().catch(()=>null);const hit=payload?.hits?.[0];
 if(!hit||Number(hit.id)!==id)throw new ApiError(404,'התמונה לא נמצאה במאגר');
 const stored={id:Number(hit.id),largeImageURL:String(hit.largeImageURL||hit.webformatURL||''),pageURL:String(hit.pageURL||''),user:String(hit.user||'Pixabay').slice(0,120)};
 await cachePut(cacheKey,stored);
 return {hit:stored,cached:false};
}

export const pixabayImageHost=(href:string)=>{try{const u=new URL(href);return u.protocol==='https:'&&['pixabay.com','cdn.pixabay.com'].includes(u.hostname);}catch{return false;}};

// Pixabay's key check for "בדיקה": the smallest valid request (per_page 3).
export async function pixabayKeyWorks(key:string){
 const res=await externalFetch(pixabayParams(key,{q:'test',per_page:'3',safesearch:'true'}),{});
 return res.ok;
}
