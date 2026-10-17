import { Row, httpUrl, textToHtml } from './shared';
import { assert } from './server';
export function contentHtml(text: string, brief: Row) { let html = textToHtml(text); for (const suffix of ['', '_2']) {
    const url = brief['target_url' + suffix], anchor = brief['anchor' + suffix];
    if (!url)
        continue;
    const safeUrl = httpUrl(url).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    const label = String(anchor || url).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const link = `<a href="${safeUrl}">${label}</a>`;
    if (anchor && html.includes(label))
        html = html.replace(label, link);
    else
        html += '<p>' + link + '</p>';
} return html; }
export async function signature(secret: string, body: string) { const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']); return [...new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body)))].map(x => x.toString(16).padStart(2, '0')).join(''); }
export function matchingSignature(a: string, b: string) { if (a.length !== b.length)
    return false; let difference = 0; for (let i = 0; i < a.length; i++)
    difference |= a.charCodeAt(i) ^ b.charCodeAt(i); return difference === 0; }
