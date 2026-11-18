import {INDEXABLE_PATHS,SITE_URL} from '@/lib/seo';
import {all} from '@/lib/server';
import {knowledgePath} from '@/lib/knowledge';
// The public pages and every published guide, on the one public address, with the date each guide last changed
// (Google reads <lastmod> when it is accurate; it ignores changefreq and priority). SEO audit 18.11.2026.
const escape=(v:string)=>v.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const day=(v:unknown)=>{const d=new Date(String(v||''));return Number.isFinite(d.getTime())?d.toISOString().slice(0,10):'';};
export async function GET(){
    const posts=await all("SELECT slug,published_at,json_extract(published,'$.updated') AS updated FROM knowledge_posts WHERE published IS NOT NULL AND published_at<=? ORDER BY published_at DESC",new Date().toISOString());
    const latest=posts.map(p=>day(p.updated)||day(p.published_at)).filter(Boolean).sort().pop()||'';
    const url=(path:string,lastmod='')=>`<url><loc>${escape(SITE_URL+path)}</loc>${lastmod?`<lastmod>${lastmod}</lastmod>`:''}</url>`;
    const body=INDEXABLE_PATHS.map(path=>url(path,path==='/knowledge'?latest:'')).join('')+posts.map(post=>url(knowledgePath(String(post.slug)),day(post.updated)||day(post.published_at))).join('');
    return new Response('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+body+'</urlset>',{headers:{'Content-Type':'application/xml; charset=utf-8','Cache-Control':'public, max-age=300'}});
}
