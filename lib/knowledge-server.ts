import {publicationDay,validPublicationDay,israelDayStart} from './publication-date';
import {env} from 'cloudflare:workers';
import {all,one,stmt,admin,actor,assert,ApiError,uid,now} from './server';
import {editorialTags,blockedEditorialTags,safeEditorialStyle,editorialUrl} from './editor-html';
import {knowledgeSummary,knowledgeText,type KnowledgeArticle} from './knowledge';
import type {Row} from './shared';

const jsonResponse=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
const imageId=(src:string)=>/^\/api\/knowledge-media\/([a-f\d-]{36})$/i.exec(src)?.[1]||'';
const staticImage=(src:string)=>/^\/brand\/knowledge\/(publication|budget|brief|strategy|metrics)\.webp$/.test(src);
export async function sanitizeKnowledgeContent(input:string){
 const images=new Set<string>();
 const content=await new HTMLRewriter().on('*',{element(el:any){
  const tag=el.tagName;if(blockedEditorialTags.has(tag)){el.remove();return;}if(!editorialTags.has(tag)){el.removeAndKeepContent();return;}
  const href=editorialUrl(el.getAttribute('href')||''),src=el.getAttribute('src')||'',alt=String(el.getAttribute('alt')||'').slice(0,300),style=safeEditorialStyle(el.getAttribute('style')||'');
  for(const [key] of Array.from(el.attributes as Iterable<[string,string]>))el.removeAttribute(key);
  if(tag==='a'&&href){el.setAttribute('href',href);el.setAttribute('rel','noopener noreferrer');}
  if(tag==='img'){if(!imageId(src)&&!staticImage(src)){el.remove();return;}if(imageId(src))images.add(imageId(src));el.setAttribute('src',src);el.setAttribute('alt',alt);el.setAttribute('loading','lazy');}
  if(style)el.setAttribute('style',style);
 }}).transform(new Response(input)).text();
 return {content,images:[...images]};
}
function project(row:Row,published=false):KnowledgeArticle{
 const value=JSON.parse(published?row.published:row.draft);
 return {...value,id:row.id,slug:row.slug,version:published?0:row.version,updated:published?value.updated:row.updated,publicationDate:value.publicationDate||publicationDay(row.published_at||''),publishedAt:row.published_at,status:row.published?(row.published_at>now()?'scheduled':'published'):'draft'};
}
export async function publishedKnowledge(slug:string){const row=await one('SELECT * FROM knowledge_posts WHERE slug=? AND published IS NOT NULL AND published_at<=?',slug,now());return row?project(row,true):null;}
export async function knowledgeCategories(){return all('SELECT id,name FROM knowledge_categories ORDER BY name') as Promise<{id:string;name:string}[]>;}
export async function publicKnowledgeList(page=1,query='',category=''){
 const needle=query.trim(),where="WHERE published IS NOT NULL AND published_at<=? AND (?='' OR instr(lower(json_extract(published,'$.title')||' '||json_extract(published,'$.excerpt')||' '||json_extract(published,'$.tags')),lower(?))>0) AND (?='' OR EXISTS(SELECT 1 FROM json_each(json_extract(published,'$.categories')) WHERE value=?))";
 const args=[now(),needle,needle,category,category],count=await one('SELECT count(*) AS total FROM knowledge_posts '+where,...args);
 const rows=await all('SELECT id,slug,published,version,published_at FROM knowledge_posts '+where+' ORDER BY published_at DESC,id LIMIT 24 OFFSET ?',...args,(page-1)*24);
 return {articles:rows.map(row=>knowledgeSummary(project(row,true))),total:count?.total||0,page,categories:await knowledgeCategories()};
}
async function fields(b:Row,publish:boolean){
 const text=(key:string,max:number)=>{assert(typeof b[key]==='string'&&b[key].length<=max,'שדה לא תקין: '+key);return b[key].trim();};
 const title=text('title',300),slug=text('slug',120),excerpt=text('excerpt',600),raw=text('content',180000),cover=text('cover',300),coverAlt=text('coverAlt',300),author=text('author',100),seoTitle=text('seoTitle',150),seoDescription=text('seoDescription',350);
 assert(title,'יש להזין כותרת למאמר');assert(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug),'כתובת המאמר יכולה להכיל אותיות באנגלית, מספרים ומקפים');
 assert(Array.isArray(b.categories)&&b.categories.length<=12&&b.categories.every((x:unknown)=>typeof x==='string'),'קטגוריות לא תקינות');
 const categories=[...new Set(b.categories as string[])];const known=await knowledgeCategories();assert(categories.every(id=>known.some(c=>c.id===id)),'אחת הקטגוריות אינה קיימת');
 assert(Array.isArray(b.tags)&&b.tags.length<=12&&b.tags.every((x:unknown)=>typeof x==='string'&&x.length<=60),'תגיות לא תקינות');
 assert(!cover||imageId(cover)||staticImage(cover),'בחרו תמונת שער מהעלאה למדריכים');
 const publicationDate=b.publicationDate===undefined?'':String(b.publicationDate);assert(!publicationDate||validPublicationDay(publicationDate),'מועד הפרסום אינו תקין');
 const safe=await sanitizeKnowledgeContent(raw);const images=[...safe.images,...(imageId(cover)?[imageId(cover)]:[])];
 for(const id of images)assert(await one('SELECT id FROM knowledge_media WHERE id=?',id),'אחת התמונות אינה זמינה');
 if(publish){assert(excerpt,'יש להזין תקציר לפני הפרסום');assert(knowledgeText(safe.content).length>=50,'יש לכתוב את תוכן המאמר לפני הפרסום');assert(categories.length,'בחרו לפחות קטגוריה אחת');assert(cover&&coverAlt,'בחרו תמונת שער והוסיפו תיאור תמונה');}
 return {title,slug,excerpt,publicationDate,content:safe.content,cover,coverAlt,author:author||'צוות MegaLinks',seoTitle,seoDescription,categories,tags:[...new Set((b.tags as string[]).map(x=>x.trim()).filter(Boolean))],featured:b.featured===true,updated:now()};
}
export async function knowledgePublicRoutes(r:Request,p:string[]){
 if(p[0]==='knowledge'&&r.method==='GET'){
  assert(p.length<=2,'העמוד לא נמצא',404);
  if(p[1]){const article=await publishedKnowledge(decodeURIComponent(p[1]));assert(article,'המאמר לא נמצא',404);return jsonResponse({article});}
  const q=new URL(r.url).searchParams,page=Math.max(1,Math.min(10000,Number(q.get('page'))||1));return jsonResponse(await publicKnowledgeList(Math.floor(page),(q.get('q')||'').slice(0,200),q.get('category')||''));
 }
 if(p[0]==='knowledge-media'&&p[1]&&p.length===2&&r.method==='GET'){
  assert(imageId('/api/knowledge-media/'+p[1]),'התמונה לא נמצאה',404);
  const reference='/api/knowledge-media/'+p[1];
  const published=await one('SELECT id FROM knowledge_posts WHERE published IS NOT NULL AND published_at<=? AND instr(published,?)>0',now(),reference);
  if(!published){let user:Row|undefined;try{user=await actor();}catch(e){if(!(e instanceof ApiError)||e.status!==401)throw e;}assert(user?.role==='admin','התמונה לא נמצאה',404);}
  const media=await one('SELECT * FROM knowledge_media WHERE id=?',p[1]);assert(media,'התמונה לא נמצאה',404);const stored=await env.BUCKET?.get(media.storage_key);assert(stored,'התמונה לא נמצאה',404);
  return new Response(stored.body,{headers:{'Content-Type':media.type,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'"}});
 }
 return null;
}
export async function knowledgeAdminRoutes(r:Request,p:string[],u:Row,json:(r:Request)=>Promise<Row>){
 if(p[0]!=='admin'||p[1]!=='knowledge')return null;
 admin(u);assert(p.length<=3,'הפעולה לא נמצאה',404);const key=p[2];
 if(key==='categories'){
  if(r.method==='GET')return jsonResponse({categories:await knowledgeCategories()});
  if(r.method==='POST'){const b=await json(r),name=String(b.name||'').trim();assert(name&&name.length<=60,'הזינו שם קטגוריה עד 60 תווים');const id=uid();await stmt('INSERT OR IGNORE INTO knowledge_categories(id,name,created) VALUES(?,?,?)',id,name,now()).run();return jsonResponse({category:await one('SELECT id,name FROM knowledge_categories WHERE name=?',name)},201);}
 }
 if(key==='media'&&r.method==='POST'){
  assert(env.BUCKET,'אחסון התמונות אינו זמין',503);assert(Number(r.headers.get('content-length')||0)<=9*1024*1024,'מותר להעלות תמונה עד 8MB',413);
  const form=await r.formData(),f=form.get('file');assert(f instanceof File&&f.size>0&&f.size<=8*1024*1024,'בחרו תמונה עד 8MB');
  assert(['image/jpeg','image/png','image/webp'].includes(f.type),'אפשר להעלות JPG, PNG או WEBP');const bytes=new Uint8Array(await f.arrayBuffer());
  const valid=f.type==='image/png'?bytes.slice(0,8).join(',')==='137,80,78,71,13,10,26,10':f.type==='image/jpeg'?bytes[0]===255&&bytes[1]===216:new TextDecoder().decode(bytes.slice(0,4))==='RIFF'&&new TextDecoder().decode(bytes.slice(8,12))==='WEBP';assert(valid,'תוכן התמונה אינו תואם לסוג הקובץ');
  const id=uid(),storage='knowledge/'+id;await env.BUCKET.put(storage,bytes,{httpMetadata:{contentType:f.type}});
  try{await stmt('INSERT INTO knowledge_media(id,storage_key,type,name,size,created) VALUES(?,?,?,?,?,?)',id,storage,f.type,f.name.slice(0,200),f.size,now()).run();}catch(e){await env.BUCKET.delete(storage);throw e;}
  return jsonResponse({id,url:'/api/knowledge-media/'+id},201);
 }
 if(!key&&r.method==='GET'){
  const q=new URL(r.url).searchParams,page=Math.max(1,Math.floor(Number(q.get('page'))||1)),search=(q.get('q')||'').slice(0,200),status=q.get('status')||'';
  const where="WHERE (?='' OR instr(lower(json_extract(draft,'$.title')),lower(?))>0) AND (?='' OR (?='published' AND published IS NOT NULL AND published_at<=?) OR (?='scheduled' AND published IS NOT NULL AND published_at>?) OR (?='draft' AND published IS NULL))";
  const args=[search,search,status,status,now(),status,now(),status],count=await one('SELECT count(*) AS total FROM knowledge_posts '+where,...args);
  const rows=await all('SELECT * FROM knowledge_posts '+where+' ORDER BY updated DESC,id LIMIT 24 OFFSET ?',...args,(page-1)*24);
  return jsonResponse({articles:rows.map(row=>knowledgeSummary(project(row))),total:count?.total||0,page,categories:await knowledgeCategories()});
 }
 if(key&&r.method==='GET'){const row=await one('SELECT * FROM knowledge_posts WHERE id=?',decodeURIComponent(key));assert(row,'המאמר לא נמצא',404);return jsonResponse({article:project(row),categories:await knowledgeCategories()});}
 if((!key&&r.method==='POST')||(key&&r.method==='PATCH')){
  const b=await json(r),old=key?await one('SELECT * FROM knowledge_posts WHERE id=?',decodeURIComponent(key)):null;if(key)assert(old,'המאמר לא נמצא',404);
  const action=b.action||'save';assert(['save','publish','unpublish'].includes(action),'פעולה לא תקינה');assert(old||action!=='unpublish','יש לשמור את המאמר תחילה');
  if(old)assert(Number.isSafeInteger(b.version)&&b.version===old.version,'המאמר עודכן ממקום אחר. התוכן שלך נשמר במסך; העתיקו אותו ופתחו את הגרסה העדכנית לפני שמירה נוספת.',409);
  const value=await fields(b,action==='publish');if(old)assert(old.slug===value.slug,'כתובת מאמר שנשמר אינה ניתנת לשינוי כדי לשמור על הקישורים');
  const collision=await one('SELECT id FROM knowledge_posts WHERE slug=? AND id<>?',value.slug,old?.id||'');assert(!collision,'כתובת המאמר כבר בשימוש. בחרו כתובת אחרת',409);
  const stamp=now(),id=old?.id||uid(),published=action==='publish'?JSON.stringify(value):action==='unpublish'?null:old?.published||null,publishedAt=action==='publish'?(value.publicationDate?israelDayStart(value.publicationDate):b.publicationDate===undefined?(old?.published_at||stamp):stamp):action==='unpublish'?null:old?.published_at||null;
  if(old){const result=await stmt('UPDATE knowledge_posts SET draft=?,published=?,published_at=?,updated=?,version=version+1 WHERE id=? AND version=?',JSON.stringify(value),published,publishedAt,stamp,id,b.version).run();assert(result.meta.changes===1,'המאמר עודכן ממקום אחר. רעננו לאחר העתקת השינויים שלכם',409);}
  else{try{await stmt('INSERT INTO knowledge_posts(id,slug,draft,published,published_at,version,created,updated) VALUES(?,?,?,?,?,1,?,?)',id,value.slug,JSON.stringify(value),published,publishedAt,stamp,stamp).run();}catch(e){if(await one('SELECT id FROM knowledge_posts WHERE slug=?',value.slug))throw new ApiError(409,'כתובת המאמר כבר בשימוש');throw e;}}
  return jsonResponse({article:project((await one('SELECT * FROM knowledge_posts WHERE id=?',id))!)},old?200:201);
 }
 throw new ApiError(405,'הפעולה אינה זמינה');
}
