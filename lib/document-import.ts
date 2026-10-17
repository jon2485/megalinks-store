import { unzipSync, strFromU8 } from 'fflate';
import { editorialTags, blockedEditorialTags, safeEditorialStyle, editorialUrl } from './editor-html';

export type ImportedImage = { token:string; file:File };
export type ImportedDocument = { html:string; title:string; images:ImportedImage[] };
const W='http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const R='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const esc=(v:string)=>v.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const child=(e:Element|undefined|null,n:string)=>e?Array.from(e.children).find(x=>x.localName===n):undefined;
const val=(e:Element|undefined|null,n='val')=>e?.getAttributeNS(W,n)||e?.getAttribute('w:'+n)||'';
const descendants=(e:Element|Document,n:string)=>Array.from(e.getElementsByTagNameNS(W,n));
const parse=(text:string)=>{const doc=new DOMParser().parseFromString(text,'application/xml');if(doc.getElementsByTagName('parsererror').length)throw new Error('מבנה מסמך Word אינו תקין');return doc;};

export function sanitizeImportedHtml(html:string) {
    const doc=new DOMParser().parseFromString(html,'text/html');
    doc.querySelectorAll(Array.from(blockedEditorialTags).join(',')).forEach(e=>e.remove());
    doc.body.querySelectorAll('*').forEach(e=>{
        const tag=e.tagName.toLowerCase();if(!editorialTags.has(tag)){e.replaceWith(...Array.from(e.childNodes));return;}
        const style=safeEditorialStyle(e.getAttribute('style')||''),href=editorialUrl(e.getAttribute('href')||'');
        for(const name of e.getAttributeNames())e.removeAttribute(name);
        // HTML imports never fetch remote images or accept active URLs.
        if(tag==='img'){e.remove();return;}
        if(style)e.setAttribute('style',style);
        if(tag==='a'&&href){e.setAttribute('href',href);e.setAttribute('rel','noopener noreferrer');}
    });
    return doc.body.innerHTML;
}

export async function importRichDocument(file:File):Promise<ImportedDocument> {
    if(file.size>15*1024*1024)throw new Error('מותר מסמך עד 15MB');
    if(/\.(txt|md)$/i.test(file.name))return {html:(await file.text()).split(/\n\s*\n/).map(p=>'<p>'+esc(p).replace(/\n/g,'<br>')+'</p>').join(''),title:'',images:[]};
    if(/\.html?$/i.test(file.name))return {html:sanitizeImportedHtml(await file.text()),title:'',images:[]};
    if(!/\.docx$/i.test(file.name))throw new Error('בחרו מסמך Word מסוג DOCX, טקסט או HTML');
    let total=0;
    const files=unzipSync(new Uint8Array(await file.arrayBuffer()),{filter:f=>{
        if(!['word/document.xml','word/styles.xml','word/numbering.xml','word/_rels/document.xml.rels'].includes(f.name)&&!/^word\/media\/[^/]+$/.test(f.name))return false;
        total+=f.originalSize;if(f.originalSize>15*1024*1024||total>25*1024*1024)throw new Error('המסמך גדול מדי לעיבוד');return true;
    }});
    if(!files['word/document.xml'])throw new Error('קובץ Word אינו תקין');
    const doc=parse(strFromU8(files['word/document.xml']));
    const styles=new Map<string,Element>(),relationships=new Map<string,{target:string;type:string}>();
    const styleDoc=files['word/styles.xml']?parse(strFromU8(files['word/styles.xml'])):undefined;
    styleDoc&&descendants(styleDoc,'style').forEach(s=>styles.set(val(s,'styleId'),s));
    if(files['word/_rels/document.xml.rels'])Array.from(parse(strFromU8(files['word/_rels/document.xml.rels'])).getElementsByTagNameNS('*','Relationship')).forEach(e=>relationships.set(e.getAttribute('Id')||'',{target:e.getAttribute('Target')||'',type:e.getAttribute('Type')||''}));
    const defaults=styleDoc?.getElementsByTagNameNS(W,'rPrDefault')[0];
    const chain=(id:string,seen=new Set<string>()):Element[]=>{if(seen.has(id)||!styles.has(id))return [];seen.add(id);const s=styles.get(id)!;return [...chain(val(child(s,'basedOn')),seen),s];};
    const props=(nodes:(Element|undefined)[])=>{const result=new Map<string,Element>();nodes.forEach(n=>n&&Array.from(n.children).forEach(c=>result.set(c.localName,c)));return result;};
    const runHtml=(r:Element,pStyle:Element[])=>{
        const rr=child(r,'rPr'),rStyles=chain(val(child(rr,'rStyle')));
        const p=props([child(defaults,'rPr'),...pStyle.map(s=>child(s,'rPr')),...rStyles.map(s=>child(s,'rPr')),rr]);
        let text=Array.from(r.children).map(e=>e.localName==='t'?esc(e.textContent||''):['br','cr'].includes(e.localName)?'<br>':e.localName==='tab'?'&emsp;':'').join('');
        const css:string[]=[];const color=val(p.get('color'));if(/^[\da-f]{6}$/i.test(color))css.push('color:#'+color);
        const size=Number(val(p.get('sz')));if(size>=12&&size<=144)css.push('font-size:'+size/2+'pt');
        const fonts=p.get('rFonts'),font=val(fonts,'cs')||val(fonts,'ascii');if(font)css.push('font-family:'+font);
        const highlight=val(p.get('highlight'));if(highlight&&highlight!=='none')css.push('background-color:'+highlight);
        const on=(name:string)=>p.has(name)&&!['0','false','off','none'].includes(val(p.get(name)));
        if(on('b')||on('bCs'))text='<strong>'+text+'</strong>';if(on('i')||on('iCs'))text='<em>'+text+'</em>';if(on('u'))text='<u>'+text+'</u>';if(on('strike'))text='<s>'+text+'</s>';
        const safe=safeEditorialStyle(css.join(';'));return safe?'<span style="'+esc(safe)+'">'+text+'</span>':text;
    };
    const numbering=files['word/numbering.xml']?parse(strFromU8(files['word/numbering.xml'])):undefined;
    const images:ImportedImage[]=[];let title='';
    const paragraph=(p:Element)=>{
        const pp=child(p,'pPr'),styleId=val(child(pp,'pStyle')),ps=chain(styleId||Array.from(styles.entries()).find(([,s])=>val(s,'type')==='paragraph'&&val(s,'default')==='1')?.[0]||'Normal'),pr=props([...ps.map(s=>child(s,'pPr')),pp]);
        let level=val(pr.get('outlineLvl'));const headingName=[styleId,...ps.map(s=>val(child(s,'name')))].join(' ');const match=headingName.match(/heading\s*([1-6])/i);
        let tag=match?'h'+match[1]:level&&Number(level)<6?'h'+(Number(level)+1):/\btitle\b/i.test(headingName)?'h1':'p';
        const css:string[]=[];const align=val(pr.get('jc'));if(['right','left','center','both','justify'].includes(align))css.push('text-align:'+(align==='both'?'justify':align));
        if(pr.has('bidi')&&!['0','false','off'].includes(val(pr.get('bidi'))))css.push('direction:rtl');
        const spacing=pr.get('spacing');for(const [attr,key] of [['before','margin-top'],['after','margin-bottom']]){const num=Number(val(spacing,attr));if(num>0&&num<=1440)css.push(key+':'+num/20+'pt');}
        const line=Number(val(spacing,'line'));if(line>=240&&line<=720&&val(spacing,'lineRule')!=='exact')css.push('line-height:'+line/240);
        let content='';
        const visit=(node:Element):string=>{
            if(node.localName==='r')return runHtml(node,ps);
            if(node.localName==='hyperlink') {const rel=relationships.get(node.getAttributeNS(R,'id')||node.getAttribute('r:id')||'');const href=editorialUrl(rel?.target||'');const inner=Array.from(node.children).map(visit).join('');return href?'<a href="'+esc(href)+'" rel="noopener noreferrer">'+inner+'</a>':inner;}
            if(node.localName==='fldSimple'){const instruction=val(node,'instr');const target=/HYPERLINK\s+"([^"]+)"/i.exec(instruction)?.[1];const href=editorialUrl(target||'');const inner=Array.from(node.children).map(visit).join('');return href?'<a href="'+esc(href)+'">'+inner+'</a>':inner;}
            return Array.from(node.children).map(visit).join('');
        };
        let fieldInstruction='',fieldContent='',inField=false,fieldResult=false;
        for(const node of Array.from(p.children).filter(e=>e.localName!=='pPr')) {
            const marker=node.localName==='r'?child(node,'fldChar'):undefined,kind=val(marker,'fldCharType');
            if(kind==='begin'){inField=true;fieldInstruction='';fieldContent='';fieldResult=false;continue;}
            if(kind==='separate'){fieldResult=true;continue;}
            if(kind==='end'){const href=editorialUrl(/HYPERLINK\s+"([^"]+)"/i.exec(fieldInstruction)?.[1]||'');content+=href?'<a href="'+esc(href)+'">'+fieldContent+'</a>':fieldContent;inField=false;fieldResult=false;continue;}
            if(inField&&!fieldResult){fieldInstruction+=descendants(node,'instrText').map(e=>e.textContent||'').join('');continue;}
            if(inField)fieldContent+=visit(node);else content+=visit(node);
        }
        if(inField)content+=fieldContent;
        // Word images enter the same mandatory-credit confirmation flow as uploads.
        const blips=Array.from(p.getElementsByTagNameNS('*','blip'));
        for(const b of blips){const rel=relationships.get(b.getAttributeNS(R,'embed')||b.getAttribute('r:embed')||'');if(!rel?.type.endsWith('/image'))continue;const path=rel.target.startsWith('/')?rel.target.slice(1):'word/'+rel.target;const bytes=files[path];const ext=path.split('.').pop()?.toLowerCase();const mime=({png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',gif:'image/gif'} as Record<string,string>)[ext||''];if(bytes&&mime){if(images.length>=10)throw new Error('ניתן לייבא עד 10 תמונות במסמך');const token='word-image-'+images.length;images.push({token,file:new File([bytes as BlobPart],token+'.'+ext,{type:mime})});content+='<figure data-import-image="'+token+'"></figure>';}}
        if(!title&&tag==='h1')title=(p.textContent||'').trim().slice(0,300);
        let list='';const numPr=pr.get('numPr');if(numPr&&numbering){const numId=val(child(numPr,'numId')),ilvl=val(child(numPr,'ilvl'))||'0';const num=descendants(numbering,'num').find(e=>val(e,'numId')===numId);const abs=val(child(num,'abstractNumId'));const def=descendants(numbering,'abstractNum').find(e=>val(e,'abstractNumId')===abs);const lvl=def&&descendants(def,'lvl').find(e=>val(e,'ilvl')===ilvl);list=val(child(lvl,'numFmt'))==='bullet'?'ul':'ol';tag='li';}
        return {html:`<${tag}${css.length?' style="'+esc(safeEditorialStyle(css.join(';'))) +'"':''}>${content||'<br>'}</${tag}>`,list};
    };
    const body=doc.getElementsByTagNameNS(W,'body')[0];if(!body)throw new Error('גוף המסמך אינו תקין');
    const blocks=(parent:Element):string=>{let html='',list='';for(const e of Array.from(parent.children)){if(e.localName==='p'){const p=paragraph(e);if(p.list!==list){if(list)html+='</'+list+'>';list=p.list;if(list)html+='<'+list+'>';}html+=p.html;}else{if(list){html+='</'+list+'>';list='';}if(e.localName==='tbl')html+='<table><tbody>'+Array.from(e.children).filter(r=>r.localName==='tr').map(r=>'<tr>'+Array.from(r.children).filter(c=>c.localName==='tc').map(c=>'<td>'+blocks(c)+'</td>').join('')+'</tr>').join('')+'</tbody></table>';}}if(list)html+='</'+list+'>';return html;};
    return {html:blocks(body),title,images};
}
