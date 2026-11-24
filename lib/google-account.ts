// Google sign-in (owner decision 25.11.2026): anyone may open an account with Google. The gateway verifies Google and
// holds the session; it calls these two functions over loopback with the automation key (route `auth/google`).
// - resolve: a known Google identity, or an existing account with the same Google-verified email, enters at once
//   (the identity is linked to it, keeping its orders). Otherwise the person must accept the terms first.
// - accept: opens the account only with the terms accepted (checked here, not only on the screen), and saves when,
//   which versions and the exact wording shown. The newsletter box is optional and saved only when ticked.
// The gateway accepts only an email Google verified (Gmail or a Workspace domain), so no one reaches an
// administrator account by typing its address.
import {env} from 'cloudflare:workers';
import {stmt,one,now,uid,assert,db} from './server';
import type {Row} from './shared';
import {LEGAL_CONTENT} from './legal-content.generated';
import {setMarketing} from './marketing-consent';

export const TERMS_WORDING='קראתי ואני מאשר/ת את תנאי השימוש ואת מדיניות הפרטיות';
const identityId=(sub:string)=>'identity:google:'+sub;
const termsId=(userId:string)=>'terms:'+userId;
type GoogleIdentity={sub:string;email:string;name:string};

function clean(body:any):GoogleIdentity{
 const sub=String(body?.sub||''),email=String(body?.email||'').trim().toLowerCase(),name=String(body?.name||'').trim().slice(0,120);
 assert(/^[A-Za-z0-9_-]{1,255}$/.test(sub),'מזהה Google לא תקין');
 assert(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)&&email.length<=254,'כתובת דוא״ל לא תקינה');
 return {sub,email,name};
}
function adminEmails(){
 const owner=String((env as any).POSTFLOW_OWNER_EMAIL||'').trim().toLowerCase();
 return new Set([owner,...String((env as any).POSTFLOW_ADMIN_EMAILS||'').split(',').map(x=>x.trim().toLowerCase())].filter(Boolean));
}
const shape=(u:Row)=>({id:String(u.id),email:String(u.email),name:String(u.name||u.email),role:String(u.role||'customer')});
const linkStatement=(id:GoogleIdentity,userId:string,stamp:string)=>stmt('INSERT INTO records(id,kind,user_id,data,created,updated) VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING',
 identityId(id.sub),'auth_identity',userId,JSON.stringify({provider:'google',sub:id.sub,email_at_link:id.email,linked_at:stamp}),stamp,stamp);

export async function resolveGoogle(body:any){
 const id=clean(body);
 // One query: the linked account (if any) and the account with this email (if any).
 const linked=await one("SELECT u.* FROM records r JOIN users u ON u.id=r.user_id WHERE r.id=?",identityId(id.sub));
 if(linked)return {status:'ok',user:shape(linked)};
 const existing=await one('SELECT * FROM users WHERE lower(email)=?',id.email);
 if(!existing)return {status:'new'};
 const stamp=now();
 await db().batch([linkStatement(id,String(existing.id),stamp),
  stmt('INSERT INTO activity(id,user_id,resource,action,data,created) VALUES (?,?,?,?,?,?)',uid(),existing.id,identityId(id.sub),'חיבור חשבון Google',JSON.stringify({email:id.email}),stamp)]);
 return {status:'ok',user:shape(existing)};
}

export async function acceptGoogle(body:any){
 const id=clean(body);
 assert(body?.accepted===true,'יש לאשר את תנאי השימוש ואת מדיניות הפרטיות כדי לפתוח חשבון');
 // Someone may have opened or linked the account meanwhile (another tab): then just enter it.
 const known=await resolveGoogle(id);
 if(known.status==='ok')return known;
 const stamp=now(),userId='g_'+uid(),role=adminEmails().has(id.email)?'admin':'customer';
 const terms={accepted_at:stamp,terms_version:LEGAL_CONTENT.terms?.version||'',privacy_version:LEGAL_CONTENT.privacy?.version||'',
  wording:TERMS_WORDING,via:'google',source:'signup',history:[{at:stamp,terms_version:LEGAL_CONTENT.terms?.version||'',privacy_version:LEGAL_CONTENT.privacy?.version||'',source:'signup'}]};
 await db().batch([
  stmt('INSERT INTO users(id,email,name,role,created) VALUES (?,?,?,?,?)',userId,id.email,id.name||id.email,role,stamp),
  linkStatement(id,userId,stamp),
  stmt('INSERT INTO records(id,kind,user_id,data,created,updated) VALUES (?,?,?,?,?,?)',termsId(userId),'terms_consent',userId,JSON.stringify(terms),stamp,stamp),
  stmt('INSERT INTO activity(id,user_id,resource,action,data,created) VALUES (?,?,?,?,?,?)',uid(),userId,termsId(userId),'פתיחת חשבון עם Google ואישור תנאים',JSON.stringify({email:id.email,terms_version:terms.terms_version,privacy_version:terms.privacy_version}),stamp),
 ]);
 const user=await one('SELECT * FROM users WHERE id=?',userId);
 assert(user,'פתיחת החשבון לא הושלמה. נסו שוב.',503);
 if(body?.marketing===true)await setMarketing(user,true,'signup');
 return {status:'ok',user:shape(user)};
}
