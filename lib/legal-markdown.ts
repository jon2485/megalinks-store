// A small, safe reader for the legal drafts in design/legal/drafts/*.md.
// It understands only what those drafts use: "## " and "### " headings, paragraphs, "- " bullets, "1. " numbered
// lists, pipe tables, "> " notes, **bold**, [text](link) and the "[חסר: ...]" placeholder. Nothing is rendered as HTML.
export type LegalInline={kind:'text'|'bold'|'missing';text:string}|{kind:'link';text:string;href:string};
export type LegalBlock=
 |{type:'h2';id:string;text:string}
 |{type:'h3';id:string;text:string}
 |{type:'p';inline:LegalInline[]}
 |{type:'ul';items:LegalInline[][]}
 |{type:'ol';items:LegalInline[][]}
 |{type:'table';head:LegalInline[][];rows:LegalInline[][][]}
 |{type:'note';inline:LegalInline[]};

const safeHref=(href:string)=>/^(\/[^/]|#|mailto:|tel:|https:\/\/)/.test(href)?href:'';

export function legalInline(source:string):LegalInline[] {
 const out:LegalInline[]=[],pattern=/\*\*([^*]+)\*\*|\[(חסר[^\]]*)\]|\[([^\]]+)\]\(([^)\s]+)\)/g;
 let last=0,match:RegExpExecArray|null;
 while((match=pattern.exec(source))){
  if(match.index>last)out.push({kind:'text',text:source.slice(last,match.index)});
  if(match[1]!==undefined)out.push({kind:'bold',text:match[1]});
  else if(match[2]!==undefined)out.push({kind:'missing',text:'['+match[2]+']'});
  else{const href=safeHref(match[4]);out.push(href?{kind:'link',text:match[3],href}:{kind:'text',text:match[3]});}
  last=match.index+match[0].length;
 }
 if(last<source.length)out.push({kind:'text',text:source.slice(last)});
 return out;
}

const cells=(line:string)=>line.trim().replace(/^\|/,'').replace(/\|$/,'').split('|').map(cell=>legalInline(cell.trim()));

export function parseLegalMarkdown(markdown:string):LegalBlock[] {
 const blocks:LegalBlock[]=[],lines=markdown.replace(/\r\n?/g,'\n').split('\n');
 let paragraph:string[]=[],headings=0;
 const flush=()=>{if(paragraph.length){blocks.push({type:'p',inline:legalInline(paragraph.join(' '))});paragraph=[];}};
 for(let i=0;i<lines.length;i++){
  const line=lines[i].trimEnd(),text=line.trim();
  if(!text){flush();continue;}
  if(text.startsWith('# ')&&!blocks.length&&!paragraph.length)continue; // the document title is shown by the page header
  const heading=/^(#{2,3})\s+(.*)$/.exec(text);
  if(heading){flush();blocks.push({type:heading[1].length===2?'h2':'h3',id:'s'+(++headings),text:heading[2].replace(/\*\*/g,'')});continue;}
  if(/^\|.*\|$/.test(text)&&/^\|?\s*:?-{2,}/.test((lines[i+1]||'').trim())){
   flush();const head=cells(text),rows:LegalInline[][][]=[];i+=2;
   while(i<lines.length&&/^\|.*\|$/.test(lines[i].trim())){rows.push(cells(lines[i]));i++;}
   i--;blocks.push({type:'table',head,rows});continue;
  }
  if(/^[-*]\s+/.test(text)||/^\d+\.\s+/.test(text)){
   flush();const ordered=/^\d+\.\s+/.test(text),items:LegalInline[][]=[],mark=ordered?/^\d+\.\s+/:/^[-*]\s+/;
   while(i<lines.length&&mark.test(lines[i].trim())){
    let item=lines[i].trim().replace(mark,'');
    while(i+1<lines.length&&/^\s{2,}\S/.test(lines[i+1])&&!/^\s*([-*]|\d+\.)\s+/.test(lines[i+1])){item+=' '+lines[i+1].trim();i++;}
    items.push(legalInline(item));i++;
   }
   i--;blocks.push(ordered?{type:'ol',items}:{type:'ul',items});continue;
  }
  if(text.startsWith('>')){
   flush();const note:string[]=[];
   while(i<lines.length&&lines[i].trim().startsWith('>')){note.push(lines[i].trim().replace(/^>\s?/,''));i++;}
   i--;blocks.push({type:'note',inline:legalInline(note.join(' '))});continue;
  }
  if(/^-{3,}$/.test(text)){flush();continue;}
  paragraph.push(text);
 }
 flush();
 return blocks;
}
