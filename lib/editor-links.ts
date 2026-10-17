// Range-based links: only the selected words change; neighbouring anchors survive.
export function selectionAnchor(range:Range,root:HTMLElement):HTMLAnchorElement|null {
    const element=(n:Node,offset:number,end=false)=>{if(n.nodeType!==1)return n.parentElement;const at=n.childNodes[end?offset-1:offset];return at?(at.nodeType===1?at as Element:at.parentElement):n as Element;};
    const a=element(range.startContainer,range.startOffset)?.closest('a');
    return a&&root.contains(a)&&a===element(range.endContainer,range.endOffset,!range.collapsed)?.closest('a')?a as HTMLAnchorElement:null;
}
// A click inside a link can leave the browser caret on its parent boundary.
// Use that clicked link only for a collapsed caret, never for a new text selection.
export function linkSelectionForEditing(range:Range|null,root:HTMLElement,clicked:HTMLAnchorElement|null=null) {
    const current=range?.cloneRange()||root.ownerDocument.createRange();
    const anchor=range?selectionAnchor(current,root):null;
    const existing=anchor||((!range||current.collapsed)&&clicked&&root.contains(clicked)?clicked:null);
    if(existing){current.selectNodeContents(existing);return {range:current,url:existing.getAttribute('href')||''};}
    if(!range||current.collapsed||!root.contains(current.commonAncestorContainer))throw new Error('סמנו מילה או כמה מילים בתוך המאמר');
    return {range:current,url:''};
}
// Word often stores hyperlink colour on nested runs. Normalise only the
// extracted selection, leaving adjacent links and unrelated formatting intact.
export function linkTextColor(fragment:DocumentFragment,linked:boolean) {
    fragment.querySelectorAll<HTMLElement>('[style]').forEach(el=>{
        if(!el.closest('figure')&&el.style.color)el.style.color='inherit';
    });
    if(linked)return;
    const doc=fragment.ownerDocument,walker=doc.createTreeWalker(fragment,4),texts:Text[]=[];
    while(walker.nextNode()){
        const text=walker.currentNode as Text;
        if(text.textContent?.trim()&&!text.parentElement?.closest('figure'))texts.push(text);
    }
    for(const text of texts){const span=doc.createElement('span');span.style.color='#0f172a';text.parentNode!.insertBefore(span,text);span.appendChild(text);}
}
export function applySelectionLink(range:Range,url:string,root:HTMLElement) {
    if(!root.contains(range.commonAncestorContainer)||range.collapsed)throw new Error('סמנו מילה או כמה מילים בתוך המאמר');
    const doc=root.ownerDocument;
    const end=doc.createElement('span'),start=doc.createElement('span');
    const er=range.cloneRange();er.collapse(false);er.insertNode(end);
    const sr=range.cloneRange();sr.collapse(true);sr.insertNode(start);
    // Move boundary markers outside existing anchors, splitting rather than overwriting them.
    for(const marker of [end,start]) {
        const anchor=marker.closest('a');if(!anchor)continue;
        const before=doc.createRange();before.setStart(anchor,0);before.setEndBefore(marker);
        const prefix=anchor.cloneNode(false) as HTMLAnchorElement;prefix.appendChild(before.extractContents());
        anchor.parentNode!.insertBefore(prefix,anchor);anchor.parentNode!.insertBefore(marker,anchor);if(!prefix.hasChildNodes())prefix.remove();if(!anchor.hasChildNodes())anchor.remove();
    }
    const selected=doc.createRange();selected.setStartAfter(start);selected.setEndBefore(end);
    const fragment=selected.extractContents();fragment.querySelectorAll('a').forEach(a=>a.replaceWith(...Array.from(a.childNodes)));
    linkTextColor(fragment,!!url);
    if(url) {
        if(fragment.querySelector('p,div,h1,h2,h3,h4,h5,h6,li')) {
            const walker=doc.createTreeWalker(fragment,4);const nodes:Node[]=[];while(walker.nextNode())nodes.push(walker.currentNode);
            nodes.filter(n=>n.textContent?.trim()&&!n.parentElement?.closest('figure')).forEach(n=>{const a=doc.createElement('a');a.href=url;a.rel='noopener noreferrer';a.style.color='#2563eb';n.parentNode?.insertBefore(a,n);a.appendChild(n);});
        } else {const a=doc.createElement('a');a.href=url;a.rel='noopener noreferrer';a.style.color='#2563eb';Array.from(fragment.childNodes).forEach(n=>a.appendChild(n));fragment.appendChild(a);}
    }
    selected.insertNode(fragment);
    const caret=doc.createRange();caret.setStartBefore(end);caret.collapse(true);
    start.remove();end.remove();root.querySelectorAll('a').forEach(a=>{if(!a.textContent&&!a.querySelector('img'))a.remove();});
    return caret;
}
