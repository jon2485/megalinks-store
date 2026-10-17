import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {realpathSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {zipSync,strToU8} from 'fflate';
const require=createRequire(realpathSync('node_modules/wrangler')+'/package.json');
const {build}=require('esbuild');
const bundled=await build({entryPoints:['lib/document-import.ts'],bundle:true,platform:'node',format:'esm',write:false});
const {importRichDocument}=await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text).toString('base64'));
// Real XML parser supplies a small DOM adapter for this Node-only import regression.
class XMLNode {
 constructor(data){Object.assign(this,data);this.children=data.children.map(x=>new XMLNode(x));}
 get textContent(){return (this.text||'')+this.children.map(c=>c.textContent+(c.tail||'')).join('');}
 getAttribute(name){return this.attrs[name]??null;}
 getAttributeNS(ns,name){return this.attrs['{'+ns+'}'+name]??null;}
 getElementsByTagNameNS(ns,name){return this.children.flatMap(c=>[...(c.localName===name&&(ns==='*'||ns===c.namespace)?[c]:[]),...c.getElementsByTagNameNS(ns,name)]);}
 getElementsByTagName(){return [];}
}
globalThis.DOMParser=class{parseFromString(text,type){assert.equal(type,'application/xml');const data=JSON.parse(execFileSync('python',['-c',`import sys,json,xml.etree.ElementTree as ET
try:
 root=ET.fromstring(sys.stdin.read())
 def node(e):
  ns,name=e.tag[1:].split('}') if e.tag.startswith('{') else ('',e.tag)
  return dict(namespace=ns,localName=name,attrs=e.attrib,text=e.text or '',tail=e.tail or '',children=[node(c) for c in e])
 print(json.dumps(node(root)))
except Exception:
 print(json.dumps(dict(namespace='',localName='parsererror',attrs={},text='',tail='',children=[])))`],{input:text,encoding:'utf8'}));const root=new XMLNode(data);return {getElementsByTagName:n=>root.localName===n?[root]:[],getElementsByTagNameNS:(ns,n)=>[...(root.localName===n&&(ns==='*'||ns===root.namespace)?[root]:[]),...root.getElementsByTagNameNS(ns,n)]};}};
const ns='xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
const doc=`<w:document ${ns}><w:body><w:p><w:pPr><w:pStyle w:val="Title"/></w:pPr><w:r><w:t>כותרת המסמך</w:t></w:r></w:p><w:p><w:pPr><w:pStyle w:val="CustomHeading"/><w:jc w:val="center"/></w:pPr><w:r><w:t>כותרת שנייה</w:t></w:r></w:p><w:p><w:r><w:rPr><w:b/><w:i/><w:u w:val="single"/><w:color w:val="123ABC"/><w:sz w:val="28"/><w:rFonts w:ascii="Arial"/></w:rPr><w:t>טקסט מעוצב</w:t></w:r><w:hyperlink r:id="link1"><w:r><w:t>שירות ראשון</w:t></w:r></w:hyperlink><w:r><w:t> וגם </w:t></w:r><w:hyperlink r:id="link2"><w:r><w:t>שירות שני</w:t></w:r></w:hyperlink></w:p><w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr><w:r><w:t>פריט ברשימה</w:t></w:r></w:p><w:p><w:r><w:drawing><a:blip xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" r:embed="img1"/></w:drawing></w:r></w:p><w:tbl><w:tr><w:tc><w:p><w:r><w:t>תא בטבלה</w:t></w:r></w:p></w:tc></w:tr></w:tbl></w:body></w:document>`;
const styles=`<w:styles ${ns}><w:style w:styleId="Heading2"><w:name w:val="heading 2"/><w:rPr><w:b/></w:rPr></w:style><w:style w:styleId="CustomHeading"><w:basedOn w:val="Heading2"/><w:pPr><w:outlineLvl w:val="1"/></w:pPr></w:style></w:styles>`;
const rels='<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="link1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="https://example.com/services/one?a=1&amp;b=2#section" TargetMode="External"/><Relationship Id="link2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="https://example.org/articles/two" TargetMode="External"/><Relationship Id="img1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image1.png"/></Relationships>';
const numbering=`<w:numbering ${ns}><w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0"><w:numFmt w:val="bullet"/></w:lvl></w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num></w:numbering>`;
const zip=zipSync({'word/document.xml':strToU8(doc),'word/styles.xml':strToU8(styles),'word/numbering.xml':strToU8(numbering),'word/_rels/document.xml.rels':strToU8(rels),'word/media/image1.png':Uint8Array.from([137,80,78,71,13,10,26,10])});
const result=await importRichDocument(new File([zip],'test.docx'));
assert.equal(result.title,'כותרת המסמך');assert.match(result.html,/<h1>כותרת המסמך/);assert.match(result.html,/<h2 style="text-align:center"><strong>כותרת שנייה/);assert.match(result.html,/color:#123ABC;font-size:14pt;font-family:Arial/);assert.match(result.html,/<u><em><strong>טקסט מעוצב/);assert.match(result.html,/href="https:\/\/example.com\/services\/one\?a=1&amp;b=2#section"/);assert.match(result.html,/href="https:\/\/example.org\/articles\/two"/);assert.match(result.html,/<ul><li>פריט ברשימה/);assert.match(result.html,/<table><tbody><tr><td>/);assert.equal(result.images.length,1);assert.equal(result.images[0].file.type,'image/png');assert.match(result.html,/data-import-image="word-image-0"/);
await assert.rejects(()=>importRichDocument(new File([zipSync({'word/document.xml':strToU8('<broken>')})],'bad.docx')),/אינו תקין/);
const text=await importRichDocument(new File(['<script>bad</script>\n\nשלום'],'text.txt'));assert.match(text.html,/&lt;script&gt;/);
console.log('Word import: inherited headings, styles, links with internal paths, lists, tables and credited-image staging passed');
