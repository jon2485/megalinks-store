import {all,one,now} from './server';
import {env} from 'cloudflare:workers';
import {queueMail} from './mail';
import type {Row} from './shared';

/** Emails for the ticket conversation: the customer hears about a team reply and about closing;
 *  the team hears when a customer writes again. Mail problems never block the conversation. */
export async function ticketMail(item:Row,event:'reply'|'closed'|'customer',origin:string,text=''){
 const data=typeof item.data==='string'?JSON.parse(item.data):item.data||{},stamp=now(),subjectLine=String(data.name||'פנייה');
 if(event==='customer'){
  const recipients=new Set([...(await all("SELECT email FROM users WHERE role='admin'")).map((x:Row)=>x.email),String((env as any).POSTFLOW_OWNER_EMAIL||''),...String((env as any).POSTFLOW_ADMIN_EMAILS||'').split(',')].map(x=>String(x||'').trim()).filter(Boolean));
  let last:any=null;for(const to of recipients)last=await queueMail('email:ticket-customer:'+item.id+':'+stamp+':'+to,item.user_id,{to,subject:'הלקוח הגיב לפנייה: '+subjectLine,text:text,button:{label:'פתיחת הפנייה',url:origin+'/admin-support/'+item.id}});
  return last;
 }
 const customer=await one('SELECT email,name FROM users WHERE id=?',item.user_id);if(!customer?.email)return null;
 return queueMail('email:ticket-'+event+':'+item.id+':'+stamp,item.user_id,{to:customer.email,subject:event==='reply'?'התקבלה תשובה לפנייה שלך':'הפנייה שלך טופלה',text:subjectLine+(text?'\n\n'+text:''),button:{label:'צפייה בפנייה',url:origin+'/support'}});
}
