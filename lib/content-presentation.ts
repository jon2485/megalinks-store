export const contentStatus:Record<string,string>={draft:'בעריכה אצל הלקוח',writing:'בכתיבה',review:'לבדיקת הלקוח',admin_review:'לאישור מנהל',approved:'מאושרת למסירה',sent:'ממתינה לספק',published:'פורסמה',revisions:'הוחזרה לתיקון',scheduled:'שליחה מתוזמנת',cancelled:'בוטלה',demo_completed:'הדגמה הושלמה'};
export function contentTime(value?:string){if(!value||!Number.isFinite(Date.parse(value)))return 'לא תועד';return new Intl.DateTimeFormat('he-IL',{timeZone:'Asia/Jerusalem',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(value));}
export function contentWait(value?:string){if(!value||!Number.isFinite(Date.parse(value)))return 'מועד השליחה לא תועד';const hours=Math.max(0,Math.floor((Date.now()-Date.parse(value))/3600000));return hours<1?'פחות משעה':hours<24?`${hours} שעות`:`${Math.floor(hours/24)} ימים${hours%24?' ו־'+hours%24+' שעות':''}`;}
export function contentUrl(value?:string){try{const u=new URL(value||'');return ['http:','https:'].includes(u.protocol)?u.href:'';}catch{return '';}}
// Where an article stands, in the words the manager sees. "tone" picks the status colour.
export const contentStages:Record<string,{label:string;tone:string;note?:string}>={
 admin_review:{label:'לאישור מנהל',tone:'report',note:'הלקוח שלח לבדיקה'},
 dispatch_scheduled:{label:'אושרה, תישלח בתאריך',tone:'ok',note:'לספק ב־7:00 ביום שנבחר'},
 writing_new:{label:'בקשת כתיבה',tone:'work',note:'ממתינה לכותב'},
 writing_fix:{label:'תיקונים לכותב',tone:'report',note:'הלקוח ביקש תיקונים'},
 customer_review:{label:'אצל הלקוח לבדיקה',tone:'unreported',note:'המאמר הוחזר ללקוח'},
 awaiting_brief:{label:'מחכה להנחיות',tone:'unreported',note:'הלקוח טרם שלח לכותב'},
 with_customer:{label:'אצל הלקוח',tone:'unreported',note:'בעריכה'},
 customer_fix:{label:'אצל הלקוח',tone:'unreported',note:'הוחזרה לתיקון'},
 scheduled:{label:'מתוזמנת',tone:'unreported',note:'תעבור לאישור במועד'},
 delivery_failed:{label:'השליחה לספק נכשלה',tone:'red',note:'הכתבה לא הגיעה לספק'},
 ready_to_send:{label:'השליחה לספק נכשלה',tone:'red',note:'הכתבה לא הגיעה לספק'},
 with_supplier:{label:'אצל הספק',tone:'month'},
 published:{label:'פורסמה',tone:'ok'},
 demo_completed:{label:'הדגמה הושלמה',tone:'cancelled'},
 cancel_pending:{label:'בקשת ביטול',tone:'red',note:'הפרסום מושהה'},
 cancelled:{label:'בוטלה',tone:'cancelled'},
};
