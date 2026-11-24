import { env } from 'cloudflare:workers';
import {one,all,stmt,db,assert,admin,audit,ApiError} from './server';
import {matchingSignature} from './integrations';
import type {Row} from './shared';

// 24.11.2026 (owner) One-time move of what the real site still lacks from Staging: catalog logos and the knowledge articles
// (with their categories and images). Staging answers /api/export/* read-only, only with POSTFLOW_EXPORT_TOKEN (its gateway
// checks the token too). The real site pulls with the same token from POSTFLOW_STAGING_EXPORT_URL. Nothing is overwritten:
// existing ids are kept as they are.
const UUID=/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
const token=()=>String((env as any).POSTFLOW_EXPORT_TOKEN||'');
const bytesResponse=(body:ReadableStream|ArrayBuffer,type:string)=>new Response(body as BodyInit,{headers:{'Content-Type':type||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});

/** Staging side: read-only export, only with the export token. */
export async function stagingExport(r:Request,p:string[]):Promise<Response|null>{
 if(p[0]!=='export')return null;
 const key=token();assert(r.method==='GET'&&key.length>=32&&matchingSignature(r.headers.get('x-export-token')||'',key),'נדרשת הרשאת שירות',403);
 if(p[1]==='catalog-logo'&&p[2]){assert(UUID.test(p[2]),'לוגו לא נמצא',404);const f=await env.BUCKET?.get('public/catalog-logos/'+p[2]);assert(f,'לוגו לא נמצא',404);return bytesResponse(f.body,f.httpMetadata?.contentType||'');}
 if(p[1]==='knowledge'&&!p[2])return Response.json({categories:await all('SELECT * FROM knowledge_categories'),posts:await all('SELECT * FROM knowledge_posts'),media:await all('SELECT * FROM knowledge_media')},{headers:{'Cache-Control':'no-store'}});
 if(p[1]==='knowledge-media'&&p[2]){assert(UUID.test(p[2]),'התמונה לא נמצאה',404);const m=await one('SELECT * FROM knowledge_media WHERE id=?',p[2]);assert(m,'התמונה לא נמצאה',404);const f=await env.BUCKET?.get(m.storage_key);assert(f,'התמונה לא נמצאה',404);return bytesResponse(f.body,m.type);}
 throw new ApiError(404,'הפעולה לא נמצאה');
}

async function pull(path:string){
 const base=String((env as any).POSTFLOW_STAGING_EXPORT_URL||'').replace(/\/$/,''),key=token();assert(/^https:\/\//.test(base)&&key.length>=32,'הייבוא מ-Staging אינו מוגדר',503);
 const res=await fetch(base+'/api/export/'+path,{headers:{'x-export-token':key},signal:AbortSignal.timeout(30000)});
 if(!res.ok)throw new ApiError(502,'Staging החזיר '+res.status+' עבור '+path);return res;
}

/** Real-site side (admin): part=logos (in batches, from offset), knowledge, or relink (logo links move to this site). */
export async function importFromStaging(r:Request,u:Row,b:Row){
 try{return await runImport(r,u,b);}catch(e){if(e instanceof ApiError)throw e;throw new ApiError(500,'הייבוא נכשל: '+String((e as Error)?.message||e).slice(0,300));}
}
async function runImport(r:Request,u:Row,b:Row){
 admin(u);assert(env.BUCKET,'האחסון אינו זמין',503);const part=String(b.part||'');
 const staging=new URL(String((env as any).POSTFLOW_STAGING_EXPORT_URL||'https://invalid.invalid')).origin,here=new URL(r.url).origin;
 if(part==='logos'){
  const rows=await all("SELECT DISTINCT json_extract(data,'$.logo_url') AS u FROM websites WHERE json_valid(data) AND instr(json_extract(data,'$.logo_url'),?)=1",staging+'/api/catalog-logo/');
  const ids=rows.map(x=>String(x.u).split('/').pop()||'').filter(id=>UUID.test(id)).sort(),offset=Math.max(0,Math.floor(Number(b.offset)||0)),batch=ids.slice(offset,offset+60);
  let copied=0,existing=0;const failed:string[]=[];
  for(const id of batch){const at='public/catalog-logos/'+id;if(await env.BUCKET.head(at)){existing++;continue;}
   try{const res=await pull('catalog-logo/'+id),type=res.headers.get('content-type')||'';assert(/^image\//.test(type),'סוג קובץ לא תקין');await env.BUCKET.put(at,new Uint8Array(await res.arrayBuffer()),{httpMetadata:{contentType:type}});copied++;}catch{failed.push(id);}}
  const next=offset+batch.length;if(next>=ids.length)await audit(u,'staging-import','ייבוא לוגואים מ-Staging',{total:ids.length});
  return {part,total:ids.length,offset,copied,existing,failed,next,done:next>=ids.length};
 }
 if(part==='knowledge'){
  const data:Row=await (await pull('knowledge')).json();let categories=0,media=0,posts=0;const failed:string[]=[];
  if((data.categories||[]).length)categories=(await db().batch((data.categories as Row[]).map(c=>stmt('INSERT OR IGNORE INTO knowledge_categories(id,name,created) VALUES(?,?,?)',c.id,c.name,c.created)))).reduce((n:number,x:any)=>n+(x.meta?.changes||0),0);
  for(const m of data.media||[]){if(!UUID.test(String(m.id)))continue;try{if(!await env.BUCKET.head(m.storage_key)){const res=await pull('knowledge-media/'+m.id);await env.BUCKET.put(m.storage_key,new Uint8Array(await res.arrayBuffer()),{httpMetadata:{contentType:m.type}});}
   const res=await stmt('INSERT OR IGNORE INTO knowledge_media(id,storage_key,type,name,size,created) VALUES(?,?,?,?,?,?)',m.id,m.storage_key,m.type,m.name,m.size,m.created).run();media+=res.meta.changes||0;}catch{failed.push('media:'+m.id);}}
  if((data.posts||[]).length)posts=(await db().batch((data.posts as Row[]).map(x=>stmt('INSERT OR IGNORE INTO knowledge_posts(id,slug,draft,published,published_at,version,created,updated) VALUES(?,?,?,?,?,?,?,?)',x.id,x.slug,x.draft,x.published,x.published_at,x.version||1,x.created,x.updated)))).reduce((n:number,x:any)=>n+(x.meta?.changes||0),0);
  await audit(u,'staging-import','ייבוא מדריכים מ-Staging',{categories,media,posts,failed:failed.length});
  return {part,categories,media,posts,failed,source:{categories:(data.categories||[]).length,media:(data.media||[]).length,posts:(data.posts||[]).length}};
 }
 if(part==='relink'){
  // Only after every logo is here: a link whose file is missing stays on Staging.
  const rows=await all("SELECT id,json_extract(data,'$.logo_url') AS u FROM websites WHERE json_valid(data) AND instr(json_extract(data,'$.logo_url'),?)=1",staging+'/api/catalog-logo/');let moved=0;const missing:string[]=[];
  const updates:any[]=[],stamp=new Date().toISOString();
  for(const w of rows){const id=String(w.u).split('/').pop()||'';if(!UUID.test(id)||!await env.BUCKET.head('public/catalog-logos/'+id)){missing.push(w.id);continue;}
   updates.push(stmt("UPDATE websites SET data=json_set(data,'$.logo_url',?),updated=? WHERE id=?",here+'/api/catalog-logo/'+id,stamp,w.id));moved++;}
  for(let i=0;i<updates.length;i+=100)await db().batch(updates.slice(i,i+100));
  await audit(u,'staging-import','קישורי לוגו הועברו לאתר',{moved,missing:missing.length});
  return {part,moved,missing};
 }
 throw new ApiError(400,'בחרו מה לייבא');
}
