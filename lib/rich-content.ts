import { editorialTags, blockedEditorialTags, safeEditorialStyle, editorialUrl, editorialFileId } from './editor-html';
// Preserve document formatting while retaining only safe editorial markup.
export async function sanitizeRichHtml(input: string) {
    const rewriter = new HTMLRewriter().on('*', { element(el: any) {
        const tag = el.tagName;
        if (blockedEditorialTags.has(tag)) { el.remove(); return; }
        if (!editorialTags.has(tag)) { el.removeAndKeepContent(); return; }
        const href = el.getAttribute('href');
        const align = el.getAttribute('align');
        const style=safeEditorialStyle(el.getAttribute('style')||'');
        const src=el.getAttribute('src')||'',credit=(el.getAttribute('data-credit')||'').trim().slice(0,300),alt=(el.getAttribute('alt')||'').slice(0,300);
        for (const [name] of Array.from(el.attributes as Iterable<[string,string]>)) el.removeAttribute(name);
        if (tag === 'a' && href && editorialUrl(href)) {el.setAttribute('href',editorialUrl(href));el.setAttribute('rel','noopener noreferrer');}
        if (tag==='img') {if(!editorialFileId(src)){el.remove();return;}el.setAttribute('src',src);el.setAttribute('data-credit',credit);el.setAttribute('alt',alt);}
        if(tag==='figure')el.setAttribute('contenteditable','false');
        if(style)el.setAttribute('style',style);
        if (['left','right','center'].includes(align || '')) el.setAttribute('align',align!);
    } });
    return await rewriter.transform(new Response(input)).text();
}

export async function inlineImages(input:string) {
    const images:{id:string;credit:string}[]=[];
    await new HTMLRewriter().on('img',{element(el:any){images.push({id:editorialFileId(el.getAttribute('src')||''),credit:(el.getAttribute('data-credit')||'').trim()});}}).transform(new Response(input)).text();
    return images;
}

// Supplier-specific URLs expose only images from the authorized article.
export async function supplierContent(input:string,prefix:string){return await new HTMLRewriter().on('img',{element(el:any){const id=editorialFileId(el.getAttribute('src')||'');if(id)el.setAttribute('src',prefix+encodeURIComponent(id));}}).transform(new Response(input)).text();}
