// Server-side pieces of the PR page (/pr): the site cards and the data the page script reads. Everything is escaped.
import {PR_INTERVIEW_CENTS,type PrSite} from './pr';

const esc=(value:unknown)=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
export const prMoney=(cents:number)=>'₪'+Math.round(cents/100).toLocaleString('en-US');
const icon=(d:string)=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const I={
 link:icon('<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>'),
 clock:icon('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
 ext:icon('<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>'),
 plus:icon('<path d="M12 5v14M5 12h14"/>'),
};
const HUES=['#E9F0FF','#E6FBF8','#F2EEFF','#FFF3E2','#EAF7FF','#FDEBF1'];
const letter=(name:string)=>(name.trim().match(/[A-Za-z0-9א-ת]/)?.[0]||'•').toUpperCase();

/** The site picture: a real image when the owner adds one (data.pr_image_url), otherwise a drawn browser window with the
 *  site's name and address, so every card has a picture of the site. */
function shot(s:PrSite,hue:string){
 const inner=s.image?`<img src="${esc(s.image)}" alt="" loading="lazy" decoding="async">`
  :`<span class="ps__brand">${s.logo?`<img src="${esc(s.logo)}" alt="" loading="lazy" decoding="async" onerror="this.remove()">`:''}<b>${esc(s.name)}</b></span><span class="ps__lines" aria-hidden="true"><i></i><i></i><i></i></span>`;
 return `<figure class="ps__shot" style="--h:${hue}" aria-label="${esc('האתר '+s.name)}"><span class="ps__chrome" aria-hidden="true"><i></i><i></i><i></i><span dir="ltr">${esc(s.host)}</span></span><span class="ps__view">${inner}</span></figure>`;
}
export function prSiteCard(s:PrSite,index:number){
 const hue=HUES[index%HUES.length];
 const chips=[s.dr!=null?`<li><b dir="ltr">DR ${esc(s.dr)}</b></li>`:'',s.ur!=null?`<li><b dir="ltr">UR ${esc(s.ur)}</b></li>`:'',s.link?`<li>${I.link}קישור לאתר שלכם</li>`:'',s.days?`<li>${I.clock}פרסום תוך כ-${esc(s.days)} ימי עסקים</li>`:''].join('');
 return `<article class="ps" data-site="${esc(s.id)}">
  ${shot(s,hue)}
  <div class="ps__top"><span class="ps__logo" style="--h:${hue}" aria-hidden="true">${esc(letter(s.name))}</span><div><h3 dir="auto">${esc(s.name)}</h3><span class="ps__host" dir="ltr">${esc(s.host)}</span></div>${s.kind?`<span class="ps__kind">${esc(s.kind)}</span>`:''}</div>
  ${s.description?`<p class="ps__desc">${esc(s.description)}</p>`:''}
  ${chips?`<ul class="ps__chips">${chips}</ul>`:''}
  ${s.note?`<p class="ps__note"><b>הערה:</b> ${esc(s.note)}</p>`:''}
  <a class="ps__sample" href="${esc(s.sample)}" target="_blank" rel="noopener noreferrer">${I.ext}כתבה לדוגמה באתר</a>
  <div class="ps__buy"><div class="ps__price"><small>החל מ-</small><b><bdi dir="ltr">${prMoney(s.total_cents)}</bdi></b><small>כולל ראיון וכתיבה, לפני מע״מ</small></div>
  <button class="ps__pick" type="button" aria-pressed="false" data-pick="${esc(s.id)}"><span class="ps__pick-off">${I.plus}בחירת האתר</span><span class="ps__pick-on">נבחר</span></button></div>
  <a class="btn btn--navy ps__go" href="/pr/start?sites=${encodeURIComponent(s.id)}" data-go="${esc(s.id)}">נשמע לי טוב, בואו נצא לדרך!</a>
</article>`;
}
export const prSiteCards=(sites:PrSite[])=>sites.length?sites.map(prSiteCard).join('\n'):'<p class="pp-empty">האתרים לכתבות יח״צ יתעדכנו כאן בקרוב. אפשר לדבר איתנו בווצאפ ולשמוע מה זמין.</p>';
/** What the page script needs: names and prices for the selection bar and the order summary. */
export const prData=(sites:PrSite[])=>JSON.stringify({interview_cents:PR_INTERVIEW_CENTS,sites:sites.map(s=>({id:s.id,name:s.name,host:s.host,total_cents:s.total_cents,publication_cents:s.publication_cents,letter:letter(s.name),hue:HUES[sites.indexOf(s)%HUES.length]}))}).replace(/</g,'\\u003c');
