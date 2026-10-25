'use client';
/** Keep export errors on the current screen; the server owns filters and workbook data. */
export async function downloadAdminWorkbook(path:string,filename:string){
 const response=await fetch('/api/'+path,{cache:'no-store'});
 if(!response.ok){const data=await response.json().catch(()=>null) as {error?:string}|null;throw new Error(data?.error||'לא ניתן לייצא כרגע. נסו שוב.');}
 const blob=await response.blob(),url=URL.createObjectURL(blob),link=document.createElement('a');
 link.href=url;link.download=filename;link.click();setTimeout(()=>URL.revokeObjectURL(url),5000);
}
