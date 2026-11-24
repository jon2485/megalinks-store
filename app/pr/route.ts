import {PR_HTML} from '@/lib/pr-page-html';
import {SITE_URL,breadcrumbSchema,faqSchema,ldJson} from '@/lib/seo';
import {PR_INTERVIEW_CENTS,PR_LOCKED,prSites} from '@/lib/pr';
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
// 24.11.2026 (owner) The PR page is closed for a short while: "רגע, בונים פה". The page and its data stay as they are;
// set PR_LOCKED (lib/pr.ts) to false to bring it back. While closed the page answers 503 with Retry-After, the way search engines
// expect a short closing (the page keeps its place in search), and /pr/start sends visitors back here.
const LOCK_MAIN=`<main id="main" class="prlock"><section class="prlock__card" aria-labelledby="prlock-title">
<div class="prlock__icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="8" rx="1"/><path d="M17 14v7"/><path d="M7 14v7"/><path d="M17 3v3"/><path d="M7 3v3"/><path d="M10 14 2.3 6.3"/><path d="m14 6 7.7 7.7"/><path d="m8 6 8 8"/></svg>
<span class="prlock__gear"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg></span></div>
<p class="prlock__kicker">כתבות יח״צ</p>
<h1 id="prlock-title">רגע, בונים פה</h1>
<p class="prlock__soon">בקרוב מאוד חוזרים!</p>
<p class="prlock__text">אנחנו משדרגים את עמוד כתבות היח״צ. בינתיים אפשר לבחור אתר ולהזמין כתבה מהקטלוג.</p>
<div class="prlock__actions"><a class="btn btn--navy btn--xl" href="/catalog">לקטלוג האתרים</a><a class="btn btn--login" href="/">לדף הבית</a></div>
</section></main>`;
const LOCK_CSS=`<style>
.bar nav a[href^="#"]{display:none!important}
.prlock{min-height:calc(100dvh - 160px);display:grid;place-items:center;padding:128px 20px 72px}
.prlock__card{width:min(560px,100%);text-align:center;background:#fff;border-radius:28px;padding:44px 32px 36px;box-shadow:0 0 0 1px #0b1b3a10,0 24px 60px -28px #0b1b3a55}
.prlock__icon{position:relative;width:96px;height:96px;margin:0 auto 22px;border-radius:28px;display:grid;place-items:center;color:#fff;background:linear-gradient(135deg,#1467cf,#12a4c8);box-shadow:0 14px 30px -12px #1467cfaa;animation:prlock-float 3.2s ease-in-out infinite}
.prlock__icon>svg{width:52px;height:52px}
.prlock__gear{position:absolute;inset-block-end:-10px;inset-inline-start:-10px;width:40px;height:40px;border-radius:50%;display:grid;place-items:center;background:#fff;color:#f29a2e;box-shadow:0 6px 16px -6px #0b1b3a66}
.prlock__gear svg{width:24px;height:24px;animation:prlock-spin 6s linear infinite}
.prlock__kicker{margin:0 0 6px;font-size:15px;font-weight:700;color:#1467cf}
.prlock h1{margin:0;font-size:clamp(34px,6vw,48px);line-height:1.1;color:#0b1b3a}
.prlock__soon{margin:12px 0 0;font-size:clamp(20px,3.4vw,24px);font-weight:800;background:linear-gradient(90deg,#1467cf,#12a4c8);-webkit-background-clip:text;background-clip:text;color:transparent}
.prlock__text{margin:14px auto 0;max-width:40ch;font-size:16px;line-height:1.7;color:#4a5a72}
.prlock__actions{margin-top:28px;display:flex;flex-wrap:wrap;gap:12px;justify-content:center}
@keyframes prlock-float{50%{transform:translateY(-6px)}}
@keyframes prlock-spin{to{transform:rotate(360deg)}}
@media (prefers-reduced-motion:reduce){.prlock__icon,.prlock__gear svg{animation:none}}
@media (max-width:560px){.prlock{padding-top:104px}.prlock__card{padding:36px 20px 28px;border-radius:24px}.prlock__actions .btn{flex:1 1 100%}}
</style>`;
function lockedPage(){
    return PR_HTML.replaceAll('%%SITE_URL%%',SITE_URL)
        .replace(/<title>[^<]*<\/title>/,'<title>רגע, בונים פה | כתבות יח״צ | MegaLinks</title>')
        .replace(/<main id="main">[\s\S]*<\/main>/,()=>LOCK_MAIN)
        .replace(/href="#sites"/g,'href="/catalog"')
        .replace(/<script[\s\S]*?<\/script>/g,m=>/scrollcraft\.js/.test(m)?m:'')
        .replace('</head>',()=>LOCK_CSS+'</head>');
}
export async function GET(){
    if(PR_LOCKED)return new Response(lockedPage(),{status:503,headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','retry-after':'86400'}});
    let sites:Awaited<ReturnType<typeof prSites>>=[];
    try{sites=await prSites();}catch(error){console.error('PR page: sites unavailable',error);}
    const html=PR_HTML.replaceAll('%%SITE_URL%%',SITE_URL).replace('<!--PR:SITES-->',()=>prSiteCards(sites)).replace('<!--PR:DATA-->',()=>prData(sites)).replace('</head>',()=>schema(sites)+'</head>');
    return new Response(html,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'public, max-age=0, must-revalidate'}});
}
