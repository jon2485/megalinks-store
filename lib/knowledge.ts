export type KnowledgeCategory={id:string;name:string};
export type KnowledgeArticle={id:string;slug:string;title:string;excerpt:string;content:string;cover:string;coverAlt:string;author:string;categories:string[];tags:string[];featured:boolean;seoTitle:string;seoDescription:string;version:number;updated:string;publishedAt:string|null;status:'draft'|'published'|'scheduled';publicationDate:string};
export type KnowledgeSummary=Omit<KnowledgeArticle,'content'>&{minutes:number};
export const knowledgePath=(slug:string)=>'/knowledge/'+encodeURIComponent(slug);
export const knowledgeText=(html:string)=>html.replace(/<[^>]*>/g,' ').replace(/&nbsp;|&#160;/g,' ').replace(/\s+/g,' ').trim();
export const knowledgeMinutes=(html:string)=>Math.max(1,Math.ceil(knowledgeText(html).split(/\s+/).filter(Boolean).length/200));
export const knowledgeDate=(value:string)=>{const d=new Date(value);return Number.isFinite(d.getTime())?new Intl.DateTimeFormat('he-IL',{day:'2-digit',month:'2-digit',year:'numeric',timeZone:'Asia/Jerusalem'}).format(d):'';};
export function emptyKnowledgeArticle():KnowledgeArticle{return {id:'',slug:'',title:'',excerpt:'',content:'',cover:'',coverAlt:'',author:'צוות MegaLinks',categories:[],tags:[],featured:false,seoTitle:'',seoDescription:'',version:0,updated:'',publishedAt:null,status:'draft',publicationDate:''};}
export function knowledgeSummary(article:KnowledgeArticle):KnowledgeSummary{const {content,...summary}=article;return {...summary,minutes:knowledgeMinutes(content)};}
// FAQ answers stay in the HTML (Google and AI engines read them); only the display folds them, one question per <details>
export function knowledgeFaqAccordion(html:string){
 const heading=/<h2[^>]*>([\s\S]*?)<\/h2>/gi;let m:RegExpExecArray|null,start=-1;
 while((m=heading.exec(html))){if(/שאלות נפוצות|שאלות ותשובות/.test(knowledgeText(m[1]))){start=m.index+m[0].length;break;}}
 if(start<0)return html;
 const next=html.indexOf('<h2',start),end=next<0?html.length:next,section=html.slice(start,end);
 if(!/<h3[\s>]/i.test(section))return html;
 const items=section.split(/(?=<h3[\s>])/i).map(part=>{const q=/^<h3([^>]*)>([\s\S]*?)<\/h3>([\s\S]*)$/i.exec(part);return q?`<details class="knowledge-faq-item"><summary><h3${q[1]}>${q[2]}</h3></summary><div class="knowledge-faq-answer">${q[3]}</div></details>`:part;});
 return html.slice(0,start)+items.join('')+html.slice(end);
}
// Cover credit convention: the alt text ends with "צילום: <name>, <site>" (as on the first guide); show it as a caption, keep the alt descriptive
export function knowledgeCoverCredit(alt:string){const at=alt.search(/צילום\s*:/);if(at<0)return {alt,credit:''};return {alt:alt.slice(0,at).replace(/[\s.,]+$/,'').trim(),credit:alt.slice(at).replace(/^צילום\s*:\s*/,'').trim()};}
export function knowledgeHeadings(html:string){const headings:{id:string;title:string}[]=[];const content=html.replace(/<h([23])([^>]*)>([\s\S]*?)<\/h\1>/gi,(_all,level,attrs,body)=>{const id='section-'+(headings.length+1);headings.push({id,title:knowledgeText(body).replace(/&amp;/g,'&')});return `<h${level}${attrs} id="${id}">${body}</h${level}>`;});return {content,headings};}
