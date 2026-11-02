import type {Row} from './shared';
export const writingWaitingLabel='ממתין לקבלת הטקסט הכתוב מעורך התוכן';
export const writingData=(a:Row):Row=>typeof a.data==='string'?{...a,...JSON.parse(a.data)}:{...a,...(a.data||{})};
export function writingSubmitted(a:Row){const d=writingData(a);return !!(d.editorial&&d.writing_requested_at);}
export function writingCustomerEditor(a:Row){const d=writingData(a);return !!(d.editorial&&d.content&&(d.writing_returned_at||d.status==='review')&&['draft','review','revisions','admin_review','approved','sent','published','demo_completed'].includes(d.status));}
export function writingQueueArticle(a:Row){const d=writingData(a);return writingSubmitted(d)&&(d.status==='writing'||d.status==='revisions'&&!d.writing_returned_at)&&!d.cancel_pending&&!d.publication_refunded;}
export function writingStatus(a:Row){const d=writingData(a);return writingSubmitted(d)&&(d.status==='writing'||d.status==='revisions'&&!d.writing_returned_at)?writingWaitingLabel:d.editorial&&d.status==='review'?'המאמר מוכן לבדיקה':null;}
// A supplier who has not published within this many days counts as late.
export const SUPPLIER_LATE_DAYS=3;
export const writingQueueSql=(a='a')=>`(COALESCE(json_extract(${a}.data,'$.editorial'),0)=1 AND json_extract(${a}.data,'$.writing_requested_at') IS NOT NULL AND (${a}.status='writing' OR (${a}.status='revisions' AND json_extract(${a}.data,'$.writing_returned_at') IS NULL)) AND COALESCE(json_extract(${a}.data,'$.cancel_pending'),0)=0 AND COALESCE(json_extract(${a}.data,'$.publication_refunded'),0)=0)`;
export const supplierLateSql=(a='a')=>`(${a}.status='sent' AND COALESCE(${a}.published_url,'')='' AND COALESCE(json_extract(${a}.data,'$.cancel_pending'),0)=0 AND COALESCE(json_extract(${a}.data,'$.publication_refunded'),0)=0 AND COALESCE(json_extract(${a}.data,'$.supplier_sent_at'),(SELECT d.created FROM supplier_dispatch_allocations d WHERE d.article_id=${a}.id),${a}.updated)<strftime('%Y-%m-%dT%H:%M:%fZ','now','-${SUPPLIER_LATE_DAYS} days'))`;
// The code the writer keeps in the file name: order number and the start of the article id.
export const writingCode=(number:unknown,id:string)=>'ML-'+String(number||'').replace(/[^0-9]/g,'')+'-'+String(id).replace(/-/g,'').slice(0,6).toUpperCase();
export const writingCodeSql=(number:string,id:string)=>`'ML-'||replace(${number},'#','')||'-'||upper(substr(replace(${id},'-',''),1,6))`;
