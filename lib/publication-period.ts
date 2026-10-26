/** Publication and its accounting month share one timestamp, independent of mail latency. */
export function publicationPeriod(date=new Date()){
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jerusalem',year:'numeric',month:'2-digit'}).formatToParts(date);
 return {stamp:date.toISOString(),month:parts.find(p=>p.type==='year')!.value+'-'+parts.find(p=>p.type==='month')!.value};
}
