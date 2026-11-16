import {SHEET_TAB,sheetHeaderGroups,sheetKey} from './sheets-plan';
import {admin,assert,audit,ApiError,now,uid,setting,saveSetting} from './server';
import {acquire,release,ingestSheets,sheetsConfig,sheetsStatus} from './sheets-sync';
import {clearServiceAccount,loadServiceAccount,parseServiceAccount,saveServiceAccount,serviceAccountStatus,signingKey,type ServiceAccount} from './sheets-account';
import type {Row} from './shared';
// Direct Google Sheets connection (16.11.2026). Google blocks the owner's account from authorising an unverified Apps Script
// that sends data out, so the site reads and writes the sheet itself through the Sheets API v4 with a service account the
// sheet is shared with. Every sync step goes through ingestSheets, the same core the Apps Script push uses; this file only
// does what the script did inside Google (read the tab, add missing columns, write the cells back, then send the ack).
export const GOOGLE_TOKEN_URL='https://oauth2.googleapis.com/token';
export const SHEETS_API='https://sheets.googleapis.com/v4/spreadsheets/';
const SCOPE='https://www.googleapis.com/auth/spreadsheets',HISTORY_TAB='היסטוריית סנכרון',PULL_LOCK='sheets_pull_lock',PULL_EVERY=5*60000;
const tokens=new Map<string,{token:string;expires:number}>();
class SyncProblem extends ApiError{constructor(public code:string,message:string){super(409,message);}}
const b64url=(bytes:Uint8Array)=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const text64=(value:string)=>b64url(new TextEncoder().encode(value));
export async function signJwt(account:ServiceAccount,issuedAt=Math.floor(Date.now()/1000)){
 const head=text64(JSON.stringify({alg:'RS256',typ:'JWT',...(account.private_key_id?{kid:account.private_key_id}:{})})),claims=text64(JSON.stringify({iss:account.client_email,scope:SCOPE,aud:GOOGLE_TOKEN_URL,iat:issuedAt,exp:issuedAt+3600}));
 const signature=new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',await signingKey(account.private_key),new TextEncoder().encode(head+'.'+claims)));
 return head+'.'+claims+'.'+b64url(signature);
}
async function send(url:string,init:RequestInit){try{return await fetch(url,{...init,redirect:'manual',signal:AbortSignal.timeout(30000)});}catch{throw new ApiError(502,'אין חיבור ל־Google כרגע. נסו שוב בעוד כמה דקות.');}}
async function body(res:Response):Promise<Row>{try{return await res.json();}catch{return {};}}
function tokenProblem(status:number,j:Row){
 const code=String(j.error||''),detail=String(j.error_description||'');
 if(status===429)return 'Google הגבילה זמנית את מספר הבקשות. נסו שוב בעוד דקה.';
 if(status>=500)return 'Google לא זמינה כרגע. נסו שוב בעוד כמה דקות.';
 if(/signature/i.test(detail))return 'Google דחתה את המפתח. ייתכן שהוא נמחק או הוחלף. צרו מפתח JSON חדש לחשבון השירות והדביקו אותו כאן.';
 if(/not found/i.test(detail)||code==='invalid_client'||code==='unauthorized_client')return 'חשבון השירות לא נמצא או מושבת ב־Google Cloud. בדקו את החשבון והדביקו קובץ JSON חדש.';
 if(/short-lived|iat|exp/i.test(detail))return 'Google דחתה את הבקשה בגלל שעון השרת. נסו שוב בעוד דקה.';
 return 'Google דחתה את פרטי חשבון השירות. הדביקו קובץ JSON חדש.';
}
async function accessToken(account:ServiceAccount,fresh=false){
 const cacheKey=account.client_email+':'+account.private_key_id,cached=tokens.get(cacheKey);
 if(!fresh&&cached&&cached.expires-120000>Date.now())return cached.token;
 const res=await send(GOOGLE_TOKEN_URL,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:await signJwt(account)}).toString()}),j=await body(res);
 if(!res.ok||typeof j.access_token!=='string')throw new ApiError(502,tokenProblem(res.status,j));
 tokens.set(cacheKey,{token:j.access_token,expires:Date.now()+Math.max(60,Number(j.expires_in)||3600)*1000});return j.access_token;
}
// Google's errors in plain Hebrew. `write` turns "permission denied" into "shared as viewer only".
export function googleProblem(status:number,j:Row,email:string,write=false){
 const e=j.error||{},message=String(e.message||''),reasons=JSON.stringify(e.details||[])+JSON.stringify(e.errors||[]);
 if(status===403&&(/SERVICE_DISABLED|accessNotConfigured/.test(reasons)||/has not been used|is disabled|API has not/i.test(message)))return 'Google Sheets API לא מופעל בפרויקט של חשבון השירות. הפעילו אותו ב־Google Cloud (APIs & Services ← Library ← Google Sheets API) ונסו שוב בעוד כמה דקות.';
 if(status===403)return write?'לחשבון השירות יש הרשאת צפייה בלבד. שתפו את השיטס עם '+email+' כעורך.':'השיטס לא שותף עם חשבון השירות. שתפו אותו עם '+email+' כעורך.';
 if(status===404)return 'הגיליון לא נמצא. בדקו שמזהה הגיליון נכון, או הדביקו שוב את כתובת השיטס המלאה.';
 if(status===400&&/parse range/i.test(message))return 'הלשונית "'+SHEET_TAB+'" לא נמצאה בגיליון.';
 if(status===401)return 'Google לא אישרה את הגישה. הדביקו שוב את קובץ ה־JSON של חשבון השירות.';
 if(status===429)return 'Google הגבילה זמנית את מספר הבקשות. נסו שוב בעוד דקה.';
 if(status>=500)return 'Google לא זמינה כרגע. נסו שוב בעוד כמה דקות.';
 return 'Google דחתה את הבקשה'+(message?' ('+message.slice(0,200)+')':'')+'.';
}
type Ctx={account:ServiceAccount;id:string};
async function google(ctx:Ctx,path:string,init:RequestInit={},write=false):Promise<Row>{
 for(let attempt=0;;attempt++){
  const token=await accessToken(ctx.account,attempt>0),res=await send(SHEETS_API+encodeURIComponent(ctx.id)+path,{...init,headers:{...(init.body?{'Content-Type':'application/json'}:{}),Authorization:'Bearer '+token}});
  if(res.status===401&&attempt===0)continue;
  const j=await body(res);if(!res.ok)throw new ApiError(502,googleProblem(res.status,j,ctx.account.client_email,write));return j;
 }
}
const quoted=(tab:string)=>"'"+tab.replace(/'/g,"''")+"'";
export function columnName(n:number){let s='';while(n>0){n--;s=String.fromCharCode(65+n%26)+s;n=Math.floor(n/26);}return s;}
// Same text-forcing as the script's megaLinksSafeCell_: a leading = + @ - stays text under USER_ENTERED.
export const safeCell=(value:any)=>typeof value==='string'&&/^[=+@-]/.test(value)?"'"+value:value;
async function tabs(ctx:Ctx){const j=await google(ctx,'?fields='+encodeURIComponent('properties.title,sheets.properties(sheetId,title,gridProperties(rowCount,columnCount))'));return {title:String(j.properties?.title||''),sheets:(j.sheets||[]).map((s:Row)=>s.properties||{}) as Row[]};}
async function catalogTab(ctx:Ctx){const meta=await tabs(ctx),tab=meta.sheets.find(s=>s.title===SHEET_TAB);assert(tab,'הלשונית "'+SHEET_TAB+'" לא נמצאה בגיליון.',409);return {...meta,tab};}
const serialDate=(serial:number)=>new Date(Date.UTC(1899,11,30)+Math.floor(serial)*86400000).toISOString().slice(0,10);
// Reads like the script's getValues(): a full rectangle up to the last row and column with content, '' for empty cells,
// numbers and booleans as they are, dates as yyyy-MM-dd. Formula cells are marked for the "formula in an editable cell" check.
async function readValues(ctx:Ctx){
 const range=encodeURIComponent(quoted(SHEET_TAB));
 const [shown,formula]=await Promise.all([google(ctx,'/values/'+range+'?majorDimension=ROWS&valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=FORMATTED_STRING'),google(ctx,'/values/'+range+'?majorDimension=ROWS&valueRenderOption=FORMULA&dateTimeRenderOption=SERIAL_NUMBER')]);
 const a:any[][]=shown.values||[],f:any[][]=formula.values||[],height=Math.max(a.length,f.length),width=Math.max(0,...a.map(r=>r.length),...f.map(r=>r.length));
 const rows:any[][]=[],formulas:boolean[][]=[];
 for(let i=0;i<height;i++){const row:any[]=[],marks:boolean[]=[];for(let j=0;j<width;j++){const v=a[i]?.[j],g=f[i]?.[j];const isFormula=typeof g==='string'&&g.startsWith('=')&&g!==v;marks.push(isFormula);row.push(typeof v==='string'&&typeof g==='number'?serialDate(g):v===undefined||v===null?'':v);}rows.push(row);formulas.push(marks);}
 return {rows,formulas};
}
async function readTab(ctx:Ctx){const read=await readValues(ctx),count=read.rows.length,width=read.rows[0]?.length||0;if(count<2||count>5001||width>80)throw new ApiError(400,'הקטלוג חייב להכיל 1 עד 5,000 אתרים ועד 80 עמודות.');return read;}
const missingHeaders=(headers:any[])=>{const names=headers.map(String);return sheetHeaderGroups().filter(g=>!g.some(h=>names.includes(h))).map(g=>g[0]);};
async function grow(ctx:Ctx,sheetId:number,dimension:'ROWS'|'COLUMNS',length:number){if(length>0)await google(ctx,':batchUpdate',{method:'POST',body:JSON.stringify({requests:[{appendDimension:{sheetId,dimension,length}}]})},true);}
// The script adds the connection's missing columns at the end of the header row before every send.
async function addMissingHeaders(ctx:Ctx,tab:Row,headers:any[]){
 const missing=missingHeaders(headers);if(!missing.length)return 0;
 assert(headers.length+missing.length<=80,'אין מקום לעמודות החיבור.',409);
 await grow(ctx,tab.sheetId,'COLUMNS',headers.length+missing.length-Number(tab.gridProperties?.columnCount||0));
 await google(ctx,'/values:batchUpdate',{method:'POST',body:JSON.stringify({valueInputOption:'USER_ENTERED',data:[{range:quoted(SHEET_TAB)+'!'+columnName(headers.length+1)+'1:'+columnName(headers.length+missing.length)+'1',values:[missing]}]})},true);
 return missing.length;
}
const same=(live:any,before:any)=>String(live===undefined||live===null?'':live)===String(before===null||before===undefined?'':before);
function checkLive(live:{rows:any[][];formulas:boolean[][]},original:any[][],output:Row){
 const cells:Row[]=output.cells||[],added:any[][]=output.append||[];
 if(JSON.stringify(live.rows[0])!==JSON.stringify(original[0]))throw new SyncProblem('cell_changed','כותרות הגיליון השתנו במהלך הסנכרון. לא בוצעה כתיבה.');
 if(added.length&&live.rows.length!==output.start_row-1)throw new SyncProblem('append_changed','נוספו שורות בשיטס בזמן הסנכרון. יש להריץ שוב.');
 for(const cell of cells){if(!same(live.rows[cell.row-1]?.[cell.column-1],cell.before))throw new SyncProblem('cell_changed','תא בשיטס השתנה בזמן הסנכרון. השינוי נשמר ונדרש סנכרון חדש.');if(live.formulas[cell.row-1]?.[cell.column-1])throw new SyncProblem('formula','שדה לעריכה מכיל נוסחה. הנוסחה לא נדרסה; בדקו במסך הסנכרון.');}
}
// megaLinksWrite_ in the script, step by step: check the live sheet, log to "היסטוריית סנכרון", write the cells, add the new rows.
async function writeBack(ctx:Ctx,output:Row,original:any[][]){
 const cells:Row[]=output.cells||[],added:any[][]=output.append||[];if(!cells.length&&!added.length)return;
 checkLive(await readTab(ctx),original,output);
 const meta=await catalogTab(ctx);
 if(cells.length){
  if(!meta.sheets.some(s=>s.title===HISTORY_TAB)){await google(ctx,':batchUpdate',{method:'POST',body:JSON.stringify({requests:[{addSheet:{properties:{title:HISTORY_TAB,rightToLeft:true,gridProperties:{frozenRowCount:1}}}}]})},true);await google(ctx,'/values/'+encodeURIComponent(quoted(HISTORY_TAB)+'!A1:E1')+'?valueInputOption=USER_ENTERED',{method:'PUT',body:JSON.stringify({values:[['תאריך','מזהה אתר','שדה','ערך קודם','ערך חדש']]})},true);}
  const stamp=now(),log=cells.map(cell=>[stamp,cell.id,cell.field,safeCell(String(cell.before)),safeCell(String(cell.after))]);
  await google(ctx,'/values/'+encodeURIComponent(quoted(HISTORY_TAB)+'!A1:E1')+':append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS',{method:'POST',body:JSON.stringify({values:log})},true);
 }
 // Checked again right before writing, as the script re-reads every cell before setValue.
 checkLive(await readTab(ctx),original,output);
 const tab=quoted(SHEET_TAB),data:Row[]=cells.map(cell=>({range:tab+'!'+columnName(cell.column)+cell.row,values:[[safeCell(cell.after)]]}));
 if(added.length){
  const start=Number(output.start_row),last=start+added.length-1,headers=original[0].map(String),minimum=headers.indexOf('מינימום ₪'),cost=headers.indexOf('עלות ₪');
  await grow(ctx,meta.tab.sheetId,'ROWS',last-Number(meta.tab.gridProperties?.rowCount||0));
  data.push({range:tab+'!A'+start+':'+columnName(Number(output.columns))+last,values:added.map((row,i)=>row.map((v,j)=>minimum>=0&&cost>=0&&j===minimum?'=IF('+columnName(cost+1)+(start+i)+'="","",'+columnName(cost+1)+(start+i)+'+30)':safeCell(v)))});
 }
 await google(ctx,'/values:batchUpdate',{method:'POST',body:JSON.stringify({valueInputOption:'USER_ENTERED',data})},true);
}
async function context():Promise<Ctx>{const account=await loadServiceAccount();assert(account,'עדיין לא נשמר מפתח של חשבון שירות.',409);return {account,id:(await sheetsConfig()).spreadsheet_id};}
const request=(ctx:Ctx,rows:any[][],extra:Row={})=>ingestSheets({protocol:2,spreadsheet_id:ctx.id,sheet_name:SHEET_TAB,nonce:uid(),sent_at:now(),rows,...extra});
// megaLinksSend_ in the script: add missing columns, read, sync, write back, ack. Never two at a time.
export async function pullSheets(trigger:'manual'|'scheduled'){
 const ctx=await context(),lock=await acquire(PULL_LOCK,300000),started=now();
 await saveSetting('sheets_pull_state',{...await setting('sheets_pull_state',{}),started_at:started,trigger,running:true});
 try{
  const meta=await catalogTab(ctx),first=await readValues(ctx);
  if(first.rows.length)await addMissingHeaders(ctx,meta.tab,first.rows[0]);
  const rows=(await readTab(ctx)).rows;
  let result=await request(ctx,rows);
  if(result.protocol===2&&result.ack&&result.writeback){
   try{await writeBack(ctx,result.writeback,rows);result=await request(ctx,(await readTab(ctx)).rows,{ack:result.ack});}
   catch(e){try{await request(ctx,(await readTab(ctx).catch(()=>({rows}))).rows,{ack:result.ack,writeback_error:e instanceof SyncProblem?e.code:'write_failed'});}catch{/* the first error is the one to show */}throw e;}
  }
  const {writeback,ack,...status}=result;
  await saveSetting('sheets_pull_state',{started_at:started,finished_at:now(),trigger,status:status.status||'received',message:status.message||''});
  return status;
 }catch(e){const message=e instanceof ApiError?e.message:'הסנכרון עם Google נכשל. נסו שוב בעוד כמה דקות.';await saveSetting('sheets_pull_state',{started_at:started,finished_at:now(),trigger,status:'failed',message});throw e instanceof ApiError?e:new ApiError(502,message);}
 finally{await release(lock,PULL_LOCK);}
}
// Called every minute by the maintenance timer; pulls every five minutes when the sync is on and a key is stored.
export async function scheduledSheetsPull(){
 if(!(await sheetsConfig()).enabled||!(await serviceAccountStatus()).key_stored)return {sheets:'off'};
 const last=Date.parse((await setting('sheets_pull_state',{})).started_at||'');if(Number.isFinite(last)&&Date.now()-last<PULL_EVERY-20000)return {sheets:'later'};
 try{const result=await pullSheets('scheduled');return {sheets:result.status||'done'};}catch(e){return {sheets:'failed',message:(e as Error).message};}
}
// "בדיקת חיבור": reads the tab and says what it sees. Writes nothing.
export async function testSheets(){
 const ctx=await context(),meta=await catalogTab(ctx),{rows}=await readValues(ctx),headers=(rows[0]||[]).map(v=>String(v??'').trim()),columns=headers.filter(Boolean).length,known=headers.filter(h=>sheetKey(h)).length,sites=rows.slice(1).filter(r=>r.some(v=>String(v??'').trim())).length,missing=missingHeaders(headers);
 const message='החיבור תקין. בלשונית "'+SHEET_TAB+'" יש '+sites+' אתרים ו־'+columns+' עמודות ('+known+' מוכרות לאתר).'+(missing.length?' חסרות '+missing.length+' עמודות, והן יתווספו בסנכרון הראשון.':'')+' הרשאת עריכה תיבדק בסנכרון הראשון.';
 return {ok:true,title:meta.title,sites,columns,known,missing,message};
}
export async function sheetsGoogleAdmin(request:Request,path:string[],user:Row,readBody:(r:Request)=>Promise<Row>):Promise<Row|null>{
 const action=path[2],method=request.method;
 if(!['service-account','test','pull'].includes(action))return null;admin(user);
 if(action==='service-account'&&method==='POST'){const b=await readBody(request),account=await parseServiceAccount(b.json);await saveServiceAccount(account);tokens.clear();await audit(user,'sheets-sync','שמירת מפתח חשבון שירות לשיטס',{client_email:account.client_email});return sheetsStatus();}
 if(action==='service-account'&&method==='DELETE'){await clearServiceAccount();tokens.clear();await audit(user,'sheets-sync','מחיקת מפתח חשבון שירות לשיטס');return sheetsStatus();}
 if(action==='test'&&method==='POST')return testSheets();
 if(action==='pull'&&method==='POST'){const result=await pullSheets('manual');await audit(user,'sheets-sync','סנכרון עכשיו דרך Google',{status:result.status});return {...await sheetsStatus(),result};}
 throw new ApiError(404,'פעולת סנכרון לא נמצאה');
}
