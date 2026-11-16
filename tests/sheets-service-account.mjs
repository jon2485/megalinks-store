// Direct Google Sheets connection through a service account (16.11.2026). Runs the built Worker in Miniflare and answers
// every outbound request with a local fake of Google's token and Sheets endpoints. Nothing ever reaches Google; the RSA key
// is generated here and thrown away. Needs `pnpm build` first.
import assert from 'node:assert/strict';
import {randomBytes,randomUUID,generateKeyPairSync,createVerify} from 'node:crypto';
import {readFileSync,realpathSync,readdirSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(realpathSync('node_modules/wrangler')+'/package.json'),{Miniflare}=require('miniflare');
const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048}),pem=privateKey.export({type:'pkcs8',format:'pem'});
const email='megalinks-sync@fictional-project.iam.gserviceaccount.com',accountJson=JSON.stringify({type:'service_account',project_id:'fictional-project',private_key_id:'fixture-key-1',private_key:pem,client_email:email,client_id:'1',token_uri:'https://oauth2.googleapis.com/token'},null,2);
const pemBody=pem.replace(/-----[^-]+-----|\s/g,''),secretBits=[pemBody.slice(100,160),pemBody.slice(-120,-60),'PRIVATE KEY','ya29.fixture'];
const syncKey=randomBytes(32).toString('base64url'),automation=randomBytes(24).toString('base64url'),SHEET_ID='1_bo5ubja3sLePWSPEVIkc5ySOvhCxRICQBf2VnqNmtE',COPY='Fictional-Copy-Sheet-000000000001',TAB='אתרים',HISTORY='היסטוריית סנכרון';
let checks=0;const ok=(v,m)=>{assert(v,m);checks++;};const eq=(a,b,m)=>{assert.deepEqual(a,b,m);checks++;};

// ---------- fake Google ----------
const serial=d=>(Date.UTC(...d)-Date.UTC(1899,11,30))/86400000;
const fake={shared:true,viewer:false,apiEnabled:true,revoked:false,tokens:[],requests:[],problems:[],onHistoryAppend:null,books:{}};
function cell(raw){if(raw===undefined||raw===null||raw==='')return {v:''};if(typeof raw==='number'||typeof raw==='boolean')return {v:raw};const s=String(raw);if(s.startsWith("'"))return {v:s.slice(1)};if(s.startsWith('='))return {f:s};if(/^-?\d+(\.\d+)?$/.test(s))return {v:Number(s)};const d=s.match(/^(\d{4})-(\d{2})-(\d{2})$/);if(d)return {date:serial([+d[1],+d[2]-1,+d[3]])};return {v:s};}
const book=()=>fake.books[COPY];
function newTab(title,sheetId,rows,cols){return {sheetId,title,rowCount:rows,columnCount:cols,grid:[]};}
function at(tab,r,c){return tab.grid[r]?.[c];}
const letters=s=>[...s].reduce((n,ch)=>n*26+ch.charCodeAt(0)-64,0);
function evaluate(tab,f){const m=f.match(/^=IF\(([A-Z]+)(\d+)="","",\1\2\+30\)$/);if(m){const v=shown(tab,+m[2]-1,letters(m[1])-1);return v===''?'':Number(v)+30;}const c=f.match(/^=CONCAT\("([^"]*)","([^"]*)"\)$/);if(c)return c[1]+c[2];return '';}
function shown(tab,r,c){const x=at(tab,r,c);if(!x)return '';if(x.f)return evaluate(tab,x.f);if(x.date!==undefined){const d=new Date(Date.UTC(1899,11,30)+x.date*86400000);return String(d.getUTCDate()).padStart(2,'0')+'/'+String(d.getUTCMonth()+1).padStart(2,'0')+'/'+d.getUTCFullYear();}return x.v;}
function render(tab,mode){const out=[];for(let r=0;r<tab.grid.length;r++){const row=[];for(let c=0;c<(tab.grid[r]||[]).length;c++){const x=at(tab,r,c);row.push(!x?'':mode==='FORMULA'?(x.f||(x.date!==undefined?x.date:x.v)):shown(tab,r,c));}while(row.length&&row.at(-1)==='')row.pop();out.push(row);}while(out.length&&!out.at(-1).length)out.pop();return out;}
function put(tab,r,c,raw){if(r>=tab.rowCount||c>=tab.columnCount)throw Object.assign(new Error('Range exceeds grid limits'),{status:400});(tab.grid[r]??=[])[c]=cell(raw);}
function parseRange(range){const m=range.match(/^'((?:[^']|'')+)'(?:!([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?)?$/);assert(m,'range '+range);return {title:m[1].replace(/''/g,"'"),c:m[2]?letters(m[2])-1:0,r:m[3]?+m[3]-1:0};}
const gErr=(status,message,extra={})=>Response.json({error:{code:status,message,status:status===403?'PERMISSION_DENIED':status===404?'NOT_FOUND':'INVALID_ARGUMENT',...extra}},{status});
function verifyJwt(assertion){const [h,c,s]=assertion.split('.'),head=JSON.parse(Buffer.from(h,'base64url')),claims=JSON.parse(Buffer.from(c,'base64url'));const v=createVerify('RSA-SHA256');v.update(h+'.'+c);const valid=v.verify(publicKey,Buffer.from(s,'base64url'));if(!valid)fake.problems.push('bad signature');if(head.alg!=='RS256'||head.kid!=='fixture-key-1')fake.problems.push('bad header');if(claims.iss!==email||claims.aud!=='https://oauth2.googleapis.com/token'||claims.scope!=='https://www.googleapis.com/auth/spreadsheets'||claims.exp-claims.iat!==3600||Math.abs(claims.iat-Date.now()/1000)>60)fake.problems.push('bad claims '+JSON.stringify(claims));return valid;}
async function google(request){
 const url=new URL(request.url),text=request.method==='GET'?'':await request.text();fake.requests.push({host:url.hostname,method:request.method,path:decodeURIComponent(url.pathname)});
 for(const bit of secretBits.slice(0,2))if(request.url.includes(bit)||text.includes(bit))fake.problems.push('private key sent to Google');
 if(url.hostname==='oauth2.googleapis.com'&&url.pathname==='/token'&&request.method==='POST'){
  const form=new URLSearchParams(text);if(form.get('grant_type')!=='urn:ietf:params:oauth:grant-type:jwt-bearer')fake.problems.push('grant type');
  if(fake.revoked||!verifyJwt(form.get('assertion')||''))return Response.json({error:'invalid_grant',error_description:'Invalid JWT Signature.'},{status:400});
  const token='ya29.fixture-'+randomUUID();fake.tokens.push(token);return Response.json({access_token:token,expires_in:3599,token_type:'Bearer'});
 }
 if(url.hostname!=='sheets.googleapis.com'){fake.problems.push('unexpected host '+url.hostname);return new Response('no',{status:599});}
 if(!fake.tokens.includes(String(request.headers.get('authorization')||'').replace(/^Bearer /,'')))return gErr(401,'Request had invalid authentication credentials.');
 if(!fake.apiEnabled)return gErr(403,'Google Sheets API has not been used in project 123 before or it is disabled.',{details:[{'@type':'type.googleapis.com/google.rpc.ErrorInfo',reason:'SERVICE_DISABLED'}]});
 const m=url.pathname.match(/^\/v4\/spreadsheets\/([^/:]+)(.*)$/);if(!m)return gErr(404,'Not found');
 const b=fake.books[decodeURIComponent(m[1])],rest=m[2];if(!b)return gErr(404,'Requested entity was not found.');if(!fake.shared)return gErr(403,'The caller does not have permission');
 const write=request.method!=='GET';if(write&&fake.viewer)return gErr(403,'The caller does not have permission');
 const body=text?JSON.parse(text):{};
 try{
  if(rest===''&&request.method==='GET')return Response.json({properties:{title:b.title},sheets:Object.values(b.tabs).map(t=>({properties:{sheetId:t.sheetId,title:t.title,gridProperties:{rowCount:t.rowCount,columnCount:t.columnCount}}}))});
  if(rest===':batchUpdate'){for(const q of body.requests){if(q.appendDimension){const t=Object.values(b.tabs).find(t=>t.sheetId===q.appendDimension.sheetId);if(q.appendDimension.dimension==='ROWS')t.rowCount+=q.appendDimension.length;else t.columnCount+=q.appendDimension.length;}else if(q.addSheet){const p=q.addSheet.properties;if(!p.rightToLeft||p.gridProperties?.frozenRowCount!==1)fake.problems.push('history tab look');b.tabs[p.title]=newTab(p.title,Object.keys(b.tabs).length+1,1000,26);}else fake.problems.push('unknown request');}return Response.json({});}
  if(rest==='/values:batchUpdate'){if(body.valueInputOption!=='USER_ENTERED')fake.problems.push('input option');for(const d of body.data){const {title,r,c}=parseRange(d.range),t=b.tabs[title];d.values.forEach((row,i)=>row.forEach((v,j)=>put(t,r+i,c+j,v)));}return Response.json({});}
  const v=rest.match(/^\/values\/(.+?)(:append)?$/);
  if(v){const range=decodeURIComponent(v[1]),{title,r,c}=parseRange(range),t=b.tabs[title];if(!t)return gErr(400,'Unable to parse range: '+range);
   if(request.method==='GET'){const mode=url.searchParams.get('valueRenderOption'),dates=url.searchParams.get('dateTimeRenderOption');if(mode==='UNFORMATTED_VALUE'&&dates!=='FORMATTED_STRING'||mode==='FORMULA'&&dates!=='SERIAL_NUMBER')fake.problems.push('render options');return Response.json({range,majorDimension:'ROWS',values:render(t,mode)});}
   if(v[2]){if(title===HISTORY&&fake.onHistoryAppend){const hook=fake.onHistoryAppend;fake.onHistoryAppend=null;hook();}let last=render(t,'FORMULA').length;if(last+body.values.length>t.rowCount)t.rowCount=last+body.values.length;body.values.forEach((row,i)=>row.forEach((x,j)=>put(t,last+i,j,x)));return Response.json({});}
   if(request.method==='PUT'){body.values.forEach((row,i)=>row.forEach((x,j)=>put(t,r+i,c+j,x)));return Response.json({});}
  }
  return gErr(404,'Not found');
 }catch(e){return gErr(e.status||500,e.message);}
}
const sheetTab=()=>book().tabs[TAB],sheetRows=()=>render(sheetTab(),'UNFORMATTED'),col=name=>sheetRows()[0].indexOf(name);
const rowOf=id=>sheetRows().findIndex(r=>r[col('מזהה אתר')]===id);
const sheetSet=(id,name,raw)=>put(sheetTab(),rowOf(id),col(name),raw);
const sheetGet=(id,name)=>sheetRows()[rowOf(id)][col(name)];
{const t=newTab(TAB,7,2,10),head=['מזהה אתר','שם האתר','כתובת אתר','קטגוריה','מחיר מחירון ₪','עלות ₪','פעיל','הערות לאתר','סיום מבצע','מינימום ₪'];fake.books[COPY]={title:'עותק בדיקה',tabs:{[TAB]:t}};head.forEach((h,i)=>put(t,0,i,h));['a','אתר א','https://a.example/','general',200,100,'כן','ישן','2026-12-31','=IF(F2="","",F2+30)'].forEach((x,i)=>put(t,1,i,x));}

// ---------- worker ----------
const mf=new Miniflare({outboundService:google,modules:[{type:'ESModule',path:'dist/server/index.js'},...readdirSync('dist/server',{recursive:true}).filter(p=>/\.(m?js)$/.test(p)&&p!=='index.js').map(p=>({type:'ESModule',path:'dist/server/'+p}))],compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],r2Buckets:['BUCKET'],bindings:{SETTINGS_ENCRYPTION_KEY:randomBytes(32).toString('base64'),POSTFLOW_OWNER_EMAIL:'owner@example.test',POSTFLOW_SHEETS_SYNC_KEY:syncKey,POSTFLOW_AUTOMATION_KEY:automation},assets:{directory:'dist/client',binding:'ASSETS',routerConfig:{has_user_worker:true,invoke_user_worker_ahead_of_assets:true}},cf:false});
async function req(path,method='GET',body,user='owner',status=200,authorization){const headers={'Content-Type':'application/json'};if(user){headers['oai-authenticated-user-id']=user;headers['oai-authenticated-user-email']=user+'@example.test';}if(authorization)headers.Authorization=authorization;const res=await mf.dispatchFetch('https://postflow.test/api/'+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)}),raw=await res.text();for(const bit of secretBits)assert(!raw.includes(bit),'response of '+path+' leaks a secret ('+bit.slice(0,12)+'…)');const j=JSON.parse(raw);assert.equal(res.status,status,path+': '+raw.slice(0,400));checks++;return j;}
const pull=(status=200)=>req('admin/sheets/pull','POST',{},'owner',status);
let db;const price=async(id='a')=>Number((await db.prepare('SELECT price FROM websites WHERE id=?').bind(id).first()).price),notes=async(id='a')=>JSON.parse((await db.prepare('SELECT data FROM websites WHERE id=?').bind(id).first()).data).public_notes;
const edit=async(values,site='a')=>{const c=await req('catalog?scope=admin'),w=c.websites.find(w=>w.id===site);return req('admin/catalog-bulk','POST',{pricing_version:c.pricing_version,rows:[{id:site,create:false,expected_updated:w.updated,values}]});};
const status=()=>req('admin/sheets');
try{
 db=await mf.getD1Database('DB');for(const m of readdirSync('drizzle').filter(x=>x.endsWith('.sql')).sort())for(const part of readFileSync('drizzle/'+m,'utf8').split('--> statement-breakpoint').map(x=>x.trim()).filter(Boolean))await db.prepare(part).run();
 await req('me');await req('me','GET',undefined,'customer');await req('catalog?scope=admin');await db.prepare('DELETE FROM websites').run();
 for(const [id,name,url,p,data] of [['a','אתר א','https://a.example/',20000,{cost_cents:10000,public_notes:'ישן',sale_ends:'2026-12-31'}],['b','אתר ב','https://b.example/',30000,{cost_cents:10000}]])await db.prepare('INSERT INTO websites(id,name,url,category,price,dr,active,data,updated) VALUES (?,?,?,?,?,?,?,?,?)').bind(id,name,url,'general',p,0,1,JSON.stringify(data),'2026-01-01').run();
 await req('admin/sheets/config','POST',{enabled:true});

 // Key: refused shapes, admin only, stored encrypted, only the e-mail comes back.
 let s=await status();eq(s.service_account.key_stored,false);eq(s.spreadsheet_id,SHEET_ID,'default sheet id');
 await req('admin/sheets/service-account','POST',{json:accountJson},'customer',403);await req('admin/sheets/pull','POST',{},'customer',403);await req('admin/sheets/test','POST',{},'customer',403);await req('admin/sheets/spreadsheet','POST',{spreadsheet_id:COPY},'customer',403);
 for(const [bad,word] of [['{not json','JSON'],[JSON.stringify({type:'authorized_user',client_email:email,private_key:pem}),'חשבון שירות'],[JSON.stringify({type:'service_account',private_key:pem}),'client_email'],[JSON.stringify({type:'service_account',client_email:email}),'private_key'],[JSON.stringify({type:'service_account',client_email:email,private_key:'-----BEGIN PRIVATE KEY-----\nAAAA\n-----END PRIVATE KEY-----\n'}),'פגום'],['','הדביקו']]){const r=await req('admin/sheets/service-account','POST',{json:bad},'owner',400);ok(r.error.includes(word),'Hebrew error for bad key: '+r.error);}
 eq((await status()).service_account.key_stored,false,'refused key is not stored');
 await req('admin/sheets/pull','POST',{},'owner',409);
 s=await req('admin/sheets/service-account','POST',{json:accountJson});eq(s.service_account.client_email,email);eq(s.service_account.key_stored,true);
 const stored=(await db.prepare("SELECT value FROM settings WHERE key='sheets_service_account'").first()).value;ok(!stored.includes('PRIVATE KEY')&&!stored.includes(secretBits[0]),'private key is encrypted at rest');
 const activity=JSON.stringify((await db.prepare("SELECT action,data FROM activity WHERE resource='sheets-sync'").all()).results);ok(!activity.includes(secretBits[0]),'audit has no key');

 // Which sheet: the configured id, never the default once changed. The push path follows it.
 await req('admin/sheets/spreadsheet','POST',{spreadsheet_id:'bad id!'},'owner',400);
 s=await req('admin/sheets/spreadsheet','POST',{spreadsheet_id:'https://docs.google.com/spreadsheets/d/'+COPY+'/edit#gid=7'});eq(s.spreadsheet_id,COPY,'id taken from a pasted address');
 const pushBody=id=>({protocol:2,spreadsheet_id:id,sheet_name:TAB,nonce:randomUUID(),sent_at:new Date().toISOString(),rows:[['מזהה אתר','שם האתר','כתובת אתר','קטגוריה','מחיר מחירון ₪'],['a','אתר א','https://a.example/','general',200]]});
 await req('sheets-sync/push','POST',pushBody(SHEET_ID),null,403,'Bearer '+syncKey);

 // Connection test and Google's errors in Hebrew.
 fake.shared=false;let r=await req('admin/sheets/test','POST',{},'owner',502);ok(r.error.includes('לא שותף')&&r.error.includes(email),r.error);fake.shared=true;
 fake.apiEnabled=false;r=await req('admin/sheets/test','POST',{},'owner',502);ok(r.error.includes('Google Sheets API לא מופעל'),r.error);fake.apiEnabled=true;
 await req('admin/sheets/spreadsheet','POST',{spreadsheet_id:'Fictional-Missing-Sheet-0000000002'});r=await req('admin/sheets/test','POST',{},'owner',502);ok(r.error.includes('הגיליון לא נמצא'),r.error);await req('admin/sheets/spreadsheet','POST',{spreadsheet_id:COPY});
 r=await req('admin/sheets/test','POST',{});ok(r.ok&&r.sites===1&&r.columns===10&&r.known===9&&r.missing.length>20,JSON.stringify(r));ok(r.message.includes('1 אתרים')&&r.message.includes('10 עמודות'),r.message);
 eq(fake.tokens.length,1,'token cached between calls');ok(!fake.requests.some(q=>q.method!=='GET'&&q.host==='sheets.googleapis.com'),'test writes nothing');

 // First pull: missing columns added, site-only values written, the site that is not in the sheet appended, ack recorded.
 r=await pull();eq(r.result.status,'success',JSON.stringify(r.result));eq(r.status,'success');eq(r.connection_protocol,2);eq(r.pull.trigger,'manual');
 let rows=sheetRows();ok(rows[0].includes('שם ספק')&&rows[0].includes('DR')&&rows[0].length>30,'missing columns added');ok(sheetTab().columnCount>=rows[0].length,'grid grew');
 eq(sheetGet('b','שם האתר'),'אתר ב','new site appended');eq(sheetGet('b','מחיר מחירון ₪'),300);eq(render(sheetTab(),'FORMULA')[rowOf('b')][col('מינימום ₪')],'=IF(F3="","",F3+30)','minimum formula on the appended row');eq(sheetGet('b','מינימום ₪'),130);
 eq(sheetGet('a','מלאי'),'חודשי');eq(sheetGet('a','סיום מבצע'),'31/12/2026','date cell kept');eq(await price(),20000);
 const history=book().tabs[HISTORY];ok(history,'history tab created');eq(render(history,'FORMULA')[0],['תאריך','מזהה אתר','שדה','ערך קודם','ערך חדש']);ok(render(history,'FORMULA').length>2,'history rows written');
 eq(fake.problems,[],'fake Google saw no problem');

 // Site change goes to the sheet; formula-looking text is written as text.
 await edit({price_ils:300,public_notes:'=1+1'});r=await pull();eq(r.result.status,'success');eq(sheetGet('a','מחיר מחירון ₪'),300);const notesCell=at(sheetTab(),rowOf('a'),col('הערות לאתר'));eq(notesCell,{v:'=1+1'},'escaped, not a formula');
 // Sheet change reaches the site.
 sheetSet('a','מחיר מחירון ₪',350);r=await pull();eq(r.result.status,'success');eq(await price(),35000);
 // Same field in both: conflict, nothing overwritten; resolved like the push path.
 await edit({price_ils:500});sheetSet('a','מחיר מחירון ₪',450);r=await pull();eq(r.result.status,'conflict');eq(r.result.conflict_count,1);eq(await price(),50000);eq(sheetGet('a','מחיר מחירון ₪'),450);
 let preview=await req('admin/sheets/preview','POST',{});await req('admin/sheets/apply','POST',{digest:preview.digest,pricing_version:preview.pricing_version,resolutions:{'a:price_ils':'site'}});r=await pull();eq(r.result.status,'success');eq(sheetGet('a','מחיר מחירון ₪'),500,'site choice written to the sheet');
 // Formula in an editable cell is never overwritten.
 sheetSet('a','הערות לאתר','=CONCAT("a","b")');r=await pull();eq(r.result.status,'success');eq(await notes(),'ab');
 await edit({public_notes:'מהאתר'});r=await req('admin/sheets/pull','POST',{},'owner',409);ok(r.error.includes('נוסחה'),r.error);eq((await status()).status,'writeback_failed');eq(render(sheetTab(),'FORMULA')[rowOf('a')][col('הערות לאתר')],'=CONCAT("a","b")','formula kept');eq(await notes(),'מהאתר');
 sheetSet('a','הערות לאתר','ab');r=await pull();eq(r.result.status,'success');eq(sheetGet('a','הערות לאתר'),'מהאתר');
 // Cell changed during the sync: stop, report, next run sees a conflict.
 await edit({price_ils:600});fake.onHistoryAppend=()=>sheetSet('a','מחיר מחירון ₪',610);r=await req('admin/sheets/pull','POST',{},'owner',409);ok(r.error.includes('השתנה'),r.error);eq(sheetGet('a','מחיר מחירון ₪'),610,'the live edit is kept');eq(await price(),60000);eq((await status()).status,'writeback_failed');
 r=await pull();eq(r.result.status,'conflict');preview=await req('admin/sheets/preview','POST',{});await req('admin/sheets/apply','POST',{digest:preview.digest,pricing_version:preview.pricing_version,conflict_policy:'sheet'});eq(await price(),61000);r=await pull();eq(r.result.status,'success');
 // Header changed during the sync.
 await edit({price_ils:620});fake.onHistoryAppend=()=>put(sheetTab(),0,col('הערות לאתר'),'הערות');r=await req('admin/sheets/pull','POST',{},'owner',409);ok(r.error.includes('כותרות'),r.error);put(sheetTab(),0,col('הערות'),'הערות לאתר');r=await pull();eq(r.result.status,'success');eq(sheetGet('a','מחיר מחירון ₪'),620);
 // Shared as viewer only.
 await edit({price_ils:640});fake.viewer=true;r=await req('admin/sheets/pull','POST',{},'owner',502);ok(r.error.includes('צפייה בלבד'),r.error);fake.viewer=false;r=await pull();eq(r.result.status,'success');eq(sheetGet('a','מחיר מחירון ₪'),640);
 // Overlapping runs.
 await db.prepare("UPDATE settings SET value=? WHERE key='sheets_pull_lock'").bind(JSON.stringify({token:'other',expires:Date.now()+60000})).run();r=await req('admin/sheets/pull','POST',{},'owner',409);ok(r.error.includes('סנכרון אחר'),r.error);await db.prepare("UPDATE settings SET value='{}' WHERE key='sheets_pull_lock'").run();

 // Every five minutes from the maintenance timer, only when on and a key is stored.
 const googleCalls=()=>fake.requests.length,wait=ms=>new Promise(f=>setTimeout(f,ms));
 const tick=async()=>{const res=await mf.dispatchFetch('https://postflow.test/api/maintenance/scheduled-articles',{method:'POST',headers:{Authorization:'Bearer '+automation}});assert.equal(res.status,200);await res.text();checks++;};
 let before=googleCalls();await tick();await wait(800);eq(googleCalls(),before,'not again within five minutes');
 const age=async()=>{const st=await db.prepare("SELECT value FROM settings WHERE key='sheets_pull_state'").first();await db.prepare("UPDATE settings SET value=? WHERE key='sheets_pull_state'").bind(JSON.stringify({...JSON.parse(st.value),started_at:new Date(Date.now()-6*60000).toISOString()})).run();};
 await edit({price_ils:660});await age();await tick();for(let i=0;i<50&&!((s=await status()).pull.trigger==='scheduled'&&s.pull.finished_at&&!s.pull.running);i++)await wait(200);eq(s.pull.trigger,'scheduled');eq(s.pull.status,'success');eq(sheetGet('a','מחיר מחירון ₪'),660,'scheduled pull wrote the sheet');
 await req('admin/sheets/config','POST',{enabled:false});eq((await status()).spreadsheet_id,COPY,'pausing keeps the sheet id');await age();before=googleCalls();await tick();await wait(800);eq(googleCalls(),before,'paused: no scheduled pull');await req('admin/sheets/config','POST',{enabled:true});

 // Owner 16.11.2026, "what is not in the sheet disappears from the site": a row deleted from the sheet comes back while its site is active;
 // after hiding the sites that are not in the sheet, the site is hidden (not deleted) and stays out of the sheet.
 {const active=async id=>Number((await db.prepare('SELECT active FROM websites WHERE id=?').bind(id).first()).active);
  eq(await active('b'),1,'b starts active');sheetTab().grid.splice(rowOf('b'),1);eq(rowOf('b'),-1,'row b deleted from the sheet');
  r=await pull();eq(r.result.status,'success');ok(rowOf('b')>0,'an active site deleted from the sheet comes back');
  await req('admin/sheets/config','POST',{enabled:false});sheetTab().grid.splice(rowOf('b'),1);r=await pull();
  let p=await req('admin/sheets/preview','POST',{});eq(p.missing_active,1,'one active site is not in the sheet');
  r=await req('admin/sheets/hide-missing','POST',{digest:'stale'},'owner',409);ok(r.error.includes('השתנו'),'an old preview cannot hide');
  await req('admin/sheets/hide-missing','POST',{digest:p.digest},'customer',403);
  r=await req('admin/sheets/hide-missing','POST',{digest:p.digest});eq(r.hidden,1);eq(await active('b'),0,'b hidden on the site');eq(await active('a'),1,'a, which is in the sheet, untouched');
  ok(await db.prepare('SELECT id FROM websites WHERE id=?').bind('b').first(),'b is hidden, not deleted');
  await req('admin/sheets/config','POST',{enabled:true});r=await pull();eq(r.result.status,'success');eq(rowOf('b'),-1,'a hidden site stays out of the sheet');
  p=await req('admin/sheets/preview','POST',{});eq(p.missing_active,0);eq(p.missing,1,'counted as a hidden site that is not in the sheet');}
 // A replaced key clears the token cache; a revoked key gets a plain Hebrew answer.
 const tokensBefore=fake.tokens.length;await req('admin/sheets/service-account','POST',{json:accountJson});fake.revoked=true;r=await req('admin/sheets/test','POST',{},'owner',502);ok(r.error.includes('Google דחתה את המפתח'),r.error);fake.revoked=false;await req('admin/sheets/test','POST',{});eq(fake.tokens.length,tokensBefore+1);
 // The Apps Script push still works against the configured sheet.
 r=await req('sheets-sync/push','POST',pushBody(COPY),null,200,'Bearer '+syncKey);ok(r.status,'push answered');
 // Another sheet starts like a first connection: the old sheet's synced values are dropped, so a difference waits for a choice.
 s=await req('admin/sheets/spreadsheet','POST',{spreadsheet_id:'Fictional-Other-Sheet-00000000003'});eq(s.has_snapshot,false,'a different sheet starts without the old snapshot');eq(s.connection_protocol,1,'and without the old receipt');
 await req('admin/sheets/spreadsheet','POST',{spreadsheet_id:COPY});await edit({price_ils:700});r=await pull();eq(r.result.status,'conflict','after a sheet change a site/sheet difference is not merged against old values');eq(sheetGet('a','מחיר מחירון ₪'),660,'the sheet value is kept until the owner chooses');
 // Deleting the key stops the direct sync.
 s=await req('admin/sheets/service-account','DELETE');eq(s.service_account.key_stored,false);eq(s.service_account.client_email,'');await req('admin/sheets/pull','POST',{},'owner',409);
 eq(fake.problems,[],'fake Google saw no problem');ok(fake.requests.every(q=>['oauth2.googleapis.com','sheets.googleapis.com'].includes(q.host)),'only the fake Google was called');
 console.log('SHEETS SERVICE ACCOUNT PASSED:',checks,'checks: key validation and encryption, signed JWT and token cache, Hebrew Google errors, configured sheet id, header columns, cell and append writeback, history tab, formula and live-change protection, conflicts, viewer share, overlap lock, five-minute schedule. Fake Google only.');
}finally{await mf.dispose();}
