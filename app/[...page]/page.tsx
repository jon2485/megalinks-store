import Workspace from '../workspace';
import type {Metadata} from 'next';
import {notFound} from 'next/navigation';
import {isWorkspacePath,privateRobots,publicMetadata} from '@/lib/seo';
import {publicCatalogPreview} from '@/lib/public-catalog-preview';
export const dynamic='force-dynamic';
const privateMetadata:Metadata={title:'המרחב האישי',description:'כניסה למרחב האישי ולניהול פרסומים ב־MegaLinks.',robots:privateRobots};
// The catalog used to live at "/". The homepage took that address, so the catalog is served here, unchanged.
const isCatalog=(page:string[])=>page.length===1&&page[0]==='catalog';
export async function generateMetadata({params}:{params:Promise<{page:string[]}>}):Promise<Metadata>{const {page}=await params;return isCatalog(page)?publicMetadata('/catalog'):privateMetadata;}
export default async function Page({params}:{params:Promise<{page:string[]}>}){const {page}=await params;if(isCatalog(page))return <Workspace initialCatalog={await publicCatalogPreview()} initialView="catalog"/>;if(!isWorkspacePath(page))notFound();return <Workspace initialCatalog={[]} initialView={page.join('/')}/>}
