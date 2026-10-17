import assert from 'node:assert/strict';
import {formatSelectedText,styleSelectedText} from '../lib/editor-format.ts';
// A small DOM contract fixture exercises text splitting and structure preservation.
class Element {
 nodeType=1;parentNode=null;attrs={};childNodes=[];
 constructor(tag,doc){this.tag=tag;this.ownerDocument=doc;this.style={setProperty:(k,v)=>{this.attrs.style=k+':'+v;}};}
 get parentElement(){return this.parentNode;}
 get textContent(){return this.childNodes.map(n=>n.textContent).join('');}
 contains(node){return node===this||this.childNodes.some(c=>c===node||c.contains?.(node));}
 setAttribute(k,v){this.attrs[k]=v;}
 closest(){let n=this;while(n){if(n.attrs?.contenteditable==='false')return n;n=n.parentNode;}return null;}
 insertBefore(node,before){if(node.parentNode){const list=node.parentNode.childNodes;list.splice(list.indexOf(node),1);}const index=before?this.childNodes.indexOf(before):this.childNodes.length;this.childNodes.splice(index,0,node);node.parentNode=this;return node;}
 appendChild(node){return this.insertBefore(node,null);}
}
class Text {
 nodeType=3;parentNode=null;
 constructor(data){this.data=data;}
 get textContent(){return this.data;}get length(){return this.data.length;}get parentElement(){return this.parentNode;}
 splitText(at){const after=new Text(this.data.slice(at));this.data=this.data.slice(0,at);const parent=this.parentNode;parent.insertBefore(after,parent.childNodes[parent.childNodes.indexOf(this)+1]||null);return after;}
}
const doc={createElement:tag=>new Element(tag,doc),createTreeWalker:root=>{const list=[];function visit(n){if(n.nodeType===3)list.push(n);else n.childNodes.forEach(visit);}visit(root);let i=-1;return {nextNode(){return ++i<list.length;},get currentNode(){return list[i];}};},createRange:()=>({setStart(node,at){this.startContainer=node;this.startOffset=at;},setEnd(node,at){this.endContainer=node;this.endOffset=at;}}),defaultView:{getComputedStyle(el){let weight='400',italic='normal';const chain=[];while(el){chain.unshift(el);el=el.parentNode;}for(const e of chain){if(e.tag==='strong'||e.tag==='b')weight='700';if(e.tag==='em'||e.tag==='i')italic='italic';weight=/font-weight:(\d+)/.exec(e.attrs.style||'')?.[1]||weight;italic=/font-style:(\w+)/.exec(e.attrs.style||'')?.[1]||italic;}return {fontWeight:weight,fontStyle:italic};}}};
const root=doc.createElement('div'),p=doc.createElement('p'),anchor=doc.createElement('a'),normal=doc.createElement('span');root.appendChild(p);p.appendChild(anchor);anchor.attrs.href='https://example.com/internal/page';anchor.appendChild(normal);normal.attrs.style='font-weight:400';const text=new Text('אחת שתיים שלוש');normal.appendChild(text);
const selection={collapsed:false,commonAncestorContainer:normal,startContainer:text,startOffset:4,endContainer:text,endOffset:9,intersectsNode:node=>node===text};
const result=formatSelectedText(root,selection,'bold');assert.equal(root.textContent,'אחת שתיים שלוש');assert.equal(result.startContainer.textContent,'שתיים');assert.equal(result.startContainer.parentNode.tag,'strong');assert.equal(result.startContainer.parentNode.attrs.style,'font-weight:700');assert.equal(anchor.attrs.href,'https://example.com/internal/page');assert.equal(normal.childNodes[0].textContent,'אחת ');assert.equal(normal.childNodes.at(-1).textContent,' שלוש');
const off=formatSelectedText(root,{...result,collapsed:false,commonAncestorContainer:normal,intersectsNode:n=>n===result.startContainer},'bold');assert.equal(off.startContainer.parentNode.attrs.style,'font-weight:400');
const second=doc.createElement('p');root.appendChild(second);const other=new Text('פסקה נוספת');second.appendChild(other);const first=off.startContainer;
formatSelectedText(root,{collapsed:false,commonAncestorContainer:root,startContainer:first,startOffset:0,endContainer:other,endOffset:4,intersectsNode:n=>n===first||n===other},'bold');assert.deepEqual(root.childNodes.map(n=>n.tag),['p','p']);assert.equal(other.parentNode.textContent,'פסקה');assert.equal(second.childNodes.at(-1).textContent,' נוספת');assert.equal(anchor.attrs.href,'https://example.com/internal/page');
console.log('Bold formatting: selected words only, normal Word styles overridden, toggle and cross-paragraph links preserved');

const linkedText=off.startContainer;const styled=styleSelectedText(root,{collapsed:false,commonAncestorContainer:root,startContainer:linkedText,startOffset:0,endContainer:linkedText,endOffset:linkedText.length,intersectsNode:n=>n===linkedText},'font-size','24pt');assert.equal(styled.startContainer.parentNode.attrs.style,'font-size:24pt');assert.equal(anchor.attrs.href,'https://example.com/internal/page');assert.deepEqual(root.childNodes.map(n=>n.tag),['p','p']);assert.equal(root.textContent,'אחת שתיים שלושפסקה נוספת');
const coloured=styleSelectedText(root,{...styled,collapsed:false,commonAncestorContainer:root,intersectsNode:n=>n===styled.startContainer},'color','#123456');assert.equal(coloured.startContainer.parentNode.attrs.style,'color:#123456');assert.equal(anchor.attrs.href,'https://example.com/internal/page');
console.log('Selected typography preserves paragraph structure, original text and independent anchors');
