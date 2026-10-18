// Railway staging only. The Worker listens on loopback; this is the only ingress.
import http from 'node:http';
import {randomBytes, createHash, createHmac, timingSafeEqual, scrypt as scryptCallback} from 'node:crypto';
import {promisify} from 'node:util';
import {readFileSync, writeFileSync, renameSync, mkdirSync} from 'node:fs';
const scrypt=promisify(scryptCallback);
const COOKIE='__Host-megalinks_staging';
const TTL=8*60*60*1000;
const sha=value=>createHash('sha256').update(value).digest('hex');
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function safeReturn(value='/') {
  try {const url=new URL(value,'https://staging.invalid');return url.origin==='https://staging.invalid'&&!['/signin-with-chatgpt','/signout-with-chatgpt','/callback','/__staging/login'].includes(url.pathname)?url.pathname+url.search:'/';}catch{return '/';}
}
function loginPage(returnTo,error='',email='') {
  return `<!doctype html><html lang="he" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>כניסה לסביבת הבדיקות | Mega Links</title><style>:root{--primary:#071f4b;--background:#f7f8fa;--foreground:#172b32;--card:#fff;--border:#c5d4df;--accent:#e8f8fb;--danger:#a02020}*{box-sizing:border-box}body{margin:0;background:var(--background);color:var(--foreground);font:16px Arial,Helvetica,sans-serif;min-height:100svh;display:grid;place-items:center;padding:24px}main{width:min(100%,440px);background:var(--card);padding:clamp(24px,6vw,40px);border:1px solid var(--border);border-radius:12px;border-top:5px solid var(--primary)}small{color:var(--primary)}h1{font-size:28px;line-height:1.3;margin:14px 0}p{line-height:1.6}label{display:block;margin:20px 0 8px}input,button{font:inherit;min-height:48px;border-radius:8px}input{width:100%;padding:12px;border:1px solid var(--border);background:white;color:var(--foreground)}button{cursor:pointer;border:1px solid var(--primary);padding:10px 16px;background:var(--primary);color:white}.password{display:flex;gap:8px}.password input{min-width:0}.password button{background:var(--accent);color:var(--primary);white-space:nowrap}.submit{width:100%;margin-top:24px;font-weight:bold}button:disabled{opacity:.7;cursor:wait}:focus-visible{outline:3px solid #087b9f;outline-offset:3px}.error{color:var(--danger)}[hidden]{display:none}</style><main><small lang="en" dir="ltr">MEGA LINKS · STAGING</small><h1>כניסה לסביבת הבדיקות</h1><p>הגישה זמינה למשתמשים שהוגדרו לבדיקת המערכת.</p><p id="error" role="alert" class="error" ${error?'':'hidden'}>${escape(error)}</p><form method="post" action="/__staging/login" novalidate><input type="hidden" name="return_to" value="${escape(safeReturn(returnTo))}"><label for="email">דוא״ל</label><input id="email" name="email" type="email" dir="ltr" autocomplete="username" maxlength="254" value="${escape(email)}" aria-describedby="error"><label for="password">סיסמה</label><div class="password"><input id="password" name="password" type="password" dir="ltr" autocomplete="current-password" maxlength="256" aria-describedby="error"><button type="button" id="show" aria-label="הצגת סיסמה" aria-pressed="false">הצגה</button></div><button class="submit" type="submit">כניסה</button></form></main><script>const form=document.querySelector('form'),password=document.querySelector('#password'),show=document.querySelector('#show');show.onclick=()=>{const visible=password.type==='password';password.type=visible?'text':'password';show.textContent=visible?'הסתרה':'הצגה';show.setAttribute('aria-label',visible?'הסתרת סיסמה':'הצגת סיסמה');show.setAttribute('aria-pressed',String(visible))};form.onsubmit=e=>{const email=document.querySelector('#email'),error=document.querySelector('#error');if(!email.value.trim()||!password.value){e.preventDefault();error.hidden=false;error.textContent='יש להזין דוא״ל וסיסמה כדי להיכנס.';const field=!email.value.trim()?email:password;field.setAttribute('aria-invalid','true');field.focus();return}const button=form.querySelector('.submit');button.disabled=true;button.textContent='מתחבר…';form.setAttribute('aria-busy','true')};</script></html>`;
}
export function createStagingGateway({accounts,sessionSecret,origin,upstreamPort=8787,stateDir}) {
  const publicOrigin=new URL(origin).origin;
  if(new URL(publicOrigin).protocol!=='https:'||Buffer.from(sessionSecret||'','base64').length!==32)throw new Error('Staging requires HTTPS and a 32-byte session secret');
  if(!Array.isArray(accounts)||!accounts.length)throw new Error('No staging accounts configured');
  for(const a of accounts)if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a.email)||typeof a.id!=='string'||!a.id||!a.salt||!/^[a-f0-9]{128}$/.test(a.hash)||/[\r\n]/.test(a.id))throw new Error('Invalid staging account configuration');
  const dummy={salt:randomBytes(16).toString('hex'),hash:randomBytes(64).toString('hex')};
  const sessions=new Map();const attempts=new Map();let pending=0;
  const path=stateDir+'/sessions.json';mkdirSync(stateDir,{recursive:true,mode:0o700});
  try{for(const [id,s] of JSON.parse(readFileSync(path,'utf8')))if(s.expires>Date.now())sessions.set(id,s);}catch(e){if(e.code!=='ENOENT')throw new Error('Cannot load staging sessions');}
  function persist(){const tmp=path+'.tmp';writeFileSync(tmp,JSON.stringify([...sessions]),{mode:0o600});renameSync(tmp,path);}
  function prune(){for(const [id,s] of sessions)if(s.expires<=Date.now())sessions.delete(id);for(const [id,s] of attempts)if(s.until<=Date.now())attempts.delete(id);}
  function sign(value){return createHmac('sha256',Buffer.from(sessionSecret,'base64')).update(value).digest('base64url');}
  function cookieSession(req){try{const cookie=(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);if(!cookie||cookie.length>200)return null;const [id,signature]=cookie.split('.');const expected=sign(id);if(!signature||signature.length!==expected.length||!timingSafeEqual(Buffer.from(signature),Buffer.from(expected)))return null;const session=sessions.get(sha(id));if(!session||session.expires<=Date.now())return null;const account=accounts.find(a=>a.id===session.id&&sha(a.hash)===session.version);return account?{account,key:sha(id)}:null;}catch{return null;}}
  const cookie=value=>`${COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${value?TTL/1000:0}`;
  const server=http.createServer(async(req,res)=>{
    const finish=(status,body,extra={})=>{res.writeHead(status,{'Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow, noarchive','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Strict-Transport-Security':'max-age=31536000','Content-Type':'text/html; charset=utf-8',...extra});res.end(body);};
    try{
      prune();const url=new URL(req.url,publicOrigin);
      if(url.origin!==publicOrigin)return finish(400,'Invalid request');
      if(url.pathname==='/healthz'&&req.method==='GET'){
        const health=await fetch(`http://127.0.0.1:${upstreamPort}/`,{signal:AbortSignal.timeout(5000)});await health.body?.cancel();return finish(health.ok?200:503,health.ok?'OK':'Unavailable',{'Content-Type':'text/plain'});
      }
      if(!['GET','HEAD','OPTIONS'].includes(req.method)&&(req.headers.origin!==publicOrigin||req.headers['sec-fetch-site']==='cross-site'))return finish(403,'הבקשה אינה מורשית.');
      const session=cookieSession(req);
      if(url.pathname==='/signout-with-chatgpt'){
        if(req.headers['sec-fetch-site']==='cross-site')return finish(403,'הבקשה אינה מורשית.');
        if(session){sessions.delete(session.key);persist();}return finish(303,'',{'Set-Cookie':cookie(''),Location:'/signin-with-chatgpt'});
      }
      if(url.pathname==='/__staging/login'&&req.method==='POST'){
        // The socket address cannot be spoofed with X-Forwarded-For. Global + per-account limits
        // also apply because Railway's reverse proxy can share one socket address.
        const ip=req.socket.remoteAddress||'unknown';const bucket=attempts.get(ip)||{count:0,until:Date.now()+300000};
        if(bucket.count>=20||pending>=4)return finish(429,loginPage('/','בוצעו ניסיונות רבים. נסו שוב בעוד חמש דקות.'),{'Retry-After':'300'});
        bucket.count++;attempts.set(ip,bucket);
        let body='';for await(const chunk of req){body+=chunk.toString();if(Buffer.byteLength(body)>4096)return finish(413,'הבקשה גדולה מדי.');}
        const form=new URLSearchParams(body);const email=(form.get('email')||'').trim().toLowerCase();const password=form.get('password')||'';const returnTo=safeReturn(form.get('return_to')||'/');
        if(password.length>256||email.length>254)return finish(400,loginPage(returnTo,'יש להזין דוא״ל וסיסמה תקינים.'));
        const account=accounts.find(a=>a.email.toLowerCase()===email);const credential=account||dummy;
        pending++;let hashed;try{hashed=await scrypt(password,credential.salt,64,{N:32768,r:8,p:1,maxmem:64*1024*1024});}finally{pending--;}
        if(!account||!password||!timingSafeEqual(hashed,Buffer.from(credential.hash,'hex')))return finish(401,loginPage(returnTo,'הדוא״ל או הסיסמה אינם נכונים.',email));
        const id=randomBytes(32).toString('base64url');sessions.set(sha(id),{id:account.id,version:sha(account.hash),expires:Date.now()+TTL});persist();
        return finish(303,'',{'Set-Cookie':cookie(id+'.'+sign(id)),Location:returnTo});
      }
      if(['/signin-with-chatgpt','/callback'].includes(url.pathname))return finish(200,loginPage(url.searchParams.get('return_to')||'/'),{'Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"});
      if(!session){
        if(url.pathname.startsWith('/api/')||url.pathname==='/mcp')return finish(401,JSON.stringify({error:'יש להתחבר כדי להמשיך'}),{'Content-Type':'application/json'});
        return finish(303,'',{Location:'/signin-with-chatgpt?return_to='+encodeURIComponent(safeReturn(url.pathname+url.search))});
      }
      const headers={...req.headers};
      for(const key of Object.keys(headers))if(key.startsWith('oai-')||key.startsWith('x-forwarded-')||['forwarded','authorization','connection','host','upgrade','proxy-authorization','proxy-connection'].includes(key))delete headers[key];
      headers.host=new URL(publicOrigin).host;headers['x-forwarded-proto']='https';
      headers['oai-authenticated-user-id']=session.account.id;headers['oai-authenticated-user-email']=session.account.email.toLowerCase();
      headers['oai-authenticated-user-full-name']=encodeURIComponent(session.account.name||session.account.email);headers['oai-authenticated-user-full-name-encoding']='percent-encoded-utf-8';
      headers.cookie=(headers.cookie||'').split(';').filter(s=>!s.trim().startsWith(COOKIE+'=')).join(';');
      const upstream=http.request({hostname:'127.0.0.1',port:upstreamPort,path:url.pathname+url.search,method:req.method,headers},response=>{
        const out={...response.headers,'cache-control':'private, no-store','x-robots-tag':'noindex, nofollow, noarchive','x-content-type-options':'nosniff','referrer-policy':'no-referrer','strict-transport-security':'max-age=31536000'};
        delete out.connection;res.writeHead(response.statusCode||502,out);response.pipe(res);
      });upstream.setTimeout(120000,()=>upstream.destroy());upstream.on('error',()=>{if(!res.headersSent)finish(502,'השירות אינו זמין כרגע. נסו שוב בעוד רגע.');else res.destroy();});req.on('aborted',()=>upstream.destroy());req.pipe(upstream);
    }catch{if(!res.headersSent)finish(503,'השירות אינו זמין כרגע. נסו שוב בעוד רגע.');else res.destroy();}
  });server.headersTimeout=10000;server.requestTimeout=30000;server.maxHeadersCount=100;return server;
}
