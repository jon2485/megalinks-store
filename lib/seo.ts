import type {Metadata} from 'next';
import {adminAreas} from './admin-navigation';
import {lobbyGroups} from './admin-lobby-config';
import {LEGAL_DOCS,legalDoc} from './legal-docs';
import {LEGAL_CONTENT} from './legal-content.generated';

export const SITE_URL = 'https://megalinks-staging-v172.up.railway.app';
export const SOCIAL_IMAGE_PATH = '/brand/megalinks-social.png';
export const SITE_NAME = 'MegaLinks';
export const HOME_TITLE = 'MegaLinks — פרסום כתבות ותוכן באתרים';
export const HOME_DESCRIPTION = 'בחרו אתרים לפרסום הכתבה הבאה שלכם עם MegaLinks. חפשו לפי תחום, השוו מחירים ונתוני אתרים, והזמינו פרסום כתבות ושירותי כתיבת תוכן במקום אחד.';
// A legal page is a draft until a lawyer approves its text; drafts stay out of search engines and of the sitemap.
export const legalPublished=(id:string)=>!!LEGAL_CONTENT[id]&&!LEGAL_CONTENT[id].draft;
export const INDEXABLE_PATHS:readonly string[] = ['/', '/knowledge', ...LEGAL_DOCS.filter(doc=>legalPublished(doc.id)).map(doc=>doc.path)];
const privateRoots = new Set([
    ...adminAreas.flatMap(area=>area.pages.map(([page])=>page)),
    ...lobbyGroups.flatMap(group=>[group.page,...group.tabs.map(([page])=>page)]),
    'admin-approvals','admin-publication','admin-writing','admin-pricing','admin-pricebooks','offers','cart','checkout','bulk','purchased',
    'orders','articles','links','dashboard','strategies','wallet','monthly','customers',
    'profile','files','support','api','notifications','supplier-workspace','supplier-finance',
]);
const nestedRoots = new Set(['article','admin-article','admin-supplier','admin-supplier-articles','admin-supplier-stock','admin-supplier-billing','admin-supplier-order','admin-supplier-package','supplier-invoice','admin-supplier-invoice','admin-seller-request','admin-pricebook','admin-customer-account','lobby-order','supplier','admin-knowledge','admin-order','admin-support','order-confirmed']);
const hubTabs = new Set(['articles','orders','payments','selling','customers','profile','files','support','api','notifications','monthly']);

export function isWorkspacePath(parts:string[]) {
    if(parts.length===1)return privateRoots.has(parts[0]);
    if(parts.length===3&&parts[1]&&parts[1].length<=200){
        if(['article','admin-article'].includes(parts[0]))return parts[2]==='ai';
        if(parts[0]==='admin-customer-account')return ['orders','payments','monthly','articles','profile','history'].includes(parts[2]);
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
    const path=view==='catalog'?'/':null;
    if(path){const metadata=publicMetadata(path);return {title:(metadata.title as {absolute:string}).absolute,description:metadata.description!,canonical:SITE_URL+path,robots:'index, follow'};}
    const adminTitle=view.startsWith('admin-seller-request/')?'בדיקת בקשת ספק':view.startsWith('admin-supplier-invoice/')?'בדיקת חשבונית ספק':/^admin-supplier(-articles|-stock|-billing|-order|-package)?\//.test(view)?'פרטי ספק ואתר':view.startsWith('admin-order/')?'פירוט ההזמנה':view.startsWith('admin-article/')?'טיפול בכתבה':view.startsWith('admin-support/')?'פרטי הפנייה':view.startsWith('admin-knowledge/')?'עורך מדריכים וידע':adminAreas.flatMap(a=>a.pages.map(([page,label])=>({page,label}))).find(item=>item.page===view)?.label;
    return {title:(adminTitle||(view.startsWith('admin')?'ניהול המערכת':'המרחב האישי'))+' | MegaLinks',description:'כניסה למרחב האישי ולניהול פרסומים ב־MegaLinks.',canonical:null,robots:'noindex, nofollow, noarchive'};
}
export const privateRobots = {index:false,follow:false,noarchive:true};
/** Metadata of a legal page (terms, privacy, cancellations, supply, accessibility, cookies). */
export function legalMetadata(id:string):Metadata {
    const doc=legalDoc(id)!,title=doc.title+' | MegaLinks',description=doc.summary,url=SITE_URL+doc.path,published=legalPublished(id);
    return {title:{absolute:title},description,alternates:{canonical:url},robots:published?{index:true,follow:true}:privateRobots,
        openGraph:{type:'website',locale:'he_IL',siteName:SITE_NAME,title,description,url}};
}
export function publicMetadata(path:'/'):Metadata {
    const title=HOME_TITLE;
    const description=HOME_DESCRIPTION;
    const url=SITE_URL+path;
    const image={url:SITE_URL+SOCIAL_IMAGE_PATH,width:1200,height:630,alt:'MegaLinks — פרסום כתבות ותוכן באתרים'};
    return {title:{absolute:title},description,alternates:{canonical:url},robots:{index:true,follow:true},
        openGraph:{type:'website',locale:'he_IL',siteName:SITE_NAME,title,description,url,images:[image]},
        twitter:{card:'summary_large_image',title,description,images:[image.url]}};
}
export const websiteSchema = {'@context':'https://schema.org','@graph':[
    {'@type':'Organization','@id':SITE_URL+'/#organization',name:SITE_NAME,url:SITE_URL+'/',logo:SITE_URL+'/brand/loader-m.png'},
    {'@type':'WebSite','@id':SITE_URL+'/#website',name:SITE_NAME,alternateName:'מגה לינקס',url:SITE_URL+'/',inLanguage:'he-IL',publisher:{'@id':SITE_URL+'/#organization'}},
]};

/** Also cover non-HTML files and private routes; robots.txt is not access control. */
export function applySeoHeaders(response:Response,pathname:string) {
    const result=new Response(response.body,response);
    const html=result.headers.get('content-type')?.includes('text/html');
    if(!isIndexablePath(pathname)&&(html||pathname.startsWith('/api/')||pathname==='/mcp'))result.headers.set('X-Robots-Tag','noindex, nofollow, noarchive');
    if(html)result.headers.set('Cache-Control','private, no-store');
    return result;
}
