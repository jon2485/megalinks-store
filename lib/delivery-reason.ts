// Turns the stored reason of a blocked supplier delivery (jobs "publication:<article>", data.error,
// written by dispatchArticle) into one plain line for the admin and a short next step.
// fix: 'site' opens the site's edit screen, 'stock' the site's stock, 'retry' only needs another try.
export type DeliveryReason={text:string;hint:string;fix:'site'|'stock'|'retry'|''};

export function deliveryReason(error?:string,status?:string):DeliveryReason|null{
 const e=String(error||'').trim();
 if(!e||!['blocked','failed'].includes(String(status||'')))return null;
 if(e.includes('הסכם הפרסום'))return {text:'האתר עוד לא מסומן "הסכם פרסום מאומת", ולכן הכתבה לא נשלחה.',hint:'סמנו "הסכם פרסום מאומת" בעריכת האתר, ואז לחצו "שליחה חוזרת לספק".',fix:'site'};
 if(e.includes('להזין מייל'))return {text:'לאתר אין מייל ספק, ולכן הכתבה לא נשלחה.',hint:'הוסיפו מייל ספק בעריכת האתר, ואז לחצו "שליחה חוזרת לספק".',fix:'site'};
 if(e.includes('אינו תקין'))return {text:'מייל הספק של האתר אינו תקין, ולכן הכתבה לא נשלחה.',hint:'תקנו את מייל הספק בעריכת האתר, ואז לחצו "שליחה חוזרת לספק".',fix:'site'};
 if(e.includes('מלאי'))return {text:'מלאי הפרסומים באתר נגמר, ולכן הכתבה לא נשלחה.',hint:'הגדילו את המלאי ב"הוספת מלאי", ואז לחצו "שליחה חוזרת לספק".',fix:'stock'};
 if(status==='failed')return {text:'השליחה לספק נכשלה בגלל תקלה זמנית.',hint:'לחצו "שליחה חוזרת לספק" כדי לנסות שוב.',fix:'retry'};
 return {text:e,hint:'',fix:''};
}
