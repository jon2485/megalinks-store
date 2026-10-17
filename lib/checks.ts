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
