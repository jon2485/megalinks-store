import {SHEET_ID,SHEET_TAB,sheetFields} from './sheets-plan';
export function sheetsScript(){return `/** @OnlyCurrentDoc — Mega Links two-way synchronization, protocol 2 */
const MEGA_LINKS_ENDPOINT = 'https://postflow-studio.elian-tetruashvili.chatgpt.site/api/sheets-sync/push';
const MEGA_LINKS_SHEET_ID = '${SHEET_ID}';
const MEGA_LINKS_TAB = '${SHEET_TAB}';
const MEGA_LINKS_HEADERS = ${JSON.stringify(Object.keys(sheetFields))};
function installMegaLinksSync() {
  const book = SpreadsheetApp.getActiveSpreadsheet();
  if (!book || book.getId() !== MEGA_LINKS_SHEET_ID) throw new Error('יש לפתוח את גיליון הקטלוג של מגה לינקס.');
  const ui = SpreadsheetApp.getUi(), properties = PropertiesService.getScriptProperties();
  let token = properties.getProperty('MEGA_LINKS_TOKEN');
  if (!token) {
    const answer = ui.prompt('חיבור מגה לינקס', 'הדביקו את מפתח החיבור ממסך הניהול:', ui.ButtonSet.OK_CANCEL);
    if (answer.getSelectedButton() !== ui.Button.OK) return;
    token = answer.getResponseText().trim();
    if (!/^[A-Za-z0-9_-]{40,100}$/.test(token)) throw new Error('מפתח החיבור אינו תקין.');
    properties.setProperty('MEGA_LINKS_TOKEN', token);
  }
  const handlers = ['megaLinksSyncOnEdit', 'megaLinksSyncOnChange', 'megaLinksTimedSync'];
  ScriptApp.getProjectTriggers().forEach(t => { if (handlers.includes(t.getHandlerFunction())) ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('megaLinksSyncOnEdit').forSpreadsheet(book).onEdit().create();
  ScriptApp.newTrigger('megaLinksSyncOnChange').forSpreadsheet(book).onChange().create();
  ScriptApp.newTrigger('megaLinksTimedSync').timeBased().everyMinutes(5).create();
  megaLinksCatalogMenu();
  const result = megaLinksSend_(true);
  ui.alert('החיבור הותקן', result.message || 'בדקו את מצב הסנכרון באתר.', ui.ButtonSet.OK);
}
function megaLinksCatalogMenu() { SpreadsheetApp.getUi().createMenu('Mega Links').addItem('סנכרון עכשיו', 'syncMegaLinksNow').addItem('התקנה או עדכון החיבור', 'installMegaLinksSync').addItem('השהיית החיבור', 'removeMegaLinksSync').addToUi(); }
function syncMegaLinksNow() { const r = megaLinksSend_(true); SpreadsheetApp.getUi().alert(r.message || 'בדקו את מצב הסנכרון באתר.'); }
function megaLinksSyncOnEdit(e) { if (e && e.range && e.range.getSheet().getName() === MEGA_LINKS_TAB) megaLinksSend_(false); }
function megaLinksSyncOnChange(e) { megaLinksSend_(false); }
function megaLinksTimedSync() { megaLinksSend_(true); }
function removeMegaLinksSync() {
  const handlers = ['megaLinksSyncOnEdit', 'megaLinksSyncOnChange', 'megaLinksTimedSync'];
  ScriptApp.getProjectTriggers().forEach(t => { if (handlers.includes(t.getHandlerFunction())) ScriptApp.deleteTrigger(t); });
}
function megaLinksRead_(tab) {
  const count = tab.getLastRow(), width = tab.getLastColumn();
  if (count < 2 || count > 5001 || width > 80) throw new Error('הקטלוג חייב להכיל 1 עד 5,000 אתרים ועד 80 עמודות.');
  return tab.getRange(1, 1, count, width).getValues().map(row => row.map(value => value instanceof Date ? Utilities.formatDate(value, 'UTC', 'yyyy-MM-dd') : value));
}
function megaLinksRequest_(book, token, rows, extra) {
  const payload = JSON.stringify(Object.assign({protocol:2, spreadsheet_id:book.getId(), sheet_name:MEGA_LINKS_TAB, nonce:Utilities.getUuid(), sent_at:new Date().toISOString(), rows:rows}, extra || {}));
  const response = UrlFetchApp.fetch(MEGA_LINKS_ENDPOINT, {method:'post', contentType:'application/json', headers:{Authorization:'Bearer ' + token}, payload:payload, muteHttpExceptions:true, followRedirects:false});
  let result;try { result = JSON.parse(response.getContentText()); } catch (_) { throw new Error('האתר החזיר תשובה לא תקינה.'); }
  if (response.getResponseCode() < 200 || response.getResponseCode() >= 300) throw new Error(result.error || result.message || 'החיבור נכשל.');
  return result;
}
function megaLinksProblem_(code, message) { const e = new Error(message);e.syncCode = code;throw e; }
function megaLinksSafeCell_(value) { return typeof value === 'string' && /^[=+@-]/.test(value) ? "'" + value : value; }
function megaLinksWrite_(book, tab, response, original) {
  const output = response.writeback, cells = output.cells || [], added = output.append || [];
  const live = megaLinksRead_(tab);
  if (JSON.stringify(live[0]) !== JSON.stringify(original[0])) megaLinksProblem_('cell_changed','כותרות הגיליון השתנו במהלך הסנכרון. לא בוצעה כתיבה.');
  if (added.length && tab.getLastRow() !== output.start_row - 1) megaLinksProblem_('append_changed','נוספו שורות בשיטס בזמן הסנכרון. יש להריץ שוב.');
  cells.forEach(cell => {
    const value = (live[cell.row - 1] || [])[cell.column - 1];
    if (String(value === undefined || value === null ? '' : value) !== String(cell.before === null ? '' : cell.before)) megaLinksProblem_('cell_changed','תא בשיטס השתנה בזמן הסנכרון. השינוי נשמר ונדרש סנכרון חדש.');
    if (tab.getRange(cell.row, cell.column).getFormula()) megaLinksProblem_('formula','שדה לעריכה מכיל נוסחה. הנוסחה לא נדרסה; בדקו במסך הסנכרון.');
  });
  let history = book.getSheetByName('היסטוריית סנכרון');
  if (!history) {history = book.insertSheet('היסטוריית סנכרון');history.appendRow(['תאריך','מזהה אתר','שדה','ערך קודם','ערך חדש']);history.setRightToLeft(true);history.setFrozenRows(1);}
  const log = cells.map(cell => [new Date().toISOString(),cell.id,cell.field,megaLinksSafeCell_(String(cell.before)),megaLinksSafeCell_(String(cell.after))]);
  if (log.length) {if(history.getLastRow()+log.length>history.getMaxRows())history.insertRowsAfter(history.getMaxRows(),history.getLastRow()+log.length-history.getMaxRows());history.getRange(history.getLastRow()+1,1,log.length,5).setValues(log);}
  cells.forEach(cell => {
    const range = tab.getRange(cell.row, cell.column), current = range.getValue();
    if (String(current === null ? '' : current) !== String(cell.before === null ? '' : cell.before)) megaLinksProblem_('cell_changed','תא השתנה במהלך העדכון. השינויים ייבדקו שוב.');
    range.setValue(megaLinksSafeCell_(cell.after));
  });
  if (added.length) {
    if (tab.getLastRow() !== output.start_row - 1) megaLinksProblem_('append_changed','נוספו שורות בשיטס במהלך הסנכרון. לא נוספו שורות כפולות.');
    const last = output.start_row + added.length - 1;
    if (last > tab.getMaxRows()) tab.insertRowsAfter(tab.getMaxRows(), last - tab.getMaxRows());
    tab.getRange(output.start_row, 1, added.length, output.columns).setValues(added.map(row => row.map(megaLinksSafeCell_)));
    const headers = original[0], minimum = headers.indexOf('מינימום ₪'), cost = headers.indexOf('עלות ₪');
    if (minimum >= 0 && cost >= 0) {let column='',n=cost+1;while(n){n--;column=String.fromCharCode(65+n%26)+column;n=Math.floor(n/26);}for (let i=0;i<added.length;i++) {const row=output.start_row+i;tab.getRange(row,minimum+1).setFormula('=IF('+column+row+'="","",'+column+row+'+30)');}}
  }
  SpreadsheetApp.flush();
}
function megaLinksSend_(force) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return {message:'סנכרון אחר מתבצע כעת.'};
  try {
    const properties = PropertiesService.getScriptProperties();
    if (!force && Date.now() - Number(properties.getProperty('MEGA_LINKS_LAST_SENT') || 0) < 15000) return {message:'הבדיקה התקופתית תכלול את השינויים האחרונים.'};
    const token = properties.getProperty('MEGA_LINKS_TOKEN');
    if (!token) throw new Error('יש להריץ installMegaLinksSync פעם אחת.');
    const book = SpreadsheetApp.getActiveSpreadsheet();
    if (!book || book.getId() !== MEGA_LINKS_SHEET_ID) throw new Error('זה אינו גיליון הקטלוג המורשה.');
    const tab = book.getSheetByName(MEGA_LINKS_TAB);
    if (!tab) throw new Error('לשונית האתרים חסרה.');
    const headers = tab.getRange(1,1,1,tab.getLastColumn()).getValues()[0].map(String), missing = MEGA_LINKS_HEADERS.filter(h=>headers.indexOf(h)<0);
    if (missing.length) {if(headers.length+missing.length>80)throw new Error('אין מקום לעמודות החיבור.');if(headers.length+missing.length>tab.getMaxColumns())tab.insertColumnsAfter(tab.getMaxColumns(),headers.length+missing.length-tab.getMaxColumns());tab.getRange(1,headers.length+1,1,missing.length).setValues([missing]);}
    const rows = megaLinksRead_(tab);
    let result = megaLinksRequest_(book,token,rows);
    if (result.protocol === 2 && result.ack && result.writeback) {
      try {megaLinksWrite_(book,tab,result,rows);result = megaLinksRequest_(book,token,megaLinksRead_(tab),{ack:result.ack});}
      catch(e) {try {megaLinksRequest_(book,token,megaLinksRead_(tab),{ack:result.ack,writeback_error:e.syncCode || 'write_failed'});}catch(_){}throw e;}
    }
    properties.setProperty('MEGA_LINKS_LAST_SENT', String(Date.now()));
    properties.setProperty('MEGA_LINKS_LAST_RESULT', String(result.status || 'received'));
    return result;
  } finally { lock.releaseLock(); }
}
`;}
