// node logo-shot.mjs <list.tsv: row<TAB>url> <outdir>  — screenshots the header logo of each site with headless Chrome
import {spawn} from 'node:child_process';import {writeFileSync,readFileSync,mkdtempSync,mkdirSync,appendFileSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
const [list,out]=process.argv.slice(2);mkdirSync(out,{recursive:true});
const items=readFileSync(list,'utf8').split('\n').filter(Boolean).map(l=>l.split('\t'));
const port=9800+Math.floor(Math.random()*190);
// CHROME_PATH picks the browser outside Windows (cloud: /opt/pw-browsers/chromium, which runs as root and needs --no-sandbox).
const chromePath=process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe';
const chrome=spawn(chromePath,[...(process.platform==='linux'?['--no-sandbox','--disable-dev-shm-usage']:[]),'--headless=new','--remote-debugging-port='+port,'--user-data-dir='+mkdtempSync(join(tmpdir(),'cdp-')),'--hide-scrollbars','--window-size=1366,900','--lang=he-IL','about:blank'],{stdio:'ignore'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));let tabs;for(let i=0;i<60;i++){try{tabs=await (await fetch(`http://127.0.0.1:${port}/json`)).json();if(tabs.length)break;}catch{}await sleep(250);}
const ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);let id=0;const pend={};let loaded=null;
ws.onmessage=e=>{const m=JSON.parse(e.data);if(pend[m.id]){pend[m.id](m.result||{error:m.error});delete pend[m.id];}if(m.method==='Page.loadEventFired'&&loaded)loaded();};
const send=(method,params={},ms=20000)=>Promise.race([new Promise(r=>{pend[++id]=r;ws.send(JSON.stringify({id,method,params}));}),sleep(ms).then(()=>({timeout:true}))]);
await send('Page.enable');await send('Emulation.setDeviceMetricsOverride',{width:1366,height:900,deviceScaleFactor:2,mobile:false});
await send('Network.setUserAgentOverride',{userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',acceptLanguage:'he-IL,he'});
const ev=async x=>(await send('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true},8000))?.result?.value;
const FIND=`(()=>{const vis=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>=30&&r.height>=16&&s.visibility!=='hidden'&&s.display!=='none'&&+s.opacity>0.1&&r.top<650&&r.top>-5&&r.width<700&&r.height<260?r:null};
const txt=e=>[e.className&&e.className.baseVal!==undefined?e.className.baseVal:e.className,e.id,e.getAttribute('alt'),e.getAttribute('src'),e.getAttribute('data-src'),e.getAttribute('aria-label'),e.getAttribute('title')].join(' ').toLowerCase();
const host=location.hostname.replace(/^www\\./,'');const c=[];
document.querySelectorAll('img,svg,picture,a,div,span').forEach(e=>{if(e.closest('svg')&&e.tagName!=='svg')return;const r=vis(e);if(!r)return;let s=0;let t=txt(e);
 const home=e.closest('a[href]');const href=home?home.getAttribute('href'):'';const isHome=home&&(href==='/'||href==='./'||/^https?:\\/\\/(www\\.)?[^/]+\\/?$/.test(href)&&href.includes(host.split('.')[0]));
 let p=e,anc='';for(let i=0;i<4&&p;i++){p=p.parentElement;if(p)anc+=' '+txt(p);}
 const tag=e.tagName.toLowerCase();if(!['img','svg','picture'].includes(tag)&&!(getComputedStyle(e).backgroundImage||'').includes('url('))return;
 if(/logo|brand|לוגו/.test(t))s+=6;if(/logo|brand|site-title|navbar-brand/.test(anc))s+=4;if(isHome)s+=4;if(e.closest('header,[class*=header],[id*=header]'))s+=3;
 if(/banner|sponsor|avatar|social|facebook|whatsapp|telegram|twitter|search|weather|user|profile|צילום/.test(t))s-=6;if(/banner|sponsor|advert|dfp|google_ads|article|post|teaser|item|card/.test(anc))s-=4;if(/ראשי|דף הבית|home/.test(t))s+=3;if(r.left+r.width>innerWidth*0.6||r.left<innerWidth*0.25)s+=1;
 s-=r.top/150;if(r.width<45&&r.height<45)s-=3;c.push({el:e,s,x:r.left,y:r.top,w:r.width,h:r.height,tag,t:t.slice(0,60)});});
c.sort((a,b)=>b.s-a.s);window.__c=c;return c.slice(0,6).map(({el,...o})=>o)})()`;
for(const [row,url] of items){
  let res={row,url};
  try{
    const p=new Promise(r=>loaded=r);const nav=await send('Page.navigate',{url},15000);
    if(nav.timeout||nav.errorText){res.err='nav '+(nav.errorText||'timeout');}
    else{await Promise.race([p,sleep(14000)]);await sleep(2500);
      // Security check pages ("רק רגע...", "Just a moment") clear by themselves after a few seconds.
      for(let k=0;k<8;k++){const t=await ev('document.title');if(!/רק רגע|just a moment|attention required|checking your browser|one moment/i.test(t||''))break;await sleep(3000);}
      
      res.meta=await ev(`(()=>{const m=n=>(document.querySelector('meta[name="'+n+'"],meta[property="'+n+'"]')||{}).content||'';return [document.title,m('description')||m('og:description'),[...document.querySelectorAll('h1,h2,h3')].slice(0,6).map(x=>x.innerText.trim()).join(' / '),[...new Set([...document.querySelectorAll('nav a,header a,[class*=menu] a')].map(x=>x.innerText.trim()).filter(t=>t&&t.length<30))].slice(0,25).join(' · ')].map(x=>(x||'').replace(/\s+/g,' ').slice(0,300))})()`);const cs=await ev(FIND)||[];res.c=cs.map(x=>[Math.round(x.s*10)/10,x.tag,Math.round(x.w),Math.round(x.h),Math.round(x.y),x.t]);const b=cs[0]&&cs[0].s>2?cs[0]:null;if(b&&b.tag==='img'){await sleep(1500);}
      if(!b){res.err='nologo';const v=await send('Page.captureScreenshot',{format:'jpeg',quality:40,clip:{x:0,y:0,width:1366,height:300,scale:0.4}});if(v.data)writeFileSync(join(out,row+'-view.jpg'),Buffer.from(v.data,'base64'));res.title=await ev('document.title+" | "+document.querySelectorAll("img,svg").length');}else{
        let done=false;
        if(b.tag==='img'){const info=await ev(`(()=>{const e=window.__c[0].el;let p=e,bg='';while(p&&p!==document.documentElement){const c=getComputedStyle(p).backgroundColor;if(c&&c!=='rgba(0, 0, 0, 0)'&&c!=='transparent'){bg=c;break;}p=p.parentElement;}let src=e.currentSrc||e.src;if(!src||src.startsWith('data:')){const z=e.getAttribute('data-lazy-src')||e.getAttribute('data-src')||(e.getAttribute('data-srcset')||e.getAttribute('data-lazy-srcset')||'').split(',')[0].trim().split(' ')[0];if(z)src=new URL(z,location.href).href;}return {src,bg}})()`);
          res.info=info;if(info&&info.src&&!info.src.startsWith('data:')){const ft=await send('Page.getFrameTree');let rc=await send('Page.getResourceContent',{frameId:ft.frameTree.frame.id,url:info.src},8000);
            if(!rc||!rc.content){const f=await ev(`fetch(${JSON.stringify(info.src)}).then(r=>r.blob()).then(b=>new Promise(ok=>{const fr=new FileReader();fr.onload=()=>ok(fr.result.split(',')[1]);fr.readAsDataURL(b)})).catch(()=>null)`);if(f)rc={content:f,base64Encoded:true};}res.rc=rc&&(rc.error?JSON.stringify(rc.error).slice(0,80):(rc.content||'').length);if(rc&&rc.content){let b64=rc.base64Encoded?rc.content:Buffer.from(rc.content).toString('base64');const head=Buffer.from(b64.slice(0,400),'base64').toString('latin1');const mime=/<svg|<\?xml/.test(head)?'image/svg+xml':'image/png';
              const png=await ev(`(async()=>{const im=new Image();im.src='data:${mime};base64,${b64}';await im.decode().catch(()=>{});let w=im.naturalWidth,h=im.naturalHeight;if(!w||!h){w=${Math.round(b.w)}*4;h=${Math.round(b.h)}*4;}const k=Math.min(4,700/Math.max(w,h));const cv=document.createElement('canvas');cv.width=Math.round(w*k);cv.height=Math.round(h*k);const x=cv.getContext('2d');x.drawImage(im,0,0,cv.width,cv.height);
                const d=x.getImageData(0,0,cv.width,cv.height).data;let n=0,l=0,op=0;for(let i=0;i<d.length;i+=16){if(d[i+3]>40){op++;l+=(d[i]+d[i+1]+d[i+2])/3;}n++;}const light=op&&l/op>225;
                if(op<n*0.02)return null;if(light){const bg=${JSON.stringify(info.bg)}||'#20262e';const c2=document.createElement('canvas');c2.width=cv.width;c2.height=cv.height;const y=c2.getContext('2d');y.fillStyle=(/255, 255, 255/.test(bg)?'#20262e':bg);y.fillRect(0,0,c2.width,c2.height);y.drawImage(cv,0,0);return c2.toDataURL('image/png');}
                return cv.toDataURL('image/png')})()`);
              res.png=png===undefined?'undef':png===null?'null':png.length;if(png){writeFileSync(join(out,row+'.png'),Buffer.from(png.split(',')[1],'base64'));res.ok=1;res.how='file';done=true;}}}}
        if(!done){await ev('scrollTo(0,0)');await sleep(400);const r=await ev(`(()=>{const e=window.__c[0].el;const q=e.getBoundingClientRect();return {x:q.left+scrollX,y:q.top+scrollY,w:q.width,h:q.height}})()`)||b;
          const pad=4,clip={x:Math.max(0,r.x-pad),y:Math.max(0,r.y-pad),width:r.w+2*pad,height:r.h+2*pad,scale:2};
          const shot=await send('Page.captureScreenshot',{format:'png',clip,captureBeyondViewport:true},10000);
          if(shot.data){writeFileSync(join(out,row+'.png'),Buffer.from(shot.data,'base64'));res.ok=1;res.how='shot';}else res.err='shot';}
        res.box=[Math.round(b.w),Math.round(b.h)];res.tag=b.tag;
      }}
  }catch(e){res.err=String(e).slice(0,60);}
  appendFileSync(join(out,'log.jsonl'),JSON.stringify(res)+'\n');
  await send('Page.navigate',{url:'about:blank'},5000);
}
chrome.kill();process.exit(0);
