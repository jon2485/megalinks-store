import assert from 'node:assert/strict';
import {linkTextColor} from '../lib/editor-links.ts';
// DOM contract fixture for the extracted selection, including nested Word runs.
class Element {
 nodeType=1;childNodes=[];parentNode=null;style={};
 constructor(tag){this.tag=tag;this.ownerDocument=doc;}
 get parentElement(){return this.parentNode?.nodeType===1?this.parentNode:null;}
 get textContent(){return this.childNodes.map(n=>n.textContent).join('');}
 closest(tag){for(let n=this;n;n=n.parentNode)if(n.tag===tag)return n;return null;}
 insertBefore(n,before){if(n.parentNode)n.parentNode.childNodes.splice(n.parentNode.childNodes.indexOf(n),1);const i=before?this.childNodes.indexOf(before):this.childNodes.length;this.childNodes.splice(i,0,n);n.parentNode=this;return n;}
 appendChild(n){return this.insertBefore(n,null);}
 querySelectorAll(){const all=[];function walk(n){for(const c of n.childNodes||[]){if(c.nodeType===1&&Object.keys(c.style).length)all.push(c);walk(c);}}walk(this);return all;}
}
class Text {nodeType=3;parentNode=null;constructor(text){this.textContent=text;}get parentElement(){return this.parentNode;}}
const doc={createElement:tag=>new Element(tag),createTreeWalker:root=>{const texts=[];function walk(n){if(n.nodeType===3)texts.push(n);else n.childNodes.forEach(walk);}walk(root);let i=-1;return {nextNode(){return ++i<texts.length;},get currentNode(){return texts[i];}};}};
const selected=new Element('fragment');selected.nodeType=11;
const strong=selected.appendChild(new Element('strong'));strong.style.fontWeight='700';
const wordRun=strong.appendChild(new Element('span'));wordRun.style.color='#0000ff';wordRun.style.fontSize='14pt';const text=wordRun.appendChild(new Text('שירות פנימי'));
const neighbouringLink=new Element('a');neighbouringLink.style.color='#2563eb';neighbouringLink.href='https://example.org/another/page';
linkTextColor(selected,false);
assert.equal(text.parentNode.style.color,'#0f172a');assert.equal(wordRun.style.color,'inherit');assert.equal(strong.style.fontWeight,'700');assert.equal(wordRun.style.fontSize,'14pt');assert.equal(selected.textContent,'שירות פנימי');assert.equal(neighbouringLink.style.color,'#2563eb');assert.equal(neighbouringLink.href,'https://example.org/another/page');
linkTextColor(selected,true);assert.equal(text.parentNode.style.color,'inherit');assert.equal(strong.style.fontWeight,'700');
const image=selected.appendChild(new Element('figure'));const caption=image.appendChild(new Element('figcaption'));caption.style.color='#334155';caption.appendChild(new Text('קרדיט לצלם'));
linkTextColor(selected,false);assert.equal(caption.style.color,'#334155');assert.equal(caption.childNodes[0].nodeType,3);
console.log('Link colours: Word blue cleared on unlink, relink inherits blue, emphasis/size/credits and adjacent links preserved');
