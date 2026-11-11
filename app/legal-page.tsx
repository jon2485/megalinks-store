'use client';
import React,{useMemo} from 'react';
import {Headphones,ListTree,ShieldAlert} from 'lucide-react';
import {LEGAL_DOCS,legalDoc,type LegalDocId} from '@/lib/legal-docs';
import {LEGAL_CONTENT} from '@/lib/legal-content.generated';
import {parseLegalMarkdown,type LegalInline} from '@/lib/legal-markdown';
import './legal-page.css';

// One template for every legal page (terms, privacy, cancellations, supply, accessibility, cookies), in the look of the
// personal area: azure page, white rounded card, Heebo. The text comes from design/legal/drafts through
// lib/legal-content.generated.ts. While a document is a draft the page says so at the top.
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
   {LEGAL_DOCS.map(item=><a key={item.id} href={item.path} aria-current={item.id===id?'page':undefined} onClick={event=>{if(!plain(event))return;event.preventDefault();go(item.id);}}>{item.label}</a>)}
  </nav>
  <div className="legal-layout">
   {sections.length>1&&<aside className="legal-toc" aria-label="תוכן העניינים">
    <details open>
     <summary><ListTree size={18} aria-hidden="true"/>בעמוד זה</summary>
     <ol>{sections.map(section=><li key={section.id}><a href={'#'+section.id}>{section.text}</a></li>)}</ol>
    </details>
   </aside>}
   <div className="legal-card">
    {!content&&<p className="legal-empty" role="status">המסמך נמצא בהכנה ויפורסם לאחר אישור משפטי.</p>}
    {blocks.map((block,i)=>block.type==='h2'?<h2 key={i} id={block.id}>{block.text}</h2>
     :block.type==='h3'?<h3 key={i} id={block.id}>{block.text}</h3>
     :block.type==='p'?<p key={i}><Inline parts={block.inline} go={go}/></p>
     :block.type==='ul'?<ul key={i}>{block.items.map((item,n)=><li key={n}><Inline parts={item} go={go}/></li>)}</ul>
     :block.type==='ol'?<ol key={i}>{block.items.map((item,n)=><li key={n}><Inline parts={item} go={go}/></li>)}</ol>
     :block.type==='note'?<p key={i} className="legal-note"><Inline parts={block.inline} go={go}/></p>
     :<div key={i} className="legal-table" role="region" aria-label="טבלה" tabIndex={0}><table><thead><tr>{block.head.map((cell,n)=><th key={n} scope="col"><Inline parts={cell} go={go}/></th>)}</tr></thead><tbody>{block.rows.map((row,r)=><tr key={r}>{row.map((cell,n)=><td key={n}><Inline parts={cell} go={go}/></td>)}</tr>)}</tbody></table></div>)}
    <footer className="legal-contact">
     <div><strong>יש שאלה על המסמך הזה?</strong><span>אפשר לפנות אלינו ונחזור אליך.</span></div>
     <a className="legal-contact-button" href="/support" onClick={event=>{if(!plain(event))return;event.preventDefault();go('support');}}><Headphones size={18} aria-hidden="true"/>פנייה לתמיכה</a>
    </footer>
   </div>
  </div>
 </article>;
}
