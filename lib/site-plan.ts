// "תוכנית פרסום מהאתר שלכם" (owner 14.11.2026, design/idea-site-plan): the customer gives their website address and gets
// a ready publication plan from the catalog. This file is pure (no server, no network) so it runs in the Worker and in
// the repo tests. First version without AI: the field and the city are found from the site's own words, the sites are
// picked from the catalog by city, field and budget, and the topics come from templates. Nothing here is bought:
// the plan only fills the cart through the regular cart route, at the regular price.
type Row=Record<string,any>;

// ---------- the customer's address ----------
// Only a public web address: http(s), a real host name with a dot, no IP address, no internal names, no password, no
// port other than the default. Returns the normalised URL or an error in plain Hebrew.
export function planUrl(input:unknown):{url:string;host:string}|{error:string}{
 let raw=String(input??'').trim();if(!raw)return {error:'יש להזין את כתובת האתר'};
 if(raw.length>500)return {error:'הכתובת ארוכה מדי'};
 if(!/^[a-z][a-z0-9+.-]*:\/\//i.test(raw))raw='https://'+raw;
 let u:URL;try{u=new URL(raw);}catch{return {error:'הכתובת לא תקינה. למשל: cafe-boker.co.il'};}
 if(!['http:','https:'].includes(u.protocol))return {error:'אפשר להזין רק כתובת של אתר אינטרנט'};
 if(u.username||u.password)return {error:'הכתובת לא תקינה'};
 if(u.port&&!['80','443'].includes(u.port))return {error:'הכתובת לא תקינה'};
 const host=u.hostname.toLowerCase().replace(/\.+$/,'');
 if(!publicHostName(host))return {error:'יש להזין כתובת של אתר ציבורי'};
 u.hash='';return {url:u.href,host};
}
export function publicHostName(host:string){
 const h=String(host||'').toLowerCase().replace(/\.+$/,'');
 if(!h||h.length>253||!h.includes('.')||h.includes(':')||h.startsWith('['))return false;
 if(/^\d+(\.\d+){3}$/.test(h)||/^[\d.]+$/.test(h))return false;
 if(/(^|\.)(localhost|local|internal|intranet|lan|home|corp|arpa|invalid|test|example|onion)$/.test(h))return false;
 return h.split('.').every(part=>/^[a-z0-9-]{1,63}$/.test(part)&&!part.startsWith('-')&&!part.endsWith('-'))||/^xn--/.test(h);
}
// Addresses a public site never has (loopback, private networks, link-local, carrier NAT, multicast, reserved).
export function privateAddress(ip:string){
 const v=String(ip||'').trim().toLowerCase();
 const m=v.match(/^(?:::ffff:)?(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
 if(m){const [a,b]=[Number(m[1]),Number(m[2])];
  return a===0||a===10||a===127||a>=224||(a===100&&b>=64&&b<=127)||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&b===168)||(a===192&&b===0&&Number(m[3])===0)||(a===198&&(b===18||b===19));}
 if(v.includes(':'))return v==='::'||v==='::1'||/^f[cd]/.test(v)||/^fe[89ab]/.test(v)||/^ff/.test(v)||v.startsWith('::ffff:')||v.startsWith('64:ff9b:');
 return true;
}

// ---------- reading one page (no DOM in the Worker: plain, tolerant parsing) ----------
const decode=(s:string)=>String(s||'').replace(/&#x([0-9a-f]+);/gi,(_,h)=>String.fromCodePoint(parseInt(h,16)||32)).replace(/&#(\d+);/g,(_,d)=>String.fromCodePoint(Number(d)||32))
 .replace(/&nbsp;/g,' ').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
const clean=(s:string)=>decode(String(s||'').replace(/<[^>]*>/g,' ')).replace(/\s+/g,' ').trim();
const attr=(tag:string,name:string)=>{const m=tag.match(new RegExp('\\s'+name+'\\s*=\\s*("([^"]*)"|\'([^\']*)\'|([^\\s>]+))','i'));return m?decode(m[2]??m[3]??m[4]??''):'';};
export type SitePage={url:string;title:string;description:string;siteName:string;headings:string[];text:string;links:{url:string;text:string}[];locality:string;ldName:string};
export function readPage(html:string,pageUrl:string):SitePage{
 const src=String(html||'').slice(0,800_000);
 const page:SitePage={url:pageUrl,title:'',description:'',siteName:'',headings:[],text:'',links:[],locality:'',ldName:''};
 // Business details a site states about itself (schema.org), before the scripts are dropped.
 for(const m of src.matchAll(/<script[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi)){
  try{const walk=(x:any):void=>{if(!x||typeof x!=='object')return;if(Array.isArray(x)){x.forEach(walk);return;}
    const types=[].concat(x['@type']||[]).map(String);
    if(types.some(t=>/LocalBusiness|Organization|Restaurant|Store|Cafe|Bakery|Attorney|LegalService|Dentist|MedicalBusiness|RealEstate|Hotel|LodgingBusiness|HealthClub|BeautySalon|AutoRepair|ProfessionalService/i.test(t))){if(!page.ldName&&typeof x.name==='string')page.ldName=x.name.trim().slice(0,80);const a=x.address;const loc=typeof a==='object'&&a?String(a.addressLocality||''):'';if(!page.locality&&loc)page.locality=loc.slice(0,60);}
    if(x['@graph'])walk(x['@graph']);};walk(JSON.parse(m[1].trim()));}catch{}
 }
 const body=src.replace(/<!--[\s\S]*?-->/g,' ').replace(/<(script|style|noscript|svg|template)\b[\s\S]*?<\/\1>/gi,' ');
 page.title=clean((body.match(/<title[^>]*>([\s\S]*?)<\/title>/i)||[])[1]||'').slice(0,200);
 for(const m of body.matchAll(/<meta\b[^>]*>/gi)){const tag=m[0],key=(attr(tag,'name')||attr(tag,'property')).toLowerCase(),content=attr(tag,'content').replace(/\s+/g,' ').trim();
  if(!content)continue;if((key==='description'||key==='og:description')&&!page.description)page.description=content.slice(0,400);if(key==='og:site_name'&&!page.siteName)page.siteName=content.slice(0,80);}
 for(const m of body.matchAll(/<h([1-3])\b[^>]*>([\s\S]*?)<\/h\1>/gi)){const t=clean(m[2]);if(t&&page.headings.length<30)page.headings.push(t.slice(0,160));}
 for(const m of body.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)){if(page.links.length>=300)break;const href=attr('<a '+m[1]+'>','href');if(!href||/^(mailto:|tel:|javascript:|#)/i.test(href))continue;
  try{const u=new URL(href,pageUrl);if(!['http:','https:'].includes(u.protocol))continue;u.hash='';page.links.push({url:u.href,text:clean(m[2]).slice(0,80)||attr('<a '+m[1]+'>','title').slice(0,80)});}catch{}}
 page.text=clean((body.match(/<body\b[^>]*>([\s\S]*)<\/body>/i)||[,body])[1]||'').slice(0,30_000);
 return page;
}

// ---------- which pages to read after the home page, and which to link to ----------
const sameSite=(a:string,b:string)=>{try{return new URL(a).hostname.replace(/^www\./,'')===new URL(b).hostname.replace(/^www\./,'');}catch{return false;}};
const SKIP=/(privacy|terms|policy|cookie|תקנון|מדיניות|פרטיות|נגישות|accessibility|cart|checkout|basket|login|signin|register|account|my-account|wp-admin|wp-login|wp-json|feed|\/tag\/|\/author\/|\/page\/\d|\?|\.(jpe?g|png|gif|webp|svg|pdf|zip|docx?|xlsx?|mp4|mp3)$)/i;
const VALUE=/(שירות|services?|תפריט|menu|מוצר|products?|shop|חנות|קטלוג|catalog|מחיר|prices?|pricing|קורס|courses?|טיפול|treatments?|חדרים|rooms|סוויטות|נכסים|properties|תחומי|practice|מומחיות|פתרונות|solutions|קולקציה|collection)/i;
const ABOUT=/(אודות|about|עלינו|מי אנחנו|הסיפור|our-story|story|team|הצוות)/i;
const CONTACT=/(צור קשר|צרו קשר|contact|יצירת קשר|סניפים|branches|location|מיקום|איך מגיעים)/i;
export function pagesToRead(home:SitePage,max=5){
 const seen=new Set<string>([home.url.replace(/\/$/,'')]),out:{url:string;text:string;kind:'value'|'about'|'contact'}[]=[];
 const list=home.links.filter(l=>sameSite(l.url,home.url)&&!SKIP.test(l.url)&&new URL(l.url).pathname.split('/').filter(Boolean).length<=3);
 const add=(kind:'value'|'about'|'contact',test:RegExp,limit:number)=>{for(const l of list){if(out.length>=max||out.filter(x=>x.kind===kind).length>=limit)return;const key=l.url.replace(/\/$/,'');if(seen.has(key))continue;
  let path='';try{path=decodeURIComponent(new URL(l.url).pathname);}catch{path=l.url;}if(test.test(l.text)||test.test(path)){seen.add(key);out.push({url:l.url,text:l.text,kind});}}};
 add('value',VALUE,3);add('about',ABOUT,1);add('contact',CONTACT,1);add('value',/./,max);
 return out.slice(0,max);
}

// ---------- the field (catalog category) and a short name for what the business is ----------
type Term={term:string;category:string;re:RegExp};
const TERMS:Term[]=[
 {term:'בית קפה',category:'food',re:/בית\s?קפה|בתי\s?קפה|קפה|coffee|caf[eé]|espresso|אספרסו/gi},
 {term:'מאפייה',category:'food',re:/מאפי[יה]|מאפיית|bakery|לחמים|עוגות|קונדיטור/gi},
 {term:'מסעדה',category:'food',re:/מסעד|restaurant|bistro|ביסטרו|שף |ארוחות/gi},
 {term:'קייטרינג',category:'food',re:/קייטרינג|catering/gi},
 {term:'פיצרייה',category:'food',re:/פיצרי|פיצה|pizza/gi},
 {term:'משרד עורכי דין',category:'legal',re:/עורכי\s?דין|עורך\s?דין|עורכת\s?דין|עו["״׳']?ד|law\s?firm|lawyer|attorney|advocate/gi},
 {term:'גישור',category:'legal',re:/גישור|מגשר|mediation/gi},
 {term:'מרפאת שיניים',category:'health',re:/שיניים|רופא\s?שיניים|dental|dentist|אורתודונט/gi},
 {term:'קליניקה',category:'health',re:/קליניק|clinic|פיזיותרפ|physio|דיאטנ|תזונ|רפואה\s?משלימה|דיקור|טיפול\s?רגשי|פסיכולוג/gi},
 {term:'תיווך נדל״ן',category:'real_estate',re:/תיווך|מתווך|נדל["״]?ן|real\s?estate|דירות\s?למכירה|דירות\s?להשכרה/gi},
 {term:'שיפוצים',category:'real_estate',re:/שיפוצ|קבלן\s?שיפוצים|renovation/gi},
 {term:'ייעוץ משכנתאות',category:'finance',re:/משכנת|mortgage/gi},
 {term:'סוכנות ביטוח',category:'finance',re:/ביטוח|insurance/gi},
 {term:'משרד רואי חשבון',category:'finance',re:/רואה\s?חשבון|רואי\s?חשבון|הנהלת\s?חשבונות|accountant|\bcpa\b/gi},
 {term:'ייעוץ פיננסי',category:'finance',re:/השקעות|פיננס|הלוואו?ת|finance|financial/gi},
 {term:'בניית אתרים',category:'tech',re:/בניית\s?אתרים|web\s?design|פיתוח\s?אתרים|פיתוח\s?אפליקצי|תוכנה|software|saas|סייבר|cyber|מחשבים/gi},
 {term:'צימר',category:'tourism',re:/צימר|zimmer|בקתו?ת|בקתה/gi},
 {term:'מלון',category:'tourism',re:/מלון|hotel|בית\s?הארחה|נופש|חופשה|vacation/gi},
 {term:'קורס',category:'education',re:/קורס|courses?|מכללה|college|academy|אקדמי|שיעורים\s?פרטיים|הכנה\s?לבגרות/gi},
 {term:'מכון יופי',category:'lifestyle',re:/קוסמטיק|cosmetic|ציפורניים|לק\s?ג'?ל|גבות|הסרת\s?שיער|beauty|איפור|makeup/gi},
 {term:'מספרה',category:'lifestyle',re:/מספרה|תספורת|hair\s?salon|barber/gi},
 {term:'עיצוב פנים',category:'lifestyle',re:/עיצוב\s?פנים|interior\s?design|מעצבת\s?פנים|מעצב\s?פנים/gi},
 {term:'חנות אופנה',category:'lifestyle',re:/אופנה|fashion|בגדי|clothing|boutique|בוטיק/gi},
 {term:'חדר כושר',category:'sports',re:/חדר\s?כושר|\bgym\b|fitness|כושר|מאמן\s?אישי|crossfit/gi},
 {term:'סטודיו ליוגה',category:'sports',re:/יוגה|yoga|פילאטיס|pilates/gi},
 {term:'הפקת אירועים',category:'entertainment',re:/הפקת\s?אירועים|הפקות|אירועים|events|חתונות|wedding|\bdj\b|די\s?ג'?יי/gi},
 {term:'מוסך',category:'general',re:/מוסך|garage|auto\s?repair|תיקון\s?רכב|פחחות/gi},
];
export const FIELD_LABEL:Record<string,string>={food:'אוכל ומסעדות',legal:'משפט',health:'בריאות',real_estate:'נדל״ן',finance:'כסף וביטוח',tech:'טכנולוגיה',tourism:'תיירות ונופש',education:'לימודים',lifestyle:'לייף סטייל',sports:'ספורט וכושר',entertainment:'בידור ואירועים',business:'עסקים',general:'כללי'};
const count=(text:string,re:RegExp)=>{re.lastIndex=0;return (String(text||'').match(re)||[]).length;};
export function findField(pages:SitePage[]){
 let best:{term:string;category:string;score:number}|null=null;const byCategory:Record<string,number>={};
 for(const t of TERMS){let score=0;for(const p of pages)score+=count(p.title,t.re)*6+count(p.siteName+' '+p.ldName,t.re)*6+count(p.description,t.re)*4+count(p.headings.join(' '),t.re)*2+Math.min(10,count(p.text,t.re));
  byCategory[t.category]=(byCategory[t.category]||0)+score;if(!best||score>best.score)best={term:t.term,category:t.category,score};}
 if(!best||best.score<3)return null;
 return {term:best.term,category:best.category,label:FIELD_LABEL[best.category]||''};
}

// ---------- the city and the region ----------
type Region={key:string;label:string;in:string;words:string[]};
export const REGIONS:Region[]=[
 {key:'north',label:'הצפון',in:'בצפון',words:['צפון','גליל','גולן','העמק','עמק יזרעאל','north','galil','galilee']},
 {key:'haifa',label:'חיפה והקריות',in:'באזור חיפה',words:['קריות','כרמל','krayot','carmel']},
 {key:'sharon',label:'השרון',in:'בשרון',words:['שרון','sharon']},
 {key:'center',label:'המרכז',in:'במרכז',words:['גוש דן','מרכז']},
 {key:'jerusalem',label:'ירושלים והסביבה',in:'באזור ירושלים',words:['ירושלים','jerusalem']},
 {key:'shfela',label:'השפלה',in:'בשפלה',words:['שפלה']},
 {key:'south',label:'הדרום',in:'בדרום',words:['דרום','נגב','south','negev']},
];
type City={name:string;region:string;aliases:string[]};
const C=(name:string,region:string,...aliases:string[]):City=>({name,region,aliases:[name,...aliases]});
export const CITIES:City[]=[
 C('חיפה','haifa','haifa'),C('קרית אתא','haifa','קריית אתא','kiryat ata'),C('קרית ביאליק','haifa','קריית ביאליק','kiryat bialik'),C('קרית מוצקין','haifa','קריית מוצקין','kiryat motzkin'),C('קרית ים','haifa','קריית ים','kiryat yam'),C('נשר','haifa','nesher'),C('טירת כרמל','haifa','tirat carmel'),
 C('נהריה','north','נהרייה','nahariya','nahariyya'),C('עכו','north','akko','acre'),C('כרמיאל','north','karmiel'),C('צפת','north','safed','tzfat'),C('טבריה','north','tiberias'),C('קרית שמונה','north','קריית שמונה','kiryat shmona'),C('עפולה','north','afula'),C('נצרת','north','nazareth'),C('נוף הגליל','north','nof hagalil'),C('יקנעם','north','יוקנעם','yokneam'),C('מגדל העמק','north','migdal haemek'),C('בית שאן','north','beit shean'),C('זכרון יעקב','north','זיכרון יעקב','zichron'),
 C('חדרה','sharon','hadera'),C('נתניה','sharon','netanya'),C('כפר סבא','sharon','kfar saba','kfarsaba'),C('רעננה','sharon','raanana'),C('הוד השרון','sharon','hod hasharon','hodhasharon'),C('הרצליה','sharon','herzliya','herzelia'),C('רמת השרון','sharon','ramat hasharon'),C('כפר יונה','sharon','kfar yona'),C('אבן יהודה','sharon','even yehuda'),C('פרדס חנה','sharon','pardes hana','pardes hanna'),C('קיסריה','sharon','caesarea'),C('אור עקיבא','sharon','or akiva'),
 C('תל אביב','center','תל-אביב','ת"א','ת״א','tel aviv','tel-aviv','telaviv'),C('רמת גן','center','ramat gan','ramatgan'),C('גבעתיים','center','givatayim'),C('בני ברק','center','bnei brak'),C('חולון','center','holon'),C('בת ים','center','bat yam','batyam'),C('פתח תקווה','center','פתח תקוה','פ"ת','petah tikva','petach tikva','petahtikva'),C('ראש העין','center','rosh haayin','rosh-haayin'),C('אור יהודה','center','or yehuda'),C('יהוד','center','yehud'),C('קרית אונו','center','קריית אונו','kiryat ono'),C('אלעד','center','elad'),C('לוד','center','lod'),C('רמלה','center','ramla'),C('מודיעין','center','modiin','modi\'in'),C('שוהם','center','shoham'),
 C('ראשון לציון','shfela','ראשל"צ','rishon','rishon lezion'),C('רחובות','shfela','rehovot'),C('נס ציונה','shfela','ness ziona','nes ziona'),C('יבנה','shfela','yavne'),C('גדרה','shfela','gedera'),
 C('ירושלים','jerusalem','jerusalem'),C('בית שמש','jerusalem','beit shemesh'),C('מעלה אדומים','jerusalem','maale adumim'),C('מבשרת ציון','jerusalem','mevaseret'),
 C('באר שבע','south','ב"ש','beer sheva','beersheba','beer-sheva'),C('אשדוד','south','ashdod'),C('אשקלון','south','ashkelon'),C('קרית גת','south','קריית גת','kiryat gat'),C('דימונה','south','dimona'),C('אילת','south','eilat'),C('נתיבות','south','netivot'),C('שדרות','south','sderot'),C('אופקים','south','ofakim'),C('ערד','south','arad'),
];
const esc=(s:string)=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const HEB=/[\u0590-\u05FF]/;
// A word in Hebrew may carry one or two prefix letters (בחיפה, ומחיפה); English needs word boundaries.
function wordRe(alias:string,flags='g'){return HEB.test(alias)?new RegExp('(?:^|[^\\u0590-\\u05FFA-Za-z0-9])(?:[ובלמהשכ]{0,2})'+esc(alias).replace(/ /g,'[\\s-]')+'(?=$|[^\\u0590-\\u05FFA-Za-z0-9])',flags):new RegExp('(?:^|[^a-z0-9])'+esc(alias.toLowerCase()).replace(/ /g,'[\\s-]?')+'(?=$|[^a-z0-9])',flags+'i');}
const cityRes=new Map<string,RegExp[]>();
const cityPatterns=(c:City)=>{let r=cityRes.get(c.name);if(!r){r=c.aliases.map(a=>wordRe(a));cityRes.set(c.name,r);}return r;};
const hits=(text:string,res:RegExp[])=>res.reduce((n,re)=>{re.lastIndex=0;return n+(String(text||'').match(re)||[]).length;},0);
export function findCity(pages:SitePage[]){
 let best:{city:City;score:number}|null=null;
 for(const c of CITIES){const res=cityPatterns(c);let score=0;
  for(const p of pages)score+=hits(p.locality,res)*12+hits(p.title,res)*5+hits(p.siteName+' '+p.ldName,res)*5+hits(p.description,res)*3+hits(p.headings.join(' '),res)*2+Math.min(8,hits(p.text,res));
  if(score>0&&(!best||score>best.score))best={city:c,score};}
 if(!best||best.score<2)return null;
 const region=REGIONS.find(r=>r.key===best!.city.region)!;
 return {name:best.city.name,region:region.key,region_label:region.label,region_in:region.in};
}
// A catalog site that writes for this city or this region (its name or its address says so).
export function siteCity(site:Row,city:string){const c=CITIES.find(x=>x.name===city);if(!c)return false;const text=String(site.name||'')+' '+hostOf(site.url).replace(/[.-]/g,' ');return hits(text,cityPatterns(c))>0;}
export function siteRegion(site:Row,regionKey:string){
 const text=String(site.name||'')+' '+hostOf(site.url).replace(/[.-]/g,' ');
 if(CITIES.some(c=>c.region===regionKey&&hits(text,cityPatterns(c))>0))return true;
 const r=REGIONS.find(x=>x.key===regionKey);return !!r&&r.words.some(w=>{const re=wordRe(w);re.lastIndex=0;return re.test(text);});
}
const hostOf=(url:string)=>{try{return new URL(/^https?:/i.test(String(url))?String(url):'https://'+url).hostname.replace(/^www\./,'');}catch{return String(url||'');}};

// ---------- the business name ----------
const GENERIC=/^(דף הבית|עמוד הבית|ראשי|בית|home|homepage|home page|welcome|ברוכים הבאים|main|index)$/i;
export function businessName(home:SitePage){
 const pick=(s:string)=>s.replace(/\s+/g,' ').trim().slice(0,60);
 if(home.siteName&&!GENERIC.test(home.siteName.trim()))return pick(home.siteName);
 if(home.ldName&&!GENERIC.test(home.ldName.trim()))return pick(home.ldName);
 const parts=home.title.split(/\s[|·•:\-–—]\s|\s?[|·•]\s?/).map(s=>s.trim()).filter(s=>s&&!GENERIC.test(s));
 if(parts.length){const short=parts.filter(p=>p.split(' ').length<=4);return pick((short.length?short.sort((a,b)=>a.length-b.length)[0]:parts[0]));}
 const label=hostOf(home.url).split('.')[0]||'';return pick(label.replace(/[-_]+/g,' '));
}
const pageName=(p:{title?:string;text?:string},name:string)=>{const t=String(p.title||p.text||'').split(/\s[|·•:\-–—]\s|\s?[|·•]\s?/).map(s=>s.trim()).filter(s=>s&&s!==name&&!GENERIC.test(s));return (t[0]||'').slice(0,60);};

// ---------- the whole site ----------
export type SiteAnalysis={site_url:string;host:string;name:string;field:{term:string;category:string;label:string}|null;city:{name:string;region:string;region_label:string;region_in:string}|null;pages_read:number;targets:{url:string;title:string;kind:string}[]};
export function analyzeSite(home:SitePage,others:(SitePage&{kind?:string})[]):SiteAnalysis{
 const pages=[home,...others],name=businessName(home);
 const targets:{url:string;title:string;kind:string}[]=[];
 for(const p of others.filter(p=>p.kind==='value'))targets.push({url:p.url,title:pageName(p,name),kind:'value'});
 for(const p of others.filter(p=>p.kind==='about'))targets.push({url:p.url,title:pageName(p,name),kind:'about'});
 targets.push({url:home.url,title:'עמוד הבית',kind:'home'});
 return {site_url:home.url,host:hostOf(home.url),name,field:findField(pages),city:findCity(pages),pages_read:pages.length,targets};
}

// ---------- the plan ----------
export type PlanSite={id:string;name:string;url:string;category:string;dr:number;price_cents:number};
type Slot='local'|'region'|'field'|'national'|'general';
export type PlanItem={slot:Slot;website_id:string;name:string;url:string;category:string;dr:number;price_cents:number;why:string;topic:string;target_url:string;anchor:string;alternatives:PlanSite[]};
export type PlanSize={key:'economy'|'balanced'|'strong';label:string;items:PlanItem[];total_cents:number};
const LOCAL_CATS=new Set(['news_local','general','magazines']);
const byCheap=(a:PlanSite,b:PlanSite)=>a.price_cents-b.price_cents||b.dr-a.dr||a.name.localeCompare(b.name);
const byStrong=(a:PlanSite,b:PlanSite)=>b.dr-a.dr||b.price_cents-a.price_cents||a.name.localeCompare(b.name);
export function buildPlan(a:SiteAnalysis,sites:PlanSite[]){
 const live=sites.filter(s=>s&&s.id&&Number.isFinite(s.price_cents)&&s.price_cents>0);
 const city=a.city,field=a.field;
 const local=city?live.filter(s=>LOCAL_CATS.has(s.category)&&siteCity(s,city.name)):[];
 const region=city?live.filter(s=>s.category==='news_local'&&!local.includes(s)&&siteRegion(s,city.region)):[];
 const fieldSites=field&&field.category!=='general'?live.filter(s=>s.category===field.category):[];
 const national=live.filter(s=>s.category==='news_national'||s.category==='magazines');
 const general=live.filter(s=>s.category==='general');
 const pools:Record<Slot,PlanSite[]>={local,region,field:fieldSites,national,general};
 const term=field?.term||a.name,place=city?.name||'',placeIn=city?'ב'+city.name:'';
 const why=(slot:Slot,cheap:boolean)=>{
  const base=slot==='local'?'הקוראים גרים ליד העסק':slot==='region'?'קהל באזור שלכם':slot==='field'?'קוראים שמתעניינים ב'+(field?.label||'תחום שלכם'):slot==='national'?'אתר חזק עם קהל ארצי':'אתר כללי עם קהל רחב';
  return cheap&&slot!=='national'?base+', מחיר נמוך':base;};
 const topicsFor=(slot:Slot):string[]=>{
  if(slot==='local')return city?[`${a.name}: ${term} ${placeIn} שכדאי להכיר`,`המדריך ל${term} ${placeIn}`]:[`${a.name}: ${term} שכדאי להכיר`];
  if(slot==='region')return city?[`הסיפור של ${a.name}, עסק מקומי ${city.region_in}`,`עסקים מקומיים ${city.region_in}: ${a.name}`]:[`הסיפור של ${a.name}`];
  if(slot==='field')return [`5 דברים שכדאי לדעת לפני שבוחרים ${term}`,`טעויות נפוצות בבחירת ${term}, ואיך להימנע מהן`];
  if(slot==='national')return [`שאלות נפוצות על ${term}, ותשובות מאנשי מקצוע`,`מה חשוב לבדוק כשבוחרים ${term}`];
  return [`המדריך ל${term}: איך בוחרים נכון`,`${a.name}: מה כדאי לדעת לפני שפונים`];};
 const anchorsFor=(target:{title:string;kind:string}):string[]=>[city?`${term} ${placeIn}`:term,a.name,target.kind!=='home'?target.title:'',term,city?`${a.name} ${place}`:'',`${term} מקצועי`].filter(Boolean).map(s=>s.slice(0,200));
 const sizes:{key:PlanSize['key'];label:string;cap:number;slots:{slot:Slot;order:'cheap'|'strong';fallback:Slot[]}[]}[]=[
  {key:'economy',label:'חסכונית',cap:30000,slots:[{slot:'local',order:'cheap',fallback:['region','general']},{slot:'field',order:'cheap',fallback:['general','national']}]},
  {key:'balanced',label:'מאוזנת',cap:70000,slots:[{slot:'local',order:'strong',fallback:['region','national']},{slot:'field',order:'strong',fallback:['national','general']},{slot:'region',order:'cheap',fallback:['local','general']}]},
  {key:'strong',label:'חזקה',cap:300000,slots:[{slot:'local',order:'strong',fallback:['region','national']},{slot:'field',order:'strong',fallback:['national','general']},{slot:'national',order:'strong',fallback:['general']}]},
 ];
 return sizes.map(size=>{
  const taken=new Set<string>(),usedTopics=new Set<string>(),usedTargets=new Set<string>(),usedAnchors=new Set<string>(),items:PlanItem[]=[];
  size.slots.forEach((spec,index)=>{
   for(const slot of [spec.slot,...spec.fallback]){
    const pool=pools[slot].filter(s=>!taken.has(s.id)&&s.price_cents<=size.cap).sort(spec.order==='cheap'?byCheap:byStrong);
    if(!pool.length)continue;const pick=pool[0];taken.add(pick.id);
    const target=a.targets.find(t=>!usedTargets.has(t.url))||a.targets[index%a.targets.length];usedTargets.add(target.url);
    const topic=topicsFor(slot).find(t=>!usedTopics.has(t))||topicsFor(slot)[0];usedTopics.add(topic);
    const anchor=anchorsFor(target).find(x=>!usedAnchors.has(x))||a.name;usedAnchors.add(anchor);
    items.push({slot,website_id:pick.id,name:pick.name,url:pick.url,category:pick.category,dr:pick.dr,price_cents:pick.price_cents,why:'',topic,target_url:target.url,anchor,alternatives:pool.slice(1,4)});
    return;
   }
  });
  const cheapest=Math.min(...items.map(i=>i.price_cents));
  for(const i of items)i.why=why(i.slot,items.length>1&&i.price_cents===cheapest&&size.key!=='strong');
  return {key:size.key,label:size.label,items,total_cents:items.reduce((n,i)=>n+i.price_cents,0)} as PlanSize;
 }).filter(s=>s.items.length);
}
