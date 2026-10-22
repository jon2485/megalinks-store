export type KnowledgeCategory={id:string;name:string};
export type KnowledgeArticle={id:string;slug:string;title:string;excerpt:string;content:string;cover:string;coverAlt:string;author:string;categories:string[];tags:string[];featured:boolean;seoTitle:string;seoDescription:string;version:number;updated:string;publishedAt:string|null;status:'draft'|'published'};
export type KnowledgeSummary=Omit<KnowledgeArticle,'content'>&{minutes:number};
export const knowledgePath=(slug:string)=>'/knowledge/'+encodeURIComponent(slug);
export const knowledgeText=(html:string)=>html.replace(/<[^>]*>/g,' ').replace(/&nbsp;|&#160;/g,' ').replace(/\s+/g,' ').trim();
export const knowledgeMinutes=(html:string)=>Math.max(1,Math.ceil(knowledgeText(html).split(/\s+/).filter(Boolean).length/200));
export const knowledgeDate=(value:string)=>{const d=new Date(value);return Number.isFinite(d.getTime())?new Intl.DateTimeFormat('he-IL',{day:'2-digit',month:'2-digit',year:'numeric',timeZone:'Asia/Jerusalem'}).format(d):'';};
export function emptyKnowledgeArticle():KnowledgeArticle{return {id:'',slug:'',title:'',excerpt:'',content:'',cover:'',coverAlt:'',author:'צוות MegaLinks',categories:[],tags:[],featured:false,seoTitle:'',seoDescription:'',version:0,updated:'',publishedAt:null,status:'draft'};}
export function knowledgeSummary(article:KnowledgeArticle):KnowledgeSummary{const {content,...summary}=article;return {...summary,minutes:knowledgeMinutes(content)};}
export function knowledgeHeadings(html:string){const headings:{id:string;title:string}[]=[];const content=html.replace(/<h([23])([^>]*)>([\s\S]*?)<\/h\1>/gi,(_all,level,attrs,body)=>{const id='section-'+(headings.length+1);headings.push({id,title:knowledgeText(body).replace(/&amp;/g,'&')});return `<h${level}${attrs} id="${id}">${body}</h${level}>`;});return {content,headings};}
