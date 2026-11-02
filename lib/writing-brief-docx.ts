import {zipSync,strToU8} from 'fflate';
import {one,assert} from './server';
import {writingCode,writingSubmitted} from './writing-workflow';
// The brief a writer receives as a Word file. It names the order only, never the customer,
// and its file name is the article code the manager searches for when the text comes back.
const xml=(s:unknown)=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const run=(text:string,{bold=false,size=24,color='',ltr=false}:{bold?:boolean;size?:number;color?:string;ltr?:boolean}={})=>`<w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>${bold?'<w:b/><w:bCs/>':''}${color?`<w:color w:val="${color}"/>`:''}<w:sz w:val="${size}"/><w:szCs w:val="${size}"/>${ltr?'':'<w:rtl/>'}</w:rPr><w:t xml:space="preserve">${xml(text)}</w:t></w:r>`;
const para=(runs:string,after=120)=>`<w:p><w:pPr><w:bidi/><w:spacing w:after="${after}" w:line="320" w:lineRule="auto"/><w:jc w:val="start"/></w:pPr>${runs}</w:p>`;
const row=(label:string,value:string,ltr=false)=>para(run(label+': ',{bold:true,color:'0B274D'})+run(value,{ltr}),100);
export const israelDateTime=(value:string)=>new Intl.DateTimeFormat('he-IL',{timeZone:'Asia/Jerusalem',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(value));
export async function writingBriefDocx(id:string){
 const a=await one('SELECT * FROM articles WHERE id=?',id);assert(a,'הכתבה לא נמצאה',404);assert(writingSubmitted(a),'הלקוח טרם שלח הנחיות לכותב',409);
 const d=JSON.parse(a.data),order=await one('SELECT number FROM orders WHERE id=?',a.order_id),code=writingCode(order?.number,a.id);
 // The snapshot is what the customer sent at that moment; later drafts do not change the brief.
 const b={...d,...(d.writing_brief_snapshot||{})},extras=[['מילות מפתח נוספות',b.keywords],['מותג או עסק',b.brand],['קהל יעד',b.audience]].filter(([,v])=>String(v||'').trim());
 const body=[
  para(run('הנחיות כתיבה',{bold:true,size:40,color:'071F4B'}),80),
  para(run('מזהה הכתבה: ',{bold:true,size:28})+run(code,{bold:true,size:28,color:'0A66C2',ltr:true}),60),
  para(run('יש לשמור על המזהה בשם הקובץ ובראש המסמך כשמחזירים את המאמר.',{size:20,color:'4A5F7A'}),240),
  row('מספר הזמנה',String(order?.number||'')),
  row('תאריך שליחה לכתיבה',d.writing_requested_at?israelDateTime(d.writing_requested_at):'לא תועד'),
  row('כמות מילים',String(Number(d.editorial_words)||400)),
  row('כותרת רצויה',String(b.topic||'').trim()||'לא צוינה'),
  row('ביטוי מפתח',String(b.anchor||'').trim()),
  row('קישור',String(b.target_url||''),true),
  ...(b.target_url_2?[row('ביטוי מפתח נוסף',String(b.anchor_2||'').trim()),row('קישור נוסף',String(b.target_url_2),true)]:[]),
  row('הערות למאמר',String(b.notes||'').trim()||'אין'),
  ...(d.writing_revision_note&&a.status==='writing'?[para('',120),row('תיקונים שהלקוח ביקש',String(d.writing_revision_note))]:[]),
  ...(extras.length?[para('',120),para(run('פרטים נוספים',{bold:true,size:26,color:'071F4B'}),80),...extras.map(([k,v])=>row(String(k),String(v)))]:[]),
 ].join('');
 const documentXml=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1300" w:right="1300" w:bottom="1300" w:left="1300" w:header="708" w:footer="708" w:gutter="0"/><w:bidi/></w:sectPr></w:body></w:document>`;
 const files={
  '[Content_Types].xml':strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/></Types>'),
  '_rels/.rels':strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'),
  'word/_rels/document.xml.rels':strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/></Relationships>'),
  'word/settings.xml':strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:themeFontLang w:val="he-IL" w:bidi="he-IL"/></w:settings>'),
  'word/document.xml':strToU8(documentXml),
 };
 return {bytes:zipSync(files),filename:code+'.docx'};
}
