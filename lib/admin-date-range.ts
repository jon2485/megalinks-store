export function validReportDay(s:string){return /^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s))&&new Date(s+'T12:00:00Z').toISOString().slice(0,10)===s;}
export function nextDay(s:string){const d=new Date(s+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+1);return d.toISOString().slice(0,10);}
/** Israel midnight, calculated by Intl so both historical/current DST rules apply. */
export function israelMidnight(day:string){
 const target=Date.parse(day+'T00:00:00Z');let stamp=target;
 for(let i=0;i<3;i++){
  const p=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jerusalem',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(stamp));
  const n=(t:string)=>Number(p.find(x=>x.type===t)!.value);const shown=Date.UTC(n('year'),n('month')-1,n('day'),n('hour'),n('minute'),n('second'));
  stamp+=target-shown;
 }
 return new Date(stamp).toISOString();
}
export function dateRangeClause(field:string,from:string,to:string){
 return {sql:`(CASE WHEN length(${field})=10 THEN ${field}>=? AND ${field}<=? ELSE julianday(${field})>=julianday(?) AND julianday(${field})<julianday(?) END)`,args:[from,to,israelMidnight(from),israelMidnight(nextDay(to))]};
}
