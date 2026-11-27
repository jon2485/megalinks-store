import assert from 'node:assert/strict';
import http from 'node:http';
import {scryptSync,randomBytes} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {createStagingGateway,safeReturn} from '../scripts/railway-staging-gateway.mjs';
const password=randomBytes(32).toString('base64url'),salt=randomBytes(16).toString('hex');
const accounts=[{id:'fixture-owner',email:'owner@example.test',name:'בדיקת מנהל',salt,hash:scryptSync(password,salt,64,{N:32768,r:8,p:1,maxmem:67108864}).toString('hex')}];
const stateDir=mkdtempSync(tmpdir()+'/ml-gateway-');const sessionSecret=randomBytes(32).toString('base64');
let forwarded=0;const upstream=http.createServer((req,res)=>{forwarded++;res.setHeader('Content-Type','application/json');res.end(JSON.stringify({headers:req.headers,url:req.url}));});
await new Promise(r=>upstream.listen(0,'127.0.0.1',r));
const options={accounts,sessionSecret,origin:'https://staging.example.test',upstreamPort:upstream.address().port,stateDir};
let gateway=createStagingGateway(options);await new Promise(r=>gateway.listen(0,'127.0.0.1',r));
let base='http://127.0.0.1:'+gateway.address().port;let checks=0;
const check=(v,m)=>{assert(v,m);checks++};
const req=(path,options={})=>fetch(base+path,{redirect:'manual',...options});
const login=(pass=password,origin=options.origin,returnTo='/catalog')=>req('/__staging/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({email:accounts[0].email,password:pass,return_to:returnTo})});
try {
  for(const target of ['https://attacker.test','//attacker.test','/\\attacker.test','/signin-with-chatgpt','/callback'])check(safeReturn(target)==='/','no external or looping redirects');
  let r=await req('/api/me',{headers:{'oai-authenticated-user-email':accounts[0].email,'oai-authenticated-user-id':'fixture-owner'}});check(r.status===401,'spoofed identity blocked');check(forwarded===0,'unauthenticated requests never reach Worker');
  for(const p of ['/','/admin','/supplier/token','/_next/static/file.js']){r=await req(p);check(r.status===303,'all resources require auth');check(r.headers.get('cache-control').includes('no-store'),'private cache');check(r.headers.get('x-robots-tag').includes('noindex'),'no indexing');}
  // Owner decision (16.11.2026): only the email logo and the personal file addresses of emails are open without signing in.
  {const spoof={'oai-authenticated-user-id':'attacker','oai-authenticated-user-email':'evil@example.test',Cookie:'other=1'},file='/api/mail-file/'+'ab'.repeat(24)+'/0/article.docx';
   for(const p of ['/brand/megalinks-logo-dark.png','/brand/megalinks-logo.png',file]){const before=forwarded;r=await req(p,{headers:spoof});const seen=await r.json();check(r.status===200&&forwarded===before+1&&seen.url===p,'email logo and email file addresses are served without signing in');check(!seen.headers['oai-authenticated-user-id']&&!seen.headers['oai-authenticated-user-email']&&!seen.headers.cookie,'an open address reaches the app with no identity and no cookies');check(r.headers.get('cache-control').includes('no-store')&&r.headers.get('x-robots-tag').includes('noindex'),'open addresses stay private and unindexed');}
   const locked=forwarded;for(const [p,status] of [['/brand/megalinks-social.png',303],['/brand/',303],['/brand/megalinks-logo-dark.png/x',303],['/brand/megalinks-logo-dark.png?x=1',303],['/brand/../api/me',401],['/api/mail-file/short/0/a.pdf',401],['/api/mail-file/'+'AB'.repeat(24)+'/0/a.pdf',401],['/api/mail-file/'+'ab'.repeat(24)+'/10/a.pdf',401],['/api/mail-file/'+'ab'.repeat(24)+'/0/a/b.pdf',401],[file+'?x=1',401],['/api/mail-file',401],['/api/me',401],['/api/admin/mail',401]]){r=await req(p);check(r.status===status,'everything next to the open addresses stays locked: '+p);}
   r=await req(file,{method:'POST',headers:{Origin:options.origin},body:'{}'});check(r.status===401,'an open address accepts reading only');check(forwarded===locked,'locked requests never reach the app');}
  r=await req('/signin-with-chatgpt');const page=await r.text();check(r.status===200&&page.includes('dir="rtl"')&&page.includes('autocomplete="current-password"'),'RTL accessible login');check(r.headers.get('referrer-policy')==='same-origin','form navigation retains same-origin Origin for CSRF validation');
  r=await login('incorrect');check(r.status===401,'wrong password rejected');check(!r.headers.get('set-cookie'),'failure creates no session');
  r=await login(password,'https://attacker.test');check(r.status===403,'login CSRF rejected');
  r=await login();check(r.status===303,'successful credential login');const setCookie=r.headers.get('set-cookie');check(/HttpOnly.*Secure.*SameSite=Lax/.test(setCookie),'secure cookie flags');const cookie=setCookie.split(';')[0];
  r=await req('/api/me',{headers:{Cookie:cookie,'oai-authenticated-user-id':'attacker','oai-authenticated-user-email':'evil@example.test','x-forwarded-host':'evil.test'}});let data=await r.json();check(data.headers['oai-authenticated-user-id']==='fixture-owner','verified identity replaces spoof');check(data.headers['oai-authenticated-user-email']===accounts[0].email,'verified email replaces spoof');check(!data.headers['x-forwarded-host'],'untrusted forwarded headers stripped');check(!data.headers.cookie.includes('__Host-megalinks_staging'),'session never reaches app');
  r=await req('/api/me',{headers:{Cookie:cookie+'x'}});check(r.status===401,'tampered session rejected');
  r=await req('/api/cart',{method:'POST',headers:{Cookie:cookie,Origin:'https://attacker.test'},body:'{}'});check(r.status===403,'authenticated cross-origin writes rejected');
  r=await req('/api/cart',{method:'POST',headers:{Cookie:cookie},body:'{}'});check(r.status===403,'missing Origin writes rejected');
  await new Promise(r=>gateway.close(r));gateway=createStagingGateway(options);await new Promise(r=>gateway.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+gateway.address().port;
  r=await req('/api/me',{headers:{Cookie:cookie}});check(r.status===200,'session survives process restart');
  r=await req('/signout-with-chatgpt',{headers:{Cookie:cookie}});check(r.status===303&&r.headers.get('set-cookie').includes('Max-Age=0'),'logout clears cookie');
  r=await req('/api/me',{headers:{Cookie:cookie}});check(r.status===401,'logout revokes captured session');
  for(let i=0;i<20;i++)await login('bad');r=await login();check(r.status===429,'login rate limit');
  // PayPlus's server may report a payment to its one callback address (POST, PayPlus user-agent); nothing else opens.
  {const before=forwarded;r=await req('/api/payplus/callback',{method:'POST',headers:{'User-Agent':'PayPlus','Content-Type':'application/json'},body:'{}'});check(r.status===200&&forwarded===before+1&&(await r.json()).url==='/api/payplus/callback','PayPlus callback reaches the app');
   for(const [p,o] of [['/api/payplus/callback',{method:'POST',headers:{'User-Agent':'curl/8'},body:'{}'}],['/api/payplus/callback?x=1',{method:'POST',headers:{'User-Agent':'PayPlus'},body:'{}'}],['/api/payplus/callback',{headers:{'User-Agent':'PayPlus'}}],['/api/payment-callback',{method:'POST',headers:{'User-Agent':'PayPlus'},body:'{}'}],['/api/me',{method:'POST',headers:{'User-Agent':'PayPlus'},body:'{}'}]]){const b=forwarded;r=await req(p,o);check(r.status>=300&&forwarded===b,'only the PayPlus callback is open: '+p);}}
  console.log('STAGING GATEWAY PASSED:',checks,'checks');
}finally{await new Promise(r=>gateway.close(r));await new Promise(r=>upstream.close(r));rmSync(stateDir,{recursive:true,force:true});}
