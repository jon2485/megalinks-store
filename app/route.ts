import {HOME_HTML} from '@/lib/home-page-html';
import {SITE_URL,websiteSchema,faqSchema,ldJson} from '@/lib/seo';
import {PR_INTERVIEW_CENTS} from '@/lib/pr';
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

// Structured data for the homepage (SEO audit 18.11.2026): the organisation and site, the three services, and the
// questions that are visible on the page, read from the page itself so the two never disagree.
const strip=(html:string)=>html.replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim();
const homeFaq=[...HOME_HTML.matchAll(/<button class="qa__q"[^>]*>([^<]+)<i[\s\S]*?<div class="qa__a"[^>]*><div>([\s\S]*?)<\/div><\/div>/g)].map(m=>[strip(m[1]),strip(m[2])] as [string,string]).filter(([q,a])=>q&&a);
const services={'@type':'OfferCatalog','@id':SITE_URL+'/#services',name:'שירותי MegaLinks',itemListElement:[
    {'@type':'Offer',itemOffered:{'@type':'Service',name:'פרסום כתבות וקניית קישורים',serviceType:'Sponsored articles and backlinks',url:SITE_URL+'/catalog',provider:{'@id':SITE_URL+'/#organization'},areaServed:'IL'}},
    {'@type':'Offer',itemOffered:{'@type':'Service',name:'כתבות יח״צ באתרי חדשות עם ראיון טלפוני',serviceType:'PR articles',url:SITE_URL+'/pr',provider:{'@id':SITE_URL+'/#organization'},areaServed:'IL'},priceSpecification:{'@type':'UnitPriceSpecification',price:PR_INTERVIEW_CENTS/100,priceCurrency:'ILS',valueAddedTaxIncluded:false,description:'ראיון טלפוני וכתיבת הכתבה, בנוסף למחיר הפרסום באתר'}},
    {'@type':'Offer',itemOffered:{'@type':'Service',name:'כתיבת תוכן לכתבות',serviceType:'Article writing',url:SITE_URL+'/catalog',provider:{'@id':SITE_URL+'/#organization'},areaServed:'IL'}},
]};
const homeSchema=ldJson([...websiteSchema['@graph'],services,...(homeFaq.length?[faqSchema(homeFaq)]:[])]);
export async function GET(){
    const guides=await latestGuides();
    let html=HOME_HTML.replaceAll('%%SITE_URL%%',SITE_URL).replace('<!--HOME:SCHEMA-->',()=>homeSchema);
    if(guides)html=html.replace(/<!--HOME:POSTS-->[\s\S]*?<!--\/HOME:POSTS-->/,()=>guides);
    return new Response(html,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'public, max-age=0, must-revalidate'}});
}
