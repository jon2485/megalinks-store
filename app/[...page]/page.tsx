import Workspace from '../workspace';
import {notFound,permanentRedirect} from 'next/navigation';
import {isWorkspacePath,privateRobots} from '@/lib/seo';
export const dynamic='force-dynamic';
export const metadata={title:'המרחב האישי',description:'כניסה למרחב האישי ולניהול פרסומים ב־MegaLinks.',robots:privateRobots};
export default async function Page({params}:{params:Promise<{page:string[]}>}){const {page}=await params;if(page.length===1&&page[0]==='catalog')permanentRedirect('/');if(!isWorkspacePath(page))notFound();return <Workspace initialCatalog={[]} initialView={page.join('/')}/>}
