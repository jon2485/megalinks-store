/** Customer-owned seller presentation; all amounts are stored integer agorot. */
export const sellerCash=(value:number)=>new Intl.NumberFormat('he-IL',{style:'currency',currency:'ILS',minimumFractionDigits:0,maximumFractionDigits:2}).format(value/100);
export function sellerDate(value:string){const date=new Date(value);return Number.isFinite(date.getTime())?new Intl.DateTimeFormat('he-IL',{timeZone:'Asia/Jerusalem',day:'2-digit',month:'2-digit',year:'numeric'}).format(date):'—';}
export function sellerMonth(value:string){if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(value))return value;return new Intl.DateTimeFormat('he-IL',{timeZone:'UTC',month:'long',year:'numeric'}).format(new Date(value+'-01T12:00:00Z'));}
