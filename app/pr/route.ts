import {PR_HTML} from '@/lib/pr-page-html';
import {SITE_URL,breadcrumbSchema,faqSchema,ldJson} from '@/lib/seo';
import {PR_INTERVIEW_CENTS,prSites} from '@/lib/pr';
import {prData,prSiteCards} from '@/lib/pr-render';

// The PR articles page (owner, 17.11.2026; design/pr-page/spec.md). A standalone document like the homepage; the site cards
// are rendered here from the live catalog on every request, so a price or a new site shows at once.
export const dynamic='force-dynamic';
// Structured data (SEO audit 18.11.2026): the service with an offer per site on the page, the visible questions, breadcrumbs.
const strip=(html:string)=>html.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
const prFaq=[...PR_HTML.matchAll(/<button class="qa__q"[^>]*>([^<]+)<i[\s\S]*?<div class="qa__a"[^>]*><div>([\s\S]*?)<\/div><\/div>/g)].map(m=>[strip(m[1]),strip(m[2])] as [string,string]);
function schema(sites:Awaited<ReturnType<typeof prSites>>){
    const service={'@type':'Service','@id':SITE_URL+'/pr#service',name:'כתבות יח״צ באתרי חדשות עם ראיון טלפוני',serviceType:'PR articles',url:SITE_URL+'/pr',areaServed:'IL',inLanguage:'he-IL',
        provider:{'@type':'Organization','@id':SITE_URL+'/#organization',name:'MegaLinks',url:SITE_URL+'/'},
        description:'מראיין מקצועי מתקשר ללקוח, כותב את הכתבה מתוך השיחה, וכתבת היח״צ מתפרסמת באתר החדשות שנבחר. ראיון אחד יכול להפיק כמה כתבות שונות. סבב תיקונים אחד כלול.',
        offers:sites.map(s=>({'@type':'Offer',name:'כתבת יח״צ ב'+s.name,url:SITE_URL+'/pr#sites',price:(s.total_cents/100).toFixed(2),priceCurrency:'ILS',
            priceSpecification:{'@type':'UnitPriceSpecification',price:(s.total_cents/100).toFixed(2),priceCurrency:'ILS',valueAddedTaxIncluded:false},
            description:'כולל ראיון טלפוני וכתיבה ('+PR_INTERVIEW_CENTS/100+' ₪) ופרסום ב'+s.host}))};
    return ldJson([service,breadcrumbSchema([['כתבות יח״צ','/pr']]),...(prFaq.length?[faqSchema(prFaq)]:[])]);
}
export async function GET(){
    let sites:Awaited<ReturnType<typeof prSites>>=[];
    try{sites=await prSites();}catch(error){console.error('PR page: sites unavailable',error);}
    const html=PR_HTML.replaceAll('%%SITE_URL%%',SITE_URL).replace('<!--PR:SITES-->',()=>prSiteCards(sites)).replace('<!--PR:DATA-->',()=>prData(sites)).replace('</head>',()=>schema(sites)+'</head>');
    return new Response(html,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'public, max-age=0, must-revalidate'}});
}
