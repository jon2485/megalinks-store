import Workspace from './workspace';
import {publicCatalogPreview} from '@/lib/public-catalog-preview';
import {publicMetadata,websiteSchema} from '@/lib/seo';
export const dynamic='force-dynamic';
export const metadata=publicMetadata('/');
export default async function Page(){
    const catalog=await publicCatalogPreview();
    return <><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(websiteSchema).replace(/</g,'\\u003c')}}/><Workspace initialCatalog={catalog}/></>;
}
