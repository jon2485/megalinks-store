import type {Metadata} from 'next';
import {adminAreas} from './admin-navigation';
import {lobbyGroups} from './admin-lobby-config';
import {LEGAL_DOCS,legalDoc} from './legal-docs';
import {LEGAL_CONTENT} from './legal-content.generated';

// The public address search engines and AI assistants should know (owner's business details: megalinks.co.il). Canonical
// links, the sitemap, robots.txt, structured data and llms.txt all use it, also on Staging, which is private (sign-in only)
// and never indexed, so a copy of the site can never compete with the real one (SEO audit 18.11.2026).
export const SITE_URL = 'https://megalinks.co.il';
export const SOCIAL_IMAGE_PATH = '/brand/megalinks-social.png';
export const SITE_NAME = 'MegaLinks';
export const HOME_TITLE = 'קניית קישורים וכתבות יח״צ באתרים מובילים | MegaLinks';
export const HOME_DESCRIPTION = 'מחירון של מאות אתרים בישראל לפרסום כתבות וקניית קישורים, כתבות יח״צ באתרי חדשות עם ראיון טלפוני וכתיבת תוכן. מחירים גלויים, הזמנה ומעקב במקום אחד.';
export const CATALOG_TITLE = 'מחירון אתרים לפרסום כתבות וקניית קישורים | MegaLinks';
export const CATALOG_DESCRIPTION = 'מחירון אתרים בישראל לפרסום כתבות ממומנות וקישורים: תחום, DR, UR, זמן פרסום ומחיר לכל אתר. מזמינים אונליין, עם כתיבת תוכן לבחירה.';
export const BUSINESS = {legalName:'Mega Links',name:'MegaLinks',hebrewName:'מגה לינקס',vatId:'201234879',telephone:'+972-50-750-8850',whatsapp:'https://wa.me/972507508850',postOfficeBox:'ת"ד 592',locality:'נס ציונה',country:'IL'} as const;
// A legal page is a draft until a lawyer approves its text; drafts stay out of search engines and of the sitemap.
export const legalPublished=(id:string)=>!!LEGAL_CONTENT[id]&&!LEGAL_CONTENT[id].draft;
export const INDEXABLE_PATHS:readonly string[] = ['/', '/catalog', '/pr', '/knowledge', ...LEGAL_DOCS.filter(doc=>legalPublished(doc.id)).map(doc=>doc.path)];
const privateRoots = new Set([
    ...adminAreas.flatMap(area=>area.pages.map(([page])=>page)),
    ...lobbyGroups.flatMap(group=>[group.page,...group.tabs.map(([page])=>page)]),
    'admin-approvals','admin-publication','admin-writing','admin-pricing','admin-pricebooks','offers','cart','checkout','bulk','purchased',
    'orders','articles','links','dashboard','strategies','wallet','monthly','customers',
    'profile','files','support','api','notifications','supplier-workspace','supplier-finance',
]);
const nestedRoots = new Set(['article','admin-article','admin-supplier','admin-supplier-articles','admin-supplier-stock','admin-supplier-billing','admin-supplier-order','admin-supplier-package','supplier-invoice','admin-supplier-invoice','admin-seller-request','admin-pricebook','admin-customer-account','lobby-order','supplier','admin-knowledge','admin-order','admin-support','order-confirmed']);
const hubTabs = new Set(['articles','orders','payments','selling','customers','profile','files','support','api','notifications','monthly']);

const agencySections=new Set(['customers','publications','tasks','calendar','reports','settings']);
const agencyCustomerTabs=new Set(['overview','details','publications','articles','used-sites','links','notes']);
function isAgencyPath(rest:string[]){
    if(!rest.length)return true;
    if(!agencySections.has(rest[0]))return false;
    if(rest.length===1)return true;
    if(rest[0]!=='customers'||!rest[1]||rest[1].length>200||rest.length>3)return false;
    return rest.length===2||agencyCustomerTabs.has(rest[2]);
}
export function isWorkspacePath(parts:string[]) {
    if(parts.length===1)return privateRoots.has(parts[0]);
    // The agency centre: /purchased/agency[/section] and /purchased/agency/customers/<id>[/tab] (design/agency-dashboard/spec.md).
    if(parts[0]==='purchased'&&parts[1]==='agency')return isAgencyPath(parts.slice(2));
    // The admin's read-only view of a customer's centre: /admin-agency-view/<user>[/section...] (owner's decision 4).
    if(parts[0]==='admin-agency-view'&&parts[1]&&parts[1].length<=200)return isAgencyPath(parts.slice(2));
    if(parts.length===3&&parts[1]&&parts[1].length<=200){
        if(['article','admin-article'].includes(parts[0]))return parts[2]==='ai';
        if(parts[0]==='admin-customer-account')return ['orders','payments','monthly','articles','profile','history','agency'].includes(parts[2]);
    }
    // The order opened from a personal update: /purchased/articles/order/<id>, so a reload or a shared link works too.
    if(parts.length===4)return parts[0]==='purchased'&&parts[1]==='articles'&&parts[2]==='order'&&!!parts[3]&&parts[3].length<=200;
    if(parts.length!==2||!parts[1]||parts[1].length>200)return false;
    return parts[0]==='purchased'?hubTabs.has(parts[1]):nestedRoots.has(parts[0]);
}
export function isIndexablePath(path:string){return INDEXABLE_PATHS.some(p=>p===path)||/^\/knowledge\/[^/]+$/.test(path);}
export function clientPageSeo(view:string) {
    const legal=legalDoc(view);
    if(legal){const metadata=legalMetadata(legal.id);return {title:(metadata.title as {absolute:string}).absolute,description:metadata.description!,canonical:SITE_URL+legal.path,robots:legalPublished(legal.id)?'index, follow':'noindex, nofollow, noarchive'};}
    const path=view==='catalog'?'/catalog':null;
    if(path){const metadata=publicMetadata(path);return {title:(metadata.title as {absolute:string}).absolute,description:metadata.description!,canonical:SITE_URL+path,robots:'index, follow'};}
    const adminTitle=view.startsWith('admin-seller-request/')?'בדיקת בקשת ספק':view.startsWith('admin-supplier-invoice/')?'בדיקת חשבונית ספק':/^admin-supplier(-articles|-stock|-billing|-order|-package)?\//.test(view)?'פרטי ספק ואתר':view.startsWith('admin-order/')?'פירוט ההזמנה':view.startsWith('admin-article/')?'טיפול בכתבה':view.startsWith('admin-support/')?'פרטי הפנייה':view.startsWith('admin-knowledge/')?'עורך מדריכים וידע':adminAreas.flatMap(a=>a.pages.map(([page,label])=>({page,label}))).find(item=>item.page===view)?.label;
    return {title:(adminTitle||(view.startsWith('admin')?'ניהול המערכת':'המרחב האישי'))+' | MegaLinks',description:'כניסה למרחב האישי ולניהול פרסומים ב־MegaLinks.',canonical:null,robots:'noindex, nofollow, noarchive'};
}
export const privateRobots = {index:false,follow:false,noarchive:true};
/** Metadata of a legal page (terms, privacy, cancellations, supply, accessibility, cookies). */
export function legalMetadata(id:string):Metadata {
    const doc=legalDoc(id)!,title=doc.title+' | MegaLinks',description=doc.summary,url=SITE_URL+doc.path,published=legalPublished(id);
    return {title:{absolute:title},description,alternates:{canonical:url},robots:published?{index:true,follow:true}:privateRobots,
        openGraph:{type:'website',locale:'he_IL',siteName:SITE_NAME,title,description,url,images:[{url:SITE_URL+SOCIAL_IMAGE_PATH,width:1200,height:630,alt:'MegaLinks'}]}};
}
export function publicMetadata(path:'/'|'/catalog'):Metadata {
    // Each public page has its own title and description: the catalog used to repeat the homepage's (SEO audit 18.11.2026).
    const title=path==='/catalog'?CATALOG_TITLE:HOME_TITLE;
    const description=path==='/catalog'?CATALOG_DESCRIPTION:HOME_DESCRIPTION;
    const url=SITE_URL+path;
    const image={url:SITE_URL+SOCIAL_IMAGE_PATH,width:1200,height:630,alt:'MegaLinks — פרסום כתבות ותוכן באתרים'};
    return {title:{absolute:title},description,alternates:{canonical:url},robots:{index:true,follow:true},
        openGraph:{type:'website',locale:'he_IL',siteName:SITE_NAME,title,description,url,images:[image]},
        twitter:{card:'summary_large_image',title,description,images:[image.url]}};
}
const organization={'@type':'Organization','@id':SITE_URL+'/#organization',name:SITE_NAME,alternateName:[BUSINESS.hebrewName,BUSINESS.legalName],legalName:BUSINESS.legalName,url:SITE_URL+'/',
    logo:{'@type':'ImageObject',url:SITE_URL+'/brand/megalinks-logo.png'},image:SITE_URL+SOCIAL_IMAGE_PATH,telephone:BUSINESS.telephone,vatID:BUSINESS.vatId,
    address:{'@type':'PostalAddress',postOfficeBoxNumber:BUSINESS.postOfficeBox,addressLocality:BUSINESS.locality,addressCountry:BUSINESS.country},areaServed:{'@type':'Country',name:'Israel'},
    contactPoint:[{'@type':'ContactPoint',contactType:'customer service',telephone:BUSINESS.telephone,areaServed:'IL',availableLanguage:['he']}],
    description:'מערכת לפרסום כתבות, לקניית קישורים ולכתבות יח״צ באתרים בישראל, עם כתיבת תוכן ומעקב אחרי כל פרסום.',
    knowsAbout:['קניית קישורים','בניית קישורים','כתבות יח״צ','כתבות ממומנות','קידום אתרים בגוגל','כתיבת תוכן שיווקי']};
export const websiteSchema = {'@context':'https://schema.org','@graph':[
    organization,
    {'@type':'WebSite','@id':SITE_URL+'/#website',name:SITE_NAME,alternateName:'מגה לינקס',url:SITE_URL+'/',inLanguage:'he-IL',publisher:{'@id':SITE_URL+'/#organization'}},
]};
/** Breadcrumbs for a public page, e.g. [['כתבות יח״צ','/pr']] under the homepage. */
export const breadcrumbSchema=(items:[string,string][])=>({'@type':'BreadcrumbList',itemListElement:[['MegaLinks','/'],...items].map(([name,path],i)=>({'@type':'ListItem',position:i+1,name,item:SITE_URL+path}))});
/** Questions and answers that are visible on the page, in schema.org form. */
export const faqSchema=(items:[string,string][])=>({'@type':'FAQPage',mainEntity:items.map(([q,a])=>({'@type':'Question',name:q,acceptedAnswer:{'@type':'Answer',text:a}}))});
export const ldJson=(graph:object[])=>'<script type="application/ld+json">'+JSON.stringify({'@context':'https://schema.org','@graph':graph}).replace(/</g,'\\u003c')+'</script>';

/** Also cover non-HTML files and private routes; robots.txt is not access control. */
export function applySeoHeaders(response:Response,pathname:string) {
    const result=new Response(response.body,response);
    const html=result.headers.get('content-type')?.includes('text/html');
    if(!isIndexablePath(pathname)&&(html||pathname.startsWith('/api/')||pathname==='/mcp'))result.headers.set('X-Robots-Tag','noindex, nofollow, noarchive');
    if(html)result.headers.set('Cache-Control','private, no-store');
    return result;
}
