import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {realpathSync} from 'node:fs';
import {unzipSync,strFromU8} from 'fflate';
const require=createRequire(realpathSync('node_modules/wrangler')+'/package.json'),{Miniflare}=require('miniflare'),{build}=require('esbuild');
const bundle=await build({stdin:{contents:`import {aiArticleHtml} from './lib/ai-article-content';import {richArticleDocx} from './lib/rich-docx';export default{async fetch(r){const b=await r.json();const html=await aiArticleHtml(b.content,b.brief||{});return b.docx?new Response(await richArticleDocx('כותרת',html,{},async()=>{throw Error('unexpected image')})):new Response(html);}}`,resolveDir:process.cwd()},bundle:true,platform:'browser',format:'esm',write:false});
const mf=new Miniflare({modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat']});
async function format(content,brief={}){return (await mf.dispatchFetch('https://test.example',{method:'POST',body:JSON.stringify({content,brief})})).text();}
try{
 const brief={target_url:'https://example.com/one?a=1&b=2',anchor:'מגה לינקס',target_url_2:'https://example.com/two',anchor_2:'מגה לינקס'};
 const html=await format('<p>פתיחה מגה לינקס</p><h2>כותרת משנה</h2><p>תוכן <strong>מודגש</strong></p><h3 style="font-size:8px">סיום</h3>',brief);
 assert(html.includes('<h2>כותרת משנה</h2>'));assert(html.includes('<h2>סיום</h2>'));assert(!html.includes('&lt;h2'));assert(!html.includes('font-size'));assert(html.includes('<strong>מודגש</strong>'));assert.equal((html.match(/<a /g)||[]).length,2);assert(!/<a [^>]*>[^<]*<a/.test(html));assert(html.includes('https://example.com/one?a=1&amp;b=2'));
 for(const input of ['H2: כותרת משנה\nתוכן רגיל','H2 כותרת משנה\n\nתוכן רגיל','[H2] כותרת משנה\nתוכן רגיל','## כותרת משנה\nתוכן רגיל','H2\n\nכותרת משנה\nתוכן רגיל','<p>H2: כותרת משנה</p><p>תוכן רגיל</p>','```html\n<h2>כותרת משנה</h2><p>תוכן רגיל</p>\n```']){
  const result=await format(input);assert(result.includes('<h2>כותרת משנה</h2>'),result);assert(!result.includes('H2'),result);assert(result.includes('<p>תוכן רגיל</p>'),result);
 }
 assert.equal(await format('המושג H2 הוא סוג של כותרת.'),'<p>המושג H2 הוא סוג של כותרת.</p>');
 const safe=await format('<h2 onclick="alert(1)">בטוח</h2><script>alert(1)</script><p><a href="https://invented.example">מגה לינקס</a><img src=x onerror=alert(1)></p>',brief);assert(safe.includes('<h2>בטוח</h2>'));assert(!/script|onclick|onerror|invented|src=/.test(safe));assert(!safe.includes('alert(1)'));assert(safe.includes('example.com/one'));
 const docx=await mf.dispatchFetch('https://test.example',{method:'POST',body:JSON.stringify({content:'H2: כותרת משנה\n\nפסקה',docx:true})});const doc=strFromU8(unzipSync(new Uint8Array(await docx.arrayBuffer()))['word/document.xml']);assert(doc.includes('w:pStyle w:val="Heading2"'));assert(!doc.includes('H2:'));
 // Owner 27.11.2026 (Google's link guidance): the phrases become links where the text says them, in different paragraphs,
 // and a phrase the model did not write is woven into a body paragraph, never a lone line at the end.
 {const two={target_url:'https://shop.example/a',anchor:'נעלי ריצה',target_url_2:'https://shop.example/b',anchor_2:'גרביים לספורט'};
  const out=await format('<p>פתיחה על נעלי ריצה טובות.</p><h2>בחירה</h2><p>כדאי גם גרביים לספורט נושמות.</p><p>סיכום קצר.</p>',two);
  assert(out.includes('<p>פתיחה על <a href="https://shop.example/a" rel="noopener noreferrer">נעלי ריצה</a> טובות.</p>'),out);
  assert(out.includes('<p>כדאי גם <a href="https://shop.example/b" rel="noopener noreferrer">גרביים לספורט</a> נושמות.</p>'),out);
  assert(!/<p><a [^>]*>[^<]*<\/a><\/p>$/.test(out),out);
  const missing=await format('<p>פתיחה כללית על ריצה.</p><p>פסקה על ציוד ספורט ונעליים.</p><p>סיכום קצר.</p>',{target_url:'https://shop.example/a',anchor:'ציוד ספורט איכותי'});
  assert.equal((missing.match(/<a /g)||[]).length,1);assert(!/<p><a [^>]*>[^<]*<\/a><\/p>/.test(missing),missing);assert(missing.endsWith('<p>סיכום קצר.</p>'),missing);
  assert(missing.includes('<p>פסקה על ציוד ספורט ונעליים. למידע נוסף: <a href="https://shop.example/a" rel="noopener noreferrer">ציוד ספורט איכותי</a>.</p>'),missing);}
 console.log('AI article formatting passed: real H2 HTML, legacy/Markdown fallback, safe markup, contextual authorized links, literal mentions preserved, and DOCX Heading2 export.');
}finally{await mf.dispose();}
