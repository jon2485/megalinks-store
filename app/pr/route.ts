import {PR_HTML} from '@/lib/pr-page-html';
import {SITE_URL} from '@/lib/seo';
import {prSites} from '@/lib/pr';
import {prData,prSiteCards} from '@/lib/pr-render';

// The PR articles page (owner, 17.11.2026; design/pr-page/spec.md). A standalone document like the homepage; the site cards
// are rendered here from the live catalog on every request, so a price or a new site shows at once.
export const dynamic='force-dynamic';
export async function GET(){
    let sites:Awaited<ReturnType<typeof prSites>>=[];
    try{sites=await prSites();}catch(error){console.error('PR page: sites unavailable',error);}
    const html=PR_HTML.replaceAll('%%SITE_URL%%',SITE_URL).replace('<!--PR:SITES-->',()=>prSiteCards(sites)).replace('<!--PR:DATA-->',()=>prData(sites));
    return new Response(html,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'public, max-age=0, must-revalidate'}});
}
