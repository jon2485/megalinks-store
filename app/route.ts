import {HOME_HTML} from '@/lib/home-page-html';
import {SITE_URL,websiteSchema} from '@/lib/seo';
import {publicKnowledgeList} from '@/lib/knowledge-server';
import {knowledgePath} from '@/lib/knowledge';

// The site's homepage. It is a standalone document (home/index.html), so it never touches the workspace screens or their styles.
export const dynamic='force-dynamic';
const esc=(value:string)=>value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const fallbackCovers=['/brand/knowledge/brief.webp','/brand/knowledge/metrics.webp','/brand/knowledge/publication.webp'];
const arrow='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M14 6l-6 6 6 6"/></svg>';

async function latestGuides(){
    try{
        const {articles}=await publicKnowledgeList(1);
        return articles.slice(0,3).map((article,index)=>{
            const cover=/^(https?:\/\/|\/)[^\s'"()<>]+$/.test(article.cover||'')?article.cover:fallbackCovers[index];
            return '<a class="post" href="'+esc(knowledgePath(article.slug))+'"><div class="post__art" aria-hidden="true" style="background-image:url(\''+esc(cover)+'\')"></div><div class="post__t"><small>מדריך</small><h3>'+esc(article.title)+'</h3><p>'+esc(article.excerpt)+'</p><span>לקריאה'+arrow+'</span></div></a>';
        }).join('');
    }catch{return '';}
}

export async function GET(){
    const guides=await latestGuides();
    let html=HOME_HTML.replaceAll('%%SITE_URL%%',SITE_URL).replace('<!--HOME:SCHEMA-->','<script type="application/ld+json">'+JSON.stringify(websiteSchema).replace(/</g,'\u003c')+'</script>');
    if(guides)html=html.replace(/<!--HOME:POSTS-->[\s\S]*?<!--\/HOME:POSTS-->/,()=>guides);
    return new Response(html,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'public, max-age=0, must-revalidate'}});
}
