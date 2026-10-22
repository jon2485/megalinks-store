import {headers} from 'next/headers';
import {env} from 'cloudflare:workers';
import type {Metadata} from 'next';
import {knowledgePath,type KnowledgeArticle} from './knowledge';
import {SOCIAL_IMAGE_PATH,SITE_URL} from './seo';
export async function knowledgeOrigin(){const bindings=env as typeof env & {POSTFLOW_PUBLIC_ORIGIN?:string;POSTFLOW_STAGING_ORIGIN?:string};const configured=String(bindings.POSTFLOW_PUBLIC_ORIGIN||bindings.POSTFLOW_STAGING_ORIGIN||'');if(configured){try{return new URL(configured).origin;}catch{/* use current request origin */}}const h=await headers(),host=h.get('host')||'';return /^[a-z\d.-]+(?::\d+)?$/i.test(host)?(host.startsWith('localhost')?'http://':'https://')+host:'';}
export async function knowledgeMetadata(article?:KnowledgeArticle|null):Promise<Metadata>{
 const origin=await knowledgeOrigin()||SITE_URL,path=article?knowledgePath(article.slug):'/knowledge';
 const title=article?.seoTitle||article?.title||'מדריכים וידע',description=article?.seoDescription||article?.excerpt||'מדריכים מעשיים לבחירת אתרי פרסום, כתיבת תוכן ותכנון פרסום כתבות עם MegaLinks.';
 const image=article?.cover?{url:new URL(article.cover,origin).href,alt:article.coverAlt||article.title}:{url:origin+SOCIAL_IMAGE_PATH,width:1200,height:630,alt:'MegaLinks — מדריכים וידע'};
 return {title:{absolute:title+' | MegaLinks'},description,robots:{index:true,follow:true},alternates:{canonical:origin+path},
  openGraph:{type:article?'article':'website',title,description,locale:'he_IL',siteName:'MegaLinks',url:origin+path,images:[image],...(article?.publishedAt?{publishedTime:article.publishedAt,modifiedTime:article.updated,authors:[article.author]}:{})},
  twitter:{card:'summary_large_image',title,description,images:[image.url]},
 };
}
