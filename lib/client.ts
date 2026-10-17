'use client';
import { useEffect, useState } from 'react';
import {beginPendingRequest} from './loading-state';
export async function api(path: string, method = 'GET', body?: any, options?: {background?: boolean}) {
    const finish = typeof window !== 'undefined' && !options?.background ? beginPendingRequest() : () => {};
    try {
        const res = await fetch('/api/' + path, { method, cache:'no-store', headers: body instanceof FormData ? undefined : { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body) });
        const data: any = await res.json().catch(() => ({ error: 'תשובת שרת לא תקינה' }));
        if (!res.ok) { const error=new Error(data.error || 'הפעולה נכשלה');Object.assign(error,{status:res.status,warnings:data.warnings});throw error; }
        return data;
    } finally { finish(); }
}
export function useData(path: string, revision = 0, enabled = true, pollMs=0) { const [data, setData] = useState<any>(null), [error, setError] = useState(''), [loading, setLoading] = useState(true); useEffect(() => { if (!enabled) {
    setLoading(false);
    return;
} let active = true; setLoading(true); setError(''); api(path).then(d => { if (active)
    setData(d); }).catch(e => { if (active)
    setError(e.message); }).finally(() => { if (active)
    setLoading(false); }); return () => { active = false; }; }, [path, revision, enabled]); useEffect(()=>{if(!enabled||!pollMs)return;let active=true,running=false;const poll=async()=>{if(running||document.hidden)return;running=true;try{const result=await api(path,'GET',undefined,{background:true});if(active){setData(result);setError('');}}catch(e){if(active)setError((e as Error).message);}finally{running=false;}};const interval=setInterval(poll,pollMs);const visible=()=>{if(!document.hidden)void poll();};document.addEventListener('visibilitychange',visible);return()=>{active=false;clearInterval(interval);document.removeEventListener('visibilitychange',visible);};},[path,revision,enabled,pollMs]);return { data, error, loading, setData }; }
export function download(filename: string, contents: string, type = 'text/plain') { const blob = new Blob([contents], { type }), url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = filename; link.click(); setTimeout(() => URL.revokeObjectURL(url), 5000); }
export function csv(rows: any[], keys: string[]) { const cell = (x: any) => { let v = String(x ?? ''); if (/^[=+@-]/.test(v))
    v = "'" + v; return '"' + v.replaceAll('"', '""') + '"'; }; return '\uFEFF' + [keys, ...rows.map(r => keys.map(k => r[k]))].map(row => row.map(cell).join(',')).join('\r\n'); }
export function decodeHtml(html: string) { if (typeof document === 'undefined')
    return html; const doc = new DOMParser().parseFromString(html.replace(/<\/p>/g, '</p>\n\n').replace(/<br\s*\/?\s*>/g, '\n'), 'text/html'); return doc.body.textContent || ''; }

async function confirmPricing(warnings:string[],message:string){return new Promise<boolean>(resolve=>{const detail={warnings,resolve,handled:false};window.dispatchEvent(new CustomEvent('megalinks:pricing-warning',{detail}));if(!detail.handled)resolve(window.confirm(message+'\n\nשמירה בכל זאת? פעולה זו עלולה ליצור מחיר הפסדי.'));});}
export async function pricingApi(path:string,method:string,body:any){try{return await api(path,method,body);}catch(e){if((e as any).warnings?.length&&await confirmPricing((e as any).warnings,(e as Error).message))return api(path,method,{...body,acknowledge:true});throw e;}}
