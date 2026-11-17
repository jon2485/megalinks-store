// Mockup of the PR articles page (design/pr-page/spec.md), built from the homepage so it shares its styles, header,
// footer and scroll engine. Fictional data only: prices, DR and notes are placeholders until the page reads the catalog.
// Run: node design/pr-page/mockup/build.mjs  (writes pr.html and start.html next to this file)
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const here=dirname(fileURLToPath(import.meta.url)),root=resolve(here,'../../..');
const home=readFileSync(resolve(root,'home/index.html'),'utf8');
const head=home.slice(0,home.indexOf('</head>'))
  .replace(/<title>[^<]*<\/title>/,'<title>כתבות יח״צ באתרי החדשות הגדולים | MegaLinks</title>')
  .replace(/<meta name="description" content="[^"]*">/,'<meta name="description" content="כתבה על העסק שלכם באתרי החדשות הגדולים בישראל. המראיין שלנו מתקשר, אתם מספרים, ואנחנו כותבים ומפרסמים.">');
const ivSection=home.slice(home.indexOf('<section id="interview"'),home.indexOf('</section>',home.indexOf('<section id="interview"'))+10);
const footer=home.slice(home.indexOf('<footer class="ft">'),home.indexOf('</footer>')+9);
// The homepage's main script drives its own sections (snake, offer rail, ranking card) and stops on a page without
// them, so the PR page keeps every other script and leaves that one out.
const tail=home.slice(home.indexOf('<div class="fab">')).replace(/<script>\s*\(function\(\)\{\s*var reduce[\s\S]*?<\/script>\n?/,'');

const I={
  arrow:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 6l-6 6 6 6"/></svg>',
  ext:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>',
  check:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>',
  plus:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  phone:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/></svg>',
  shield:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>',
  eye:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
  link:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/></svg>',
  share:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/></svg>',
  clock:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  wa:'<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.5 14.4c-.3-.1-1.7-.8-2-.9-.3-.1-.5-.1-.7.1-.2.3-.8.9-.9 1.1-.2.2-.3.2-.6.1-.3-.1-1.2-.5-2.3-1.4-.9-.8-1.4-1.7-1.6-2-.2-.3 0-.5.1-.6l.4-.5c.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.4s1 2.8 1.2 3c.1.2 2 3.1 4.9 4.3 2.4 1 2.9.8 3.4.7.5-.1 1.7-.7 2-1.4.2-.7.2-1.2.2-1.4-.1-.1-.3-.2-.6-.3zM12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2z"/></svg>',
};
const BTN='נשמע לי טוב, בואו נצא לדרך!';
// Fictional numbers for the mockup only. The real page reads name, DR, UR, notes, examples and price from the catalog.
const sites=[
  {key:'ynet',name:'ynet',host:'ynet.co.il',letter:'Y',kind:'חדשות',desc:'אתר החדשות של ידיעות אחרונות, אתר החדשות הנצפה בישראל, עם עשרות מיליוני כניסות בחודש.',dr:91,ur:68,days:3,note:'הכתבה מתפרסמת במדור התוכן השיווקי של האתר.',price:'4,999',hue:'#E9F0FF'},
  {key:'mako',name:'mako',host:'mako.co.il',letter:'M',kind:'חדשות ובידור',desc:'אתר החדשות והבידור של קשת 12, מהאתרים הגדולים בישראל, עם עשרות מיליוני כניסות בחודש.',dr:89,ur:61,days:3,note:'אפשר לבחור מדור: צרכנות, בריאות או אוכל.',price:'4,499',hue:'#E6FBF8',selected:true},
  {key:'globes',name:'גלובס',host:'globes.co.il',letter:'ג',kind:'כלכלה ועסקים',desc:'עיתון העסקים והכלכלה של ישראל, עם מיליוני כניסות בחודש.',dr:84,ur:57,days:3,note:'מתאים לעסקים, להשקעות ולחברות.',price:'3,999',hue:'#F2EEFF'},
];
const siteCard=s=>`<article class="ps${s.selected?' is-picked':''}" data-site="${s.key}">
  <div class="ps__top"><span class="ps__logo" style="--h:${s.hue}" aria-hidden="true">${s.letter}</span><div><h3 dir="auto">${s.name}</h3><span class="ps__host" dir="ltr">${s.host}</span></div><span class="ps__kind">${s.kind}</span></div>
  <p class="ps__desc">${s.desc}</p>
  <ul class="ps__chips"><li><b dir="ltr">DR ${s.dr}</b></li><li><b dir="ltr">UR ${s.ur}</b></li><li>${I.link}קישור לאתר שלכם</li><li>${I.clock}פרסום תוך כ-${s.days} ימי עסקים</li></ul>
  <p class="ps__note"><b>הערה:</b> ${s.note}</p>
  <a class="ps__sample" href="#samples">${I.ext}כתבה לדוגמה באתר</a>
  <div class="ps__buy"><div class="ps__price"><small>החל מ-</small><b><bdi dir="ltr">₪${s.price}</bdi></b><small>כולל ראיון וכתיבה, לפני מע״מ</small></div>
  <button class="ps__pick" type="button" aria-pressed="${s.selected?'true':'false'}">${s.selected?I.check+'נבחר':I.plus+'בחירת האתר'}</button></div>
  <a class="btn btn--navy ps__go" href="start.html?site=${s.key}">${BTN}</a>
</article>`;

const css=`<style id="pr-page">
/* PR articles page (mockup). Shares the homepage tokens; everything new starts with .pp */
.pp-hero{position:relative;padding:clamp(120px,14vw,170px) 0 clamp(70px,9vw,120px);background:radial-gradient(1100px 520px at 85% 0%,#DDF7F4 0%,transparent 60%),radial-gradient(900px 600px at 10% 20%,#E6EBFF 0%,transparent 60%),var(--sc-canvas);overflow:hidden}
.pp-hero__grid{display:grid;grid-template-columns:1.05fr .95fr;gap:clamp(28px,5vw,80px);align-items:center}
.pp-hero h1{font-size:clamp(2.4rem,1.5rem + 3.4vw,4.6rem);line-height:1.02;letter-spacing:-.02em;margin-top:14px}
.pp-hero h1 span{background:var(--brand);-webkit-background-clip:text;background-clip:text;color:transparent}
.pp-hero .lede{margin-top:18px}
.pp-names{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin:26px 0 0;padding:0;list-style:none;color:var(--sc-ink-soft);font-weight:600}
.pp-names li{height:38px;display:inline-flex;align-items:center;padding:0 16px;border-radius:999px;background:#fff;box-shadow:inset 0 0 0 1px #DCE5F2;color:#0B1B3A;font:700 1rem var(--sc-font-display)}
.pp-names small{font-size:.95rem}
.pp-stack{position:relative;height:clamp(380px,36vw,500px);font-size:clamp(12px,1.1vw,15px)}
.pp-art{position:absolute;width:74%;background:#fff;border-radius:1.6em;padding:1.4em 1.5em;box-shadow:0 2px 3px #0b1b3a10,0 3em 5em -3em #0b1b3a8c;display:grid;gap:.7em;transform:translateY(calc((1 - var(--e,1)) * var(--dy,40px))) rotate(var(--r,0deg));transition:transform .3s}
.pp-art small{display:flex;align-items:center;justify-content:space-between;font:700 .85em var(--sc-font-display);color:#6B7F9E}
.pp-art b{font:700 1.25em/1.25 var(--sc-font-display);color:#0B1B3A}
.pp-art .pic{height:7em;border-radius:1em;background:linear-gradient(135deg,#CFF6F1,#DCE3FF)}
.pp-art .l{display:block;height:.6em;border-radius:1em;background:#E7EDF6}
.pp-art--1{top:0;right:0;--r:3deg;--dy:60px}
.pp-art--2{top:22%;left:0;--r:-4deg;--dy:90px;z-index:2}
.pp-art--3{bottom:0;right:8%;--r:1.5deg;--dy:120px;z-index:3}
.pp-call{position:absolute;z-index:4;top:46%;right:-2%;display:flex;align-items:center;gap:.7em;padding:.8em 1.1em;border-radius:999px;background:#031E4D;color:#fff;font:700 1em var(--sc-font-display);box-shadow:0 1.5em 3em -1.5em #031e4d}
.pp-call i{display:grid;place-items:center;width:2.2em;height:2.2em;border-radius:50%;background:var(--brand)}
.pp-call svg{width:1.1em;height:1.1em}
.pp-sites{background:#fff}
.pp-head{display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:18px 40px}
.pp-head .lede{max-width:30em}
.pp-grid{margin-top:clamp(30px,4vw,52px);display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:22px}
.ps{position:relative;display:grid;gap:14px;align-content:start;padding:22px;border-radius:28px;background:#F7F9FD;box-shadow:inset 0 0 0 1px #E3EAF4;transition:transform .25s var(--sc-ease-out),box-shadow .25s}
.ps:hover{transform:translateY(-4px);box-shadow:inset 0 0 0 1px #C9D6EE,0 30px 50px -36px #0b1b3a8c}
.ps.is-picked{background:#fff;box-shadow:inset 0 0 0 2px #5E7AEA,0 30px 50px -36px #4762dc99}
.ps__top{display:flex;align-items:center;gap:12px}
.ps__logo{width:54px;height:54px;border-radius:16px;display:grid;place-items:center;background:var(--h);color:#031E4D;font:800 1.5rem var(--sc-font-display);flex:none;box-shadow:inset 0 0 0 1px #0b1b3a12}
.ps h3{font-size:1.45rem;line-height:1.1}
.ps__host{display:block;font-size:.85rem;color:#6B7F9E}
.ps__kind{margin-inline-start:auto;align-self:flex-start;height:28px;display:inline-flex;align-items:center;padding:0 12px;border-radius:999px;background:#fff;box-shadow:inset 0 0 0 1px #DCE5F2;font:700 .8rem var(--sc-font-display);color:#4A5E7D;white-space:nowrap}
.ps__desc{font-size:1.05rem;color:#0B1B3A;line-height:1.5}
.ps__chips{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:8px}
.ps__chips li{display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 11px;border-radius:10px;background:#fff;box-shadow:inset 0 0 0 1px #E0E8F3;font-size:.86rem;color:#4A5E7D}
.ps__chips b{font:700 .9rem var(--sc-font-display);color:#0B1B3A}
.ps__chips svg{width:15px;height:15px;color:var(--sc-accent)}
.ps__note{font-size:.9rem;color:#4A5E7D;padding:10px 12px;border-radius:12px;background:#EEF3FB}
.ps__note b{color:#0B1B3A}
.ps__sample{display:inline-flex;align-items:center;gap:7px;font-weight:700;font-size:.95rem;color:var(--sc-accent);text-decoration:none;justify-self:start}
.ps__sample svg{width:16px;height:16px}
.ps__buy{display:flex;align-items:center;justify-content:space-between;gap:12px;padding-top:14px;border-top:1px solid #E3EAF4}
.ps__price{display:grid;line-height:1.2}
.ps__price small{font-size:.8rem;color:#6B7F9E}
.ps__price b{font:800 1.7rem var(--sc-font-display);color:#0B1B3A;margin:2px 0}
.ps__pick{all:unset;box-sizing:border-box;cursor:pointer;display:inline-flex;align-items:center;gap:7px;height:44px;padding:0 16px;border-radius:999px;background:#fff;box-shadow:inset 0 0 0 1.5px #C9D6EE;font:700 .95rem var(--sc-font-display);color:#0B1B3A;white-space:nowrap}
.ps__pick svg{width:16px;height:16px}
.ps.is-picked .ps__pick{background:#E9EEFF;box-shadow:inset 0 0 0 1.5px #5E7AEA;color:#3048B8}
.ps__go{width:100%;height:52px;font-size:1rem}
.pp-multi{margin-top:22px;display:flex;align-items:center;gap:12px;padding:16px 20px;border-radius:20px;background:linear-gradient(90deg,#E4FBF8,#EAF0FF);font-weight:600;color:#0B1B3A}
.pp-multi i{display:grid;place-items:center;width:40px;height:40px;border-radius:12px;background:#fff;color:var(--sc-accent);flex:none}
.pp-multi svg{width:20px;height:20px}
.pp-bar{position:fixed;z-index:39;inset:auto 0 0;display:flex;align-items:center;justify-content:center;gap:18px;padding:12px clamp(16px,4vw,48px) calc(12px + env(safe-area-inset-bottom));background:#031E4D;color:#fff;box-shadow:0 -14px 30px -18px #031e4dcc}
.pp-bar span{font-weight:600}
.pp-bar b{font:800 1.2rem var(--sc-font-display)}
.pp-bar .btn{height:46px;font-size:1rem}
body:has(.pp-bar){padding-bottom:72px}
.pp-value{background:var(--sc-canvas)}
.pp-vgrid{margin-top:clamp(30px,4vw,52px);display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:18px}
.pv{padding:24px 22px;border-radius:24px;background:#fff;box-shadow:0 2px 3px #0b1b3a0d,0 24px 44px -34px #0b1b3a8c;display:grid;gap:10px;align-content:start}
.pv i{display:grid;place-items:center;width:52px;height:52px;border-radius:16px;background:#EAF0FF;color:var(--sc-accent)}
.pv:nth-child(2) i{background:#E4FBF8;color:#0E8F86}.pv:nth-child(3) i{background:#F1ECFF;color:#6B4BD8}.pv:nth-child(4) i{background:#FFF3E2;color:#C26B00}
.pv svg{width:24px;height:24px}
.pv h3{font-size:1.25rem}
.pv p{color:var(--sc-ink-soft)}
.pp-honest{margin-top:22px;display:flex;align-items:center;gap:10px;font-size:.95rem;color:#4A5E7D}
.pp-honest svg{width:18px;height:18px;color:var(--ok);flex:none}
.pp-steps{background:#fff}
.pp-tl{list-style:none;margin:clamp(30px,4vw,52px) 0 0;padding:0;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:18px;counter-reset:s}
.pp-tl li{position:relative;padding:22px;border-radius:24px;background:#F7F9FD;display:grid;gap:8px;align-content:start}
.pp-tl b{display:grid;place-items:center;width:46px;height:46px;border-radius:15px;background:var(--brand);color:#fff;font:800 1.25rem var(--sc-font-display)}
.pp-tl h3{font-size:1.2rem;line-height:1.25}
.pp-tl p{color:var(--sc-ink-soft);font-size:1rem}
.pp-tl li:not(:last-child)::after{content:"";position:absolute;top:44px;left:-18px;width:18px;height:3px;background:linear-gradient(90deg,#5E7AEA,#1CE6D9)}
.pp-samples{background:var(--sc-canvas)}
.pp-sgrid{margin-top:clamp(30px,4vw,52px);display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:22px}
.sm{position:relative;border-radius:26px;background:#fff;overflow:hidden;box-shadow:0 2px 3px #0b1b3a0d,0 30px 50px -36px #0b1b3a8c;display:grid}
.sm .pic{height:170px;background:var(--g)}
.sm div{padding:18px 20px 22px;display:grid;gap:8px}
.sm small{font:700 .85rem var(--sc-font-display);color:#6B7F9E}
.sm h3{font-size:1.25rem;line-height:1.25}
.sm p{color:var(--sc-ink-soft);font-size:.98rem}
.sm .eg{position:absolute;top:14px;inset-inline-end:14px}
.sm .tag{justify-self:start;font-size:.78rem;color:#6B7F9E;padding:3px 9px;border-radius:999px;background:#F1F5FB}
@media (max-width:1060px){.pp-grid,.pp-sgrid{grid-template-columns:repeat(2,minmax(0,1fr))}.pp-vgrid,.pp-tl{grid-template-columns:repeat(2,minmax(0,1fr))}.pp-tl li::after{display:none}}
@media (max-width:760px){
 .pp-hero{padding-top:110px}
 .pp-hero__grid{grid-template-columns:1fr}
 .pp-stack{height:360px;max-width:420px;width:100%;justify-self:center;font-size:12.5px}
 .pp-grid,.pp-sgrid{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;gap:14px;margin-inline:calc(-1 * clamp(16px,5vw,64px));padding:4px clamp(16px,5vw,64px) 18px;scrollbar-width:none}
 .pp-grid::-webkit-scrollbar,.pp-sgrid::-webkit-scrollbar{display:none}
 .ps,.sm{flex:0 0 86%;scroll-snap-align:center}
 .pp-vgrid,.pp-tl{grid-template-columns:1fr}
 .pp-bar{display:grid;grid-template-columns:1fr auto;gap:8px 12px;padding-top:10px}.pp-bar span{font-size:.92rem;align-self:center}.pp-bar b{justify-self:end}.pp-bar .btn{grid-column:1/-1;width:100%;height:48px}
 body:has(.pp-bar) .fab{bottom:132px}
 body:has(.pp-bar){padding-bottom:120px}
}
</style>
`;

const bar=`<header class="bar">
  <a href="/" aria-label="מגה לינקס, לעמוד הבית"><img class="bar__logo" src="/brand/megalinks-logo.png" width="2048" height="449" alt="מגה לינקס"></a>
  <nav aria-label="ניווט בעמוד">
    <a href="#sites">האתרים</a><a href="#value">מה זה נותן</a><a href="#process">איך זה עובד</a><a href="#samples">דוגמאות</a><a href="#faq">שאלות</a>
  </nav>
  <div class="bar__acts"><a class="btn btn--login" href="/purchased" aria-label="כניסה למערכת"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg><span>כניסה למערכת</span></a><a class="btn btn--main" href="#sites">לאתרים</a></div>
</header>`;

const iv=ivSection
  .replace('<p class="kicker">כתיבת ראיון</p>','<p class="kicker">הראיון</p>')
  .replace(/<h2 id="iv-h">[\s\S]*?<\/h2>/,'<h2 id="iv-h">לא צריך לכתוב מילה. <br>מספיקה שיחה.</h2>');

const faq=[
 ['כמה זה עולה?','מחיר הפרסום באתר שבחרתם, ועוד 499 ₪ לראיון טלפוני וכתיבת הכתבה. המחיר כולל סבב תיקונים אחד. כל המחירים לפני מע״מ.'],
 ['אפשר להזמין כמה כתבות?','כן. ראיון אחד מספיק. המראיין מוציא ממנו את כל הכתבות שהזמנתם, עם כל הפרטים מהשיחה, וכל כתבה שונה ומיוחדת בפני עצמה. 499 ₪ לכל כתבה, ועוד מחיר הפרסום בכל אתר.'],
 ['מתי המראיין מתקשר?','בימים ובשעות שבחרתם בטופס.'],
 ['מה אם לא אהבתי את הכתבה?','סבב תיקונים אחד כלול במחיר. כותבים לנו מה לשנות, והמראיין מתקן לפני הפרסום.'],
 ['האם הכתבה מסומנת כתוכן שיווקי?','כן. כל אתר מסמן אותה לפי הכללים שלו, כפי שכתוב בתקנון.'],
 ['אפשר קישור לאתר שלי?','באתרים שמאפשרים קישור, הכתבה כוללת קישור לאתר שלכם. זה כתוב בכרטיס של כל אתר.'],
 ['כמה זמן הכתבה באוויר?','לפחות שנה מיום הפרסום.'],
 ['ומה אם האתר לא יפרסם בסוף?','נעדכן אתכם, ותבחרו בין זיכוי לבין אתר אחר שווה ערך.'],
];
const plusIcon='<i aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg></i>';
const faqHtml=faq.map(([q,a],i)=>`<div class="qa${i===0?' is-open':''}"><h3><button class="qa__q" type="button" aria-expanded="${i===0}" aria-controls="pq${i}">${q}${plusIcon}</button></h3><div class="qa__a" id="pq${i}"><div><p>${a}</p></div></div></div>`).join('\n      ');

const main=`<main id="main">
<section id="top" class="pp-hero" aria-labelledby="pp-h">
  <div class="wrap pp-hero__grid">
    <div data-sc-in data-sc-stagger="80">
      <p class="kicker">כתבות יח״צ</p>
      <h1 id="pp-h">כתבה על העסק שלכם <span>באתרי החדשות הגדולים</span> בישראל</h1>
      <p class="lede">המראיין שלנו מתקשר אליכם, אתם מספרים על העסק, ואנחנו כותבים את הכתבה ומפרסמים אותה.</p>
      <div class="cta-row"><a class="btn btn--navy btn--xl" href="#sites">${BTN}</a><a class="btn btn--login" href="#process" style="color:#031E4D;background:#fff;box-shadow:inset 0 0 0 1.5px #C9D6EE">איך זה עובד</a></div>
      <ul class="pp-names" aria-label="האתרים"><li><small>מתפרסמים ב:</small></li>${sites.map(s=>`<li dir="auto">${s.name}</li>`).join('')}</ul>
    </div>
    <div class="pp-stack" data-fx aria-hidden="true">
      <div class="pp-art pp-art--1"><small>ynet · כתבה<em class="eg">דוגמה</em></small><b>השף שהפך מטבח ביתי לשלושה סניפים</b><span class="l" style="width:100%"></span><span class="l" style="width:70%"></span></div>
      <div class="pp-art pp-art--2"><small>גלובס · כתבה<em class="eg">דוגמה</em></small><b>משרד האדריכלים הקטן שזוכה בפרויקטים של ערים</b><div class="pic"></div><span class="l" style="width:90%"></span></div>
      <div class="pp-art pp-art--3"><small>mako · ראיון<em class="eg">דוגמה</em></small><b>המרפאה שמחזירה לתושבי העיר את החיוך</b><span class="l" style="width:100%"></span><span class="l" style="width:60%"></span></div>
      <div class="pp-call"><i>${I.phone}</i>המראיין שלנו · בשיחת טלפון</div>
    </div>
  </div>
</section>

<section id="sites" class="pp-sites sec sheet" aria-labelledby="sites-h">
  <div class="wrap">
    <div class="pp-head" data-sc-in data-sc-stagger="70">
      <div><p class="kicker">האתרים</p><h2 id="sites-h" class="h2" style="margin-top:12px">איפה הכתבה שלכם תתפרסם</h2></div>
      <p class="lede">בחרו אתר אחד או כמה. לכל אתר המראיין כותב כתבה שונה, מאותה שיחה.</p>
    </div>
    <div class="pp-grid">
      ${sites.map(siteCard).join('\n      ')}
    </div>
    <p class="pp-multi"><i>${I.phone}</i>בחרתם כמה אתרים? מספיק ראיון אחד. המראיין יכתוב לכל אתר כתבה שונה ומיוחדת.</p>
  </div>
</section>

<section id="value" class="pp-value sec sheet" aria-labelledby="value-h">
  <div class="wrap">
    <div data-sc-in data-sc-stagger="70"><p class="kicker">מה זה נותן</p><h2 id="value-h" class="h2" style="margin-top:12px">מה כתבת יח״צ עושה לעסק</h2></div>
    <div class="pp-vgrid" data-sc-in data-sc-stagger="90">
      <div class="pv"><i>${I.shield}</i><h3>אמינות</h3><p>לקוח שמחפש אתכם בגוגל מוצא כתבה עליכם באתר שהוא מכיר וסומך עליו.</p></div>
      <div class="pv"><i>${I.eye}</i><h3>חשיפה</h3><p>הקוראים של האתר פוגשים את העסק שלכם בתוך כתבה, לא בפרסומת קופצת.</p></div>
      <div class="pv"><i>${I.link}</i><h3>קישור מאתר חזק</h3><p>באתרים שמאפשרים, הכתבה מקשרת לאתר שלכם ומחזקת אותו בגוגל.</p></div>
      <div class="pv"><i>${I.share}</i><h3>תוכן שנשאר שלכם</h3><p>משתפים את הכתבה ברשתות, בניוזלטר ובאתר: "כפי שפורסם ב-".</p></div>
    </div>
    <p class="pp-honest">${I.check}הכתבה מסומנת כתוכן שיווקי, לפי הכללים של כל אתר.</p>
  </div>
</section>

<section id="process" class="pp-steps sec sheet" aria-labelledby="process-h">
  <div class="wrap">
    <div data-sc-in data-sc-stagger="70"><p class="kicker">איך זה עובד</p><h2 id="process-h" class="h2" style="margin-top:12px">ארבעה שלבים, ואתם רק מדברים</h2></div>
    <ol class="pp-tl" data-sc-in data-sc-stagger="110">
      <li><b>1</b><h3>בוחרים אתרים ומשאירים פרטים</h3><p>שם העסק, טלפון, קישור, וימים ושעות שנוח לכם לדבר.</p></li>
      <li><b>2</b><h3>משלמים</h3><p>ברכישה הרגילה במערכת: אשראי, העברה בנקאית או יתרה.</p></li>
      <li><b>3</b><h3>המראיין מתקשר</h3><p>בימים ובשעות שבחרתם. לא יודעים מה לומר? הוא מוביל את השיחה.</p></li>
      <li><b>4</b><h3>מאשרים ומתפרסמים</h3><p>מקבלים את הכתבה לאישור, עם סבב תיקונים אחד, והיא עולה לאתר.</p></li>
    </ol>
  </div>
</section>

${iv}

<section id="samples" class="pp-samples sec sheet" aria-labelledby="samples-h">
  <div class="wrap">
    <div class="pp-head" data-sc-in data-sc-stagger="70"><div><p class="kicker">דוגמאות</p><h2 id="samples-h" class="h2" style="margin-top:12px">ככה נראית כתבה כזו</h2></div><p class="lede">שלוש דוגמאות לכתבות שיוצאות מראיון אחד, כל אחת בזווית אחרת.</p></div>
    <div class="pp-sgrid">
      <article class="sm"><em class="eg">דוגמה</em><span class="pic" style="--g:linear-gradient(135deg,#CFF6F1,#DCE3FF)"></span><div><small>mako · בריאות</small><h3>המרפאה שמחזירה לתושבי העיר את החיוך</h3><p>ראיון עם ד״ר לוי על השתלות, על חידושים, ועל מה שחשוב לבדוק לפני שבוחרים רופא.</p><span class="tag">זווית: הסיפור האישי</span></div></article>
      <article class="sm"><em class="eg">דוגמה</em><span class="pic" style="--g:linear-gradient(135deg,#E3E8FF,#F3E8FF)"></span><div><small>ynet · צרכנות</small><h3>חמש שאלות לשאול לפני השתלת שיניים</h3><p>ד״ר לוי מסביר מה לבדוק בבדיקה הראשונה, וכמה זמן לוקח כל שלב.</p><span class="tag">זווית: מדריך לקורא</span></div></article>
      <article class="sm"><em class="eg">דוגמה</em><span class="pic" style="--g:linear-gradient(135deg,#FFF1DE,#E4FBF8)"></span><div><small>גלובס · עסקים</small><h3>איך מרפאה עירונית הכפילה את מספר המטופלים</h3><p>מאחורי הקלעים של עסק משפחתי שהשקיע בטכנולוגיה ובשירות אישי.</p><span class="tag">זווית: העסק והצמיחה</span></div></article>
    </div>
  </div>
</section>

<section id="faq" class="faq sec sheet" aria-labelledby="faq-h">
  <div class="wrap faq__col">
    <h2 id="faq-h" class="h2" data-sc-in>שאלות ותשובות</h2>
    <div class="faq__list">
      ${faqHtml}
    </div>
    <div class="faq__more" data-sc-in><div><b>יש עוד שאלה?</b><span>דברו איתנו, נשמח לעזור.</span></div><a class="btn btn--wa" href="https://wa.me/972507508850">${I.wa}דברו איתנו בווצאפ</a></div>
  </div>
</section>

<section id="close" class="close dark" data-sc-act="flow" aria-labelledby="close-h">
  <div class="close__stage">
    <div class="close__bg" aria-hidden="true"></div>
    <div class="close__inner" data-sc-in data-sc-stagger="110">
      <div>
        <span class="close__k">מוכנים לכתבה הראשונה?</span>
        <h2 id="close-h">אתם מספרים.<br><span>אנחנו כותבים ומפרסמים.</span></h2>
        <p class="close__lede">499 ₪ לראיון וכתיבה, ועוד מחיר הפרסום באתר שבחרתם.</p>
        <div class="close__ctas"><a class="btn btn--white btn--xl" href="#sites">${BTN}</a><a class="btn btn--wa btn--xl" href="https://wa.me/972507508850">${I.wa}יש שאלה? דברו איתנו</a></div>
      </div>
    </div>
  </div>
</section>
</main>
<div class="pp-bar" role="region" aria-label="הבחירה שלכם"><span>נבחר 1 אתר · mako</span><b><bdi dir="ltr">₪4,499</bdi></b><a class="btn btn--white" href="start.html?site=mako">${BTN}</a></div>
`;

const page=`${head}${css}</head>
<body>
<a class="skip" href="#main">דילוג לתוכן</a>
${bar}
${main}
${footer}
${tail}`;
writeFileSync(resolve(here,'pr.html'),page);

// Step 2: the interview form, then the normal purchase in the system.
const days=['א׳','ב׳','ג׳','ד׳','ה׳','ו׳'],hours=['בוקר 9-12','צהריים 12-15','אחה״צ 15-18','ערב 18-20'];
const startCss=`<style id="pr-start">
.st{min-height:100vh;padding:clamp(100px,11vw,130px) 0 80px;background:radial-gradient(900px 500px at 90% 0%,#DDF7F4 0%,transparent 60%),var(--sc-canvas)}
.st__grid{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(0,.75fr);gap:clamp(20px,3vw,40px);align-items:start}
.st h1{font-size:clamp(1.9rem,1.3rem + 1.8vw,2.9rem);line-height:1.08}
.st .lede{margin-top:8px}
.st__steps{display:flex;gap:8px;margin:0 0 18px;padding:0;list-style:none;font:700 .85rem var(--sc-font-display);color:#6B7F9E}
.st__steps li{display:flex;align-items:center;gap:6px}.st__steps li b{display:grid;place-items:center;width:24px;height:24px;border-radius:50%;background:#E3EAF4;color:#4A5E7D;font-size:.8rem}
.st__steps li.on{color:#0B1B3A}.st__steps li.on b{background:var(--sc-accent);color:#fff}.st__steps li.done b{background:#16A34A;color:#fff}
.st__steps li+li::before{content:"";width:22px;height:2px;background:#D5DFEC;margin-inline-end:4px}
.card{background:#fff;border-radius:28px;padding:clamp(20px,3vw,32px);box-shadow:0 2px 3px #0b1b3a0d,0 30px 50px -36px #0b1b3a8c}
.f{display:grid;grid-template-columns:1fr 1fr;gap:16px 18px;margin-top:22px}
.f label,.f fieldset{display:grid;gap:7px;font:700 .95rem var(--sc-font-display);color:#0B1B3A;border:0;margin:0;padding:0;min-width:0}
.grp{display:grid;gap:9px}.grp__l{font:700 .95rem var(--sc-font-display);color:#0B1B3A}
.f .full{grid-column:1/-1}
.f input,.f textarea{all:unset;box-sizing:border-box;width:100%;min-height:52px;padding:12px 16px;border-radius:14px;background:#F5F8FC;box-shadow:inset 0 0 0 1.5px #DCE5F2;font:500 1.02rem var(--sc-font-text);color:#0B1B3A}
.f textarea{min-height:84px}
.f input:focus,.f textarea:focus{box-shadow:inset 0 0 0 2px var(--sc-accent);background:#fff}
.f small{font:500 .82rem var(--sc-font-text);color:#6B7F9E}
.f .req{color:#C2410C}
.chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:0}
.chips button{all:unset;box-sizing:border-box;cursor:pointer;min-height:44px;min-width:52px;padding:0 16px;display:inline-flex;align-items:center;justify-content:center;border-radius:12px;background:#F5F8FC;box-shadow:inset 0 0 0 1.5px #DCE5F2;font:700 .95rem var(--sc-font-display);color:#0B1B3A}
.chips button[aria-pressed=true]{background:#E9EEFF;box-shadow:inset 0 0 0 2px #5E7AEA;color:#3048B8}
.st__go{margin-top:24px;display:grid;gap:10px}
.st__go .btn{width:100%}
.st__go p{font-size:.85rem;color:#6B7F9E;text-align:center}
.st__go p a{color:var(--sc-accent)}
.sum{position:sticky;top:96px;display:grid;gap:14px}
.sum h2{font-size:1.25rem}
.sum__row{display:flex;align-items:center;gap:12px;padding:12px;border-radius:16px;background:#F7F9FD}
.sum__row .ps__logo{width:42px;height:42px;font-size:1.15rem;border-radius:12px}
.sum__row div{display:grid;line-height:1.3}.sum__row div small{color:#6B7F9E;font-size:.82rem}
.sum__row bdi{margin-inline-start:auto;font:700 1rem var(--sc-font-display)}
.sum__add{all:unset;cursor:pointer;display:inline-flex;align-items:center;gap:8px;font:700 .95rem var(--sc-font-display);color:var(--sc-accent)}
.sum__add svg{width:16px;height:16px}
.sum dl{margin:0;display:grid;gap:8px;padding-top:12px;border-top:1px solid #E3EAF4}
.sum dl div{display:flex;justify-content:space-between;color:#4A5E7D}
.sum dl div:last-child{color:#0B1B3A;font:800 1.15rem var(--sc-font-display)}
.sum dd{margin:0}
.sum__note{display:flex;gap:10px;font-size:.9rem;color:#0B1B3A;padding:12px;border-radius:14px;background:linear-gradient(90deg,#E4FBF8,#EAF0FF)}
.sum__note svg{width:18px;height:18px;color:var(--sc-accent);flex:none;margin-top:2px}
@media (max-width:860px){.st__grid{grid-template-columns:1fr}.sum{position:static;order:-1}.f{grid-template-columns:1fr}}
</style>
`;
const picked=[sites[1],sites[0]];
const start=`${head}${startCss}${css}</head>
<body>
<a class="skip" href="#main">דילוג לתוכן</a>
${bar.replace('<a class="btn btn--main" href="#sites">לאתרים</a>','')}
<main id="main" class="st">
  <div class="wrap">
    <ol class="st__steps" aria-label="שלבים"><li class="done"><b>✓</b>אתרים</li><li class="on"><b>2</b>פרטים לראיון</li><li><b>3</b>תשלום</li></ol>
    <div class="st__grid">
      <form class="card" onsubmit="return false" aria-labelledby="st-h">
        <h1 id="st-h">פרטים לראיון</h1>
        <p class="lede">כדי שהמראיין יוכל להתקשר אליכם בזמן שנוח לכם.</p>
        <div class="f">
          <label><span>שם העסק <span class="req" aria-hidden="true">*</span></span><input value="מרפאת השיניים של ד״ר לוי" autocomplete="organization"></label>
          <label><span>שם איש הקשר <span class="req" aria-hidden="true">*</span></span><input value="ד״ר דנה לוי" autocomplete="name"></label>
          <label><span>טלפון <span class="req" aria-hidden="true">*</span></span><input dir="ltr" value="050-1234567" inputmode="tel" autocomplete="tel"><small>המראיין יתקשר למספר הזה</small></label>
          <label><span>קישור לאתר או לדף העסק <span class="req" aria-hidden="true">*</span></span><input dir="ltr" value="https://dr-levi.example" inputmode="url"><small>גם הקישור בכתבה, באתרים שמאפשרים</small></label>
          <div class="full grp" role="group" aria-labelledby="g-days"><span class="grp__l" id="g-days">ימים נוחים לשיחה <span class="req" aria-hidden="true">*</span></span><div class="chips">${days.map((d,i)=>`<button type="button" aria-pressed="${[0,2,3].includes(i)}">${d}</button>`).join('')}</div></div>
          <div class="full grp" role="group" aria-labelledby="g-hours"><span class="grp__l" id="g-hours">שעות נוחות <span class="req" aria-hidden="true">*</span></span><div class="chips">${hours.map((h,i)=>`<button type="button" aria-pressed="${i===0}">${h}</button>`).join('')}</div></div>
          <label class="full"><span>על מה חשוב לכם לדבר? <small style="display:inline">(רשות)</small></span><textarea>השתלות שיניים בשיטה החדשה, והליווי האישי מהבדיקה הראשונה.</textarea></label>
        </div>
        <div class="st__go">
          <a class="btn btn--navy btn--xl" href="#">המשך לרכישה</a>
          <p>נשתמש בפרטים כדי לתאם את הראיון ולכתוב את הכתבה. <a href="/privacy">מדיניות הפרטיות</a></p>
        </div>
      </form>
      <aside class="card sum" aria-labelledby="sum-h">
        <h2 id="sum-h">ההזמנה שלכם</h2>
        ${picked.map(s=>`<div class="sum__row"><span class="ps__logo" style="--h:${s.hue}" aria-hidden="true">${s.letter}</span><div><b dir="auto">${s.name}</b><small>כתבת יח״צ עם ראיון</small></div><bdi dir="ltr">₪${s.price}</bdi></div>`).join('')}
        <button class="sum__add" type="button">${I.plus}הוספת אתר</button>
        <p class="sum__note">${I.phone}<span>ראיון אחד, שתי כתבות שונות. המראיין יכתוב לכל אתר כתבה בזווית אחרת.</span></p>
        <dl><div><dt>פרסום ב-2 אתרים</dt><dd><bdi dir="ltr">₪8,500</bdi></dd></div><div><dt>ראיון וכתיבה · 2 כתבות</dt><dd><bdi dir="ltr">₪998</bdi></dd></div><div><dt>סה״כ לפני מע״מ</dt><dd><bdi dir="ltr">₪9,498</bdi></dd></div></dl>
      </aside>
    </div>
  </div>
</main>
${tail}`;
writeFileSync(resolve(here,'start.html'),start);
console.log('mockup written: pr.html, start.html');
