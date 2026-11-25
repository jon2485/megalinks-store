// The sign-in and terms screens for Google sign-in, served by the gateway. Built from the design the owner approved on
// 25.11.2026: design/login-screen/mockup-system2.html (?s=login, ?s=terms). White split screen: sign-in at right, and at
// left a short line for site promoters and site owners with the logos of four large sites (no prices: they change).
// The newsletter line is MARKETING_WORDING (lib/marketing-wording.ts) and the terms line is TERMS_WORDING
// (lib/google-account.ts): the wording saved with the consent must be the wording shown (tests check both match).
export const MARKETING_WORDING='אני רוצה לקבל במייל עדכונים ומבצעים ממגה לינקס';
export const TERMS_LINE=['קראתי ואני מאשר/ת את ','תנאי השימוש',' ואת ','מדיניות הפרטיות'];
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const PAGE_CSP="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src 'self'; font-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'";
const BOX='<span class="box"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 5 5 9-10"/></svg></span>';
const GOOGLE='<svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>';
const STYLE=`@font-face{font-family:Heebo;src:url("/brand/heebo-variable.ttf");font-weight:100 900;font-display:swap}
@font-face{font-family:Rubik;src:url("/brand/rubik-bold.woff");font-weight:700;font-display:swap}
:root{--navy:#071f4b;--ink:#172b3a;--muted:#4f5f6e;--faint:#66727f;--link:#1460c4;--line:#dce6ee;--ok:#1d7d45;color-scheme:light}
*{box-sizing:border-box}html,body{margin:0}[hidden]{display:none!important}
body{font-family:Heebo,Arial,sans-serif;color:var(--ink);background:#fff;-webkit-font-smoothing:antialiased}
a:focus-visible,.btn:focus-visible,.check input:focus-visible+.box{outline:3px solid #7fb4f5;outline-offset:3px}
.split{min-height:100vh;min-height:100svh;display:grid;grid-template-columns:minmax(400px,5fr) 7fr}
.pane{display:flex;flex-direction:column;padding:28px clamp(24px,4.2vw,64px) 24px;background:#fff}
.top{display:flex;align-items:center;justify-content:space-between;gap:12px}
.top img{height:36px;width:auto;display:block}
.home{display:inline-flex;align-items:center;min-height:44px;font-size:15px;font-weight:600;color:var(--navy);text-underline-offset:4px}
.body{flex:1;display:flex;flex-direction:column;justify-content:center;width:100%;max-width:410px;padding:32px 0}
h1{margin:0;font-family:Rubik,Heebo,sans-serif;font-weight:700;font-size:clamp(30px,2.7vw,38px);line-height:1.18;letter-spacing:-.01em;color:var(--navy);text-wrap:balance}
.sub{margin:14px 0 0;font-size:17px;line-height:1.65;color:var(--muted)}
.error{margin:18px 0 0;padding:11px 14px;border-radius:10px;background:#fdecec;color:#a02020;font-size:14.5px;line-height:1.5}
.btn{display:flex;align-items:center;justify-content:center;gap:12px;width:100%;min-height:56px;margin-top:28px;padding:0 18px;border:0;border-radius:14px;font:inherit;font-size:17px;font-weight:700;cursor:pointer;text-decoration:none;transition:transform .12s,background-color .2s}
.btn:active{transform:scale(.985)}
.google{background:var(--navy);color:#fff;box-shadow:0 14px 26px -18px #071f4b}.google:hover{background:#0b2b63}
.google .g{display:grid;place-items:center;width:32px;height:32px;border-radius:50%;background:#fff;flex:none}
.free{margin:12px 0 0;font-size:15px;font-weight:700;color:var(--ok);text-align:center}
.safe{margin:22px 0 0;padding-top:18px;border-top:1px solid var(--line);font-size:13.5px;line-height:1.55;color:var(--faint)}
.peek{display:inline-flex;align-items:center;min-height:44px;margin-top:4px;font-size:15px;font-weight:700;color:var(--link);text-underline-offset:4px;align-self:flex-start}
.foot{display:flex;flex-wrap:wrap;justify-content:space-between;gap:8px 18px;font-size:13.5px;color:var(--faint)}
.foot nav{display:flex;gap:14px;flex-wrap:wrap}.foot a{color:#33445a;text-underline-offset:3px}.foot .wa{color:#0f7a55;font-weight:700}
.test{width:100%;margin:0;font-size:13px}.test a{color:var(--faint)}
.who{display:flex;align-items:center;gap:12px;margin-top:24px;padding:12px 0;border-block:1px solid var(--line)}
.av{flex:none;display:grid;place-items:center;width:42px;height:42px;border-radius:50%;background:#eaf4fb;color:var(--navy);font-family:Rubik,Heebo,sans-serif;font-size:18px}
.who .t{flex:1;min-width:0}.who b{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.who small{display:block;font-size:14px;color:var(--muted);direction:ltr;text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.who a{flex:none;font-size:14px;font-weight:700;color:var(--link);text-underline-offset:3px}
.checks{display:grid;gap:10px;margin-top:18px}
.check{position:relative;display:flex;gap:12px;align-items:flex-start;padding:14px;border-radius:12px;box-shadow:inset 0 0 0 1px var(--line);cursor:pointer}
.check.on{background:#f3f8fd;box-shadow:inset 0 0 0 2px var(--link)}
.check input{position:absolute;opacity:0;width:24px;height:24px;margin:0}
.box{flex:none;display:grid;place-items:center;width:24px;height:24px;border-radius:7px;box-shadow:inset 0 0 0 2px #a9b8c8;color:#fff;background:#fff}
.check.on .box{background:var(--link);box-shadow:none}
.tx{flex:1;font-size:15.5px;line-height:1.55;font-weight:600}.tx a{color:var(--link);text-underline-offset:3px}
.tx small{display:block;margin-top:2px;font-size:13.5px;font-weight:500;color:var(--muted)}
.need{flex:none;align-self:center;font-size:12.5px;font-weight:700;color:#a8510a}.need.opt{color:var(--faint);font-weight:600}
.go{background:var(--navy);color:#fff;margin-top:20px}.go[disabled]{background:#e3e9ef;color:#6b7886;cursor:not-allowed}
.hint{margin:10px 0 0;text-align:center;font-size:14px;color:#a8510a}.hint.ok{color:var(--ok)}
.note{margin:12px 0 0;text-align:center;font-size:13px;line-height:1.5;color:var(--faint)}
.art{position:relative;overflow:hidden;display:flex;flex-direction:column;justify-content:center;gap:clamp(28px,5vh,52px);padding:clamp(36px,6vh,64px) clamp(32px,4.5vw,72px);background:#fff;color:var(--ink);border-inline-start:1px solid var(--line)}
.art:before{content:"";position:absolute;inset:0;background:radial-gradient(520px 380px at 30% 62%,#d9f3f7 0,transparent 70%),radial-gradient(460px 340px at 78% 70%,#e3ecff 0,transparent 70%),radial-gradient(360px 260px at 55% 96%,#ffeeda 0,transparent 70%);pointer-events:none}
.art:after{content:"";position:absolute;inset:0;background-image:radial-gradient(#0b285014 1.2px,transparent 1.3px);background-size:22px 22px;mask-image:radial-gradient(60% 55% at 50% 66%,#000 0,transparent 100%);-webkit-mask-image:radial-gradient(60% 55% at 50% 66%,#000 0,transparent 100%);pointer-events:none}
.art>*{position:relative;z-index:1}
.say{max-width:600px}
.say h2{margin:0;color:var(--navy);font-family:Rubik,Heebo,sans-serif;font-weight:700;font-size:clamp(26px,2.5vw,36px);line-height:1.25;text-wrap:balance}
.say p{margin:12px 0 0;font-size:17px;line-height:1.6;color:var(--muted);max-width:48ch}.say p b{color:var(--navy)}.say h2+p{margin-top:16px}
.stage{position:relative;width:100%;max-width:700px;padding:0 0 78px}
.back{position:absolute;inset:-34px 7% auto 7%;display:grid;grid-template-columns:repeat(3,1fr);gap:14px;z-index:-1}
.back i{height:150px;border-radius:18px;background:linear-gradient(180deg,#ffffffd9,#ffffff73);box-shadow:0 0 0 1px #dce6eeb3,0 18px 30px -22px #0b285040;filter:blur(1.2px)}
.back i:nth-child(2){transform:translateY(-16px)}
.row{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
.site{background:#fff;color:var(--ink);border-radius:18px;padding:14px;box-shadow:0 0 0 1px var(--line),0 2px 4px #0b28500a,0 18px 28px -18px #0b285038,0 44px 60px -40px #0b285066;animation:rise .7s cubic-bezier(.2,.7,.2,1) both}
.site:nth-child(2){animation-delay:.07s}.site:nth-child(3){animation-delay:.14s}.site:nth-child(4){animation-delay:.21s}.site:nth-child(even){transform:translateY(-14px)}
.lg{display:flex;align-items:center;justify-content:flex-start;height:46px}.lg img{max-width:100%;max-height:100%;width:auto;height:auto;object-fit:contain}
.site b{display:block;margin-top:12px;font-size:16px;line-height:1.3}
.chip{display:inline-block;margin-top:8px;padding:3px 10px;border-radius:999px;background:#eaf2ff;color:#1460c4;font-size:12.5px;font-weight:700}
.meter{display:flex;align-items:center;gap:8px;margin-top:14px;font-size:12px;font-weight:700;color:#6b7886}
.meter i{flex:1;height:6px;border-radius:3px;background:#e6edf3;position:relative;overflow:hidden}
.meter i:after{content:"";position:absolute;inset:0 0 0 auto;width:var(--v);border-radius:3px;background:#19b8c7}
.add{display:flex;align-items:center;justify-content:center;gap:6px;height:38px;margin-top:14px;border-radius:11px;background:linear-gradient(180deg,#ff9a3d,#f47a20);color:#3a1c00;font-size:14px;font-weight:800}
.pool{display:none}
.float{position:absolute;display:flex;align-items:center;gap:12px;padding:12px 16px;border-radius:16px;background:#fff;color:var(--ink);box-shadow:0 0 0 1px var(--line),0 10px 18px -10px #0b285040,0 30px 50px -26px #0b285073;font-size:14px;line-height:1.4;animation:rise .7s .35s cubic-bezier(.2,.7,.2,1) both}
.float b{display:block;font-size:15px}.float span{color:#5b6b7b}
.float .dot{flex:none;display:grid;place-items:center;width:36px;height:36px;border-radius:50%;background:#e4f6ec;color:#1d7d45}
.float.cart .dot{background:#fff1e3;color:#c25a0a}
.float.live{bottom:0;inset-inline-start:6%}.float.cart{bottom:0;inset-inline-end:4%}
@keyframes rise{from{opacity:0;translate:0 22px}}
@media(prefers-reduced-motion:reduce){.site,.float{animation:none}*{transition:none!important}}
@media(max-width:900px){
 .split{grid-template-columns:1fr;grid-template-rows:auto 1fr}
 .art{order:-1;padding:22px 18px 18px;gap:16px;justify-content:flex-start;border:0}
 .art:after{mask-image:none;-webkit-mask-image:none;opacity:.6}
 .say h2{font-size:27px;line-height:1.2}.say p{display:none}
 .stage{max-width:none;padding:0}.back,.float{display:none}
 .row{grid-template-columns:1fr 1fr;gap:10px}
 .site{padding:10px 14px;border-radius:14px;box-shadow:0 0 0 1px var(--line),0 14px 22px -16px #0b285059}.site:nth-child(even){transform:none}
 .site b,.site .chip,.site .meter,.site .add{display:none}
 .lg{height:40px;justify-content:center}
 .pool{display:block;margin:14px 0 0;text-align:center;font-size:16px;line-height:1.5;color:var(--muted)}.pool b{color:var(--navy)}
 .pane{padding:16px 18px calc(18px + env(safe-area-inset-bottom))}
 .top img{height:30px}
 .body{max-width:none;padding:18px 0 22px;justify-content:flex-start}
 h1{font-size:27px}.sub{font-size:16px}.btn{margin-top:22px}
 .foot{justify-content:center;text-align:center}.foot nav{justify-content:center}
}`;
const POOL='<b>מאגר עצום של 2,500+ אתרים</b>, בכל תחום ובמחירים הטובים ביותר.';
const SITES=[['ynet','ווינט','חדשות',96],['israelhayom','ישראל היום','חדשות',90],['calcalist','כלכליסט','כלכלה',88],['maariv','מעריב','חדשות',84]];
// Decorative only (aria-hidden): what the system offers, with real site logos and no prices.
const ART=`<aside class="art" aria-hidden="true">
 <div class="say"><h2>כתבות וקישורים באתרים הגדולים בישראל</h2>
  <p>מערכת הזמנות <b>למקדמי אתרים ולבעלי אתרים</b>. בוחרים אתר, מזמינים פרסום ועוקבים עד שהוא באוויר.</p>
  <p>${POOL}</p></div>
 <div class="stage"><div class="back"><i></i><i></i><i></i></div>
  <div class="row">${SITES.map(([f,n,c,v])=>`<div class="site"><span class="lg"><img src="/brand/login-logo-${f}.png" alt=""></span><b>${n}</b><span class="chip">${c}</span><div class="meter">חוזק<i style="--v:${v}%"></i></div><div class="add">+ הוספה לסל</div></div>`).join('')}</div>
  <p class="pool">${POOL}</p>
  <div class="float live"><span class="dot"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5 9-10"/></svg></span><div><b>הכתבה שלך באוויר</b><span>הוזמן · נכתב · פורסם</span></div></div>
  <div class="float cart"><span class="dot"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg></span><div><b>נוסף לסל הפרסום</b><span>ממשיכים להזמנה</span></div></div>
 </div>
</aside>`;
const shell=(title,body,{extra='',script=''}={})=>`<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title} | Mega Links</title><style>${STYLE}</style></head><body><div class="split"><main class="pane">
 <div class="top"><img src="/brand/megalinks-logo-dark.png" alt="Mega Links" width="144" height="36"><a class="home" href="/">לדף הבית</a></div>
 ${body}
 <div class="foot"><span>לא מצליחים להיכנס? <a class="wa" href="https://wa.me/972507508850" target="_blank" rel="noopener">כתבו לנו בוואטסאפ</a></span><nav aria-label="מסמכים"><a href="/terms" target="_blank" rel="noopener">תנאי שימוש</a><a href="/privacy" target="_blank" rel="noopener">מדיניות פרטיות</a><a href="/accessibility" target="_blank" rel="noopener">הצהרת נגישות</a></nav>${extra}</div>
</main>${ART}</div>${script}</body></html>`;

export function googleLoginPage({startHref,error='',passwordHref=''}){
 return shell('כניסה לחשבון',`<section class="body">
 <h1>כניסה למגה לינקס</h1>
 <p class="sub">נכנסים בלחיצה אחת עם חשבון <bdi>Google</bdi>. אם עוד אין לכם חשבון, הוא ייפתח בכניסה הראשונה.</p>
 ${error?`<p class="error" role="alert">${escape(error)}</p>`:''}
 <a class="btn google" href="${escape(startHref)}"><span class="g">${GOOGLE}</span><span>כניסה עם <bdi>Google</bdi></span></a>
 <p class="free">ההרשמה בחינם. יאללה, תרשמו אותי!</p>
 <p class="safe">אנחנו מקבלים מ־<bdi>Google</bdi> רק את השם ואת כתובת המייל. את הסיסמה שלכם אנחנו לא רואים.</p>
 <a class="peek" href="/catalog">לצפייה במחירון בלי להירשם</a>
</section>`,{extra:passwordHref?`<p class="test"><a href="${escape(passwordHref)}">כניסה לחשבון בדיקה עם סיסמה</a></p>`:''});
}

export function termsPage({name,email,switchHref,error=''}){
 const initial=(String(name||email).trim()[0]||'?').toUpperCase();
 return shell('נשאר רק לאשר את התנאים',`<section class="body">
 <h1>נשאר רק לאשר את התנאים</h1>
 <p class="sub">מאשרים פעם אחת, בפתיחת החשבון.</p>
 <div class="who"><span class="av" aria-hidden="true">${escape(initial)}</span><span class="t"><b>${escape(name||email)}</b><small>${escape(email)}</small></span><a href="${escape(switchHref)}">החלפת חשבון</a></div>
 ${error?`<p class="error" role="alert">${escape(error)}</p>`:''}
 <form method="post" action="/__staging/google/terms" id="f" novalidate>
 <div class="checks">
  <label class="check" id="c1"><input type="checkbox" name="accepted" value="1" id="i1" aria-describedby="hint">${BOX}<span class="tx">${TERMS_LINE[0]}<a href="/terms" target="_blank" rel="noopener">${TERMS_LINE[1]}</a>${TERMS_LINE[2]}<a href="/privacy" target="_blank" rel="noopener">${TERMS_LINE[3]}</a></span><span class="need">חובה</span></label>
  <label class="check" id="c2"><input type="checkbox" name="marketing" value="1" id="i2">${BOX}<span class="tx">${MARKETING_WORDING}<small>אפשר לבטל בכל רגע בהגדרות החשבון.</small></span><span class="need opt">לא חובה</span></label>
 </div>
 <button class="btn go" id="go" type="submit">פתיחת החשבון</button>
 <p class="hint" id="hint" aria-live="polite">כדי להמשיך יש לסמן את אישור תנאי השימוש</p>
 </form>
 <p class="note">אחרי האישור תחזרו בדיוק למקום שבו הייתם. נשמור את מועד האישור ואת גרסת התנאים.</p>
</section>`,{script:`<script>const i1=document.getElementById('i1'),i2=document.getElementById('i2'),go=document.getElementById('go'),hint=document.getElementById('hint'),f=document.getElementById('f');
function sync(){document.getElementById('c1').classList.toggle('on',i1.checked);document.getElementById('c2').classList.toggle('on',i2.checked);go.disabled=!i1.checked;hint.textContent=i1.checked?'הכול מוכן':'כדי להמשיך יש לסמן את אישור תנאי השימוש';hint.classList.toggle('ok',i1.checked);}
i1.onchange=i2.onchange=sync;sync();f.onsubmit=e=>{if(!i1.checked){e.preventDefault();return;}go.disabled=true;go.textContent='פותחים את החשבון…';};</script>`});
}
