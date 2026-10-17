// Format selected text nodes in place: preserve paragraph boundaries and each link.
export function formatSelectedText(root:HTMLElement,range:Range,kind:'bold'|'italic') {
    if(range.collapsed||!root.contains(range.commonAncestorContainer))return null;
    const doc=root.ownerDocument,view=doc.defaultView;
    const property=kind==='bold'?'font-weight':'font-style';
    const walker=doc.createTreeWalker(root,4),segments:{node:Text;start:number;end:number}[]=[];
    while(walker.nextNode()){
        const node=walker.currentNode as Text;
        if(!range.intersectsNode(node)||node.parentElement?.closest('[contenteditable="false"]'))continue;
        const start=range.startContainer===node?range.startOffset:0,end=range.endContainer===node?range.endOffset:node.length;
        if(end>start&&node.textContent?.slice(start,end).trim())segments.push({node,start,end});
    }
    if(!segments.length)return null;
    const already=segments.every(({node})=>{const style=view?.getComputedStyle(node.parentElement!);return kind==='bold'?Number(style?.fontWeight)>=600:style?.fontStyle==='italic';});
    const formatted:Text[]=[];
    for(const {node,start,end} of segments){
        if(end<node.length)node.splitText(end);
        const selected=start?node.splitText(start):node;
        const mark=doc.createElement(already?'span':kind==='bold'?'strong':'em');
        mark.setAttribute('style',property+':'+(kind==='bold'?(already?'400':'700'):(already?'normal':'italic')));
        selected.parentNode!.insertBefore(mark,selected);mark.appendChild(selected);formatted.push(selected);
    }
    const result=doc.createRange();result.setStart(formatted[0],0);const last=formatted[formatted.length-1];result.setEnd(last,last.length);return result;
}

// Apply typography to each selected text segment without nesting whole paragraphs
// or merging anchors. The persistence boundary already permits these CSS properties.
export function styleSelectedText(root:HTMLElement,range:Range,property:'font-size'|'font-family'|'color'|'background-color',value:string) {
    if(range.collapsed||!root.contains(range.commonAncestorContainer))return null;
    const doc=root.ownerDocument,walker=doc.createTreeWalker(root,4),segments:{node:Text;start:number;end:number}[]=[];
    while(walker.nextNode()){
        const node=walker.currentNode as Text;
        if(!range.intersectsNode(node)||node.parentElement?.closest('[contenteditable="false"]'))continue;
        const start=range.startContainer===node?range.startOffset:0,end=range.endContainer===node?range.endOffset:node.length;
        if(end>start)segments.push({node,start,end});
    }
    const formatted:Text[]=[];
    for(const {node,start,end} of segments){
        if(end<node.length)node.splitText(end);
        const selected=start?node.splitText(start):node;
        const mark=doc.createElement('span');mark.style.setProperty(property,value);
        selected.parentNode!.insertBefore(mark,selected);mark.appendChild(selected);formatted.push(selected);
    }
    if(!formatted.length)return null;
    const result=doc.createRange();result.setStart(formatted[0],0);const last=formatted[formatted.length-1];result.setEnd(last,last.length);return result;
}
