/** Dates are days in Israel, never the visitor's device timezone. */
export function validPublicationDay(value:string){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
 const [year,month,day]=value.split('-').map(Number),date=new Date(Date.UTC(year,month-1,day));
 return year>=1900&&year<=2200&&date.getUTCFullYear()===year&&date.getUTCMonth()===month-1&&date.getUTCDate()===day;
}
export function israelDay(value:string|Date=new Date()):string{
 const date=value instanceof Date?value:new Date(value);if(!Number.isFinite(date.getTime()))return '';
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jerusalem',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
 return ['year','month','day'].map(type=>parts.find(p=>p.type===type)?.value).join('-');
}
export function publicationDay(value:string){return validPublicationDay(value)?value:value.includes('T')?israelDay(value):'';}
export function displayPublicationDay(value:string){const day=publicationDay(value);return day?day.split('-').reverse().join('.'):'';}
export function israelDayStart(value:string){
 if(!validPublicationDay(value))throw new Error('בחרו תאריך תקין בלוח השנה');
 const target=Date.parse(value+'T00:00:00Z');let instant=target;
 const fmt=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jerusalem',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
 for(let i=0;i<3;i++){const parts=fmt.formatToParts(new Date(instant));const get=(key:string)=>parts.find(p=>p.type===key)!.value;const wall=Date.parse(`${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}Z`);instant+=target-wall;}
 return new Date(instant).toISOString();
}
export function normalizeRequestedPublication(value:unknown,today=israelDay()){
 if(value==='')return '';
 if(typeof value!=='string')throw new Error('מועד הפרסום אינו תקין');
 const day=publicationDay(value);if(!day||day<today)throw new Error('בחרו מועד פרסום מהיום והלאה');
 return israelDayStart(day);
}
