import {notFound} from 'next/navigation';
import KnowledgeShell from '../../knowledge-shell';
import {KnowledgeArticleView} from '../../knowledge-components';
import {publishedKnowledge,publicKnowledgeList} from '@/lib/knowledge-server';
import {knowledgeMetadata,knowledgeOrigin} from '@/lib/knowledge-seo';
import '../../knowledge.css';
import {knowledgePath} from '@/lib/knowledge';
export const dynamic='force-dynamic';
export async function generateMetadata({params}:{params:Promise<{slug:string}>}){const {slug}=await params;const article=await publishedKnowledge(slug);return article?knowledgeMetadata(article):{title:'המאמר לא נמצא',robots:{index:false,follow:false}};}
export default async function KnowledgeDetail({params}:{params:Promise<{slug:string}>}){const {slug}=await params,article=await publishedKnowledge(slug);if(!article)notFound();const data=await publicKnowledgeList(),origin=await knowledgeOrigin();const schema={'@context':'https://schema.org','@type':'Article',headline:article.title,description:article.excerpt,inLanguage:'he-IL',datePublished:article.publishedAt,dateModified:article.updated,author:{'@type':'Organization',name:article.author},publisher:{'@type':'Organization',name:'MegaLinks'},...(article.cover?{image:origin+article.cover}:{}),...(origin?{mainEntityOfPage:origin+knowledgePath(article.slug)}:{})};return <KnowledgeShell><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(schema).replace(/</g,'\\u003c')}}/><KnowledgeArticleView article={article} categories={data.categories} related={data.articles.filter(a=>a.id!==article.id).slice(0,3)}/></KnowledgeShell>;}
