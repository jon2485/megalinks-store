// Google sign-in on the gateway, with a fake token endpoint. No network.
import assert from 'node:assert/strict';
import http from 'node:http';
import {randomBytes} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {createStagingGateway} from '../scripts/railway-staging-gateway.mjs';
const hash=randomBytes(64).toString('hex'),salt=randomBytes(16).toString('hex');
const accounts=[{id:'fixture-owner',email:'owner@gmail.com',name:'מנהל',salt,hash},{id:'fixture-customer',email:'customer@gmail.com',name:'לקוח',salt,hash}];
const stateDir=mkdtempSync(tmpdir()+'/ml-google-');const origin='https://staging.example.test',clientId='client-123.apps.googleusercontent.com';
let claims={},tokenStatus=200,lastBody=null;
const fakeFetch=async(url,init)=>{assert.equal(url,'https://oauth2.googleapis.com/token');lastBody=new URLSearchParams(init.body);
  const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');return new Response(JSON.stringify({id_token:b64({alg:'RS256'})+'.'+b64(claims)+'.sig'}),{status:tokenStatus});};
const upstream=http.createServer((req,res)=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify({headers:req.headers}));});
await new Promise(r=>upstream.listen(0,'127.0.0.1',r));
const gateway=createStagingGateway({accounts,sessionSecret:randomBytes(32).toString('base64'),origin,upstreamPort:upstream.address().port,stateDir,
  google:{clientId,clientSecret:'test-secret',fetch:fakeFetch},adminEmails:['owner@gmail.com']});
await new Promise(r=>gateway.listen(0,'127.0.0.1',r));
const base='http://127.0.0.1:'+gateway.address().port;let checks=0;const check=(v,m)=>{assert(v,m);checks++;};
const req=(p,o={})=>fetch(base+p,{redirect:'manual',...o});
async function start(returnTo='/catalog'){const r=await req('/__staging/google/start?return_to='+encodeURIComponent(returnTo));const loc=new URL(r.headers.get('location'));
  return {r,loc,flow:r.headers.get('set-cookie').split(';')[0],state:loc.searchParams.get('state'),nonce:loc.searchParams.get('nonce')};}
const good=(nonce,email='customer@gmail.com')=>({iss:'https://accounts.google.com',aud:clientId,exp:Math.floor(Date.now()/1000)+300,nonce,sub:'g-'+email,email,email_verified:true});
try{
  let r=await req('/signin-with-chatgpt');let page=await r.text();check(page.includes('/__staging/google/start')&&page.includes('כניסה עם Google'),'login page offers Google');
  let s=await start();check(s.r.status===303&&s.loc.origin+s.loc.pathname==='https://accounts.google.com/o/oauth2/v2/auth','start sends to Google');
  check(s.loc.searchParams.get('redirect_uri')===origin+'/__staging/google/callback'&&s.loc.searchParams.get('code_challenge_method')==='S256'&&s.loc.searchParams.get('scope')==='openid email profile','PKCE, exact redirect, basic scopes');
  check(/HttpOnly.*Secure.*SameSite=Lax/.test(s.r.headers.get('set-cookie')),'flow cookie is protected');
  // customer: 30 days, verified identity reaches the app
  claims=good(s.nonce);r=await req('/__staging/google/callback?code=abc&state='+s.state,{headers:{Cookie:s.flow}});
  check(r.status===303&&r.headers.get('location')==='/catalog','customer signed in and returned');check(lastBody.get('code_verifier')&&lastBody.get('client_secret')==='test-secret','code exchanged with verifier and secret');
  const set=r.headers.get('set-cookie');check(set.includes('Max-Age=2592000'),'customer stays 30 days');const cookie=set.split(';')[0];
  r=await req('/api/me',{headers:{Cookie:cookie}});let d=await r.json();check(d.headers['oai-authenticated-user-id']==='fixture-customer'&&d.headers['oai-authenticated-user-email']==='customer@gmail.com','Google session maps to the configured account');
  // admin: 8 hours
  s=await start('/admin');claims=good(s.nonce,'owner@gmail.com');r=await req('/__staging/google/callback?code=abc&state='+s.state,{headers:{Cookie:s.flow}});check(r.status===303&&r.headers.get('set-cookie').includes('Max-Age=28800'),'administrator stays 8 hours');
  // refusals
  const refused=async(mutate,status,label,opts={})=>{const s=await start();claims={...good(s.nonce),...mutate(s)};const q=opts.query?opts.query(s):'?code=abc&state='+s.state;
    const r=await req('/__staging/google/callback'+q,{headers:opts.noCookie?{}:{Cookie:s.flow}});check(r.status===status&&!/megalinks_staging=[^;]/.test(r.headers.get('set-cookie')||''),label);};
  await refused(()=>({email:'stranger@gmail.com',sub:'x'}),403,'unknown account refused');
  await refused(()=>({email_verified:false}),403,'unverified email refused');
  await refused(()=>({email:'customer@gmail.com.evil.test'}),403,'non-Gmail without Workspace domain refused');
  await refused(()=>({aud:'other-client'}),400,'wrong audience refused');
  await refused(()=>({nonce:'replayed'}),400,'wrong nonce refused');
  await refused(()=>({iss:'https://evil.test'}),400,'wrong issuer refused');
  await refused(()=>({exp:1}),400,'expired token refused');
  await refused(()=>({}),400,'wrong state refused',{query:s=>'?code=abc&state=x'+s.state.slice(1)});
  await refused(()=>({}),400,'missing flow cookie refused',{noCookie:true});
  await refused(()=>({}),400,'cancel at Google handled',{query:s=>'?error=access_denied&state='+s.state});
  tokenStatus=400;await refused(()=>({}),502,'Google rejection handled');tokenStatus=200;
  // production gateway without Google: no button, no routes
  const plain=createStagingGateway({accounts,sessionSecret:randomBytes(32).toString('base64'),origin,upstreamPort:upstream.address().port,stateDir:stateDir+'/p'});
  await new Promise(r=>plain.listen(0,'127.0.0.1',r));const pb='http://127.0.0.1:'+plain.address().port;
  page=await (await fetch(pb+'/signin-with-chatgpt')).text();check(!page.includes('Google'),'no Google without configuration');
  r=await fetch(pb+'/__staging/google/start',{redirect:'manual'});check(r.status===303&&r.headers.get('location').startsWith('/signin-with-chatgpt'),'routes closed without configuration');
  await new Promise(r=>plain.close(r));
  console.log('GATEWAY GOOGLE PASSED:',checks,'checks');
}finally{await new Promise(r=>gateway.close(r));await new Promise(r=>upstream.close(r));rmSync(stateDir,{recursive:true,force:true});}
