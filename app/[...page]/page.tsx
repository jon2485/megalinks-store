import Workspace from '../workspace';
import type {Metadata} from 'next';
import {notFound} from 'next/navigation';
import {SITE_URL,breadcrumbSchema,customerPageTitle,isWorkspacePath,ldJson,privateRobots,publicMetadata} from '@/lib/seo';
import {publicCatalogPreview} from '@/lib/public-catalog-preview';
export const dynamic='force-dynamic';
const privateMetadata:Metadata={title:'המרחב האישי',description:'כניסה למרחב האישי ולניהול פרסומים ב־MegaLinks.',robots:privateRobots};
// The catalog used to live at "/". The homepage took that address, so the catalog is served here, unchanged.
const isCatalog=(page:string[])=>page.length===1&&page[0]==='catalog';
export async function generateMetadata({params}:{params:Promise<{page:string[]}>}):Promise<Metadata>{const {page}=await params;return isCatalog(page)?publicMetadata('/catalog'):page[0]?.startsWith('admin')?privateMetadata:{...privateMetadata,title:customerPageTitle(page.join('/'))};}
// The price list as structured data (SEO audit 18.11.2026): the strongest sites already in the server-rendered page, each as
// an offer with its public regular price before VAT, plus breadcrumbs. Nothing private: the same fields the page shows.
function catalogSchema(sites:Awaited<ReturnType<typeof publicCatalogPreview>>){
    const items=sites.filter(s=>s.name&&Number(s.price_cents)>0).map((s,i)=>({'@type':'ListItem',position:i+1,item:{'@type':'Offer',name:'פרסום כתבה ב'+s.name,url:SITE_URL+'/catalog',price:(Number(s.price_cents)/100).toFixed(2),priceCurrency:'ILS',
        priceSpecification:{'@type':'UnitPriceSpecification',price:(Number(s.price_cents)/100).toFixed(2),priceCurrency:'ILS',valueAddedTaxIncluded:false},
        itemOffered:{'@type':'Service',name:'פרסום כתבה ממומנת עם קישור',serviceType:'Sponsored article',provider:{'@id':SITE_URL+'/#organization'},areaServed:'IL'}}}));
    return ldJson([{'@type':'CollectionPage','@id':SITE_URL+'/catalog#page',name:'מחירון אתרים לפרסום כתבות וקניית קישורים',url:SITE_URL+'/catalog',inLanguage:'he-IL',isPartOf:{'@id':SITE_URL+'/#website'},
        mainEntity:{'@type':'ItemList',name:'אתרים לפרסום כתבות',numberOfItems:items.length,itemListElement:items}},breadcrumbSchema([['מחירון אתרים','/catalog']])]);
}
export default async function Page({params}:{params:Promise<{page:string[]}>}){const {page}=await params;if(isCatalog(page)){const sites=await publicCatalogPreview();return <><script type="application/ld+json" dangerouslySetInnerHTML={{__html:catalogSchema(sites).replace(/^<script type="application\/ld\+json">|<\/script>$/g,'')}}/><Workspace initialCatalog={sites} initialView="catalog"/></>;}if(!isWorkspacePath(page))notFound();return <Workspace initialCatalog={[]} initialView={page.join('/')}/>}
