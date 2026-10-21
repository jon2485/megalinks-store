import type {Row} from './shared';
import {spreadsheetBytes} from './office';

// Prices are the authenticated server quote, including personal/tier/bundle pricing.
// Coupon discounts apply to the order and are shown separately, as in the cart.
export function cartExportRows(quote:Row):(string|number)[][] {
 const items:Row[]=quote.items||[];
 if(!items.length)throw new Error('אין פריטים לייצוא');
 const amount=(value:unknown)=>{const n=Number(value);if(value==null||!Number.isSafeInteger(n)||n<0)throw new Error('מחירי הסל אינם מוכנים לייצוא');return n/100;};
 const metric=(value:unknown)=>value==null||value===''?'':Number.isFinite(Number(value))?Number(value):'';
 return [
  ['שם האתר','URL','DR','UR','מחיר לפני הנחה (₪)','מחיר ללקוח אחרי הנחה (₪)','כמות','סה״כ פרסום (₪)','שירותי כתיבה (₪)','סה״כ שורה (₪)'],
  ...items.map(item=>[String(item.name||''),String(item.url||''),metric(item.dr),metric(item.ur),amount(item.regular_price),amount(item.publication_price),Number(item.quantity),amount(item.publication_price*item.quantity),amount(Number(item.editorial_price||0)*item.quantity),amount(item.price_cents*item.quantity)]),
  [],['המחירים לפרסום אחד, לפני מע״מ. הנחת קופון מוצגת בנפרד בסיכום, כמו בסל.'],
  ['סכום ביניים לפני קופון (₪)',amount(quote.subtotal)],
  ['הנחת קופון (₪)',amount(quote.discount||0)],
  ['סכום אחרי קופון ולפני מע״מ (₪)',amount(quote.subtotal-Number(quote.discount||0))],
  ['מע״מ (₪)',amount(quote.vat)],['סה״כ לתשלום כולל מע״מ (₪)',amount(quote.total)],
 ];
}
export function cartSpreadsheetBytes(quote:Row){
 return spreadsheetBytes(cartExportRows(quote),'סל הקניות',{widths:[32,48,9,9,25,29,10,25,24,25],moneyColumns:[4,5,7,8,9],dataRows:quote.items.length});
}
export function exportCart(quote:Row){
 const bytes=cartSpreadsheetBytes(quote),url=URL.createObjectURL(new Blob([bytes as BlobPart],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
 const a=document.createElement('a');a.href=url;a.download='megalinks-cart-'+new Date().toISOString().slice(0,10)+'.xlsx';a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);
}
