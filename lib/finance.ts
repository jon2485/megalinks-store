import {orderSummarySql,fullyCancelledOrderSql} from './order-summary';
import {env} from 'cloudflare:workers';
import {Row,money} from './shared';
import {admin,assert,all,one,stmt,db,parse,uid,now,setting,saveSetting,audit,hash,owns} from './server';
import {queueMail} from './mail';

export const isTopUp = (row:Row) => row.kind==='wallet_topup'||(row.kind==='ticket'&&row.payment_method==='bank_transfer'&&Number(row.amount_cents)>0);
const topupWhere="(r.kind='wallet_topup' OR (r.kind='ticket' AND json_extract(r.data,'$.payment_method')='bank_transfer' AND json_extract(r.data,'$.amount_cents')>0))";
const topupStatus="COALESCE(json_extract(r.data,'$.decision'),'pending')";
const output=(data:any,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
const text=(value:any,max=200)=>String(value||'').trim().slice(0,max);
async function safeMail(id:string,userId:string,data:Row){try{return await queueMail(id,userId,data);}catch{return {status:'failed'};}}
export async function financeRoutes(r:Request,p:string[],u:Row,readBody:(r:Request)=>Promise<Row>){
 const query=new URL(r.url).searchParams,origin=new URL(r.url).origin;
 if(p[0]==='bank-details'){
  if(r.method==='GET')return output({bank:await setting('bank_details',null)});
  admin(u);assert(r.method==='PATCH','פעולה לא נתמכת',405);const b=await readBody(r);
  const bank={bank_name:text(b.bank_name,100),bank_number:text(b.bank_number,10),branch:text(b.branch,20),account:text(b.account,40),holder:text(b.holder,200)};
  assert(Object.values(bank).every(Boolean),'יש למלא את כל פרטי הבנק');assert(/^\d+$/.test(bank.bank_number)&&/^\d+$/.test(bank.branch)&&/^\d[\d -]*$/.test(bank.account),'מספרי הבנק אינם תקינים');
  await saveSetting('bank_details',bank);await audit(u,'bank_details','פרטי בנק עודכנו');return output({ok:true});
 }
 if(p[0]==='wallet-topups'){
  if(r.method==='GET'&&!p[1]){
   const scope=u.role==='admin'&&query.get('scope')==='all';const page=Math.max(1,Math.floor(Number(query.get('page'))||1));
   const filters=[topupWhere],args:any[]=[];
   if(!scope){filters.push('r.user_id=?');args.push(u.id);}
   const state=query.get('status');if(state&&state!=='all'){assert(['pending','approved','rejected'].includes(state),'סטטוס לא תקין');filters.push(topupStatus+'=?');args.push(state);}
   const search=text(query.get('search'));if(search){filters.push("(u.name||' '||u.email||' '||COALESCE(json_extract(r.data,'$.reference'),'')) LIKE ? ESCAPE '\\'");args.push('%'+search.replace(/[\\%_]/g,'\\$&')+'%');}
   const where=filters.join(' AND '),total=await one('SELECT COUNT(*) AS n FROM records r JOIN users u ON u.id=r.user_id WHERE '+where,...args);
   const rows=await all('SELECT r.*,u.name AS user_name,u.email,u.credits AS balance,actor.name AS handled_by_name,f.type AS proof_type,j.status AS mail_status FROM records r JOIN users u ON u.id=r.user_id LEFT JOIN users actor ON actor.id=json_extract(r.data,\'$.handled_by\') LEFT JOIN files f ON f.id=json_extract(r.data,\'$.proof_file_id\') LEFT JOIN jobs j ON j.id=\'email:decision:\'||r.id WHERE '+where+' ORDER BY r.created DESC LIMIT 30 OFFSET ?',...args,(page-1)*30);
   const summary=await one(`SELECT SUM(CASE WHEN ${topupStatus}='pending' THEN 1 ELSE 0 END) AS pending,SUM(CASE WHEN ${topupStatus}='pending' THEN json_extract(r.data,'$.amount_cents') ELSE 0 END) AS pending_amount,SUM(CASE WHEN ${topupStatus}='approved' THEN 1 ELSE 0 END) AS approved,SUM(CASE WHEN ${topupStatus}='rejected' THEN 1 ELSE 0 END) AS rejected FROM records r WHERE ${topupWhere}${scope?'':' AND r.user_id=?'}`,...(scope?[]:[u.id]));
   return output({requests:rows.map(row=>({...parse(row),decision:parse(row)?.decision||'pending'})),total:total?.n||0,page,summary});
  }
  if(r.method==='POST'&&!p[1]){
   const b=await readBody(r),amount=Number(b.amount_cents),reference=text(b.reference),requestId=text(b.request_id,80);
   assert(Number.isSafeInteger(amount)&&amount>0&&amount<=100000000,'סכום אינו תקין');assert(reference,'יש להזין אסמכתא');assert(/^[\w-]{8,80}$/.test(requestId),'מזהה הבקשה אינו תקין');
   if(b.proof_file_id){const f=owns(u,await one('SELECT * FROM files WHERE id=?',b.proof_file_id));assert(f.user_id===u.id&&['image/png','image/jpeg','image/webp','application/pdf'].includes(f.type)&&f.size<=15*1024*1024,'מסמך ההעברה אינו תקין');assert(await env.BUCKET?.head(f.key),'המסמך לא נמצא',404);}
   const id='topup:'+u.id+':'+requestId,existing=await one('SELECT * FROM records WHERE id=?',id);if(existing){const prior=parse(existing)!;assert(prior.amount_cents===amount&&prior.reference===reference&&String(prior.proof_file_id||'')===String(b.proof_file_id||''),'הבקשה כבר נשמרה עם פרטים אחרים. יש לפתוח בקשה חדשה',409);return output({id,duplicate:true});}
   const data={name:'בקשת טעינת יתרה',payment_method:'bank_transfer',amount_cents:amount,reference,proof_file_id:b.proof_file_id||'',decision:'pending',status:'open'};
   await stmt('INSERT OR IGNORE INTO records(id,kind,user_id,data,created,updated) VALUES (?,?,?,?,?,?)',id,'wallet_topup',u.id,JSON.stringify(data),now(),now()).run();await audit(u,id,'בקשת הטענת יתרה נשלחה',{amount,reference});
   const recipients=new Set([...(await all("SELECT email FROM users WHERE role='admin'")).map(x=>x.email),String((env as any).POSTFLOW_OWNER_EMAIL||''),...String((env as any).POSTFLOW_ADMIN_EMAILS||'').split(',')].map(x=>x.trim()).filter(Boolean));for(const email of recipients)await safeMail('email:new:'+id+':'+email,u.id,{to:email,subject:'בקשת הטענת יתרה חדשה',text:u.name+'\n'+money(amount)+'\nאסמכתא: '+reference,button:{label:'טיפול בבקשה',url:origin+'/admin-topups'}});
   return output({id},201);
  }
  admin(u);assert(r.method==='POST'&&['approve','reject'].includes(p[2]),'פעולה לא נתמכת',405);
  const row=parse(await one('SELECT * FROM records WHERE id=?',p[1]));assert(row&&isTopUp(row),'בקשת הטענה לא נמצאה',404);
  const b=await readBody(r),decision=p[2]==='approve'?'approved':'rejected',note=text(b.note,1500);
  if(row.decision&&row.decision!=='pending'){assert(row.decision===decision,'הבקשה כבר טופלה בהחלטה אחרת',409);return output({ok:true,duplicate:true});}
  if(decision==='rejected')assert(note,'יש לציין סיבת דחייה');else assert(b.confirmed===true,'יש לאשר שהכספים התקבלו בפועל');
  const amount=Number(row.amount_cents);assert(Number.isSafeInteger(amount)&&amount>0&&amount<=100000000,'סכום הבקשה אינו תקין');assert(text(row.reference),'אסמכתא חסרה');
  const stamp=now(),ledgerId=uid(),eventId=uid(),mailId='email:decision:'+row.id,target=await one('SELECT * FROM users WHERE id=?',row.user_id);assert(target,'לקוח לא נמצא',404);
  const pending="id=? AND COALESCE(json_extract(data,'$.decision'),'pending')='pending'";
  const ops=[];
  if(decision==='approved'){
   const reference='bank-transfer:'+await hash(text(row.reference).normalize('NFKC').toLowerCase());
   const prior=await one('SELECT id FROM ledger WHERE reference=?',reference);assert(!prior,'אסמכתא זו כבר זוכתה. יש לבדוק את תנועות הארנק',409);
   ops.push(stmt(`INSERT INTO ledger(id,user_id,amount,reason,reference,created) SELECT ?,user_id,?,'הטענת יתרה בהעברה בנקאית',?,? FROM records WHERE ${pending}`,ledgerId,amount,reference,stamp,row.id));
   ops.push(stmt('UPDATE users SET credits=credits+? WHERE id=? AND EXISTS(SELECT id FROM ledger WHERE id=?)',amount,row.user_id,ledgerId));
  }
  ops.push(stmt(`UPDATE records SET data=json_set(data,'$.decision',?,'$.status','closed','$.handled_by',?,'$.handled_at',?,'$.decision_note',?,'$.ledger_id',?,'$.decision_event',?),updated=? WHERE ${pending}`,decision,u.id,stamp,note,decision==='approved'?ledgerId:'',eventId,stamp,row.id));
  ops.push(stmt("INSERT INTO activity(id,user_id,resource,action,data,created) SELECT ?,?,?,?, ?,? WHERE EXISTS(SELECT id FROM records WHERE id=? AND json_extract(data,'$.decision_event')=?)",eventId,u.id,row.id,decision==='approved'?'הטענת יתרה אושרה':'הטענת יתרה נדחתה',JSON.stringify({amount,note,customer_id:row.user_id}),stamp,row.id,eventId));
  const mail={to:target.email,subject:decision==='approved'?'בקשת הטענת היתרה אושרה':'בקשת הטענת היתרה נדחתה',text:decision==='approved'?money(amount)+' נוספו ליתרה שלכם.\nאסמכתא: '+row.reference:'הבקשה לא אושרה: '+note,button:{label:'לארנק שלי',url:origin+'/wallet'}};
  ops.push(stmt("INSERT OR IGNORE INTO jobs(id,user_id,kind,status,data,created,updated) SELECT ?,?,'email','requested',?,?,? WHERE EXISTS(SELECT id FROM records WHERE id=? AND json_extract(data,'$.decision_event')=?)",mailId,row.user_id,JSON.stringify(mail),stamp,stamp,row.id,eventId));
  try{await db().batch(ops);}catch(error){const current=parse(await one('SELECT * FROM records WHERE id=?',row.id));if(current?.decision===decision)return output({ok:true,decision,duplicate:true});if(String(error).includes('ledger.reference'))assert(false,'אסמכתא זו כבר זוכתה. יש לבדוק את תנועות הארנק',409);throw error;}const result=parse(await one('SELECT * FROM records WHERE id=?',row.id));assert(result?.decision===decision,'הבקשה טופלה במקביל בהחלטה אחרת',409);
  const delivery=await safeMail(mailId,row.user_id,mail);return output({ok:true,decision,mail_status:delivery?.status});
 }
 if(p[0]==='admin'&&p[1]==='invoices'){
  admin(u);assert(r.method==='GET','פעולה לא נתמכת',405);const filters:string[]=[],args:any[]=[];
  const search=text(query.get('search'));if(search){filters.push("(o.number||' '||u.name||' '||u.email||' '||COALESCE(json_extract(o.data,'$.invoice_name'),'')) LIKE ? ESCAPE '\\'");args.push('%'+search.replace(/[\\%_]/g,'\\$&')+'%');}
  const status=query.get('status')||'missing';assert(['all','missing','attached','unpaid'].includes(status),'סטטוס לא תקין');
  const eligible="(o.paid=1 OR EXISTS(SELECT 1 FROM monthly_charges c WHERE c.order_id=o.id AND c.settled=1 AND c.demo=0)) AND COALESCE(json_extract(o.data,'$.demo'),0)=0 AND o.status<>'cancelled'"+' AND NOT '+fullyCancelledOrderSql();
  const has="COALESCE(json_extract(o.data,'$.invoice_file_id'),'')<>''";
  if(status==='missing')filters.push('('+eligible+') AND NOT ('+has+')');if(status==='attached')filters.push(has);if(status==='unpaid')filters.push('NOT ('+eligible+') AND NOT ('+has+')');
  const where=filters.length?' WHERE '+filters.join(' AND '):'',page=Math.max(1,Math.floor(Number(query.get('page'))||1));
  const base=' FROM orders o JOIN users u ON u.id=o.user_id';const total=await one('SELECT COUNT(*) AS n'+base+where,...args);
  const rows=await all('SELECT o.*,'+orderSummarySql()+',u.name AS user_name,u.email,actor.name AS attached_by_name,f.name AS invoice_filename'+base+" LEFT JOIN users actor ON actor.id=json_extract(o.data,'$.invoice_attached_by') LEFT JOIN files f ON f.id=json_extract(o.data,'$.invoice_file_id')"+where+' ORDER BY o.created DESC LIMIT 30 OFFSET ?',...args,(page-1)*30);
  const summary=await one(`SELECT SUM(CASE WHEN ${eligible} AND NOT (${has}) THEN 1 ELSE 0 END) AS missing,SUM(CASE WHEN ${has} THEN 1 ELSE 0 END) AS attached,COUNT(*) AS total FROM orders o`);
  return output({orders:rows.map(parse),total:total?.n||0,page,summary});
 }
 return null;
}
