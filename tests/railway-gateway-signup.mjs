// Open sign-up with Google on the gateway: fake Google and a fake app. No network, fictional data only.
import assert from 'node:assert/strict';
import http from 'node:http';
import {randomBytes} from 'node:crypto';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {createStagingGateway,signupPublicPath} from '../scripts/railway-staging-gateway.mjs';
import {MARKETING_WORDING,TERMS_LINE} from '../scripts/google-signup-pages.mjs';
const hash=randomBytes(64).toString('hex'),salt=randomBytes(16).toString('hex');
const accounts=[{id:'fixture-owner',email:'owner@gmail.com',name:'מנהל',salt,hash}];
const stateDir=mkdtempSync(tmpdir()+'/ml-signup-');const origin='https://staging.example.test',clientId='client-123.apps.googleusercontent.com',automationKey=randomBytes(32).toString('hex');
let claims={};const fakeFetch=async()=>{const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');return new Response(JSON.stringify({id_token:b64({alg:'RS256'})+'.'+b64(claims)+'.sig'}));};
// Fake app: existing@gmail.com is a known customer, boss@gmail.com a known admin; anyone else is new until accepted.
const known={'existing@gmail.com':{id:'u-existing',email:'existing@gmail.com',name:'לקוח קיים',role:'customer'},'boss@gmail.com':{id:'u-boss',email:'boss@gmail.com',name:'מנהלת',role:'admin'}};
const calls=[];
const upstream=http.createServer(async(req,res)=>{let body='';for await(const c of req)body+=c;res.setHeader('Content-Type','application/json');
  if(req.url.startsWith('/api/auth/google/')){const b=JSON.parse(body);calls.push({action:req.url.split('/').pop(),auth:req.headers.authorization,body:b});
    if(req.headers.authorization!=='Bearer '+automationKey){res.statusCode=403;return res.end('{}');}
    if(known[b.email])return res.end(JSON.stringify({status:'ok',user:known[b.email]}));
    if(req.url.endsWith('/accept')){if(b.accepted!==true){res.statusCode=400;return res.end('{}');}known[b.email]={id:'g_new',email:b.email,name:b.name,role:'customer'};return res.end(JSON.stringify({status:'ok',user:known[b.email]}));}
    return res.end(JSON.stringify({status:'new'}));}
  res.end(JSON.stringify({headers:req.headers,url:req.url}));});
await new Promise(r=>upstream.listen(0,'127.0.0.1',r));
const gateway=createStagingGateway({accounts,sessionSecret:randomBytes(32).toString('base64'),origin,upstreamPort:upstream.address().port,stateDir,automationKey,
  google:{clientId,clientSecret:'test-secret',fetch:fakeFetch},adminEmails:['owner@gmail.com']});
await new Promise(r=>gateway.listen(0,'127.0.0.1',r));
const base='http://127.0.0.1:'+gateway.address().port;let checks=0;const check=(v,m)=>{assert(v,m);checks++;};
const req=(p,o={})=>fetch(base+p,{redirect:'manual',...o});
const cookieOf=(r,name)=>(r.headers.getSetCookie().find(c=>c.startsWith(name+'='))||'').split(';')[0];
async function google(email,name='דנה כהן',returnTo='/catalog'){
  const s=await req('/__staging/google/start?return_to='+encodeURIComponent(returnTo));const loc=new URL(s.headers.get('location'));
  claims={iss:'https://accounts.google.com',aud:clientId,exp:Math.floor(Date.now()/1000)+300,nonce:loc.searchParams.get('nonce'),sub:'sub-'+email.split('@')[0],email,email_verified:true,name};
  return req('/__staging/google/callback?code=abc&state='+loc.searchParams.get('state'),{headers:{Cookie:s.headers.get('set-cookie').split(';')[0]}});}
const SIGNUP='__Host-megalinks_staging_signup',SESSION='__Host-megalinks_staging';
const form=(cookie,fields,o=origin)=>req('/__staging/google/terms',{method:'POST',headers:{Cookie:cookie,Origin:o,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(fields)});
try{
  // wording shown = wording saved
  check(readFileSync('lib/marketing-wording.ts','utf8').includes(`MARKETING_WORDING='${MARKETING_WORDING}'`),'newsletter wording matches the saved wording');
  check(readFileSync('lib/google-account.ts','utf8').includes(`TERMS_WORDING='${TERMS_LINE.join('')}'`),'terms wording matches the saved wording');
  // sign-in page = approved design, Google only, test password page kept apart
  let r=await req('/signin-with-chatgpt?return_to=/cart');let page=await r.text();
  check(page.includes('כניסה לחשבון')&&page.includes('ההרשמה בחינם')&&page.includes('href="/__staging/google/start?return_to=%2Fcart"')&&!page.includes('type="password"'),'sign-in page is the Google screen');
  check(page.includes('href="/__staging/password?return_to=%2Fcart"'),'test accounts keep a separate password page');
  r=await req('/__staging/password');check((await r.text()).includes('type="password"'),'password page still works');
  // anonymous visitors: public pages and reading only, with no identity
  for(const p of ['/catalog','/terms','/privacy','/brand/heebo-variable.ttf','/brand/megalinks-logo-dark.png','/api/catalog?q=x']){r=await req(p,{headers:{'oai-authenticated-user-id':'fixture-owner','oai-authenticated-user-email':'owner@gmail.com'}});const seen=await r.json();check(r.status===200&&!seen.headers['oai-authenticated-user-id']&&!seen.headers.cookie,'anonymous read of '+p+' carries no identity');}
  for(const p of ['/admin','/cart','/purchased','/mcp'])check((await req(p)).status===303||(await req(p)).status===401,'private page stays locked: '+p);
  r=await req('/api/cart',{method:'POST',headers:{Origin:origin},body:'{}'});check(r.status===401,'anonymous writes stay locked');
  check(!signupPublicPath('/admin')&&!signupPublicPath('/catalogx')&&signupPublicPath('/knowledge/a-b'),'public path list is exact');
  check(signupPublicPath('/homepage/scrollcraft.js')&&signupPublicPath('/homepage/logos/g1.png')&&!signupPublicPath('/homepage')&&!signupPublicPath('/homepagex/a.js'),'home page files are readable without signing in');
  // new person: terms first, nothing opened before accepting
  r=await google('dana@gmail.com');check(r.status===303&&r.headers.get('location')==='/__staging/google/terms','new person goes to the terms step');
  check(!cookieOf(r,SESSION),'no session before the terms are accepted');const pending=cookieOf(r,SIGNUP);check(pending,'signup step remembered');
  r=await req('/__staging/google/terms',{headers:{Cookie:pending}});page=await r.text();check(page.includes('נשאר רק לאשר את התנאים')&&page.includes('dana@gmail.com')&&page.includes('דנה כהן')&&page.includes(MARKETING_WORDING),'terms step shows who and the exact wording');
  check(!/name="accepted"[^>]*checked/.test(page)&&!/name="marketing"[^>]*checked/.test(page),'both boxes start empty');
  r=await form(pending,{marketing:'1'});check(r.status===400&&!cookieOf(r,SESSION)&&!calls.some(c=>c.action==='accept'),'no account without the terms box (checked on the server)');
  r=await form(pending,{accepted:'1'},'https://attacker.test');check(r.status===403,'cross-site accept refused');
  r=await req('/__staging/google/terms',{headers:{Cookie:pending.slice(0,-2)+'xx'}});check(r.status===303&&r.headers.get('location')==='/signin-with-chatgpt','tampered signup step refused');
  r=await form(pending,{accepted:'1',marketing:'1'});check(r.status===303&&r.headers.get('location')==='/catalog','account opened and back where they were');
  const acc=calls.find(c=>c.action==='accept');check(acc.body.accepted===true&&acc.body.marketing===true&&acc.body.email==='dana@gmail.com'&&acc.auth==='Bearer '+automationKey,'app asked to open the account with consent');
  let set=r.headers.getSetCookie().join('\n');check(set.includes('Max-Age=2592000')&&set.includes(SIGNUP+'=;'),'customer 30 days, signup step cleared');
  r=await req('/api/me',{headers:{Cookie:cookieOf(r,SESSION)}});let d=await r.json();check(d.headers['oai-authenticated-user-id']==='g_new'&&d.headers['oai-authenticated-user-email']==='dana@gmail.com','new account reaches the app');
  // newsletter not ticked: not sent as consent
  r=await google('noam@gmail.com','נועם');r=await form(cookieOf(r,SIGNUP),{accepted:'1'});check(r.status===303&&calls.filter(c=>c.action==='accept').pop().body.marketing===false,'newsletter only when ticked');
  // existing customer: straight in, linked by the app
  r=await google('existing@gmail.com');check(r.status===303&&r.headers.get('location')==='/catalog'&&r.headers.get('set-cookie').includes('Max-Age=2592000'),'existing customer enters at once');
  r=await req('/api/me',{headers:{Cookie:cookieOf(r,SESSION)}});d=await r.json();check(d.headers['oai-authenticated-user-id']==='u-existing','existing customer keeps the same account');
  // administrator: 8 hours
  r=await google('boss@gmail.com','מנהלת','/admin');check(r.status===303&&r.headers.get('set-cookie').includes('Max-Age=28800'),'administrator stays 8 hours');
  // returning person who signed up: straight in
  r=await google('dana@gmail.com');check(r.status===303&&r.headers.get('location')==='/catalog'&&cookieOf(r,SESSION),'returning person enters without the terms step');
  // logout
  const c=cookieOf(r,SESSION);r=await req('/signout-with-chatgpt',{headers:{Cookie:c}});r=await req('/api/me',{headers:{Cookie:c}});d=await r.json();check(!d.headers['oai-authenticated-user-id'],'logout ends a Google session');r=await req('/cart',{headers:{Cookie:c}});check(r.status===303,'logged-out person is sent to sign in');
  // unverified or non-Google address: refused, nothing asked of the app
  const before=calls.length;claims={};r=await google('mallory@example.test');check(r.status===403&&calls.length===before,'unverified address never reaches account opening');
  console.log('GATEWAY SIGNUP PASSED:',checks,'checks');
}finally{await new Promise(r=>gateway.close(r));await new Promise(r=>upstream.close(r));rmSync(stateDir,{recursive:true,force:true});}
