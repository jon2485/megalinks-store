import {zipSync,strToU8} from 'fflate';
import type {Row} from './shared';
import {bulkContentChoices,bulkExampleMarker,bulkTemplateHeaders} from './bulk-order';

// Owner approved 26.11.2026 (design/bulk-order): the template is built per user, with four sheets.
// "הזמנה" stays the first sheet (xl/worksheets/sheet1.xml), because readSpreadsheet reads only that one.
export const bulkTemplateName='הזמנה מרוכזת - מגה לינקס.xlsx';
const ORDER_ROWS=500,FIRST=7,LAST=FIRST+ORDER_ROWS-1;
const esc=(s:unknown)=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const head='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const col=(n:number)=>{let s='';for(n++;n>0;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s;};
type Cell=string|number|null|undefined;
const cell=(ref:string,v:Cell,s:number)=>v===null||v===undefined||v===''?`<c r="${ref}" s="${s}"/>`:typeof v==='number'&&Number.isFinite(v)?`<c r="${ref}" s="${s}"><v>${v}</v></c>`:`<c r="${ref}" s="${s}" t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>`;
const row=(r:number,cells:[number,Cell,number][],ht?:number)=>`<row r="${r}"${ht?` ht="${ht}" customHeight="1"`:''}>${cells.map(([c,v,s])=>cell(col(c)+r,v,s)).join('')}</row>`;
const sheet=(o:{view:string;cols:string;rows:string;after?:string})=>head+'<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetViews>'+o.view+'</sheetViews><sheetFormatPr defaultRowHeight="15"/><cols>'+o.cols+'</cols><sheetData>'+o.rows+'</sheetData>'+(o.after||'')+'</worksheet>';
const widths=(w:number[],extra:(i:number)=>string=()=>'')=>w.map((x,i)=>`<col min="${i+1}" max="${i+1}" width="${x}" customWidth="1"${extra(i)}/>`).join('');
const rtl=(pane='')=>`<sheetView rightToLeft="1" workbookViewId="0">${pane}</sheetView>`;
const frozen=(rows:number)=>`<pane ySplit="${rows}" topLeftCell="A${rows+1}" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A${rows+1}" sqref="A${rows+1}"/>`;

// Styles (cellXfs index):
// 0 default · 1 title · 2 subtitle · 3 header teal · 4 header navy · 5 column hint · 6 example banner · 7 example cell
// 8 data cell · 9 step label (tinted) · 10 step text (tinted) · 11 step label · 12 step text · 13 free option label · 14 free option text
// 15 paid option label · 16 paid option text · 17 section heading · 18 tip label · 19 tip text · 20 table cell · 21 price cell
const styles=head+'<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
 +'<numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.##&quot; ₪&quot;"/></numFmts>'
 +'<fonts count="8"><font><sz val="11"/><color rgb="FF09234B"/><name val="Arial"/></font><font><b/><sz val="18"/><color rgb="FF09234B"/><name val="Arial"/></font><font><sz val="11"/><color rgb="FF405A78"/><name val="Arial"/></font><font><b/><sz val="12"/><color rgb="FFFFFFFF"/><name val="Arial"/></font><font><sz val="10"/><color rgb="FF52677E"/><name val="Arial"/></font><font><b/><sz val="13"/><color rgb="FFFFFFFF"/><name val="Arial"/></font><font><b/><sz val="11"/><color rgb="FF9A4A00"/><name val="Arial"/></font><font><b/><sz val="11"/><color rgb="FF09234B"/><name val="Arial"/></font></fonts>'
 +'<fills count="11"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>'+['FF007C88','FF09234B','FFEEF4F9','FFE07A00','FFFFF1DC','FFF2F7FA','FFE9F8F0','FFF1EEFF','FFE6F7FA'].map(c=>`<fill><patternFill patternType="solid"><fgColor rgb="${c}"/><bgColor indexed="64"/></patternFill></fill>`).join('')+'</fills>'
 +'<borders count="3"><border><left/><right/><top/><bottom/><diagonal/></border>'+[['thin','FFD6E6F0'],['medium','FFF0A23B']].map(([w,c])=>`<border>${['left','right','top','bottom'].map(s=>`<${s} style="${w}"><color rgb="${c}"/></${s}>`).join('')}<diagonal/></border>`).join('')+'</borders>'
 +'<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="22">'
 +[[0,0,0,0,''],[0,1,0,0,'right|center'],[0,2,0,0,'right|center|wrap'],[0,3,2,1,'center|center|wrap'],[0,3,3,1,'center|center|wrap'],[0,4,4,1,'right|center|wrap'],[0,5,5,0,'center|center'],[0,6,6,2,'right|center|wrap'],[0,0,0,1,'right|center|wrap'],
   [0,7,7,0,'right|center|wrap'],[0,0,7,0,'right|center|wrap'],[0,7,0,0,'right|center|wrap'],[0,0,0,0,'right|center|wrap'],[0,7,8,0,'right|center|wrap'],[0,0,8,0,'right|center|wrap'],[0,7,9,0,'right|center|wrap'],[0,0,9,0,'right|center|wrap'],[0,7,0,0,'right|center'],[0,7,10,0,'right|center|wrap'],[0,0,10,0,'right|center|wrap'],[0,0,0,1,'right|center'],[164,0,0,1,'right|center']]
   .map(([num,font,fill,border,al])=>{const [h,v,w]=String(al).split('|');return `<xf numFmtId="${num}" fontId="${font}" fillId="${fill}" borderId="${border}" xfId="0"${num?' applyNumberFormat="1"':''}${font?' applyFont="1"':''}${fill?' applyFill="1"':''}${border?' applyBorder="1"':''}${h?' applyAlignment="1"><alignment horizontal="'+h+'" vertical="'+v+'"'+(w?' wrapText="1"':'')+'/></xf>':'/>'}`;}).join('')
 +'</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles><dxfs count="1"><dxf><fill><patternFill patternType="solid"><bgColor rgb="FFFDE7EA"/></patternFill></fill></dxf></dxfs></styleSheet>';

export type BulkTemplateInput={sites:Row[];customers:Row[];ai:boolean;categoryLabel?:(key:string)=>string};
export function bulkTemplateBytes({sites,customers,ai,categoryLabel=k=>k}:BulkTemplateInput){
 const live=sites.filter(s=>s.active!==0&&String(s.name||'').trim());
 const people=customers.filter(c=>String(c.name||c.email||'').trim());
 const choices=bulkContentChoices(ai);
 const span='A%:I%';
 // Sheet 1: הזמנה
 const hints=['בחרו מהרשימה · חובה','בחרו מהרשימה · ריק = אני אכין','לא חובה','100–5,000 · חובה לכתיבה מקצועית','לא חובה','לא חובה','לא חובה · https://…','בחרו מהרשימה · לא חובה','לא חובה',bulkExampleMarker];
 const contentExample=ai?'כתיבה עם AI':'כתיבה מקצועית';
 const example=['דוגמה: '+(live[0]?.name||'ישראל היום'),'דוגמה: '+contentExample,'דוגמה: איך לבחור מנוף לעבודה בגובה','600 (דוגמה)','דוגמה: המותג שלי','דוגמה: השכרת מנוף','https://example.co.il','דוגמה: חברת אלפא','דוגמה: קהל יעד ועדי בית',bulkExampleMarker];
 let rows=row(1,[[0,'הזמנה מרוכזת · מגה לינקס',1]],36)+row(2,[[0,'שורה אחת לכל כתבה. רק עמודת האתר חובה. ההסבר המלא בלשונית „איך ממלאים”.',2]],24)
  +row(3,bulkTemplateHeaders.map((h,i)=>[i,h,i?4:3] as [number,Cell,number]),32)
  +row(4,hints.map((h,i)=>[i,h,5] as [number,Cell,number]),30)
  +row(5,[[0,'▼  שורת דוגמה בלבד — לא תיכנס להזמנה. מתחילים למלא מהשורה שמתחתיה  ▼',6],...Array.from({length:8},(_,i)=>[i+1,'',6] as [number,Cell,number]),[9,bulkExampleMarker,0]],30)
  +row(6,example.map((v,i)=>[i,v,7] as [number,Cell,number]),30);
 for(let r=FIRST;r<=LAST;r++)rows+=row(r,Array.from({length:9},(_,i)=>[i,'',8] as [number,Cell,number]),26);
 const lists=[
  live.length?`<dataValidation type="list" allowBlank="1" showInputMessage="1" showErrorMessage="1" errorTitle="אתר לא מהרשימה" error="בחרו אתר מהרשימה הנפתחת (לשונית „אתרים”)." promptTitle="אתר" prompt="בחרו אתר מהרשימה. אפשר להתחיל להקליד." sqref="A${FIRST}:A${LAST}"><formula1>'אתרים'!$A$2:$A$${live.length+1}</formula1></dataValidation>`:'',
  `<dataValidation type="list" allowBlank="1" showInputMessage="1" showErrorMessage="1" errorTitle="איך התוכן יוכן" error="בחרו אחת מ־${choices.length} האפשרויות." promptTitle="איך התוכן יוכן" prompt="${esc(ai?'אני אכין: בלי עלות, אחרי הרכישה. AI: בלי עלות, אוטומטי אחרי התשלום. מקצועית: 15 אג׳ למילה.':'אני אכין: בלי עלות, אחרי הרכישה. מקצועית: 15 אג׳ למילה.')}" sqref="B${FIRST}:B${LAST}"><formula1>"${esc(choices.join(','))}"</formula1></dataValidation>`,
  `<dataValidation type="whole" operator="between" allowBlank="1" showInputMessage="1" showErrorMessage="1" errorTitle="מספר מילים" error="מספר שלם בין 100 ל־5,000, או ריק." promptTitle="מספר מילים" prompt="${esc(ai?'חובה לכתיבה מקצועית (קובע את המחיר). ל־AI: ריק = 500.':'חובה לכתיבה מקצועית (קובע את המחיר).')}" sqref="D${FIRST}:D${LAST}"><formula1>100</formula1><formula2>5000</formula2></dataValidation>`,
  people.length?`<dataValidation type="list" allowBlank="1" showInputMessage="1" showErrorMessage="0" promptTitle="לקוח הסוכנות" prompt="לא חובה. בחרו מהרשימה או הקלידו שם או מייל." sqref="H${FIRST}:H${LAST}"><formula1>'הלקוחות שלי'!$A$2:$A$${people.length+1}</formula1></dataValidation>`:''].filter(Boolean);
 const order=sheet({view:rtl(frozen(4)),cols:widths([30,30,34,20,20,24,32,24,46,14],i=>i===9?' hidden="1"':''),rows,
  after:`<mergeCells count="3">${[1,2,5].map(r=>`<mergeCell ref="${span.replaceAll('%',String(r))}"/>`).join('')}</mergeCells>`
   +`<conditionalFormatting sqref="D${FIRST}:D${LAST}"><cfRule type="expression" dxfId="0" priority="1"><formula>AND($B${FIRST}="כתיבה מקצועית",$D${FIRST}="")</formula></cfRule></conditionalFormatting>`
   +`<dataValidations count="${lists.length}">${lists.join('')}</dataValidations>`});
 // Sheet 2: איך ממלאים
 const steps:[string,string][]=[['1. מורידים תבנית ובוחרים אתרים','שורה נפרדת לכל כתבה. אפשר לבחור אתרים בלבד, גם בלי נושא, מאמר או הנחיות.'],['2. כל שורה היא כתבה בפני עצמה','שתי כתבות באותו אתר? שתי שורות. לכל כתבה נושא והנחיות משלה. הנושא לא חובה.'],['3. מוסיפים הנחיות עכשיו — או בהמשך','נושא, מותג, מילת מפתח וקישור אפשר למלא עכשיו, או להשלים באזור האישי אחרי הרכישה.'],['4. בוחרים מי מכין את התוכן','בעמודה „איך התוכן יוכן”. אם משאירים ריק — אתם מכינים.']];
 const options:[string,string,string,boolean][]=[['אני אכין את התוכן','כותבים בעורך, מעלים מאמר מוכן מ־Word, או יוצרים טיוטה עם AI. באזור האישי, אחרי הרכישה.','בלי עלות',false],...(ai?[['כתיבה עם AI','המערכת כותבת טיוטה לבד מיד אחרי התשלום, לפי הנושא, מילת המפתח או הקישור. אתם בודקים ושולחים לפרסום.','בלי עלות',false] as [string,string,string,boolean]]:[]),['כתיבה מקצועית','כותב מקצועי שלנו. ממלאים מספר מילים בין 100 ל־5,000.','15 אג׳ למילה · 400 מילים = 60 ₪',true]];
 const details=['לקוח הסוכנות: בוחרים מהרשימה (מ„הלקוחות שלי”) או מקלידים שם, מייל או מזהה.','עד 500 שורות, כתבה אחת בכל שורה.','שורת הדוגמה בלשונית „הזמנה” לא נכנסת להזמנה.','מחירים לפני מע״מ. הסיכום המלא, הנחות וקופון — בסל באתר.'];
 let r=2,guide=row(r,[[1,'בוחרים עכשיו, מכינים תוכן מתי שנוח',1]],34);r+=2;
 steps.forEach(([a,b],i)=>{guide+=row(r++,[[1,a,i%2?11:9],[2,b,i%2?12:10],[3,'',i%2?12:10]],40);});
 r++;guide+=row(r++,[[1,(options.length===3?'שלוש':'שתי')+' דרכים להכין תוכן',17]],26);
 options.forEach(([a,b,c,paid])=>{guide+=row(r++,[[1,a,paid?15:13],[2,b,paid?16:14],[3,c,paid?16:14]],44);});
 r++;guide+=row(r++,[[1,'פרטים נוספים',17]]);
 details.forEach(d=>{guide+=row(r++,[[1,'•',17],[2,d,12]],24);});
 r++;guide+=row(r,[[1,'לדוגמה:',18],[2,'בוחרים 10 אתרים עכשיו, ומשלימים את התוכן לכל כתבה כשמוכנים.',19],[3,'',19]],28);
 const howto=sheet({view:rtl(),cols:widths([4,26,70,24]),rows:guide,after:'<mergeCells count="1"><mergeCell ref="B2:D2"/></mergeCells>'});
 // Sheet 3: אתרים (the price the customer sees in the catalog, before VAT)
 const siteRows=row(1,['אתר','כתובת','קטגוריה','מחיר לפני מע״מ','DR','ימי אספקה'].map((h,i)=>[i,h,4] as [number,Cell,number]),28)
  +live.map((s,i)=>row(i+2,[[0,s.name,20],[1,String(s.url||'').replace(/^https?:\/\//,'').replace(/\/$/,''),20],[2,categoryLabel(String(s.category||'')),20],[3,Number(s.price_cents||0)/100,21],[4,s.dr==null||s.dr===''?'':Number(s.dr),20],[5,s.turnaround_days==null||s.turnaround_days===''?'':Number(s.turnaround_days),20]])).join('');
 const siteSheet=sheet({view:rtl(frozen(1)),cols:widths([30,30,22,18,8,12]),rows:siteRows});
 // Sheet 4: הלקוחות שלי (empty when the user has no agency customers)
 const peopleRows=row(1,[[0,'שם',4],[1,'מייל',4]],28)+people.map((c,i)=>row(i+2,[[0,c.name||c.email,20],[1,c.email||'',20]])).join('');
 const peopleSheet=sheet({view:rtl(),cols:widths([28,32]),rows:peopleRows});
 const names=['הזמנה','איך ממלאים','אתרים','הלקוחות שלי'],sheets=[order,howto,siteSheet,peopleSheet];
 const files:Record<string,Uint8Array>={
  '[Content_Types].xml':strToU8(head+'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'+sheets.map((_,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')+'</Types>'),
  '_rels/.rels':strToU8(head+'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'),
  'xl/workbook.xml':strToU8(head+'<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView activeTab="0"/></bookViews><sheets>'+names.map((n,i)=>`<sheet name="${esc(n)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')+'</sheets></workbook>'),
  'xl/_rels/workbook.xml.rels':strToU8(head+'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+sheets.map((_,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')+`<Relationship Id="rId${sheets.length+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`),
  'xl/styles.xml':strToU8(styles)};
 sheets.forEach((s,i)=>{files[`xl/worksheets/sheet${i+1}.xml`]=strToU8(s);});
 files['xl/worksheets/sheet1.xml']=strToU8(order.replace('<sheetView rightToLeft="1" workbookViewId="0">','<sheetView rightToLeft="1" tabSelected="1" workbookViewId="0">'));
 return zipSync(files,{level:6});
}
