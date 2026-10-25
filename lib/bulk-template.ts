import {zipSync,unzipSync,strFromU8,strToU8} from 'fflate';
import {spreadsheetBytes} from './office';
import {bulkTemplateHeaders,bulkExampleRow} from './bulk-order';

/** A visible example is explicitly marked and excluded by parseBulkSheet. */
export function bulkTemplateBytes(){
 const rows=[bulkTemplateHeaders,bulkExampleRow,...Array.from({length:25},()=>Array(9).fill(''))];
 const files=unzipSync(spreadsheetBytes(rows,'הזמנה מרוכזת',{widths:[28,44,28,28,44,30,26,58,34],moneyColumns:[],dataRows:rows.length-1}));
 let sheet=strFromU8(files['xl/worksheets/sheet1.xml']);
 sheet=sheet.replace(/<mergeCells[\s\S]*?<\/mergeCells>/,'').replace(/(<row r="2"[^>]*>)([\s\S]*?)(<\/row>)/,(_,open,cells,close)=>open+cells.replace(/s="0"/g,'s="3"')+close);
 sheet=sheet.replace('defaultRowHeight="24"','defaultRowHeight="44"').replaceAll('ht="34"','ht="52"');
 let styles=strFromU8(files['xl/styles.xml']);
 styles=styles.replace('<fills count="3">','<fills count="4">').replace('</fills>','<fill><patternFill patternType="solid"><fgColor rgb="FFDDF5FA"/><bgColor indexed="64"/></patternFill></fill></fills>');
 styles=styles.replace('<cellXfs count="3">','<cellXfs count="4">').replace('</cellXfs>','<xf numFmtId="0" fontId="0" fillId="3" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="right" vertical="center" wrapText="1"/></xf></cellXfs>');
 files['xl/worksheets/sheet1.xml']=strToU8(sheet);files['xl/styles.xml']=strToU8(styles);
 return zipSync(files,{level:0});
}
