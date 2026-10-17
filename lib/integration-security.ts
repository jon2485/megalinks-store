import {env} from 'cloudflare:workers';
import type {Row} from './shared';
import {assert,encrypt,externalUrl} from './server';

export function integrationEnvironmentName(key:string,provider='openai') {
    if(key==='ai')return ({gemini:'GEMINI_API_KEY',openai:'OPENAI_API_KEY',groq:'GROQ_API_KEY',grok:'XAI_API_KEY'} as Row)[provider]||'';
    return ({email:'POSTFLOW_EMAIL_SECRET',wordpress:'POSTFLOW_WORDPRESS_PASSWORD',payments:'POSTFLOW_PAYMENTS_SECRET',whatsapp:'POSTFLOW_WHATSAPP_SECRET',images:'PEXELS_API_KEY'} as Row)[key]||'';
}
export function integrationEnvironmentSecret(key:string,provider?:string) {
    const name=integrationEnvironmentName(key,provider);return name?String((env as any)[name]||'').trim():'';
}
// Only documented configuration fields may be persisted or returned. In
// particular, never spread arbitrary password/token fields into API responses.
export function integrationMetadata(key:string,config:Row):Row {
    const fields=['enabled','url','username','auto_publish','secret_storage',...(key==='ai'?['provider','model']:[])];
    const result:Row={};for(const field of fields)if(config[field]!==undefined)result[field]=config[field];
    if(result.url){try{const url=new URL(result.url);url.username='';url.password='';url.search='';url.hash='';result.url=url.href;}catch{delete result.url;}}
    return result;
}
export async function updatedIntegration(key:string,b:Row,prev:Row) {
    const fields=['enabled','url','username','auto_publish','secret','clear_secret','secret_storage',...(key==='ai'?['provider','model']:[])];
    assert(Object.keys(b).every(k=>fields.includes(k)),'הגדרות החיבור מכילות שדה שאינו נתמך');
    for(const field of ['enabled','auto_publish','clear_secret'])assert(b[field]===undefined||typeof b[field]==='boolean','מצב החיבור אינו תקין');
    for(const field of ['url','username','model'])assert(b[field]===undefined||typeof b[field]==='string'&&b[field].length<=(field==='url'?2000:200),'פרטי החיבור אינם תקינים');
    assert(b.secret===undefined||typeof b.secret==='string'&&b.secret.length<=4000,'מפתח החיבור אינו תקין');
    const value={...integrationMetadata(key,prev),...Object.fromEntries(Object.entries(b).filter(([k])=>!['secret','clear_secret'].includes(k)))};
    if(key==='ai')assert(['openai','groq','grok'].includes(value.provider||'openai'),'ספק AI אינו נתמך');
    if(value.url){const url=externalUrl(value.url);assert(!url.search&&!url.hash,'אין לשמור סודות או פרמטרים בכתובת החיבור; השתמשו בשדה המפתח');value.url=url.href;}
    const environment=integrationEnvironmentSecret(key,value.provider);
    const storage=b.secret_storage??(b.secret?.trim()?'encrypted_server':prev.secret_storage|| (environment?'environment':'encrypted_server'));
    assert(['environment','encrypted_server'].includes(storage),'אופן שמירת מפתח אינו תקין');
    assert(storage!=='environment'||!b.secret,'מפתח במצב משתנה סביבה מוגדר בסודות האירוח בלבד');
    value.secret_storage=storage;
    const sameProvider=key!=='ai'||(prev.provider||'openai')===(value.provider||'openai');
    value.secret=storage==='environment'||b.clear_secret?'':b.secret?.trim()?await encrypt(b.secret.trim()):sameProvider?prev.secret||'':'';
    if(b.clear_secret)value.enabled=false;
    if(b.enabled===true)assert(storage==='environment'?!!environment:!!value.secret,'יש להגדיר מפתח לפני הפעלת החיבור');
    return value;
}
