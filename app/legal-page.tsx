'use client';
import React,{useEffect,useMemo,useState} from 'react';
import {Accessibility,ChevronDown,Cookie,FileText,Headphones,Info,ListTree,Lock,Phone,RotateCcw,Send,ShieldAlert} from 'lucide-react';
import {LEGAL_DOCS,legalDoc,type LegalDocId} from '@/lib/legal-docs';
import {LEGAL_CONTENT} from '@/lib/legal-content.generated';
import {parseLegalMarkdown,type LegalInline} from '@/lib/legal-markdown';
import './legal-page.css';

// One template for every legal page (terms, privacy, cancellations, supply, accessibility, cookies), in the look of the
// personal area: azure page, white rounded card, Heebo. The text comes from design/legal/drafts through
// lib/legal-content.generated.ts. While a document is a draft the page says so at the top.
// Owner (16.11.2026): a new look for every box on the page: document tiles with an icon, a numbered contents box,
// and one card per section instead of one long sheet.
const DOC_ICON:Record<string,React.ComponentType<{size?:number;'aria-hidden'?:boolean|'true'}>>={terms:FileText,privacy:Lock,cancellation:RotateCcw,supply:Send,accessibility:Accessibility,cookies:Cookie};
const numbered=(text:string)=>{const m=/^(\d+)\.\s*(.+)$/.exec(text);return m?{num:m[1],title:m[2]}:{num:'',title:text};};
const plain=(event:React.MouseEvent)=>event.button===0&&!event.metaKey&&!event.ctrlKey&&!event.shiftKey&&!event.altKey;
function Inline({parts,go}:{parts:LegalInline[];go:(view:string)=>void}){
 return <>{parts.map((part,i)=>part.kind==='bold'?<strong key={i}>{part.text}</strong>
  :part.kind==='missing'?<mark key={i} className="legal-missing">{part.text}</mark>
  :part.kind==='link'?(()=>{const target=LEGAL_DOCS.find(doc=>doc.path===part.href);
    return target?<a key={i} href={part.href} onClick={event=>{if(!plain(event))return;event.preventDefault();go(target.id);}}>{part.text}</a>
     :<a key={i} href={part.href} {...(part.href.startsWith('https://')?{target:'_blank',rel:'noopener noreferrer'}:{})}>{part.text}</a>;})()
  :<React.Fragment key={i}>{part.text}</React.Fragment>)}</>;
}
export default function LegalPage({id,go}:{id:LegalDocId;go:(view:string)=>void}){
 const doc=legalDoc(id)!,content=LEGAL_CONTENT[id];
 const blocks=useMemo(()=>content?parseLegalMarkdown(content.markdown):[],[content]);
 const sections=blocks.filter(block=>block.type==='h2') as {type:'h2';id:string;text:string}[];
 const groups=useMemo(()=>{const out:{head:{id:string;text:string}|null;blocks:typeof blocks}[]=[];for(const block of blocks){if(block.type==='h2')out.push({head:block as any,blocks:[]});else{if(!out.length)out.push({head:null,blocks:[]});out[out.length-1].blocks.push(block);}}return out;},[blocks]);
 // The contents list is open on a wide screen and starts closed on a phone, so the text itself is not pushed down.
 const [tocOpen,setTocOpen]=useState(true);
 useEffect(()=>{setTocOpen(!window.matchMedia('(max-width:900px)').matches);},[id]);
 return <article className="legal" dir="rtl" aria-labelledby="legal-title">
  <header className="legal-hero">
   <p className="legal-kicker">מידע משפטי</p>
   <h1 id="legal-title">{content?.title||doc.title}</h1>
   <p className="legal-summary">{doc.summary}</p>
   <div className="legal-meta">
    {(!content||content.draft)&&<span className="legal-draft" role="note"><ShieldAlert size={16} aria-hidden="true"/>טיוטה לאישור עורך דין</span>}
    {content?.updated&&<span>עודכן לאחרונה: <bdi>{content.updated}</bdi></span>}
    {content?.version&&<span>גרסה <bdi>{content.version}</bdi></span>}
   </div>
  </header>
  <nav className="legal-docs" aria-label="המסמכים המשפטיים של האתר">
   {LEGAL_DOCS.map(item=>{const Icon=DOC_ICON[item.id]||FileText;return <a key={item.id} href={item.path} aria-current={item.id===id?'page':undefined} onClick={event=>{if(!plain(event))return;event.preventDefault();go(item.id);}}><span className="legal-doc-icon"><Icon size={19} aria-hidden="true"/></span><span className="legal-doc-label">{item.label}</span></a>;})}
  </nav>
  <div className="legal-layout">
   {sections.length>1&&<aside className="legal-toc" aria-label="תוכן העניינים">
    <details open={tocOpen} onToggle={event=>setTocOpen((event.currentTarget as HTMLDetailsElement).open)}>
     <summary><span className="legal-toc-icon"><ListTree size={18} aria-hidden="true"/></span><span className="legal-toc-title">בעמוד זה</span><span className="legal-toc-count">{sections.length} סעיפים</span><ChevronDown size={18} className="legal-toc-chevron" aria-hidden="true"/></summary>
     <ol>{sections.map(section=>{const n=numbered(section.text);return <li key={section.id}><a href={'#'+section.id}>{n.num&&<span className="legal-toc-num">{n.num}</span>}<span>{n.title}</span></a></li>;})}</ol>
    </details>
   </aside>}
   <div className="legal-sections">
    {!content&&<div className="legal-card"><p className="legal-empty" role="status">המסמך נמצא בהכנה ויפורסם בקרוב.</p></div>}
    {groups.map((group,g)=>{const n=group.head?numbered(group.head.text):null;
     return <section key={g} className={'legal-card'+(group.head?'':' legal-card-intro')} aria-labelledby={group.head?.id}>
      {group.head&&<h2 id={group.head.id}>{n!.num&&<span className="legal-num" aria-hidden="true">{n!.num}</span>}<span>{n!.num?<><span className="sr-only">{n!.num}. </span>{n!.title}</>:n!.title}</span></h2>}
      {group.blocks.map((block,i)=>block.type==='h3'?<h3 key={i} id={block.id}>{block.text}</h3>
       :block.type==='p'?<p key={i}><Inline parts={block.inline} go={go}/></p>
       :block.type==='ul'?<ul key={i}>{block.items.map((item,k)=><li key={k}><Inline parts={item} go={go}/></li>)}</ul>
       :block.type==='ol'?<ol key={i}>{block.items.map((item,k)=><li key={k}><Inline parts={item} go={go}/></li>)}</ol>
       :block.type==='note'?<p key={i} className="legal-note"><Info size={18} aria-hidden="true"/><span><Inline parts={block.inline} go={go}/></span></p>
       :block.type==='table'?<div key={i} className="legal-table" role="region" aria-label={'טבלה'+(n?': '+n.title:'')+(group.blocks.filter(b=>b.type==='table').length>1?' '+group.blocks.slice(0,i+1).filter(b=>b.type==='table').length:'')} tabIndex={0}><table><thead><tr>{block.head.map((cell,k)=><th key={k} scope="col"><Inline parts={cell} go={go}/></th>)}</tr></thead><tbody>{block.rows.map((row,r)=><tr key={r}>{row.map((cell,k)=><td key={k} data-label={(block.head[k]||[]).map(part=>part.text).join('')}><Inline parts={cell} go={go}/></td>)}</tr>)}</tbody></table></div>
       :null)}
     </section>;})}
    <footer className="legal-card legal-contact">
     <div><strong>יש שאלה על המסמך הזה?</strong><span>אפשר להתקשר אלינו, וגם בלי להתחבר לחשבון. לקוחות מחוברים יכולים לפתוח פנייה לתמיכה.</span></div>
     <div className="legal-contact-actions">
      <a className="legal-contact-phone" href="tel:+972507508850" aria-label="התקשרו למגה לינקס: 050-750-8850"><Phone size={18} aria-hidden="true"/><bdi>050-750-8850</bdi></a>
      <a className="legal-contact-button" href="/support" onClick={event=>{if(!plain(event))return;event.preventDefault();go('support');}}><Headphones size={18} aria-hidden="true"/>פנייה לתמיכה</a>
     </div>
    </footer>
   </div>
  </div>
 </article>;
}
