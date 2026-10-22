import KnowledgeShell from '../knowledge-shell';
import KnowledgeHub from '../knowledge-hub';
import {publicKnowledgeList} from '@/lib/knowledge-server';
import {knowledgeMetadata} from '@/lib/knowledge-seo';
import '../knowledge.css';
import '../knowledge-hub-approved.css';
export const dynamic='force-dynamic';
export const generateMetadata=()=>knowledgeMetadata();
export default async function KnowledgePage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){const q=await searchParams;const text=(key:string)=>typeof q[key]==='string'?q[key] as string:'';const page=Math.max(1,Math.min(10000,Math.floor(Number(text('page'))||1)));return <KnowledgeShell><KnowledgeHub initial={await publicKnowledgeList(page,text('q').slice(0,200),text('category'))} initialQuery={text('q').slice(0,200)} initialCategory={text('category')}/></KnowledgeShell>;}
