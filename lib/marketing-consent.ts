// Consent to marketing email (Communications Law s.30A): given only by an explicit, unticked box, kept with the date,
// the exact wording shown and where it was given, and withdrawn at any time. One record per user: 'marketing:<user id>'.
// The admin exports the subscribed list to the external mailing tool and pastes back the addresses that unsubscribed there.
import {stmt,one,all,now,audit} from './server';
import type {Row} from './shared';

import {MARKETING_WORDING} from './marketing-wording';
export type MarketingSource='checkout'|'account'|'admin';
const recordId=(userId:string)=>'marketing:'+userId;

export async function marketingStatus(userId:string){
 const row=await one('SELECT data FROM records WHERE id=?',recordId(userId)),data=row?JSON.parse(row.data):null;
 const subscribed=data?.status==='subscribed';
 return {subscribed,at:(subscribed?data?.subscribed_at:data?.unsubscribed_at)||''};
}

// Saves the new state and keeps a short history of every change (date, state, source). Saving the same state again
// changes nothing, so the first consent date stays.
export async function setMarketing(user:Row,subscribed:boolean,source:MarketingSource,actor:Row=user){
 const id=recordId(user.id),row=await one('SELECT data FROM records WHERE id=?',id),old=row?JSON.parse(row.data):null,stamp=now();
 if(old&&(old.status==='subscribed')===subscribed)return false;
 if(!old&&!subscribed)return false;
 const change={status:subscribed?'subscribed':'unsubscribed',at:stamp,source};
 const data={...(old||{}),status:change.status,email:user.email,
  ...(subscribed?{subscribed_at:stamp,source,wording:MARKETING_WORDING}:{unsubscribed_at:stamp,unsubscribed_source:source}),
  history:[...(old?.history||[]),change].slice(-20)};
 await stmt('INSERT INTO records(id,kind,user_id,data,created,updated) VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,updated=excluded.updated',
  id,'marketing_consent',user.id,JSON.stringify(data),stamp,stamp).run();
 await audit(actor,id,subscribed?'הצטרפות לדיוור שיווקי':'הסרה מדיוור שיווקי',{source,email:user.email});
 return true;
}

// The current e-mail of the account is used (not the one saved at consent), so a changed address follows the account.
export async function marketingList(){
 const rows=await all("SELECT u.id,u.name,u.email,r.data FROM records r JOIN users u ON u.id=r.user_id WHERE r.kind='marketing_consent' AND json_extract(r.data,'$.status')='subscribed' ORDER BY json_extract(r.data,'$.subscribed_at')");
 const removed=await one("SELECT COUNT(*) AS n FROM records WHERE kind='marketing_consent' AND json_extract(data,'$.status')='unsubscribed'");
 return {subscribers:rows.map(r=>{const d=JSON.parse(r.data);return {name:r.name||'',email:r.email,subscribed_at:d.subscribed_at||'',source:d.source||''};}),unsubscribed:Number(removed?.n||0)};
}

const csvCell=(value:string)=>{const text=String(value??'').replace(/^[=+\-@\t\r]/,"'$&");return /[",\n]/.test(text)?'"'+text.replace(/"/g,'""')+'"':text;};
export async function marketingCsv(){
 const {subscribers}=await marketingList();
 const lines=[['email','name','consent_date','source'],...subscribers.map(s=>[s.email,s.name,s.subscribed_at,s.source])];
 return '﻿'+lines.map(line=>line.map(csvCell).join(',')).join('\r\n')+'\r\n';
}

// Addresses that unsubscribed in the external tool (or asked by phone / reply "הסר"). Unknown addresses are reported back.
export async function marketingRemove(actor:Row,text:string){
 const emails=[...new Set(String(text||'').toLowerCase().match(/[^\s,;<>"']+@[^\s,;<>"']+\.[^\s,;<>"']+/g)||[])].slice(0,5000);
 let removed=0;const unknown:string[]=[];
 for(const email of emails){
  const user=await one('SELECT * FROM users WHERE lower(email)=?',email);
  if(!user){unknown.push(email);continue;}
  if(await setMarketing(user,false,'admin',actor))removed++;
 }
 return {checked:emails.length,removed,unknown:unknown.slice(0,50)};
}
