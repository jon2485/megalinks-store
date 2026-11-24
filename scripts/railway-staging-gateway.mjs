// Railway staging only. The Worker listens on loopback; this is the only ingress.
import http from 'node:http';
import {randomBytes, createHash, createHmac, timingSafeEqual, scrypt as scryptCallback} from 'node:crypto';
import {promisify} from 'node:util';
import {readFileSync, writeFileSync, renameSync, mkdirSync} from 'node:fs';
const scrypt=promisify(scryptCallback);
const TTL=8*60*60*1000;
// Owner decision (24.11.2026): Google sign-in. A customer stays signed in 30 days, an administrator 8 hours.
const CUSTOMER_TTL=30*24*60*60*1000;
const GOOGLE_START='/__staging/google/start',GOOGLE_CALLBACK='/__staging/google/callback';
const sha=value=>createHash('sha256').update(value).digest('hex');
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function safeReturn(value='/') {
  try {const url=new URL(value,'https://staging.invalid');return url.origin==='https://staging.invalid'&&!['/signin-with-chatgpt','/signout-with-chatgpt','/callback','/__staging/login',GOOGLE_START,GOOGLE_CALLBACK].includes(url.pathname)?url.pathname+url.search:'/';}catch{return '/';}
}
function loginPage(returnTo,error='',email='',production=false,google=false) {
  return `<!doctype html><html lang="he" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>כניסה ל${production?'מגה לינקס':'סביבת הבדיקות'} | Mega Links</title><style>:root{--primary:#071f4b;--background:#f7f8fa;--foreground:#172b32;--card:#fff;--border:#c5d4df;--accent:#e8f8fb;--danger:#a02020}*{box-sizing:border-box}body{margin:0;background:var(--background);color:var(--foreground);font:16px Arial,Helvetica,sans-serif;min-height:100svh;display:grid;place-items:center;padding:24px}main{width:min(100%,440px);background:var(--card);padding:clamp(24px,6vw,40px);border:1px solid var(--border);border-radius:12px;border-top:5px solid var(--primary)}small{color:var(--primary)}h1{font-size:28px;line-height:1.3;margin:14px 0}p{line-height:1.6}label{display:block;margin:20px 0 8px}input,button{font:inherit;min-height:48px;border-radius:8px}input{width:100%;padding:12px;border:1px solid var(--border);background:white;color:var(--foreground)}button{cursor:pointer;border:1px solid var(--primary);padding:10px 16px;background:var(--primary);color:white}.password{display:flex;gap:8px}.password input{min-width:0}.password button{background:var(--accent);color:var(--primary);white-space:nowrap}.submit{width:100%;margin-top:24px;font-weight:bold}button:disabled{opacity:.7;cursor:wait}:focus-visible{outline:3px solid #087b9f;outline-offset:3px}.error{color:var(--danger)}.google{display:flex;align-items:center;justify-content:center;gap:10px;min-height:48px;margin-top:20px;border:1px solid var(--border);border-radius:8px;background:white;color:var(--foreground);font-weight:bold;text-decoration:none}.google:hover{background:var(--accent)}.or{display:flex;align-items:center;gap:12px;margin:24px 0 0;color:#5b6b72}.or:before,.or:after{content:'';flex:1;border-top:1px solid var(--border)}[hidden]{display:none}</style><main><small lang="en" dir="ltr">MEGA LINKS · STAGING</small><h1>כניסה ל${production?'מגה לינקס':'סביבת הבדיקות'}</h1><p>הגישה זמינה למשתמשים שהוגדרו לבדיקת המערכת.</p><p id="error" role="alert" class="error" ${error?'':'hidden'}>${escape(error)}</p>${google?`<a class="google" href="${GOOGLE_START}?return_to=${encodeURIComponent(safeReturn(returnTo))}"><svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true"><path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h11.8c-.5 2.7-2.1 5-4.4 6.6v5.5h7.1c4.2-3.8 6.6-9.5 6.6-16.1z"/><path fill="#34A853" d="M24 46c5.9 0 10.9-2 14.5-5.3l-7.1-5.5c-2 1.3-4.5 2.1-7.4 2.1-5.7 0-10.6-3.9-12.3-9.1H4.4v5.7C8 41.1 15.4 46 24 46z"/><path fill="#FBBC05" d="M11.7 28.2c-.4-1.3-.7-2.7-.7-4.2s.3-2.9.7-4.2v-5.7H4.4C2.9 17.1 2 20.4 2 24s.9 6.9 2.4 9.9l7.3-5.7z"/><path fill="#EA4335" d="M24 10.7c3.2 0 6.1 1.1 8.4 3.3l6.3-6.3C34.9 4.2 29.9 2 24 2 15.4 2 8 6.9 4.4 14.1l7.3 5.7c1.7-5.2 6.6-9.1 12.3-9.1z"/></svg>כניסה עם Google</a><p class="or">או עם דוא״ל וסיסמה</p>`:''}<form method="post" action="/__staging/login" novalidate><input type="hidden" name="return_to" value="${escape(safeReturn(returnTo))}"><label for="email">דוא״ל</label><input id="email" name="email" type="email" dir="ltr" autocomplete="username" maxlength="254" value="${escape(email)}" aria-describedby="error"><label for="password">סיסמה</label><div class="password"><input id="password" name="password" type="password" dir="ltr" autocomplete="current-password" maxlength="256" aria-describedby="error"><button type="button" id="show" aria-label="הצגת סיסמה" aria-pressed="false">הצגה</button></div><button class="submit" type="submit">כניסה</button></form></main><script>const form=document.querySelector('form'),password=document.querySelector('#password'),show=document.querySelector('#show');show.onclick=()=>{const visible=password.type==='password';password.type=visible?'text':'password';show.textContent=visible?'הסתרה':'הצגה';show.setAttribute('aria-label',visible?'הסתרת סיסמה':'הצגת סיסמה');show.setAttribute('aria-pressed',String(visible))};form.onsubmit=e=>{const email=document.querySelector('#email'),error=document.querySelector('#error');if(!email.value.trim()||!password.value){e.preventDefault();error.hidden=false;error.textContent='יש להזין דוא״ל וסיסמה כדי להיכנס.';const field=!email.value.trim()?email:password;field.setAttribute('aria-invalid','true');field.focus();return}const button=form.querySelector('.submit');button.disabled=true;button.textContent='מתחבר…';form.setAttribute('aria-busy','true')};</script></html>`;
}
// Owner decision (16.11.2026): emails sent from Staging must show the logo, and the mail service must be able
// to fetch the files of an email in order to attach them. Only these exact addresses pass without signing in:
// the two logo images and a file address that carries the personal token of one email. GET and HEAD only,
// no query string, and the request reaches the app with no identity and no cookies. Everything else stays locked.
export const publicMailPath=pathname=>/^\/(?:brand\/megalinks-logo(?:-dark)?\.png|api\/mail-file\/[0-9a-f]{48}\/\d\/[^\/]{1,200})$/.test(pathname);
// production: the same gateway for the real environment (own cookie name, no "test environment" wording).
// google: {clientId, clientSecret, fetch?}. Only accounts already configured here may sign in with Google, and only with an
// email Google verified (Gmail, or a Workspace domain). Omit it and the gateway behaves exactly as before.
export function createStagingGateway({accounts,sessionSecret,origin,upstreamPort=8787,stateDir,production=false,exportToken='',google=null,adminEmails=[]}) {
  // 24.11.2026 Staging only: read-only /api/export/* for the real site's one-time import, with its own token (checked here and in the app).
  const exportAllowed=(req,path)=>{const given=String(req.headers['x-export-token']||'');return !!exportToken&&exportToken.length>=32&&req.method==='GET'&&path.startsWith('/api/export/')&&given.length===exportToken.length&&timingSafeEqual(Buffer.from(sha(given)),Buffer.from(sha(exportToken)));};
  const COOKIE=production?'__Host-megalinks_session':'__Host-megalinks_staging';
  if(google&&(typeof google.clientId!=='string'||!google.clientId||typeof google.clientSecret!=='string'||!google.clientSecret))throw new Error('Google sign-in needs a client id and a client secret');
  const admins=new Set(adminEmails.map(e=>String(e).trim().toLowerCase()).filter(Boolean));
  const FLOW=production?'__Host-megalinks_google':'__Host-megalinks_staging_google';
  const formPage=(returnTo,error='',email='')=>loginPage(returnTo,error,email,production,!!google);
  const PAGE_CSP="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'";
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
  const cookie=(value,ttl=TTL)=>`${COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${value?Math.floor(ttl/1000):0}`;
  const readCookie=(req,name)=>(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(name+'='))?.slice(name.length+1)||'';
  const flowCookie=value=>`${FLOW}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${value?600:0}`;
  const redirectUri=publicOrigin+GOOGLE_CALLBACK;
  const same=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.length===b.length&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
  async function googleCallback(req,url){
    const fail=(status,message)=>({status,body:formPage('/',message),headers:{'Set-Cookie':flowCookie(''),'Content-Security-Policy':PAGE_CSP}});
    const raw=readCookie(req,FLOW);const [payload,signature]=raw.split('.');
    if(!payload||raw.length>2000||!same(signature,sign('google.'+payload)))return fail(400,'פג הזמן של הכניסה עם Google. נסו שוב.');
    let flow;try{flow=JSON.parse(Buffer.from(payload,'base64url').toString('utf8'));}catch{return fail(400,'פג הזמן של הכניסה עם Google. נסו שוב.');}
    if(!flow||flow.exp<=Date.now()||!same(url.searchParams.get('state')||'',flow.state))return fail(400,'פג הזמן של הכניסה עם Google. נסו שוב.');
    if(url.searchParams.get('error'))return fail(400,'הכניסה עם Google בוטלה.');
    const code=url.searchParams.get('code')||'';if(!code||code.length>2048)return fail(400,'Google לא החזירה אישור כניסה. נסו שוב.');
    if(pending>=4)return fail(429,'בוצעו ניסיונות רבים. נסו שוב בעוד רגע.');
    let claims;pending++;
    try{
      const response=await(google.fetch||fetch)('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
        body:new URLSearchParams({code,client_id:google.clientId,client_secret:google.clientSecret,redirect_uri:redirectUri,grant_type:'authorization_code',code_verifier:flow.verifier}),signal:AbortSignal.timeout(10000)});
      if(!response.ok)return fail(502,'Google לא אישרה את הכניסה. נסו שוב.');
      // The id_token comes straight from Google's token endpoint over TLS, authenticated with our client secret,
      // so its claims are trusted without a separate signature check (OpenID Connect Core 3.1.3.7).
      const token=String((await response.json()).id_token||'');claims=JSON.parse(Buffer.from(token.split('.')[1]||'','base64url').toString('utf8'));
    }catch{return fail(502,'אין כרגע חיבור ל-Google. נסו שוב בעוד רגע.');}finally{pending--;}
    const email=String(claims?.email||'').trim().toLowerCase();
    if(!['https://accounts.google.com','accounts.google.com'].includes(claims?.iss)||claims.aud!==google.clientId||!(Number(claims.exp)*1000>Date.now())||!same(String(claims.nonce||''),flow.nonce)||typeof claims.sub!=='string'||!claims.sub)
      return fail(400,'לא ניתן לאמת את הכניסה עם Google. נסו שוב.');
    // A verified flag alone does not prove a non-Google address is still owned by the person; accept Gmail or a Workspace domain only.
    if(!(claims.email_verified===true||claims.email_verified==='true')||!(email.endsWith('@gmail.com')||(typeof claims.hd==='string'&&email.endsWith('@'+claims.hd.toLowerCase()))))
      return fail(403,'Google לא אישרה את כתובת הדוא״ל הזו. היכנסו עם דוא״ל וסיסמה.');
    const account=accounts.find(a=>a.email.toLowerCase()===email);
    if(!account)return fail(403,'החשבון '+email+' עדיין לא מורשה להיכנס כאן.');
    const ttl=admins.has(email)?TTL:CUSTOMER_TTL;const id=randomBytes(32).toString('base64url');
    sessions.set(sha(id),{id:account.id,version:sha(account.hash),expires:Date.now()+ttl,via:'google'});persist();
    return {status:303,body:'',headers:{'Set-Cookie':[cookie(id+'.'+sign(id),ttl),flowCookie('')],Location:safeReturn(flow.returnTo||'/')}};
  }
  const server=http.createServer(async(req,res)=>{
    const finish=(status,body,extra={})=>{res.writeHead(status,{'Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow, noarchive','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','Strict-Transport-Security':'max-age=31536000','Content-Type':'text/html; charset=utf-8',...extra});res.end(body);};
    try{
      prune();const url=new URL(req.url,publicOrigin);
      if(url.origin!==publicOrigin)return finish(400,'Invalid request');
      if(url.pathname==='/healthz'&&req.method==='GET'){
        const health=await fetch(`http://127.0.0.1:${upstreamPort}/`,{signal:AbortSignal.timeout(5000)});await health.body?.cancel();return finish(health.ok?200:503,health.ok?'OK':'Unavailable',{'Content-Type':'text/plain'});
      }
      if(google&&url.pathname===GOOGLE_START&&req.method==='GET'){
        const state=randomBytes(24).toString('base64url'),nonce=randomBytes(24).toString('base64url'),verifier=randomBytes(48).toString('base64url');
        const payload=Buffer.from(JSON.stringify({state,nonce,verifier,returnTo:safeReturn(url.searchParams.get('return_to')||'/'),exp:Date.now()+600000})).toString('base64url');
        const auth=new URL('https://accounts.google.com/o/oauth2/v2/auth');
        auth.search=new URLSearchParams({client_id:google.clientId,redirect_uri:redirectUri,response_type:'code',scope:'openid email profile',state,nonce,
          code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256',prompt:'select_account'}).toString();
        return finish(303,'',{'Set-Cookie':flowCookie(payload+'.'+sign('google.'+payload)),Location:auth.href});
      }
      if(google&&url.pathname===GOOGLE_CALLBACK&&req.method==='GET'){const out=await googleCallback(req,url);return finish(out.status,out.body,out.headers);}
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
        if(bucket.count>=20||pending>=4)return finish(429,formPage('/','בוצעו ניסיונות רבים. נסו שוב בעוד חמש דקות.'),{'Retry-After':'300'});
        bucket.count++;attempts.set(ip,bucket);
        let body='';for await(const chunk of req){body+=chunk.toString();if(Buffer.byteLength(body)>4096)return finish(413,'הבקשה גדולה מדי.');}
        const form=new URLSearchParams(body);const email=(form.get('email')||'').trim().toLowerCase();const password=form.get('password')||'';const returnTo=safeReturn(form.get('return_to')||'/');
        if(password.length>256||email.length>254)return finish(400,formPage(returnTo,'יש להזין דוא״ל וסיסמה תקינים.'));
        const account=accounts.find(a=>a.email.toLowerCase()===email);const credential=account||dummy;
        pending++;let hashed;try{hashed=await scrypt(password,credential.salt,64,{N:32768,r:8,p:1,maxmem:64*1024*1024});}finally{pending--;}
        if(!account||!password||!timingSafeEqual(hashed,Buffer.from(credential.hash,'hex')))return finish(401,formPage(returnTo,'הדוא״ל או הסיסמה אינם נכונים.',email));
        const id=randomBytes(32).toString('base64url');sessions.set(sha(id),{id:account.id,version:sha(account.hash),expires:Date.now()+TTL});persist();
        return finish(303,'',{'Set-Cookie':cookie(id+'.'+sign(id)),Location:returnTo});
      }
      if(['/signin-with-chatgpt','/callback'].includes(url.pathname))return finish(200,formPage(url.searchParams.get('return_to')||'/'),{'Content-Security-Policy':PAGE_CSP});
      const open=!session&&(['GET','HEAD'].includes(req.method)&&!url.search&&publicMailPath(url.pathname)||exportAllowed(req,url.pathname));
      if(!session&&!open){
        if(url.pathname.startsWith('/api/')||url.pathname==='/mcp')return finish(401,JSON.stringify({error:'יש להתחבר כדי להמשיך'}),{'Content-Type':'application/json'});
        return finish(303,'',{Location:'/signin-with-chatgpt?return_to='+encodeURIComponent(safeReturn(url.pathname+url.search))});
      }
      const headers={...req.headers};
      for(const key of Object.keys(headers))if(key.startsWith('oai-')||key.startsWith('x-forwarded-')||['forwarded','authorization','connection','host','upgrade','proxy-authorization','proxy-connection'].includes(key))delete headers[key];
      headers.host=new URL(publicOrigin).host;headers['x-forwarded-proto']='https';
      if(session){
        headers['oai-authenticated-user-id']=session.account.id;headers['oai-authenticated-user-email']=session.account.email.toLowerCase();
        headers['oai-authenticated-user-full-name']=encodeURIComponent(session.account.name||session.account.email);headers['oai-authenticated-user-full-name-encoding']='percent-encoded-utf-8';
        headers.cookie=(headers.cookie||'').split(';').filter(s=>!s.trim().startsWith(COOKIE+'=')).join(';');
      }else delete headers.cookie;
      const upstream=http.request({hostname:'127.0.0.1',port:upstreamPort,path:url.pathname+url.search,method:req.method,headers},response=>{
        const out={...response.headers,'cache-control':'private, no-store','x-robots-tag':'noindex, nofollow, noarchive','x-content-type-options':'nosniff','referrer-policy':'no-referrer','strict-transport-security':'max-age=31536000'};
        delete out.connection;res.writeHead(response.statusCode||502,out);response.pipe(res);
      });upstream.setTimeout(120000,()=>upstream.destroy());upstream.on('error',()=>{if(!res.headersSent)finish(502,'השירות אינו זמין כרגע. נסו שוב בעוד רגע.');else res.destroy();});req.on('aborted',()=>upstream.destroy());req.pipe(upstream);
    }catch{if(!res.headersSent)finish(503,'השירות אינו זמין כרגע. נסו שוב בעוד רגע.');else res.destroy();}
  });server.headersTimeout=10000;server.requestTimeout=30000;server.maxHeadersCount=100;return server;
}
