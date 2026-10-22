import type {Metadata} from 'next';
import {adminAreas} from './admin-navigation';
import {lobbyGroups} from './admin-lobby-config';

export const SITE_URL = 'https://megalinks-staging-v172.up.railway.app';
export const SOCIAL_IMAGE_PATH = '/brand/megalinks-social.png';
export const SITE_NAME = 'MegaLinks';
export const HOME_TITLE = 'MegaLinks — פרסום כתבות ותוכן באתרים';
export const HOME_DESCRIPTION = 'בחרו אתרים לפרסום הכתבה הבאה שלכם עם MegaLinks. חפשו לפי תחום, השוו מחירים ונתוני אתרים, והזמינו פרסום כתבות ושירותי כתיבת תוכן במקום אחד.';
export const INDEXABLE_PATHS = ['/', '/terms', '/knowledge'] as const;
const privateRoots = new Set([
    ...adminAreas.flatMap(area=>area.pages.map(([page])=>page)),
    ...lobbyGroups.flatMap(group=>[group.page,...group.tabs.map(([page])=>page)]),
    'admin-pricing','admin-pricebooks','offers','cart','checkout','bulk','purchased',
    'orders','articles','links','dashboard','strategies','wallet','monthly','customers',
    'profile','files','support','api','notifications','supplier-workspace','supplier-finance',
]);
const nestedRoots = new Set(['article','admin-article','admin-pricebook','admin-customer-account','lobby-order','supplier','admin-knowledge']);
const hubTabs = new Set(['articles','orders','payments','customers','profile','files','support','api','notifications','monthly']);

export function isWorkspacePath(parts:string[]) {
    if(parts.length===1)return privateRoots.has(parts[0]);
    if(parts.length===3&&parts[1]&&parts[1].length<=200){
        if(['article','admin-article'].includes(parts[0]))return parts[2]==='ai';
        if(parts[0]==='admin-customer-account')return ['orders','payments','monthly','articles','profile','history'].includes(parts[2]);
    }
    if(parts.length!==2||!parts[1]||parts[1].length>200)return false;
    return parts[0]==='purchased'?hubTabs.has(parts[1]):nestedRoots.has(parts[0]);
}
export function isIndexablePath(path:string){return INDEXABLE_PATHS.some(p=>p===path)||/^\/knowledge\/[^/]+$/.test(path);}
export function clientPageSeo(view:string) {
    const path=view==='catalog'?'/':view==='terms'?'/terms':null;
    if(path){const metadata=publicMetadata(path);return {title:(metadata.title as {absolute:string}).absolute,description:metadata.description!,canonical:SITE_URL+path,robots:'index, follow'};}
    return {title:(view.startsWith('admin')?'ניהול המערכת':'המרחב האישי')+' | MegaLinks',description:'כניסה למרחב האישי ולניהול פרסומים ב־MegaLinks.',canonical:null,robots:'noindex, nofollow, noarchive'};
}
export const privateRobots = {index:false,follow:false,noarchive:true};
export function publicMetadata(path:'/'|'/terms'):Metadata {
    const title=path==='/'?HOME_TITLE:'תקנון ותנאי שימוש | MegaLinks';
    const description=path==='/'?HOME_DESCRIPTION:'תקנון ותנאי השימוש בשירותי MegaLinks לפרסום כתבות, כתיבת תוכן וניהול הזמנות.';
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
