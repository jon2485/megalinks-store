import assert from 'node:assert/strict';
import {linkSelectionForEditing} from '../lib/editor-links.ts';
const root={contains:n=>[anchor,anchor2,text,plain,parent].includes(n),ownerDocument:{createRange:()=>range(null,null,true)}};
const anchor={nodeType:1,closest:()=>anchor,getAttribute:()=> 'https://example.com/services/one',childNodes:[]},anchor2={nodeType:1,closest:()=>anchor2,getAttribute:()=> 'https://example.org/articles/two',childNodes:[]};
const text={nodeType:3,parentElement:anchor},text2={nodeType:3,parentElement:anchor2},plain={nodeType:3,parentElement:{closest:()=>null}},parent={nodeType:1,childNodes:[anchor],closest:()=>null};anchor.childNodes=[text];anchor2.childNodes=[text2];
function range(start,end,collapsed=false){return {startContainer:start,endContainer:end,startOffset:0,endOffset:collapsed?0:1,commonAncestorContainer:parent,collapsed,cloneRange(){return {...this};},selectNodeContents(a){this.selected=a;this.collapsed=false;}};}
const existing=linkSelectionForEditing(range(text,text,true),root);assert.equal(existing.url,'https://example.com/services/one');assert.equal(existing.range.selected,anchor);
const second=linkSelectionForEditing(range(text2,text2,true),root);assert.equal(second.url,'https://example.org/articles/two');
const boundary=linkSelectionForEditing({...range(parent,parent,false),startOffset:0,endOffset:1},root);assert.equal(boundary.url,'https://example.com/services/one');
const clicked=linkSelectionForEditing(range(plain,plain,true),root,anchor);assert.equal(clicked.url,'https://example.com/services/one');
const newWords=linkSelectionForEditing(range(plain,plain,false),root,anchor);assert.equal(newWords.url,'','new unlinked selection does not inherit the previously clicked URL');
assert.throws(()=>linkSelectionForEditing(range(plain,plain,true),root),/סמנו/);
assert.equal(linkSelectionForEditing(null,root,anchor).url,'https://example.com/services/one');
console.log('Link dialog: caret and selected linked words prefill their own URL; clicked-link fallback, parent boundaries and fresh unlinked selection passed');
