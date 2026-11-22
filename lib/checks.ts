import { assert, externalUrl, now, stmt, one, mapIn } from './server';
import { Row, plainText } from './shared';
import { inlineImages } from './rich-content';
const publicUrl=(value:string)=>{const url=new URL(value);assert(['http:','https:'].includes(url.protocol),'כתובת לא תקינה');const check=new URL(url);check.protocol='https:';externalUrl(check.href);return url;};
const bareHost=(s:string)=>{try{return new URL(s).hostname.toLowerCase().replace(/^www\./,'');}catch{return '';}};

// Owner report (22.11.2026): a real site behind Cloudflare answered a plain server fetch only after 8 s, so the old
// check timed out and said "the site did not answer" before it ever looked at the page. The page is now fetched once,
// like a browser (headers, no Range), up to 15 s, with one retry when the site does not answer or the network fails.
export const BROWSER_HEADERS:Record<string,string>={
 'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
 'Accept':'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
 'Accept-Language':'he-IL,he;q=0.9,en-US;q=0.7,en;q=0.6',
};
export const PAGE_TIMEOUT_MS=15000;
// Why a link was refused. "unreachable" and "blocked" are on the site's or our side, not a wrong link.
export type LinkReason='invalid'|'domain'|'redirect'|'unreachable'|'blocked'|'not_found'|'http'|'links'|'topic';
type Opened={ok:true,res:Response,url:URL}|{ok:false,reason:LinkReason,message:string,status?:number};
const messages={
 invalid:'נדרשת כתובת HTTP או HTTPS ציבורית תקינה',
 unreachable:'האתר לא ענה לבדיקה שלנו בזמן. זו תקלה טכנית בבדיקה, לא בעיה בקישור. נסו שוב בעוד כמה דקות.',
 redirects:'הקישור מעביר יותר מדי פעמים לכתובות אחרות. שלחו את הכתובת הסופית של הכתבה.',
 badRedirect:'הקישור מעביר לכתובת לא תקינה. שלחו את הכתובת הישירה של הכתבה.',
};
const otherDomain=(found:string,expected:string,redirect=false)=>(redirect?'הקישור מעביר לאתר אחר':'הקישור הוא לאתר אחר')+(found?' ('+found+')':'')+'. יש לשלוח קישור לכתבה באתר '+bareHost(expected)+'.';
// "published": the supplier's page, where the article itself must already be online.
const httpMessage=(status:number,published=false):{reason:LinkReason,message:string}=>
 status===404||status===410?{reason:'not_found',message:`הדף לא נמצא באתר (שגיאה ${status}). בדקו שהקישור הועתק במלואו${published?' ושהכתבה כבר פורסמה':''}.`}:
 [401,403,429].includes(status)?{reason:'blocked',message:`האתר לא אפשר לנו לבדוק את הדף (שגיאה ${status}). זו לא בעיה בקישור. נסו שוב בעוד כמה דקות.`}:
 status>=500?{reason:'http',message:`האתר החזיר שגיאת שרת (שגיאה ${status}). נסו שוב בעוד כמה דקות.`}:
 {reason:'http',message:`הדף לא נפתח (שגיאה ${status}). בדקו שהכתובת נכונה${published?' ושהכתבה פורסמה':''}.`};
// One request, and one retry when the site does not answer in time or the connection fails (an HTTP answer is final).
async function fetchPage(href:string){
 for(let attempt=0;;attempt++){
  try{return await fetch(href,{method:'GET',redirect:'manual',headers:BROWSER_HEADERS,signal:AbortSignal.timeout(PAGE_TIMEOUT_MS)});}
  catch(error){if(attempt>=1)throw error;}
 }
}
// Opens the page, following up to 3 redirects that stay on public addresses and on the expected site.
async function openPage(value:string,expectedDomain='',published=false):Promise<Opened>{
 let url:URL;try{url=publicUrl(value);}catch{return {ok:false,reason:'invalid',message:messages.invalid};}
 if(expectedDomain&&bareHost(url.href)!==bareHost(expectedDomain))return {ok:false,reason:'domain',message:otherDomain(bareHost(url.href),expectedDomain)};
 for(let redirects=0;redirects<4;redirects++){
  let res:Response;try{res=await fetchPage(url.href);}catch{return {ok:false,reason:'unreachable',message:messages.unreachable};}
  if(res.status>=300&&res.status<400){
   await res.body?.cancel();const next=res.headers.get('location');if(!next)return {ok:false,status:res.status,...httpMessage(res.status,published)};
   try{url=publicUrl(new URL(next,url).href);}catch{return {ok:false,reason:'redirect',message:messages.badRedirect};}
   if(expectedDomain&&bareHost(url.href)!==bareHost(expectedDomain))return {ok:false,reason:'domain',message:otherDomain(bareHost(url.href),expectedDomain,true)};
   continue;
  }
  if(res.status<200||res.status>=300){await res.body?.cancel();return {ok:false,status:res.status,...httpMessage(res.status,published)};}
  return {ok:true,res,url};
 }
 return {ok:false,reason:'redirect',message:messages.redirects};
}
export async function checkLink(value:string, expectedDomain='') {
 const page=await openPage(value,expectedDomain);
 if(!page.ok)return {url:value,ok:false,status:page.status,reason:page.reason,message:page.message};
 await page.res.body?.cancel();
 return {url:value,final_url:page.url.href,ok:true,status:page.res.status,message:'הקישור נגיש'};
}
export async function articleChecks(a:Row) {
    const errors:string[]=[];const data=typeof a.data==='string'?JSON.parse(a.data):a.data||{};
    if(!a.title?.trim())errors.push('חסרה כותרת');if(!plainText(a.content||'').trim())errors.push('חסר גוף מאמר');
    if(data.image_id&&!data.image_credit?.trim())errors.push('יש להוסיף קרדיט לתמונה הראשית');
    if(data.secondary_image_id&&!data.secondary_image_credit?.trim())errors.push('יש להוסיף קרדיט לתמונה המשנית');
    const embedded=await inlineImages(a.content||'');if(embedded.length>10)errors.push('מותר עד 10 תמונות בתוך המאמר');for(const image of embedded)if(!image.credit)errors.push('חסר קרדיט לתמונה בתוך המאמר');
    let imageBytes=0;const imageIds=new Set<string>(embedded.map(i=>i.id));for(const key of ['image_id','secondary_image_id']){if(data[key])imageIds.add(data[key]);}const imageFiles=await mapIn('files','id',[...imageIds]);for(const id of imageIds){const file=imageFiles.get(String(id));if(!file||!file.type.startsWith('image/'))errors.push('יש לצרף קובץ תמונה תקין');else imageBytes+=file.size;}if(imageBytes>12*1024*1024)errors.push('התמונות יחד גדולות מ־12MB. הקטינו אותן לפני שליחה');
    const urls:string[]=[];await new HTMLRewriter().on('a[href]',{element(el:any){const href=el.getAttribute('href');if(href&&!urls.includes(href))urls.push(href);}}).transform(new Response(a.content||'')).text();
    if(!urls.length)errors.push('חובה להוסיף לפחות קישור אחד בתוך גוף המאמר');if(urls.length>10)errors.push('ניתן לבדוק עד 10 קישורים במאמר');
    const links=await Promise.all(urls.slice(0,10).map(url=>checkLink(url)));for(const l of links)if(!l.ok)errors.push(l.url+': '+l.message);
    const validation={checked_at:now(),article_version:a.version,ok:!errors.length,errors,links};
    await stmt('UPDATE articles SET data=json_set(data,?,json(?)) WHERE id=? AND version=?','$.validation',JSON.stringify(validation),a.id,a.version).run();return validation;
}

// Owner rule (11.11.2026): a supplier's link is accepted only when the page opens, it holds the links that were
// sent in the article, and its topic matches the article title. Otherwise the supplier sees what is wrong.
const normalLink=(value:string,base?:string)=>{try{const u=new URL(value,base);if(!['http:','https:'].includes(u.protocol))return '';const params=[...u.searchParams].filter(([k])=>!/^(utm_|fbclid$|gclid$)/i.test(k)).sort(([a],[b])=>a.localeCompare(b));const query=params.length?'?'+new URLSearchParams(params).toString():'';return u.hostname.toLowerCase().replace(/^www\./,'')+(decodeURI(u.pathname).replace(/\/+$/,'')||'')+query;}catch{return '';}};
const titleWords=(text:string)=>String(text||'').replace(/&[a-z#0-9]+;/gi,' ').replace(/[֑-ׇ]/g,'').toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(w=>w.length>=2);
export function topicMatch(articleTitle:string,pageTitles:string[],bodyText:string){
 const wanted=[...new Set(titleWords(articleTitle))];if(!wanted.length)return true;
 const share=(text:string)=>{const have=new Set(titleWords(text));return wanted.filter(w=>have.has(w)).length/wanted.length;};
 return Math.max(0,...pageTitles.map(share))>=0.6||share(bodyText)>=0.8;
}
// The first readable title found on the page (og:title, <title> or <h1>), for the "another article" message.
const pageTitle=(titles:string[])=>titles.map(t=>t.replace(/&quot;/g,'"').replace(/&#0?39;|&apos;/g,"'").replace(/&amp;/g,'&').replace(/&#8211;|&ndash;/g,'–').replace(/&[a-z#0-9]+;/gi,' ').replace(/\s+/g,' ').trim()).find(Boolean)?.slice(0,160)||'';
export async function verifyPublishedArticle(value:string,siteUrl:string,article:Row){
 const page=await openPage(value,siteUrl,true);
 if(!page.ok)return {url:value,ok:false,status:page.status,reason:page.reason,message:page.message};
 const final=page.url.href,first={url:value,final_url:final,status:page.res.status};
 let html='';
 try{const reader=page.res.body?.getReader(),decoder=new TextDecoder();let size=0;
  while(reader){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;html+=decoder.decode(part.value,{stream:true});if(size>3_000_000){await reader.cancel();break;}}
 }catch{return {...first,ok:false,reason:'unreachable' as LinkReason,message:messages.unreachable};}
 const pageLinks=new Set<string>(),titles:string[]=[];let body='',current:'title'|'h1'|'',buffer='';
 await new HTMLRewriter()
  .on('a[href]',{element(el:any){const href=normalLink(el.getAttribute('href')||'',final);if(href)pageLinks.add(href);}})
  .on('meta[property="og:title"]',{element(el:any){titles.push(el.getAttribute('content')||'');}})
  .on('title',{element(el:any){current='title';buffer='';el.onEndTag?.(()=>{titles.push(buffer);current='';});},text(t:any){if(current)buffer+=t.text;}})
  .on('h1',{element(el:any){current='h1';buffer='';el.onEndTag?.(()=>{titles.push(buffer);current='';});},text(t:any){if(current)buffer+=t.text;}})
  .on('body',{text(t:any){if(body.length<400000)body+=t.text+' ';}})
  .transform(new Response(html)).text();
 const sent:string[]=[];await new HTMLRewriter().on('a[href]',{element(el:any){const href=el.getAttribute('href')||'';if(/^https?:/i.test(href)&&!sent.includes(href))sent.push(href);}}).transform(new Response(article.content||'')).text();
 // The topic is checked first: a page of another article lacks the links too, and "another article" is the real cause.
 const articleTitle=String(article.title||'').trim();
 if(!topicMatch(articleTitle,titles,body)){const seen=pageTitle(titles);return {...first,ok:false,reason:'topic' as LinkReason,message:'נראה שהקישור מוביל לכתבה אחרת.'+(seen?' כותרת הדף שמצאנו: "'+seen+'".':'')+' הכתבה שצריך לפרסם: "'+articleTitle.slice(0,200)+'". בדקו שהדבקתם את הקישור הנכון.'};}
 const missing=sent.filter(href=>{const n=normalLink(href);return n&&!pageLinks.has(n);});
 if(missing.length)return {...first,ok:false,reason:'links' as LinkReason,message:(missing.length===1?'לא מצאנו בדף את הקישור שהיה בכתבה: ':'לא מצאנו בדף את הקישורים שהיו בכתבה: ')+missing.join(' , ')+'. יש לוודא שהקישורים פורסמו בדיוק כמו שנשלחו.'};
 return {...first,ok:true,message:'הקישור נבדק: הדף נפתח, הקישורים קיימים והנושא תואם',links_checked:sent.length};
}
