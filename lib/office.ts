import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate';
const xml = (s: any) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
const xmlHeader = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
function save(name: string, bytes: Uint8Array, type: string) { const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type })); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 5000); }
export function docxBytes(title: string, content: string, links: {
    url: string;
    anchor: string;
}[] = []) { const paragraphs = [title, ...content.split(/\n/)].map((p, i) => `<w:p><w:pPr><w:bidi/><w:jc w:val="right"/>${i === 0 ? '<w:pStyle w:val="Title"/>' : ''}</w:pPr><w:r><w:rPr><w:rtl/>${i === 0 ? '<w:b/><w:sz w:val="36"/>' : '<w:sz w:val="24"/>'}</w:rPr><w:t xml:space="preserve">${xml(p)}</w:t></w:r></w:p>`).join('') + links.filter(x => x.url).map((x, i) => `<w:p><w:pPr><w:bidi/></w:pPr><w:hyperlink r:id="link${i}"><w:r><w:rPr><w:color w:val="097767"/><w:u w:val="single"/></w:rPr><w:t>${xml(x.anchor || x.url)}</w:t></w:r></w:hyperlink></w:p>`).join(''); const files: any = { '[Content_Types].xml': strToU8(xmlHeader + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'), '_rels/.rels': strToU8(xmlHeader + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'), 'word/document.xml': strToU8(xmlHeader + '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>' + paragraphs + '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body></w:document>'), 'word/_rels/document.xml.rels': strToU8(xmlHeader + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + links.filter(x => x.url).map((x, i) => `<Relationship Id="link${i}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${xml(x.url)}" TargetMode="External"/>`).join('') + '</Relationships>') }; return zipSync(files, { level: 0 }); }
export function exportDocx(title: string, content: string, links: {
    url: string;
    anchor: string;
}[] = []) { save((title.slice(0, 60) || 'article') + '.docx', docxBytes(title, content, links), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'); }
function unzipBounded(bytes: Uint8Array, allowed: (name: string) => boolean, maxFile = 5 * 1024 * 1024, maxTotal = 10 * 1024 * 1024) { let total = 0; return unzipSync(bytes, { filter: file => { if (!allowed(file.name))
        return false; total += file.originalSize; if (file.originalSize > maxFile || total > maxTotal)
        throw new Error('המסמך גדול מדי לעיבוד. נסו להעלות גרסה קטנה יותר.'); return true; } }); }
export async function importDocument(file: File) { if (file.size > 15 * 1024 * 1024)
    throw new Error('מותר מסמך עד 15MB'); if (/\.docx$/i.test(file.name)) {
    const zipped = unzipBounded(new Uint8Array(await file.arrayBuffer()), n => n === 'word/document.xml');
    if (!zipped['word/document.xml'])
        throw new Error('קובץ Word אינו תקין');
    const doc = new DOMParser().parseFromString(strFromU8(zipped['word/document.xml']), 'application/xml');
    return [...doc.getElementsByTagName('w:p')].map(p => [...p.getElementsByTagName('w:t')].map(t => t.textContent).join('')).join('\n\n');
} if (/\.(txt|md)$/i.test(file.name))
    return file.text(); if (/\.html?$/i.test(file.name)) {
    const doc = new DOMParser().parseFromString(await file.text(), 'text/html');
    doc.querySelectorAll('script,style').forEach(n => n.remove());
    return doc.body.innerText || doc.body.textContent || '';
} throw new Error('אפשר לייבא Word, טקסט או HTML. PDF נשמר כקובץ מצורף.'); }
export function parseCsv(text: string) { const rows: string[][] = []; let row: string[] = [], cell = '', quoted = false; for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
        if (quoted && text[i + 1] === '"') {
            cell += '"';
            i++;
        }
        else
            quoted = !quoted;
    }
    else if (c === ',' && !quoted) {
        row.push(cell);
        cell = '';
    }
    else if ((c === '\n' || c === '\r') && !quoted) {
        if (c === '\r' && text[i + 1] === '\n')
            i++;
        row.push(cell);
        if (row.some(Boolean))
            rows.push(row);
        row = [];
        cell = '';
    }
    else
        cell += c;
} row.push(cell); if (row.some(Boolean))
    rows.push(row); return rows; }
export async function readSpreadsheet(file: File) { if (file.size > 15 * 1024 * 1024)
    throw new Error('מותר קובץ עד 15MB'); if (/\.csv$/i.test(file.name))
    return parseCsv((await file.text()).replace(/^\uFEFF/, '')); if (!/\.xlsx$/i.test(file.name))
    throw new Error('יש להעלות XLSX או CSV'); const files = unzipBounded(new Uint8Array(await file.arrayBuffer()), n => n === 'xl/sharedStrings.xml' || n === 'xl/worksheets/sheet1.xml', 24 * 1024 * 1024, 30 * 1024 * 1024); const parser = new DOMParser(); const shared = files['xl/sharedStrings.xml'] ? [...parser.parseFromString(strFromU8(files['xl/sharedStrings.xml']), 'application/xml').getElementsByTagName('si')].map(si => si.textContent || '') : []; const sheet = files['xl/worksheets/sheet1.xml']; if (!sheet)
    throw new Error('הגיליון הראשון לא נמצא'); const rows = [...parser.parseFromString(strFromU8(sheet), 'application/xml').getElementsByTagName('row')]; if (rows.length > 5001)
    throw new Error('ניתן לייבא עד 5,000 שורות בכל פעם'); return rows.map(row => { const result: string[] = []; [...row.getElementsByTagName('c')].forEach(cell => { const name = (cell.getAttribute('r') || 'A1').replace(/\d+/g, ''); let index = 0; for (const l of name)
    index = index * 26 + l.charCodeAt(0) - 64; const value = cell.getElementsByTagName('v')[0]?.textContent || ''; result[index - 1] = cell.getAttribute('t') === 's' ? shared[Number(value)] || '' : cell.getAttribute('t') === 'inlineStr' ? cell.getElementsByTagName('is')[0]?.textContent || '' : value; }); return result; }); }
export function spreadsheetBytes(rows: any[][], sheetName = 'הזמנות', options?:{widths:number[];moneyColumns:number[];dataRows:number}) { const col = (n: number) => { let s = ''; for (n++; n > 0; n = Math.floor((n - 1) / 26))
    s = String.fromCharCode(65 + (n - 1) % 26) + s; return s; }; const sheet = xmlHeader + '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0" rightToLeft="1">'+(options?'<pane ySplit="1" topLeftCell="A2" activePane="bottomRight" state="frozen"/>':'')+'</sheetView></sheetViews>'+(options?'<sheetFormatPr defaultRowHeight="24"/><cols>'+options.widths.map((width,i)=>`<col min="${i+1}" max="${i+1}" width="${width}" customWidth="1"/>`).join('')+'</cols>':'')+'<sheetData>' + rows.map((r, i) => `<row r="${i + 1}"${options?' ht="34" customHeight="1"':''}>` + r.map((v, j) => options&&typeof v==='number'&&Number.isFinite(v)?`<c r="${col(j)}${i+1}" s="${(i<=options.dataRows?options.moneyColumns.includes(j):j===1)?2:0}"><v>${v}</v></c>`:`<c r="${col(j)}${i + 1}"${options?' s="'+(i===0?1:0)+'"':''} t="inlineStr"><is><t xml:space="preserve">${xml(v)}</t></is></c>`).join('') + '</row>').join('') + '</sheetData>'+(options?`<autoFilter ref="A1:${col(options.widths.length-1)}${options.dataRows+1}"/><mergeCells count="1"><mergeCell ref="A${options.dataRows+3}:${col(options.widths.length-1)}${options.dataRows+3}"/></mergeCells>`:'')+'</worksheet>'; return zipSync({ '[Content_Types].xml': strToU8(xmlHeader + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'+(options?'<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>':'')+'</Types>'), '_rels/.rels': strToU8(xmlHeader + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'), 'xl/workbook.xml': strToU8(xmlHeader + '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="' + xml(sheetName) + '" sheetId="1" r:id="rId1"/></sheets></workbook>'), 'xl/_rels/workbook.xml.rels': strToU8(xmlHeader + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'+(options?'<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>':'')+'</Relationships>'), 'xl/worksheets/sheet1.xml': strToU8(sheet), ...(options?{'xl/styles.xml':strToU8(xmlHeader+'<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.00&quot; ₪&quot;"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Arial"/><color rgb="FF09234B"/></font><font><b/><sz val="11"/><name val="Arial"/><color rgb="FFFFFFFF"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF0876BF"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="right" vertical="center" wrapText="1"/></xf><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>')}:{}) }, { level: 0 }); }
export function exportSpreadsheet(name: string, rows: any[][], sheetName?: string) { save(name, spreadsheetBytes(rows, sheetName), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); }

export function downloadSpreadsheetBytes(name:string,bytes:Uint8Array){save(name,bytes,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');}
