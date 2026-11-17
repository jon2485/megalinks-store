import {PR_START_HTML} from '@/lib/pr-page-html';
import {SITE_URL} from '@/lib/seo';
import {PR_DAYS,PR_HOURS,prSites} from '@/lib/pr';
import {prData} from '@/lib/pr-render';

// Step 2 of the PR page: the interview details, then the normal cart and checkout (see home/pr/start.html).
export const dynamic='force-dynamic';
const chip=(value:string,label:string)=>`<button type="button" aria-pressed="false" data-value="${value}">${label}</button>`;
export async function GET(){
    let sites:Awaited<ReturnType<typeof prSites>>=[];
    try{sites=await prSites();}catch(error){console.error('PR form: sites unavailable',error);}
    const html=PR_START_HTML.replaceAll('%%SITE_URL%%',SITE_URL).replace('<!--PR:DATA-->',()=>prData(sites))
        .replace('<!--PR:DAYS-->',()=>PR_DAYS.map(d=>chip(d,d)).join('')).replace('<!--PR:HOURS-->',()=>PR_HOURS.map(([id,label])=>chip(id,label)).join(''));
    return new Response(html,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'private, no-store'}});
}
