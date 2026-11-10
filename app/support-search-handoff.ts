// Opening "all tickets of this customer" from a ticket page: the list starts filtered by name.
// The view router keeps no query string, so the name is handed over in memory (or read from
// ?customer= when the link is opened in a new tab).
let pending='';
export function handOffSupportSearch(name:string){pending=String(name||'').trim();}
export function takeSupportSearch(){
 const value=pending;pending='';
 if(value)return value;
 if(typeof window==='undefined')return '';
 return new URLSearchParams(window.location.search).get('customer')||'';
}
