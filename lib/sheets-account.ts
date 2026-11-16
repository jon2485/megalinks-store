import {setting,saveSetting,encrypt,decrypt,assert,now,ApiError} from './server';
import type {Row} from './shared';
// Google service account for the direct Sheets connection (16.11.2026). The owner pastes the JSON key file in the admin;
// the private key is stored encrypted with SETTINGS_ENCRYPTION_KEY and never leaves the server. Only the e-mail is shown.
const KEY='sheets_service_account';
export type ServiceAccount={client_email:string;private_key:string;private_key_id:string;project_id:string};
function der(pem:string){const body=pem.replace(/-----(BEGIN|END) PRIVATE KEY-----/g,'').replace(/\s+/g,'');const raw=atob(body);return Uint8Array.from(raw,c=>c.charCodeAt(0));}
export async function signingKey(pem:string){return crypto.subtle.importKey('pkcs8',der(pem),{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);}
export async function parseServiceAccount(text:unknown):Promise<ServiceAccount>{
 assert(typeof text==='string'&&text.trim(),'הדביקו את תוכן קובץ ה־JSON של חשבון השירות');
 assert(text.length<=20000,'הטקסט ארוך מדי. הדביקו רק את קובץ ה־JSON של חשבון השירות');
 let j:Row;try{j=JSON.parse(text.trim());}catch{throw new ApiError(400,'זה לא JSON תקין. הדביקו את כל תוכן הקובץ, מהסוגר { ועד הסוגר }');}
 assert(j&&typeof j==='object'&&!Array.isArray(j),'זה לא קובץ של חשבון שירות');
 assert(j.type==='service_account','זה לא קובץ של חשבון שירות. בקובץ הנכון כתוב "type": "service_account"');
 const email=String(j.client_email||'').trim().toLowerCase();
 assert(/^[^\s@]+@[^\s@]+\.gserviceaccount\.com$/.test(email),'חסרה בקובץ כתובת חשבון השירות (client_email)');
 const pem=String(j.private_key||'');
 assert(/-----BEGIN PRIVATE KEY-----[\s\S]+-----END PRIVATE KEY-----/.test(pem),'חסר בקובץ המפתח הפרטי (private_key)');
 try{await signingKey(pem);}catch{throw new ApiError(400,'המפתח הפרטי בקובץ פגום. צרו מפתח JSON חדש לחשבון השירות והדביקו אותו');}
 return {client_email:email,private_key:pem,private_key_id:String(j.private_key_id||'').slice(0,100),project_id:String(j.project_id||'').slice(0,100)};
}
export async function saveServiceAccount(account:ServiceAccount){await saveSetting(KEY,{client_email:account.client_email,project_id:account.project_id,private_key_id:account.private_key_id,key:await encrypt(account.private_key),saved_at:now()});}
export async function clearServiceAccount(){await saveSetting(KEY,{});}
export async function loadServiceAccount():Promise<ServiceAccount|null>{const s=await setting(KEY,{});if(!s.key||!s.client_email)return null;let pem:string;try{pem=await decrypt(s.key);}catch{throw new ApiError(503,'לא ניתן לפענח את מפתח חשבון השירות. הדביקו את קובץ ה־JSON מחדש');}return {client_email:s.client_email,private_key:pem,private_key_id:s.private_key_id||'',project_id:s.project_id||''};}
// The only shape the browser ever receives.
export async function serviceAccountStatus(){const s=await setting(KEY,{});return {client_email:s.key?String(s.client_email||''):'',key_stored:!!(s.key&&s.client_email),saved_at:s.key?s.saved_at||'':'',project_id:s.key?String(s.project_id||''):''};}
