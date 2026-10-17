import { env } from 'cloudflare:workers';
import catalog from '@/data/catalog.json';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { Row, httpUrl, websitePricing } from './shared';
import {integrationEnvironmentSecret} from './integration-security';
import {customerWebsiteData} from './customer-privacy';
export const now = () => new Date().toISOString();
export const uid = () => crypto.randomUUID();
export class ApiError extends Error {
    constructor(public status: number, message: string) { super(message); }
}
export function db() { if (!env.DB)
    throw new ApiError(503, 'שמירת הנתונים אינה זמינה כרגע. נסו שוב בעוד רגע.'); return env.DB; }
export const stmt = (sql: string, ...args: any[]) => db().prepare(sql).bind(...args);
export async function one(sql: string, ...args: any[]) { return await stmt(sql, ...args).first<Row>(); }
export async function all(sql: string, ...args: any[]) { return (await stmt(sql, ...args).all<Row>()).results; }
export function parse(row: Row | null) { if (!row)
    return null; return { ...(row.data ? JSON.parse(row.data) : {}), ...row, ...(row.data ? { data: JSON.parse(row.data) } : {}) }; }
export function assert(ok: any, message: string, status = 400): asserts ok { if (!ok)
    throw new ApiError(status, message); }
export async function actor() {
    const u = await getChatGPTUser();
    assert(u, 'יש להתחבר כדי להמשיך', 401);
    const ownerEmail = String((env as any).POSTFLOW_OWNER_EMAIL || '').trim().toLowerCase();
    assert(ownerEmail, 'זהות בעל המערכת טרם הוגדרה', 503);
    const adminEmails = new Set([ownerEmail, ...String((env as any).POSTFLOW_ADMIN_EMAILS || '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean)]);
    const email = u.email.trim().toLowerCase();
    const isOwner = email === ownerEmail;
    const isSystemAdmin = adminEmails.has(email);
    // The first visitor must never acquire administrator privileges unless their email is explicitly configured.
    if (isOwner) {
        await stmt('INSERT INTO settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', 'owner_id', u.userId).run();
        await ensureRuntimeSecretMigration();
    }
    await stmt('INSERT OR IGNORE INTO users(id,email,name,role,created) VALUES (?,?,?,?,?)', u.userId, email, u.displayName, isSystemAdmin ? 'admin' : 'customer', now()).run();
    if (isSystemAdmin)
        await stmt("UPDATE users SET role='admin',email=?,name=? WHERE id=?", email, u.displayName, u.userId).run();
    const me = await one('SELECT * FROM users WHERE id=?', u.userId);
    assert(me, 'משתמש לא זמין', 503);
    return me;
}
export function admin(u: Row) { assert(u.role === 'admin', 'הפעולה זמינה למנהל בלבד', 403); }
export function owns(u: Row, row: Row | null) { assert(row, 'הרשומה לא נמצאה', 404); assert(u.role === 'admin' || row.user_id === u.id, 'אין הרשאה לרשומה הזו', 403); return row; }
export async function setting(key: string, fallback: any = null) { const r = await one('SELECT value FROM settings WHERE key=?', key); return r ? JSON.parse(r.value) : fallback; }
export async function saveSetting(key: string, value: any) { await stmt('INSERT INTO settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', key, JSON.stringify(value)).run(); }
export async function audit(u: Row, resource: string, action: string, data: any = {}) { await stmt('INSERT INTO activity(id,user_id,resource,action,data,created) VALUES (?,?,?,?,?,?)', uid(), u.id, resource, action, JSON.stringify(data), now()).run(); }
export async function ensureCatalog() { if (await one('SELECT value FROM settings WHERE key=?', 'catalog_initialized'))
    return; const stamp = now(); const statements = []; for (let i = 0; i < catalog.length; i += 10) {
    const chunk = catalog.slice(i, i + 10);
    const args = chunk.flatMap(w => [w.id, w.name, w.url, w.category, w.price_cents, Number((w as Row).dr || 0), 1, JSON.stringify({ ...w, procurement_verified: false, source: 'BuyPost public catalog', source_date: '2026-10-04' }), stamp]);
    statements.push(stmt('INSERT OR IGNORE INTO websites(id,name,url,category,price,dr,active,data,updated) VALUES ' + chunk.map(() => '(?,?,?,?,?,?,?,?,?)').join(','), ...args));
} for (let i = 0; i < statements.length; i += 20)
    await db().batch(statements.slice(i, i + 20)); await saveSetting('catalog_initialized', true); }
export function publicWebsite(w: Row) { const raw=typeof w.data==='string'?JSON.parse(w.data):w.data||{},d=customerWebsiteData(raw);return { ...d, id: w.id, name: w.name, url: w.url, category: w.category, dr: w.dr, active: w.active, ...websitePricing({ ...d, price: w.price }) }; }
export async function website(id: string, allowInactive = false) { const w = parse(await one('SELECT * FROM websites WHERE id=?', id)); assert(w && (allowInactive || w.active), 'האתר אינו זמין להזמנה', 404); return { ...w, ...websitePricing(w) }; }
export async function hash(value: string) { return [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))].map(x => x.toString(16).padStart(2, '0')).join(''); }
function keyValue() {
    const s = (env as any).SETTINGS_ENCRYPTION_KEY;
    assert(typeof s==='string'&&s, 'לא הוגדר סוד השרת SETTINGS_ENCRYPTION_KEY. שמירת מפתחות ופענוחם אינם זמינים.', 503);
    let decoded: string;
    try { decoded = atob(s); }
    catch { throw new ApiError(503, 'סוד השרת SETTINGS_ENCRYPTION_KEY אינו Base64 תקין. יש לבדוק את הגדרת הסוד באירוח.'); }
    const bytes = Uint8Array.from(decoded, c => c.charCodeAt(0));
    assert(bytes.length===32, 'סוד השרת SETTINGS_ENCRYPTION_KEY חייב להכיל בדיוק 32 בתים לאחר פענוח Base64 (256 ביט). יש לבדוק את הגדרת הסוד; אין להחליף מפתח קיים ללא העברת הסודות המוצפנים.', 503);
    // Return the original decoded bytes. Do not hash, pad, trim or rotate the key.
    return bytes;
}
export async function encrypt(value: string) { const iv = crypto.getRandomValues(new Uint8Array(12)); const k = await crypto.subtle.importKey('raw', keyValue(), 'AES-GCM', false, ['encrypt']); const bytes = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k, new TextEncoder().encode(value))); return btoa(String.fromCharCode(...iv, ...bytes)); }
export async function decrypt(value: string) { const bytes = Uint8Array.from(atob(value), c => c.charCodeAt(0)); const k = await crypto.subtle.importKey('raw', keyValue(), 'AES-GCM', false, ['decrypt']); return new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.slice(0, 12) }, k, bytes.slice(12))); }
export function geminiEnvironmentConfigured() {return !!String((env as any).GEMINI_API_KEY||(env as any).GEMINI_API_KEY_ENCRYPTED||'').trim();}
export async function geminiServerKey() { const raw=String((env as any).GEMINI_API_KEY || '').trim();if(raw)return raw;const wrapped=String((env as any).GEMINI_API_KEY_ENCRYPTED||'').trim();return wrapped?await decrypt(wrapped):''; }
async function migrateGeminiRuntimeSecret() {
    const wrapped=String((env as any).GEMINI_API_KEY_ENCRYPTED||'').trim();if(!wrapped)return;
    const row=await one("SELECT value FROM settings WHERE key='integration_ai'");if(!row)return;
    const config=JSON.parse(row.value);
    if(config.provider!=='gemini'||config.secret_storage!=='encrypted_server'||config.secret!==wrapped)return;
    // Verify the original key before deleting the DB copy; compare-and-swap
    // preserves any concurrent change made by the owner.
    assert(await decrypt(wrapped),'מפתח Gemini בסביבת השרת אינו תקין',503);
    const {secret:discard,...metadata}=config;
    await stmt("UPDATE settings SET value=? WHERE key='integration_ai' AND value=?",JSON.stringify({...metadata,secret_storage:'environment'}),row.value).run();
}
let runtimeSecretMigration:Promise<void>|undefined;
export function ensureRuntimeSecretMigration() {
    if(!(env as any).GEMINI_API_KEY_ENCRYPTED||!env.DB)return Promise.resolve();
    return runtimeSecretMigration??=migrateGeminiRuntimeSecret().catch(error=>{runtimeSecretMigration=undefined;throw error;});
}
export function externalUrl(value: string) {
    let u:URL;try{u=new URL(httpUrl(value));}catch{throw new ApiError(400,'יש להזין כתובת ציבורית תקינה');}
    assert(u.protocol==='https:','חיבורים חיצוניים דורשים HTTPS');
    assert(!u.username&&!u.password,'אין לכלול סיסמה בכתובת');
    const host=u.hostname.toLowerCase().replace(/\.+$/,'');
    assert(!/^(localhost|.*\.local|.*\.internal|.*\.localhost)$/i.test(host)&&!/^\d+(\.\d+){3}$/.test(host)&&!host.includes(':')&&host.includes('.'),'יש להזין כתובת ציבורית תקינה');
    return u;
}
export async function externalFetch(url: string, init: RequestInit) { externalUrl(url); let res:Response;try{res = await fetch(url, { ...init, redirect: 'manual', signal: AbortSignal.timeout(45000) });}catch{throw new ApiError(502,'החיבור לשירות החיצוני נכשל או שזמן ההמתנה הסתיים');} assert(res.status < 300 || res.status >= 400, 'השירות החיצוני החזיר הפניה לכתובת אחרת', 502); return res; }
export async function connection(key: string) { const x = await setting('integration_' + key, {}); if (key === 'ai' && x.provider === 'gemini') return { ...x, secret: x.secret_storage==='encrypted_server'?(x.secret?await decrypt(x.secret):''):await geminiServerKey() }; const runtime=integrationEnvironmentSecret(key,x.provider);return {...x,secret:x.secret_storage==='environment'?runtime:x.secret_storage==='encrypted_server'?(x.secret?await decrypt(x.secret):''):runtime||(x.secret?await decrypt(x.secret):'')}; }
export async function notify(u: Row, kind: string, data: any) { await stmt('INSERT INTO jobs(id,user_id,kind,status,data,created,updated) VALUES (?,?,?,?,?,?,?)', uid(), u.id, kind, 'requested', JSON.stringify(data), now(), now()).run(); }
export async function syncOrder(id: string) { const outstanding = await one("SELECT COUNT(*) AS n FROM articles WHERE order_id=? AND status NOT IN ('published','cancelled','demo_completed')", id); const started = await one("SELECT COUNT(*) AS n FROM articles WHERE order_id=? AND status NOT IN ('draft','cancelled')", id); if (!outstanding?.n)
    await stmt("UPDATE orders SET status='completed',updated=? WHERE id=? AND (paid=1 OR json_extract(data,'$.demo')=1 OR json_extract(data,'$.on_account')=1) AND status<>'cancelled'", now(), id).run();
else if (started?.n)
    await stmt("UPDATE orders SET status='in_progress',updated=? WHERE id=? AND (paid=1 OR json_extract(data,'$.demo')=1 OR json_extract(data,'$.on_account')=1) AND status<>'cancelled'", now(), id).run(); }
export const basicAuth = (name: string, password: string) => 'Basic ' + btoa(String.fromCharCode(...new TextEncoder().encode(name + ':' + password)));
