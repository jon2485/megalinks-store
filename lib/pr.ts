// PR articles page (owner, 17.11.2026; spec design/pr-page/spec.md). A PR article is an ordinary publication with one
// difference: instead of a written brief, a professional interviewer calls the customer, and one interview can feed
// several articles, each written differently. The interview service has a fixed price per article.
import {all,one,ApiError} from './server';
import {pricedSite} from './pricing';
import {liveSites} from './site-archive';
import type {Row} from './shared';

/** 499 ₪ before VAT for a professional phone interview article, one revision round included (owner, 17.11.2026). */
export const PR_INTERVIEW_CENTS=49900;
export const PR_CONTENT_TYPE='pr_interview';
export const PR_DAYS=['א׳','ב׳','ג׳','ד׳','ה׳','ו׳'] as const;
export const PR_HOURS=[['morning','בוקר 9-12'],['noon','צהריים 12-15'],['afternoon','אחה״צ 15-18'],['evening','ערב 18-20']] as const;
export const PR_MAX_SITES=6;

export type PrInterview={business_name:string;contact_name:string;phone:string;link:string;days:string[];hours:string[];topic:string};

const text=(value:unknown,max:number)=>String(value??'').replace(/\s+/g,' ').trim().slice(0,max);
function link(value:unknown){
 const raw=text(value,500);if(!raw)return '';
 try{const url=new URL(/^https?:\/\//i.test(raw)?raw:'https://'+raw);return ['http:','https:'].includes(url.protocol)&&url.hostname.includes('.')?url.href:'';}catch{return '';}
}
/** Israeli phone numbers: 9-10 digits starting with 0, or +972 without the leading 0. Dashes and spaces are allowed. */
export function prPhone(value:unknown){
 const raw=text(value,30),digits=raw.replace(/[\s\-()]/g,'');
 if(/^0\d{8,9}$/.test(digits))return digits;
 if(/^\+972\d{8,9}$/.test(digits))return '0'+digits.slice(4);
 return '';
}
/** The interview details the customer leaves on the PR page. Throws a Hebrew 400 error when something required is missing. */
export function validInterview(input:unknown):PrInterview{
 const b=(input&&typeof input==='object'?input:{}) as Row;
 const days=(Array.isArray(b.days)?b.days:[]).map(String).filter((d:string)=>(PR_DAYS as readonly string[]).includes(d));
 const hours=(Array.isArray(b.hours)?b.hours:[]).map(String).filter((h:string)=>PR_HOURS.some(([id])=>id===h));
 const d:PrInterview={business_name:text(b.business_name,120),contact_name:text(b.contact_name,120),phone:prPhone(b.phone),link:link(b.link),days:[...new Set(days)],hours:[...new Set(hours)],topic:text(b.topic,600)};
 const fail=(message:string)=>{throw new ApiError(400,message);};
 if(!d.business_name)fail('יש להזין את שם העסק');
 if(!d.contact_name)fail('יש להזין את שם איש הקשר');
 if(!d.phone)fail('יש להזין מספר טלפון תקין, למשל 050-1234567');
 if(!d.link)fail('יש להזין קישור לאתר או לדף העסק');
 if(!d.days.length)fail('יש לבחור לפחות יום אחד שנוח לשיחה');
 if(!d.hours.length)fail('יש לבחור לפחות טווח שעות אחד');
 return d;
}
export const prHoursLabel=(ids:string[])=>ids.map(id=>PR_HOURS.find(([key])=>key===id)?.[1]||'').filter(Boolean).join(' · ');

// Until the owner picks the sites for this page (spec 3.2), the page shows the live catalog, and these lines describe the
// sites that are in it today. A description saved on the site (data.pr_description) always wins. Size wording is general
// on purpose (owner, 17.11.2026): third-party traffic estimates differ too much for one number.
const DEFAULT_DESCRIPTIONS:Record<string,string>={
 'ynet.co.il':'אתר החדשות של ידיעות אחרונות, אתר החדשות הנצפה בישראל, עם עשרות מיליוני כניסות בחודש.',
 'mako.co.il':'אתר החדשות והבידור של קשת 12, מהאתרים הגדולים בישראל, עם עשרות מיליוני כניסות בחודש.',
 'globes.co.il':'עיתון העסקים והכלכלה של ישראל, עם מיליוני כניסות בחודש.',
};
const KINDS:Record<string,string>={news_national:'חדשות',news_local:'חדשות מקומיות',finance:'כלכלה ועסקים',business:'עסקים',tech:'טכנולוגיה',magazines:'מגזין',lifestyle:'לייף סטייל',health:'בריאות',sport:'ספורט',food:'אוכל',travel:'תיירות'};
const DEFAULT_KINDS:Record<string,string>={'ynet.co.il':'חדשות','mako.co.il':'חדשות ובידור','globes.co.il':'כלכלה ועסקים'};
export const prHost=(url:string)=>{try{return new URL(url).hostname.replace(/^www\./,'');}catch{return String(url||'').replace(/^https?:\/\//,'').replace(/^www\./,'').split('/')[0];}};
const safeUrl=(value:unknown)=>{const v=String(value||'');return /^https?:\/\/[^\s"'<>]+$/i.test(v)?v:'';};

/** A public, read-only view of a site for the PR page. Never costs, suppliers, stock or customer prices. */
export type PrSite={id:string;name:string;url:string;host:string;kind:string;description:string;dr:number|null;ur:number|null;link:boolean;days:number|null;note:string;logo:string;image:string;sample:string;sample_is_placeholder:boolean;publication_cents:number;total_cents:number};

/** Sites for the PR page: the ones the owner marked (data.pr_featured, ordered by data.pr_order), or, while none is marked,
 *  the live catalog's active sites, up to 6, strongest first (owner, 17.11.2026: "כרגע תציג רק מה שיש באתר"). */
export async function prSites():Promise<PrSite[]>{
 const [rows,tier,overrides]=await Promise.all([
  all(`SELECT id,name,url,category,dr,active,price,data FROM websites WHERE active=1 AND ${liveSites} ORDER BY dr DESC,name LIMIT 200`),
  one("SELECT * FROM pricing_tiers WHERE id='regular'"),
  all("SELECT website_id,price,scope,owner_id FROM pricing_overrides WHERE scope='tier' AND owner_id='regular'"),
 ]);
 if(!tier)return [];
 const sites=rows.map(row=>({row,data:JSON.parse(String(row.data||'{}')) as Row}));
 const featured=sites.filter(s=>s.data.pr_featured===true||s.data.pr_featured===1).sort((a,b)=>(Number(a.data.pr_order)||99)-(Number(b.data.pr_order)||99));
 const chosen=(featured.length?featured:sites).slice(0,PR_MAX_SITES);
 return chosen.map(({row,data})=>{
  const priced=pricedSite(row,{tier,overrides} as any),host=prHost(String(row.url)),publication=Number(priced.price_cents)||0;
  const features=Array.isArray(data.features)?data.features.map(String):[];
  const example=Array.isArray(data.example_articles)?data.example_articles.map((x:any)=>typeof x==='string'?x:x?.url).map(safeUrl).find(Boolean):'';
  const sample=safeUrl(data.pr_sample_url)||example||'';
  return {id:String(row.id),name:String(row.name),url:safeUrl(row.url)||'https://'+host,host,
   kind:text(data.pr_kind,40)||DEFAULT_KINDS[host]||KINDS[String(row.category)]||'',
   description:text(data.pr_description,400)||DEFAULT_DESCRIPTIONS[host]||'',
   dr:row.dr==null?null:Number(row.dr),ur:data.ur==null||data.ur===''?null:Number(data.ur),
   link:features.some(f=>/follow/i.test(f)),days:Number(data.turnaround_days)>0?Number(data.turnaround_days):null,
   note:text(data.public_notes,300),logo:safeUrl(data.logo_url),image:safeUrl(data.pr_image_url),
   // A placeholder until the owner adds real PR sample articles (owner, 17.11.2026: "כרגע תשים קישור דמה").
   sample:sample||safeUrl(row.url)||'https://'+host,sample_is_placeholder:!sample,
   publication_cents:publication,total_cents:publication+PR_INTERVIEW_CENTS};
 });
}
