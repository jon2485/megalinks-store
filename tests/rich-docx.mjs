import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {realpathSync,writeFileSync,mkdirSync,readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {unzipSync,strFromU8} from 'fflate';
const require=createRequire(realpathSync('node_modules/wrangler')+'/package.json'),{build}=require('esbuild');
const compiled=await build({entryPoints:['lib/rich-docx.ts'],bundle:true,platform:'node',format:'esm',write:false});
mkdirSync('.sites-runtime',{recursive:true});writeFileSync('.sites-runtime/rich-docx-test.mjs',compiled.outputFiles[0].text);
const {richArticleDocx}=await import(pathToFileURL(realpathSync('.sites-runtime/rich-docx-test.mjs')));
const png=process.env.DOCX_QA_IMAGE?new Uint8Array(readFileSync(process.env.DOCX_QA_IMAGE)):Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j2ioAAAAASUVORK5CYII=','base64'));
const html='<h2 style="text-align:center">כותרת משנה</h2><p>טקסט <strong>מודגש</strong> ו<a href="https://example.com/one?a=1&amp;b=2">קישור ראשון</a></p><figure><img src="/api/files/image1" data-credit="צילום: בדיקה" alt="תמונת בדיקה"><figcaption>צילום: בדיקה</figcaption></figure><p style="direction:ltr;text-align:left">English <em>italic text</em> and <a href="https://example.com/two">second link</a>.</p><ul><li>פריט ראשון</li><li>פריט שני</li></ul><ol><li>מספור</li></ol><table><tr><th>שם</th><th>ערך</th></tr><tr><td>בדיקה</td><td>100</td></tr></table><h3>סיום</h3>';
let loads=0;const bytes=await richArticleDocx('כותרת המאמר',html,{image_id:'image1',image_credit:'צילום: בדיקה',meta_description:'תיאור לדוגמה',client_notes:'הנחיות לספק'},async()=>{loads++;return {bytes:png,type:'image/png'};});
writeFileSync('.sites-runtime/rich-export.docx',bytes);
const files=unzipSync(bytes),doc=strFromU8(files['word/document.xml']),rels=strFromU8(files['word/_rels/document.xml.rels']);
assert.equal(loads,1,'inline and gallery same image is not duplicated');
assert(doc.includes('w:pStyle w:val="Heading2"'));assert(doc.includes('w:pStyle w:val="Heading3"'));
assert(doc.includes('<w:b/>'));assert(doc.includes('<w:i/>'));assert(doc.includes('<w:bidi/>'));assert(doc.includes('w:bidi w:val="0"'));
// Owner 22.11.2026: the iPhone preview showed Hebrew paragraphs left-aligned. Every Hebrew paragraph, heading, list item
// and table cell is RTL the way Word writes it: <w:bidi/>, Hebrew runs <w:rtl/>, no "start"/"left" alignment, RTL table and section.
{const paras=doc.match(/<w:p>[\s\S]*?<\/w:p>/g),hebrew=paras.filter(p=>/<w:t[^>]*>[^<]*[֐-׿]/.test(p)&&!p.includes('English'));
 assert(hebrew.length>=10,'Hebrew paragraphs found');for(const p of hebrew){assert(p.includes('<w:bidi/>'),'Hebrew paragraph is RTL: '+p.slice(0,120));assert(!/w:jc w:val="(start|left)"/.test(p),'Hebrew paragraph is not left-aligned');}
 for(const r of doc.match(/<w:r><w:rPr>[\s\S]*?<\/w:r>/g).filter(r=>/<w:t[^>]*>[^<]*[֐-׿]/.test(r)))assert(r.includes('<w:rtl/>'),'Hebrew run is RTL');
 const english=paras.find(p=>p.includes('English'));assert(english.includes('w:bidi w:val="0"')&&!english.includes('<w:rtl/>'),'English paragraph stays LTR');
 assert(doc.includes('<w:tblPr><w:bidiVisual/>'),'table is RTL');assert(/<w:sectPr>[\s\S]*<w:bidi\/><\/w:sectPr>/.test(doc),'section is RTL');
 assert(strFromU8(files['word/styles.xml']).includes('<w:pPrDefault><w:pPr><w:bidi/>'),'RTL is the document default');
 assert(!doc.includes('w:val="start"'),'no strict-only alignment value');}
assert(doc.includes('<w:hyperlink'));assert(rels.includes('https://example.com/one?a=1&amp;b=2'));assert(rels.includes('https://example.com/two'));
assert(doc.indexOf('<w:drawing>')<doc.indexOf('English'),'image remains in its original position');
assert(doc.indexOf('צילום: בדיקה')>doc.indexOf('<w:drawing>'));assert.equal(doc.match(/צילום: בדיקה/g).length,1);
assert(!doc.includes('תיאור לדוגמה'));assert(!doc.includes('הנחיות לספק'));const caption=doc.match(/<w:p>[\s\S]*?<\/w:p>/g).find(p=>p.includes('צילום: בדיקה'));assert(caption.includes('<w:jc w:val="center"/>'),'credit is centered below its image');
assert(doc.includes('<w:tbl>'));assert(doc.includes('<w:numPr>'));assert(files['word/styles.xml']);assert(files['word/numbering.xml']);assert(files['word/media/image1.png']);
await assert.rejects(()=>richArticleDocx('t','<p><img src="/api/files/missing"></p>',{},async()=>{throw Error('Missing image');}),/Missing image/);
console.log('Rich DOCX: headings, bold/italic, RTL/LTR, anchored links, image placement/credit/dedup, numbering, tables and missing-image failures passed.');

const notesBundle=await build({entryPoints:['lib/supplier-mail-content.ts'],bundle:true,platform:'node',format:'esm',write:false});writeFileSync('.sites-runtime/supplier-mail-test.mjs',notesBundle.outputFiles[0].text);const {supplierPublicationNotes}=await import(pathToFileURL(realpathSync('.sites-runtime/supplier-mail-test.mjs')));const notes=supplierPublicationNotes({data:JSON.stringify({meta_description:'תיאור מטא',client_notes:'הנחיות פרסום',admin_notes:'הנחיות מנהל'})});assert(notes.includes('תיאור מטא'));assert(notes.includes('הנחיות פרסום'));assert(notes.includes('הנחיות מנהל'));assert.equal(supplierPublicationNotes({data:'{}'}),'');console.log('Supplier email receives metadata and publication notes separately from article DOCX');
// Owner 22.11.2026: a link inside black text (pasted content) is still blue and underlined in the Word file.
{const html2='<p style="color:#000000">טקסט <span style="color:#000000"><a href="https://example.com/black">קישור בתוך טקסט שחור</a></span> ו<a href="https://example.com/inner"><span style="color:#000000">קישור עם צבע פנימי</span></a></p>';
const doc2=strFromU8(unzipSync(await richArticleDocx('קישורים',html2,{},async()=>({bytes:png,type:'image/png'})))['word/document.xml']);
const links=[...doc2.matchAll(/<w:hyperlink[^>]*>([\s\S]*?)<\/w:hyperlink>/g)].map(m=>m[1]);
assert.equal(links.length,2,'two links');for(const l of links){assert(l.includes('<w:color w:val="0563c1"/>'),'link is blue');assert(l.includes('<w:u w:val="single"/>'),'link is underlined');assert(!l.includes('w:val="000000"'),'no black inside a link');}
assert(doc2.includes('<w:color w:val="000000"/>'),'the text around the link keeps its own colour');}
console.log('rich docx links blue ok');
// Supplier e-mail (Staging 22.11.2026): an image Word cannot show fails a download (strict) but in lenient mode becomes a
// short note and is reported, so the e-mail still goes.
{const webp=new Uint8Array([82,73,70,70,30,0,0,0,87,69,66,80,86,80,56,32,0,0,0,0]);const html3='<p>טקסט</p><figure><img src="/api/files/w1" data-credit="צילום: א"></figure><figure><img src="/api/files/ok" data-credit="צילום: ב"></figure><figure><img src="/api/files/gone"></figure>';
 const load=async id=>{if(id==='gone')throw Error('missing');return id==='w1'?{bytes:webp,type:'image/webp'}:{bytes:png,type:'image/png'};};
 await assert.rejects(()=>richArticleDocx('t',html3,{},load),/אינה נתמכת/,'download stays strict');
 const skipped=[];const doc3=strFromU8(unzipSync(await richArticleDocx('t',html3,{},load,{lenient:true,skipped}))['word/document.xml']);
 assert.deepEqual(skipped,['w1','gone']);assert.equal(doc3.match(/<w:drawing>/g).length,1,'the good image stays');assert.equal(doc3.match(/התמונה מצורפת למייל כקובץ נפרד/g).length,2);assert(doc3.includes('צילום: א'),'the credit of a skipped image stays');}
console.log('rich docx lenient images ok');
