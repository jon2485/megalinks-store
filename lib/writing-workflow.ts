import type {Row} from './shared';
export const writingWaitingLabel='ממתין לקבלת הטקסט הכתוב מעורך התוכן';
export const writingData=(a:Row):Row=>typeof a.data==='string'?{...a,...JSON.parse(a.data)}:{...a,...(a.data||{})};
export function writingSubmitted(a:Row){const d=writingData(a);return !!(d.editorial&&d.writing_requested_at);}
export function writingCustomerEditor(a:Row){const d=writingData(a);return !!(d.editorial&&d.content&&(d.writing_returned_at||d.status==='review')&&['draft','review','revisions','admin_review','approved','sent','published','demo_completed'].includes(d.status));}
export function writingQueueArticle(a:Row){const d=writingData(a);return writingSubmitted(d)&&(d.status==='writing'||d.status==='revisions'&&!d.writing_returned_at)&&!d.cancel_pending&&!d.publication_refunded;}
export function writingStatus(a:Row){const d=writingData(a);return writingSubmitted(d)&&(d.status==='writing'||d.status==='revisions'&&!d.writing_returned_at)?writingWaitingLabel:d.editorial&&d.status==='review'?'המאמר מוכן לבדיקה':null;}
