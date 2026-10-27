import {zipSync,unzipSync,strToU8,strFromU8} from 'fflate';
import {spreadsheetBytes} from './office';
import type {Row} from './shared';
export function framedWorkbook(rows:unknown[][],name:string,widths:number[],moneyColumns:number[],dataRows:number){
 const files=unzipSync(spreadsheetBytes(rows,name,{widths,moneyColumns,dataRows}));
 let sheet=strFromU8(files['xl/worksheets/sheet1.xml']).replace(/<mergeCells[\s\S]*?<\/mergeCells>/,'').replaceAll('ht="34"','ht="44"');
 sheet=sheet.replace(new RegExp('(<row r="'+(dataRows+2)+'"[^>]*>)([\\s\\S]*?)(</row>)'),(_,a,b,c)=>a+b.replace(/s="[02]"(?=><v>)/g,'s="4"').replace(/s="0"/g,'s="3"')+c);
 let styles=strFromU8(files['xl/styles.xml']);styles=styles.replace('<fills count="3">','<fills count="4">').replace('</fills>','<fill><patternFill patternType="solid"><fgColor rgb="FFDDF5FA"/><bgColor indexed="64"/></patternFill></fill></fills>');
 styles=styles.replace('<cellXfs count="3">','<cellXfs count="5">').replace('</cellXfs>','<xf numFmtId="0" fontId="0" fillId="3" borderId="0" xfId="0"><alignment horizontal="right" vertical="center" wrapText="1"/></xf><xf numFmtId="164" fontId="0" fillId="3" borderId="0" xfId="0" applyNumberFormat="1"><alignment vertical="center" wrapText="1"/></xf></cellXfs>');
 files['xl/worksheets/sheet1.xml']=strToU8(sheet);files['xl/styles.xml']=strToU8(styles);return zipSync(files,{level:0});
}
export function monthReportWorkbook(report:Row){
 const missing='חסרה עלות',s=report.summary,clients:Row[]=report.clients;
 const rows:unknown[][]=[['מספרי הזמנות','שם הלקוח','דוא״ל','טלפון','סכום הזמנות לפני מע״מ','שולם בפועל לפני מע״מ','עלויות לפני מע״מ','רווח מחושב לפני מס'],...clients.map(c=>[c.numbers.join(', '),c.name,c.email,c.phone,c.order_net/100,c.paid_net/100,c.cost_net===null?(c.paid_count?missing:'טרם שולם'):c.cost_net/100,c.profit_net===null?(c.paid_count?missing:'טרם שולם'):c.profit_net/100]),['סה״כ','','','',clients.reduce((n,c)=>n+c.order_net,0)/100,s.net/100,s.cost_net===null?missing:s.cost_net/100,s.profit_net===null?missing:s.profit_net/100],[],['טווח הדוח',report.from+' — '+report.to],['בסיס התאריך',report.basis==='order'?'תאריך ההזמנה':'מועד אישור התשלום הסופי'],['הכנסות לפני מע״מ',s.net/100],['מע״מ על ההכנסות',s.vat/100],['הכנסות כולל מע״מ',s.total/100],['עלויות ידועות לפני מע״מ',s.cost_known/100],['רווח מחושב לפני מס',s.profit_net===null?missing:s.profit_net/100],['מקור העלויות','עלויות שנשמרו ברכישה; זיכוי ללקוח אינו מבטל עלות ספק. עלויות חסרות אינן אפס.'],['מצב הנתונים',s.cost_missing?'חסרים '+s.cost_missing+' רכיבי עלות':'העלויות המתועדות זמינות']];
 return framedWorkbook(rows,'סיכום לפי לקוח',[30,30,38,23,28,28,25,27],[4,5,6,7],clients.length);
}
