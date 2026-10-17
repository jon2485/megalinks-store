import assert from 'node:assert/strict';
import {unzipSync,strFromU8} from 'fflate';
import {docxBytes,spreadsheetBytes,parseCsv} from '../lib/office.ts';
const word=unzipSync(docxBytes('כותרת בדיקה','פסקה ראשונה\nשורה נוספת',[{anchor:'אתר',url:'https://example.com/?a=1&b=2'}]));assert(word['word/document.xml']);assert(strFromU8(word['word/document.xml']).includes('כותרת בדיקה'));assert(strFromU8(word['word/_rels/document.xml.rels']).includes('&amp;'));
const xlsx=unzipSync(spreadsheetBytes([['אתר','נושא'],['HWzone','טכנולוגיה'],['רשומה','<escape>']]));assert(xlsx['xl/workbook.xml']);assert(strFromU8(xlsx['xl/worksheets/sheet1.xml']).includes('&lt;escape&gt;'));
assert.deepEqual(parseCsv('"אתר","נושא"\r\n"HWzone","שורה, עם פסיק"\r\n"טקסט","מרכאות ""כפולות"""'),[['אתר','נושא'],['HWzone','שורה, עם פסיק'],['טקסט','מרכאות "כפולות"']]);console.log('Office exports and CSV parser passed');
