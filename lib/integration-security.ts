import {env} from 'cloudflare:workers';
import type {Row} from './shared';
import {assert,encrypt,externalUrl} from './server';

export const RESEND_URL='https://api.resend.com/emails',RESEND_TEST_FROM='Mega Links <onboarding@resend.dev>';
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
    const fields=['enabled','url','username','auto_publish','secret_storage',...(key==='ai'?['provider','model']:[]),...(key==='email'?['provider','from','test_to']:[])];
    const result:Row={};for(const field of fields)if(config[field]!==undefined)result[field]=config[field];
    if(result.url){try{const url=new URL(result.url);url.username='';url.password='';url.search='';url.hash='';result.url=url.href;}catch{delete result.url;}}
    return result;
}
export async function updatedIntegration(key:string,b:Row,prev:Row) {
    const fields=['enabled','url','username','auto_publish','secret','clear_secret','secret_storage',...(key==='ai'?['provider','model']:[]),...(key==='email'?['provider','from','test_to']:[])];
    assert(Object.keys(b).every(k=>fields.includes(k)),'הגדרות החיבור מכילות שדה שאינו נתמך');
    for(const field of ['enabled','auto_publish','clear_secret'])assert(b[field]===undefined||typeof b[field]==='boolean','מצב החיבור אינו תקין');
    for(const field of ['url','username','model'])assert(b[field]===undefined||typeof b[field]==='string'&&b[field].length<=(field==='url'?2000:200),'פרטי החיבור אינם תקינים');
    assert(b.secret===undefined||typeof b.secret==='string'&&b.secret.length<=4000,'מפתח החיבור אינו תקין');
    const value={...integrationMetadata(key,prev),...Object.fromEntries(Object.entries(b).filter(([k])=>!['secret','clear_secret'].includes(k)))};
    if(key==='ai')assert(['openai','groq','grok'].includes(value.provider||'openai'),'ספק AI אינו נתמך');
    // Email can go to a webhook (Zapier and the like) or straight to Resend (owner, 16.11.2026). Resend has a fixed address;
    // `test_to` sends every message to one inbox only, with the real recipient in the subject.
    if(key==='email'){
        value.provider=value.provider||'webhook';assert(['webhook','resend'].includes(value.provider),'שירות דיוור אינו נתמך');
        for(const field of ['from','test_to'])assert(value[field]===undefined||typeof value[field]==='string'&&value[field].length<=254,'פרטי החיבור אינם תקינים');
        value.from=String(value.from||'').trim();value.test_to=String(value.test_to||'').trim().toLowerCase();
        assert(!value.test_to||/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value.test_to),'כתובת הבדיקה אינה תקינה');
        if(value.provider==='resend'){value.url=RESEND_URL;value.from=value.from||RESEND_TEST_FROM;assert(/^([^<>\r\n]{0,100}<)?[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+>?$/.test(value.from),'כתובת השולח אינה תקינה. לדוגמה: Mega Links <noreply@example.co.il>');}
    }
    if(value.url){const url=externalUrl(value.url);assert(!url.search&&!url.hash,'אין לשמור סודות או פרמטרים בכתובת החיבור; השתמשו בשדה המפתח');value.url=url.href;}
    const environment=integrationEnvironmentSecret(key,value.provider);
    const storage=b.secret_storage??(b.secret?.trim()?'encrypted_server':prev.secret_storage|| (environment?'environment':'encrypted_server'));
    assert(['environment','encrypted_server'].includes(storage),'אופן שמירת מפתח אינו תקין');
    assert(storage!=='environment'||!b.secret,'מפתח במצב משתנה סביבה מוגדר בסודות האירוח בלבד');
    value.secret_storage=storage;
    const sameProvider=key==='email'?(prev.provider||'webhook')===(value.provider||'webhook'):key!=='ai'||(prev.provider||'openai')===(value.provider||'openai');
    value.secret=storage==='environment'||b.clear_secret?'':b.secret?.trim()?await encrypt(b.secret.trim()):sameProvider?prev.secret||'':'';
    if(b.clear_secret)value.enabled=false;
    if(b.enabled===true)assert(storage==='environment'?!!environment:!!value.secret,'יש להגדיר מפתח לפני הפעלת החיבור');
    return value;
}
