import { assert, externalUrl, now, stmt, one } from './server';
import { Row, plainText } from './shared';
import { inlineImages } from './rich-content';
const publicUrl=(value:string)=>{const url=new URL(value);assert(['http:','https:'].includes(url.protocol),'כתובת לא תקינה');const check=new URL(url);check.protocol='https:';externalUrl(check.href);return url;};
export async function checkLink(value:string, expectedDomain='') {
    let url:URL; try {url=publicUrl(value);}catch{return {url:value,ok:false,message:'נדרשת כתובת HTTP או HTTPS ציבורית תקינה'};}
    const host=(s:string)=>new URL(s).hostname.toLowerCase().replace(/^www\./,'');
    if(expectedDomain && host(url.href)!==host(expectedDomain))return {url:value,ok:false,message:'הקישור אינו שייך לדומיין האתר שנרכש'};
    try {
        for(let redirects=0;redirects<4;redirects++) {
            const res=await fetch(url.href,{method:'GET',redirect:'manual',headers:{Range:'bytes=0-1023'},signal:AbortSignal.timeout(8000)});
            await res.body?.cancel();
            if(res.status>=300&&res.status<400) {const next=res.headers.get('location');if(!next)break;url=publicUrl(new URL(next,url).href);if(expectedDomain&&host(url.href)!==host(expectedDomain))return {url:value,ok:false,message:'ההפניה מובילה לדומיין אחר'};continue;}
            return {url:value,final_url:url.href,ok:res.status>=200&&res.status<300,status:res.status,message:res.status>=200&&res.status<300?'הקישור נגיש':`לא ניתן לאמת את הקישור (HTTP ${res.status})`};
        }
        return {url:value,ok:false,message:'יותר מדי הפניות'};
    } catch{return {url:value,ok:false,message:'האתר לא השיב לבדיקה. נסו שוב או החליפו קישור'};}
}
export async function articleChecks(a:Row) {
    const errors:string[]=[];const data=typeof a.data==='string'?JSON.parse(a.data):a.data||{};
    if(!a.title?.trim())errors.push('חסרה כותרת');if(!plainText(a.content||'').trim())errors.push('חסר גוף מאמר');
    if(data.image_id&&!data.image_credit?.trim())errors.push('יש להוסיף קרדיט לתמונה הראשית');
    if(data.secondary_image_id&&!data.secondary_image_credit?.trim())errors.push('יש להוסיף קרדיט לתמונה המשנית');
    const embedded=await inlineImages(a.content||'');if(embedded.length>10)errors.push('מותר עד 10 תמונות בתוך המאמר');for(const image of embedded)if(!image.credit)errors.push('חסר קרדיט לתמונה בתוך המאמר');
    let imageBytes=0;const imageIds=new Set<string>(embedded.map(i=>i.id));for(const key of ['image_id','secondary_image_id']){if(data[key])imageIds.add(data[key]);}for(const id of imageIds){const file=await one('SELECT type,size FROM files WHERE id=?',id);if(!file||!file.type.startsWith('image/'))errors.push('יש לצרף קובץ תמונה תקין');else imageBytes+=file.size;}if(imageBytes>12*1024*1024)errors.push('התמונות יחד גדולות מ־12MB. הקטינו אותן לפני שליחה');
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
export async function verifyPublishedArticle(value:string,siteUrl:string,article:Row){
 const first=await checkLink(value,siteUrl);if(!first.ok)return first;
 let html='';
 try{const res=await fetch(first.final_url||value,{method:'GET',redirect:'manual',headers:{Accept:'text/html'},signal:AbortSignal.timeout(10000)});
  if(res.status<200||res.status>=300){await res.body?.cancel();return {...first,ok:false,message:`הדף לא נפתח (HTTP ${res.status}). בדקו שהכתובת נכונה ושהכתבה פורסמה.`};}
  const reader=res.body?.getReader(),decoder=new TextDecoder();let size=0;
  while(reader){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;html+=decoder.decode(part.value,{stream:true});if(size>3_000_000){await reader.cancel();break;}}
 }catch{return {...first,ok:false,message:'האתר לא השיב לבדיקה. נסו שוב בעוד כמה דקות.'};}
 const pageLinks=new Set<string>(),titles:string[]=[];let body='',current:'title'|'h1'|'',buffer='';
 await new HTMLRewriter()
  .on('a[href]',{element(el:any){const href=normalLink(el.getAttribute('href')||'',first.final_url||value);if(href)pageLinks.add(href);}})
  .on('meta[property="og:title"]',{element(el:any){titles.push(el.getAttribute('content')||'');}})
  .on('title',{element(el:any){current='title';buffer='';el.onEndTag?.(()=>{titles.push(buffer);current='';});},text(t:any){if(current)buffer+=t.text;}})
  .on('h1',{element(el:any){current='h1';buffer='';el.onEndTag?.(()=>{titles.push(buffer);current='';});},text(t:any){if(current)buffer+=t.text;}})
  .on('body',{text(t:any){if(body.length<400000)body+=t.text+' ';}})
  .transform(new Response(html)).text();
 const sent:string[]=[];await new HTMLRewriter().on('a[href]',{element(el:any){const href=el.getAttribute('href')||'';if(/^https?:/i.test(href)&&!sent.includes(href))sent.push(href);}}).transform(new Response(article.content||'')).text();
 const missing=sent.filter(href=>{const n=normalLink(href);return n&&!pageLinks.has(n);});
 if(missing.length)return {...first,ok:false,message:(missing.length===1?'לא מצאנו בדף את הקישור שהיה בכתבה: ':'לא מצאנו בדף את הקישורים שהיו בכתבה: ')+missing.join(' , ')+'. יש לוודא שהקישורים פורסמו בדיוק כמו שנשלחו.'};
 if(!topicMatch(article.title||'',titles,body)){const seen=titles.map(t=>t.trim()).find(Boolean);return {...first,ok:false,message:'נושא הדף אינו תואם לכתבה שנשלחה'+(seen?' (בדף: "'+seen.slice(0,120)+'")':'')+'. בדקו שזה הקישור לכתבה "'+String(article.title||'').slice(0,120)+'".'};}
 return {...first,ok:true,message:'הקישור נבדק: הדף נפתח, הקישורים קיימים והנושא תואם',links_checked:sent.length};
}
