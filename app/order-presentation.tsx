'use client';
import React from 'react';
import type {Row} from '@/lib/shared';
import {paymentConfirmed,israelDate} from '@/lib/admin-order-buckets';
export const orderNumber=(o:Row)=>'#'+String(o.number||'').replace(/^#+/,'');
export const orderMoney=(n:number)=>new Intl.NumberFormat('he-IL',{style:'currency',currency:'ILS',minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(n||0)/100);
export const orderDateLabel=(v:string)=>israelDate(v)?new Intl.DateTimeFormat('he-IL',{timeZone:'Asia/Jerusalem',day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(v)):'לא תועד';
export function orderTimestamp(v:string){if(!v||Number.isNaN(+new Date(v)))return 'לא תועד';if(/^\d{4}-\d{2}-\d{2}$/.test(v))return orderDateLabel(v)+' (שעה לא תועדה)';return new Intl.DateTimeFormat('he-IL',{timeZone:'Asia/Jerusalem',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(v));}
export function paymentReceivedAt(o:Row,evidence?:Row){return paymentConfirmed(o)?evidence?.approved_at||o.paid_date||o.payment_approved_at||o.paid_at||'':'';}
export function OrderUrl({url}:{url:string}){
 let href='',label='';try{const u=new URL(/^https?:\/\//i.test(url||'')?url:'https://'+url);if(url&&['http:','https:'].includes(u.protocol)&&u.hostname.includes('.')&&!u.username&&!u.password){href=u.href;label=u.hostname+(u.pathname==='/'?'':u.pathname)+u.search;}}catch{}
 return href?<a className="approved-order-url" href={href} target="_blank" rel="noopener noreferrer"><bdi dir="ltr">{label}</bdi></a>:<span className="approved-order-url-missing">כתובת האתר לא תועדה</span>;
}
