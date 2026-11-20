// Consent to marketing email (Communications Law s.30A): given only by an explicit, unticked box, kept with the date,
// the exact wording shown and where it was given, and withdrawn at any time. One record per user: 'marketing:<user id>'.
// The admin exports the subscribed list to the external mailing tool and pastes back the addresses that unsubscribed there.
import {stmt,one,all,now,uid,db,mapIn} from './server';
import type {Row} from './shared';

import {MARKETING_WORDING,ACCOUNT_MARKETING_WORDING} from './marketing-wording';
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
 const statements=marketingStatements(user,subscribed,source,actor,await one('SELECT data FROM records WHERE id=?',recordId(user.id)));
 if(!statements)return false;
 for(const statement of statements)await statement.run();
 return true;
}
// The writes for one consent change, from the consent row already read (null: none yet). null when nothing changes.
function marketingStatements(user:Row,subscribed:boolean,source:MarketingSource,actor:Row,row:Row|null|undefined){
 const id=recordId(user.id),old=row?JSON.parse(row.data):null,stamp=now();
 if(old&&(old.status==='subscribed')===subscribed)return null;
 if(!old&&!subscribed)return null;
 const change={status:subscribed?'subscribed':'unsubscribed',at:stamp,source};
 const data={...(old||{}),status:change.status,email:user.email,
  ...(subscribed?{subscribed_at:stamp,source,wording:source==='account'?ACCOUNT_MARKETING_WORDING:MARKETING_WORDING}:{unsubscribed_at:stamp,unsubscribed_source:source}),
  history:[...(old?.history||[]),change].slice(-20)};
 return [stmt('INSERT INTO records(id,kind,user_id,data,created,updated) VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,updated=excluded.updated',
  id,'marketing_consent',user.id,JSON.stringify(data),stamp,stamp),
  stmt('INSERT INTO activity(id,user_id,resource,action,data,created) VALUES (?,?,?,?,?,?)',uid(),actor.id,id,subscribed?'הצטרפות לדיוור שיווקי':'הסרה מדיוור שיווקי',JSON.stringify({source,email:user.email}),now())];
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
 // All the pasted addresses in one query (no query per address).
 const users=new Map((emails.length?await all('SELECT *,lower(email) AS email_key FROM users WHERE lower(email) IN (SELECT value FROM json_each(?))',JSON.stringify(emails)):[]).map(u=>[String(u.email_key),u]));
 // Their consent rows in one query, and every change written in one batch (no queries per address).
 const consents=await mapIn('records','id',[...users.values()].map(u=>recordId(String(u.id)))),writes=[];
 for(const email of emails){
  const found=users.get(email),user=found?(({email_key,...rest})=>rest)(found):null;
  if(!user){unknown.push(email);continue;}
  const statements=marketingStatements(user,false,'admin',actor,consents.get(recordId(String(user.id))));
  if(statements){writes.push(...statements);removed++;}
 }
 if(writes.length)await db().batch(writes);
 return {checked:emails.length,removed,unknown:unknown.slice(0,50)};
}
