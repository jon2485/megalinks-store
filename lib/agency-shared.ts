// Pure helpers of the agency centre, without server imports (used by the server and by tests).
import type {Row} from './shared';

export function normalizeDomain(input:unknown){
 let text=String(input??'').trim().toLowerCase().replace(/^[a-z][a-z0-9+.-]*:\/\//,'').replace(/^www\./,'');
 text=text.split(/[\/?#\s]/)[0].replace(/:\d+$/,'').replace(/\.$/,'');
 if(!text||!/^[^\s@]+\.[^\s@.]{2,}$/.test(text)||text.length>253)return '';
 try{text=new URL('http://'+text).hostname.replace(/^www\./,'');}catch{return '';}
 return text;
}

// The money of one article for the agency's reports: what was paid before VAT, minus the parts that were refunded.
// Demo articles and articles of unpaid orders are not spend.
export function articleSpend(a:Row){
 const d=typeof a.data==='string'?JSON.parse(a.data||'{}'):a.data||{};
 if(d.demo||a.status==='demo_completed'||a.status==='demo_paid')return 0;
 if(!(Number(a.paid)||d.on_account))return 0;
 const net=Number(d.paid_net_amount||0),writing=Number(d.writing_net_amount||0),publication=Math.max(0,net-writing);
 if(a.status==='cancelled'&&!d.publication_refunded&&!d.writing_refunded)return 0;
 return (d.publication_refunded?0:publication)+(d.writing_refunded?0:writing);
}
