// Pure helpers of the agency centre, without server imports (used by the server and by tests).
import type {Row} from './shared';
import {writingStyles} from './shared';
import {writingBriefLink} from './writing-brief-validation';

// Who gets the customer management centre. The owner (12.11.2026): for now every customer, not only "סוכנות" accounts.
export const AGENCY_CENTRE_ROLES=['customer','agency'];
export const hasAgencyCentre=(u?:Row|null)=>!!u&&AGENCY_CENTRE_ROLES.includes(String(u.role||''));
// The name on the tab and the page: agencies keep "מרכז הסוכנות", other customers see "ניהול לקוחות".
export const agencyCentreName=(u?:Row|null)=>u?.role==='agency'?'מרכז הסוכנות':'ניהול לקוחות';

export function normalizeDomain(input:unknown){
 let text=String(input??'').trim().toLowerCase().replace(/^[a-z][a-z0-9+.-]*:\/\//,'').replace(/^www\./,'');
 text=text.split(/[\/?#\s]/)[0].replace(/:\d+$/,'').replace(/\.$/,'');
 if(!text||!/^[^\s@]+\.[^\s@.]{2,}$/.test(text)||text.length>253)return '';
 try{text=new URL('http://'+text).hostname.replace(/^www\./,'');}catch{return '';}
 return text;
}

// The money of one article for the agency's reports: what was paid before VAT, minus the parts that were refunded.
// Demo articles and articles of unpaid orders are not spend.
export function articleSpend(a:Row){
 const d=typeof a.data==='string'?JSON.parse(a.data||'{}'):a.data||{};
 if(d.demo||a.status==='demo_completed'||a.status==='demo_paid')return 0;
 if(!(Number(a.paid)||d.on_account))return 0;
 const net=Number(d.paid_net_amount||0),writing=Number(d.writing_net_amount||0),publication=Math.max(0,net-writing);
 if(a.status==='cancelled'&&!d.publication_refunded&&!d.writing_refunded)return 0;
 return (d.publication_refunded?0:publication)+(d.writing_refunded?0:writing);
}

// A site in the "already used" list: its domain, and optionally a section path (e.g. ynet.co.il + /capital).
// An entry with no path covers every catalog site on that domain; an entry with a path covers that section only.
export function usedSiteKey(input:unknown){
 const raw=String(input??'').trim();if(!raw)return null;
 const domain=normalizeDomain(raw);if(!domain)return null;
 let path='';
 try{const url=new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)?raw:'http://'+raw);path=decodeURIComponent(url.pathname).toLowerCase().replace(/\/+$/,'');}catch{}
 // Only a first-level section is kept: an article address like /article/123 is the site itself, not a section.
 const first=path.split('/').filter(Boolean)[0]||'';
 const section=first&&!/^\d+$/.test(first)&&!/^(article|articles|item|news|post|posts|p|story|blog|[a-z]{2})$/.test(first)&&path.split('/').filter(Boolean).length===1?'/'+first:'';
 return {domain,path:section};
}
export function usedSiteMatches(entry:{domain:string;path:string},siteUrl:string){
 const site=usedSiteKey(siteUrl);if(!site||site.domain!==entry.domain)return false;
 return !entry.path||site.path===entry.path;
}
// Splits a pasted list (new lines, commas, semicolons, tabs, spaces) into entries; reports duplicates and bad lines.
export function parseUsedSites(text:string,existing:{domain:string;path:string}[]=[]){
 const seen=new Set(existing.map(e=>e.domain+e.path)),added:{domain:string;path:string}[]=[],invalid:string[]=[];let duplicates=0;
 for(const part of String(text||'').split(/[\n\r,;\t ]+/).map(s=>s.trim()).filter(Boolean).slice(0,10000)){
  const key=usedSiteKey(part);
  if(!key){invalid.push(part.slice(0,120));continue;}
  if(seen.has(key.domain+key.path)){duplicates++;continue;}
  seen.add(key.domain+key.path);added.push(key);
 }
 return {added,duplicates,invalid};
}

// Monthly budget of a customer (spec 5.8), in agorot before VAT: how much of it this month's spend used.
// Below 80% is fine, from 80% it is close, from 100% it is over. No budget set: no line and no alert (null).
export function budgetState(spendCents:unknown,budgetCents:unknown){
 const budget=Math.round(Number(budgetCents)),spend=Math.max(0,Math.round(Number(spendCents)||0));
 if(!Number.isFinite(budget)||budget<=0)return null;
 const level:'ok'|'near'|'over'=spend>=budget?'over':spend*5>=budget*4?'near':'ok';
 return {level,pct:Math.floor(spend*100/budget),spend,budget,label:level==='over'?'חריגה מהתקציב החודשי':level==='near'?'קרוב לתקציב החודשי':''};
}

// A cell of an exported file (CSV, Excel): a value that starts like a formula is written as plain text.
export const safeCell=(v:unknown)=>String(v??'').replace(/^[=+\-@\t\r]/,"'$&");
// ---------- brief defaults of a customer (spec 5.6 and 6.1) ----------
// What the buyer would otherwise retype in every brief for this customer. The limits are the brief's own (validBrief in
// the API route) and the link is checked like the link of a writer's brief. One target link and its anchor for now.
export const BRIEF_DEFAULT_KEYS=['brand','audience','style','keywords','target_url','anchor'] as const;
export const BRIEF_DEFAULT_MAX:Record<string,number>={brand:200,audience:500,style:100,keywords:300,target_url:2000,anchor:200};
// Text only, trimmed and cut to the limit; empty fields are left out. A link that is not a web address is reported and dropped.
export function briefDefaultsInput(input:unknown){
 const src:Row=input&&typeof input==='object'&&!Array.isArray(input)?input as Row:{},values:Record<string,string>={};let error='';
 for(const key of BRIEF_DEFAULT_KEYS){const text=typeof src[key]==='string'?src[key].trim().slice(0,BRIEF_DEFAULT_MAX[key]).trim():'';if(text)values[key]=text;}
 if(values.style&&!writingStyles.includes(values.style))delete values.style;
 if(values.target_url){const link=writingBriefLink(values.target_url);if(link.error){error='קישור היעד: '+link.error;delete values.target_url;}else values.target_url=link.url;}
 return {values,error};
}
// Fills the fields of a brief that are still empty from the customer's defaults. What the buyer typed always stays.
// The anchor belongs to the default link, so it is not put beside another link the buyer typed.
export function fillBriefDefaults(brief:Row,defaults:unknown){
 const d=briefDefaultsInput(defaults).values,has=(key:string)=>!!String(brief?.[key]??'').trim(),out:Row={...brief},filled:string[]=[];
 const ownLink=has('target_url')&&String(brief.target_url).trim()!==d.target_url;
 for(const key of BRIEF_DEFAULT_KEYS){if(!d[key]||has(key)||key==='anchor'&&ownLink)continue;out[key]=d[key];filled.push(key);}
 return {brief:out,filled};
}
// A cart item that moves to another customer: what came from the old customer's defaults is replaced by the new
// customer's (or emptied), and what the buyer typed stays. Returns only the fields that change.
export function moveBriefDefaults(item:Row,from:unknown,to:unknown){
 const old=briefDefaultsInput(from).values,now=(key:string)=>String(item?.[key]??''),cleared:Row={},patch:Row={};
 for(const key of BRIEF_DEFAULT_KEYS)cleared[key]=old[key]&&now(key).trim()===old[key]?'':now(key);
 const next=fillBriefDefaults(cleared,to).brief;
 for(const key of BRIEF_DEFAULT_KEYS)if(next[key]!==now(key))patch[key]=next[key];
 return patch;
}
// Which fields of a brief hold the customer's defaults right now (for the quiet line under a pre-filled brief).
export function briefDefaultsUsed(brief:Row,defaults:unknown){
 const d=briefDefaultsInput(defaults).values;
 return BRIEF_DEFAULT_KEYS.filter(key=>!!d[key]&&String(brief?.[key]??'').trim()===d[key]);
}
