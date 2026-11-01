import assert from 'node:assert/strict';
import {createAdminFixture} from './admin-glass.mjs';
const f=await createAdminFixture();
async function req(path,body,expected=200){const r=await f.request('/api/admin/control-center/updates'+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined}),j=await r.json();assert.equal(r.status,expected,JSON.stringify(j));return j;}
try{
 const open=await req('?state=open'),event=open.updates.find(r=>r.kind==='support')||open.updates[0];assert.equal(open.updates.length,20);assert(event.version);
 for(const identity of [null,'buyer','supplier']){const r=await f.mf.dispatchFetch('http://admin.test/api/admin/control-center/updates',{method:'POST',headers:{'Content-Type':'application/json',...(identity?{'oai-authenticated-user-id':identity,'oai-authenticated-user-email':identity+'@example.test'}:{})},body:JSON.stringify({id:event.id,version:event.version})});assert.equal(r.status,identity?403:401);}
 // Lane view: every open update lands in exactly one lane, counts match rows, oldest waits first, and information is newest first.
 const laned=await req('?view=lanes&limit_urgent=500&limit_content=500&limit_service=500&limit_info=500'),laneRows=Object.values(laned.lanes).flatMap(l=>l.rows);
 assert.deepEqual(Object.keys(laned.lanes).sort(),['content','info','service','urgent']);assert.equal(laneRows.length,open.total);assert.equal(new Set(laneRows.map(r=>r.id)).size,open.total);
 for(const [lane,{total,rows}] of Object.entries(laned.lanes)){assert.equal(total,rows.length);const times=rows.map(r=>+new Date(r.happened_at));assert.deepEqual(times,[...times].sort((a,b)=>lane==='info'?b-a:a-b),lane+' order');}
 assert(laned.lanes.info.rows.every(r=>r.needs_action===0));assert(['urgent','content','service'].every(l=>laned.lanes[l].rows.every(r=>r.needs_action===1)));assert(laneRows.every(r=>r.version));
 const short=await req('?view=lanes&limit_content=1');assert(short.lanes.content.rows.length<=1);assert.equal(short.lanes.content.total,laned.lanes.content.total);
 await req('',{id:event.id,version:'stale'},409);assert.equal((await req('?state=handled')).total,0);
 const marked=await req('',{id:event.id,version:event.version});await req('',{id:event.id,version:event.version});assert.equal((await req('?state=handled')).total,1,'repeated mark is idempotent');assert.equal((await req('?state=open')).total,open.total-1);assert(!(await req('?state=open')).updates.some(r=>r.id===event.id));
 let history=await req('?state=handled');assert.equal(history.updates[0].history_id,marked.history_id);assert(history.updates[0].can_reopen);assert.equal(history.updates[0].handled_by_name,'owner@example.test');assert(history.updates[0].handled_at);
 await req('/reopen',{history_id:marked.history_id});assert.equal((await req('?state=handled')).total,0);assert.equal((await req('?state=open')).total,open.total);
 // Bank report acknowledgements never approve money, publish an article or close the source report.
 const bank=(await req('?state=open&q='+encodeURIComponent('#1005'))).updates[0];assert(bank&&bank.kind==='bank');const reportMarked=await req('',{id:bank.id,version:bank.version});
 assert.equal((await f.db.prepare("SELECT paid FROM orders WHERE id='bank'").first()).paid,0);assert.equal(JSON.parse((await f.db.prepare("SELECT data FROM records WHERE id='payment-report:bank'").first()).data).status,'pending');assert.equal((await f.db.prepare("SELECT status FROM articles WHERE id='review'").first()).status,'admin_review');
 assert.equal((await req('?state=open&q='+encodeURIComponent('#1005'))).total,0);
 // New version of the same source is a new open notification; old snapshot stays immutable.
 const updated='2090-10-10T11:00:00Z';await f.db.prepare("UPDATE records SET data=json_set(data,'$.reference','UPDATED-REF'),updated=? WHERE id='payment-report:bank'").bind(updated).run();
 const changed=(await req('?state=open&q='+encodeURIComponent('#1005'))).updates[0];assert.notEqual(changed.version,bank.version);assert.equal(changed.detail,'UPDATED-REF');await req('',{id:bank.id,version:bank.version},409);
 history=await req('?state=handled&q='+encodeURIComponent('#1005'));assert.equal(history.updates[0].detail,'BANK-TEST');assert.equal(history.updates[0].can_reopen,false);await req('/reopen',{history_id:reportMarked.history_id},409);
 // History survives an underlying financial resolution, and has no misleading restore action.
 await f.db.prepare("UPDATE orders SET paid=1 WHERE id='bank'").run();assert.equal((await req('?state=open&q='+encodeURIComponent('#1005'))).updates.filter(r=>r.kind==='bank').length,0);history=await req('?state=handled&q='+encodeURIComponent('#1005'));assert.equal(history.total,1);assert.equal(history.updates[0].can_reopen,false);
 assert.equal((await req('?state=handled&q=%25')).total,0);assert.equal((await req('?state=handled&page=99999')).page,1);
 await req('?state=invalid',undefined,400);
 console.log('ADMIN HANDLED UPDATES PASS: server persistence; auth; idempotent acknowledgement; stale conflicts; no financial/publication side effects; exact-version reopen; changed event reappears; durable immutable handled history; filtering and page clamping.');
}finally{await f.mf.dispose();}
