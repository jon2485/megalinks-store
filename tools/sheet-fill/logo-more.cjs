// Second pass for rows without a good logo or without readable content (cloud, 20.11.2026).
// node logo-more.cjs <list.tsv: row<TAB>url> <outdir>
// For each site it saves up to three logo candidates (A: logo named in the site's own data, JSON-LD/og:logo;
// B: the widest logo image or SVG at the top of the page; C: the home link/logo box as it is drawn, text included)
// plus the page meta, so a person (or a review pass) picks the right one. A site that shows a security check page is
// left alone and reported as blocked: it is opened later in a regular browser on the owner's computer.
const fs=require('fs'),path=require('path');const {chromium}=require('playwright');
const [list,out]=process.argv.slice(2);fs.mkdirSync(out,{recursive:true});
const items=fs.readFileSync(list,'utf8').split('\n').filter(Boolean).map(l=>l.split('\t'));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const CHALLENGE=/רק רגע|just a moment|attention required|checking your browser|one moment|access denied|cloudflare/i;
const META=`(()=>{const c=x=>(x||'').replace(/\\s+/g,' ').trim();const m=n=>(document.querySelector('meta[name="'+n+'"],meta[property="'+n+'"]')||{}).content||'';
 return [document.title,m('description')||m('og:description'),[...document.querySelectorAll('h1,h2,h3')].slice(0,8).map(x=>x.innerText).join(' / '),[...new Set([...document.querySelectorAll('nav a,header a,[class*=menu] a')].map(x=>c(x.innerText)).filter(t=>t&&t.length<30))].slice(0,30).join(' · ')].map(x=>c(x).slice(0,400))})()`;
const LD=`(()=>{const urls=[];const push=u=>{if(u&&typeof u==='string')urls.push(new URL(u,location.href).href)};
 for(const s of document.querySelectorAll('script[type="application/ld+json"]')){try{const walk=o=>{if(!o||typeof o!=='object')return;if(Array.isArray(o)){o.forEach(walk);return;}
  if(o.logo){const l=o.logo;push(typeof l==='string'?l:(l.url||l.contentUrl||l['@id']&&!String(l['@id']).includes('#')&&l['@id']));}for(const k of Object.keys(o))if(typeof o[k]==='object')walk(o[k]);};walk(JSON.parse(s.textContent));}catch{}}
 const og=document.querySelector('meta[property="og:logo"],link[rel="logo"]');if(og)push(og.content||og.href);return [...new Set(urls)].filter(u=>!/favicon|\\.ico($|\\?)|apple-touch|site-icon|cropped-.*-(32|180|192|270)x/i.test(u)).slice(0,2)})()`;
// B and C mark their element with data-logo-pick so Playwright can screenshot it.
const PICK=`(()=>{const bad=e=>{const t=((e.className&&e.className.baseVal!==undefined?e.className.baseVal:e.className)+' '+e.id+' '+(e.getAttribute('alt')||'')+' '+(e.getAttribute('src')||'')+' '+(e.getAttribute('aria-label')||'')).toLowerCase();
  if(/access|a11y|nagish|נגיש|cookie|banner|sponsor|advert|social|facebook|whatsapp|instagram|youtube|twitter|telegram|search|weather|avatar|user|profile|placeholder|lazy-load|loading/.test(t))return true;
  let p=e;while(p&&p!==document.body){const s=getComputedStyle(p);if(s.position==='fixed'&&!p.matches('header,[class*=header i]'))return true;if(/access|nagish|cookie|footer/i.test((p.className&&p.className.baseVal!==undefined?p.className.baseVal:p.className)+' '+p.id+' '+p.tagName))return true;p=p.parentElement;}return false;};
 const vis=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>=24&&r.height>=14&&r.top<320&&r.top>-5&&r.width<720&&r.height<260&&s.visibility!=='hidden'&&s.display!=='none'&&+s.opacity>0.1?r:null};
 const host=location.hostname.replace(/^www\\./,'');const res={};
 const imgs=[...document.querySelectorAll('img,svg,picture')].filter(e=>!(e.closest('svg')&&e.tagName!=='svg')).map(e=>{const r=vis(e);if(!r||bad(e))return null;
  const t=((e.className&&e.className.baseVal!==undefined?e.className.baseVal:e.className)+' '+e.id+' '+(e.getAttribute('alt')||'')+' '+(e.getAttribute('src')||'')).toLowerCase();
  let anc='';let p=e;for(let i=0;i<4&&p;i++){p=p.parentElement;if(p)anc+=' '+((p.className&&p.className.baseVal!==undefined?p.className.baseVal:p.className)+' '+p.id).toLowerCase();}
  const a=e.closest('a[href]');const href=a?a.getAttribute('href'):'';const home=a&&(href==='/'||href==='./'||/^https?:\\/\\/[^/]+\\/?$/.test(href));
  let s=0;if(/logo|brand|לוגו/.test(t))s+=6;if(/logo|brand|site-title|navbar-brand|custom-logo/.test(anc))s+=4;if(home)s+=4;if(e.closest('header,[class*=header i],[id*=header i]'))s+=3;
  s+=Math.min(3,r.width/120);if(r.width/r.height>=1.6)s+=2;if(r.width<60&&r.height<60)s-=4;s-=r.top/160;return {e,s};}).filter(Boolean).sort((a,b)=>b.s-a.s);
 if(imgs[0]&&imgs[0].s>3){imgs[0].e.setAttribute('data-logo-pick','B');res.B=Math.round(imgs[0].s*10)/10;}
 const boxes=[...document.querySelectorAll('[class*=logo i],[id*=logo i],[class*=brand i],.site-title,.navbar-brand,a[rel=home],header a[href="/"],a[href="/"],a[href="./"]')].map(e=>{const r=vis(e);if(!r||bad(e)||r.width<60)return null;
  const t=((e.className&&e.className.baseVal!==undefined?e.className.baseVal:e.className)+' '+e.id);if(/menu|nav-item|navbar-nav|widget/i.test(t))return null;if((e.innerText||'').trim().length>45)return null;
  let s=0;if(/logo|brand|site-title/i.test(t))s+=4;if(e.closest('header,[class*=header i]'))s+=2;if(e.querySelector('img,svg'))s+=1;if((e.innerText||'').trim())s+=1;s-=r.top/150;return {e,s,r};}).filter(Boolean).sort((a,b)=>b.s-a.s);
 if(boxes[0]){boxes[0].e.setAttribute('data-logo-pick','C');res.C=Math.round(boxes[0].s*10)/10;}
 return res})()`;
(async()=>{const b=await chromium.launch({args:['--no-sandbox']});
 const ctx=await b.newContext({viewport:{width:1366,height:900},deviceScaleFactor:2,locale:'he-IL'});
 for(const [row,url0] of items){const res={row,url:url0};
  const page=await ctx.newPage();
  const open=async u=>{try{await page.goto(u,{waitUntil:'domcontentloaded',timeout:30000});}catch(e){return 'nav '+String(e.message).split('\n')[0].slice(0,60);}
   await sleep(3500);for(let k=0;k<6;k++){const t=await page.title().catch(()=>'');if(!CHALLENGE.test(t))break;await sleep(3000);}
   try{await page.waitForLoadState('networkidle',{timeout:8000});}catch{}return '';};
  try{
   let err=await open(url0);let meta=err?null:await page.evaluate(META).catch(()=>null);
   if(!err&&meta&&CHALLENGE.test(meta[0]||''))err='blocked: security check page';
   res.source='live';
   if(err){res.err=err;}else{res.meta=meta;
    const ld=await page.evaluate(LD).catch(()=>[]);res.ld=ld;
    const picks=await page.evaluate(PICK).catch(()=>({}));res.picks=picks;
    for(const k of ['B','C']){if(!picks[k])continue;const el=await page.$(`[data-logo-pick="${k}"]`);if(!el)continue;
     try{await el.scrollIntoViewIfNeeded();await el.screenshot({path:path.join(out,`${row}-${k}.png`),omitBackground:true,timeout:8000});}catch(e){res['err'+k]=String(e.message).slice(0,50);}}
    if(ld&&ld[0]){const p2=await ctx.newPage();try{await p2.goto(ld[0],{timeout:20000});const im=await p2.$('img,svg');if(im)await im.screenshot({path:path.join(out,`${row}-A.png`),omitBackground:true,timeout:8000});}catch(e){res.errA=String(e.message).slice(0,50);}await p2.close();}
   }
  }catch(e){res.err=String(e.message||e).slice(0,80);}
  await page.close().catch(()=>{});fs.appendFileSync(path.join(out,'log.jsonl'),JSON.stringify(res)+'\n');}
 await b.close();})();
