import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,copyFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {openStorage,fileAssets} from '../runtime/node-storage.mjs';
const root=mkdtempSync('/tmp/ml-storage-');let runtime=openStorage(root+'/live');let checks=0;const check=(v,m)=>{assert(v,m);checks++;};
try{
 await runtime.migrate('drizzle');await runtime.migrate('drizzle');check((await runtime.db.prepare('SELECT COUNT(*) AS n FROM _railway_migrations').first()).n===6,'six migrations are idempotent');
 await runtime.db.prepare('CREATE TABLE fixture(id TEXT PRIMARY KEY,balance INTEGER CHECK(balance>=0),data TEXT)').run();
 await runtime.db.prepare('INSERT INTO fixture VALUES (?,?,?)').bind('one',100,JSON.stringify({name:'עברית'})).run();
 await assert.rejects(runtime.db.batch([runtime.db.prepare('UPDATE fixture SET balance=balance+50 WHERE id=?').bind('one'),runtime.db.prepare('INSERT INTO fixture VALUES (?,?,?)').bind('two',-1,'{}')]));checks++;
 check((await runtime.db.prepare('SELECT balance FROM fixture WHERE id=?').bind('one').first('balance'))===100,'failed batch rolls back every statement');
 const json=await runtime.db.prepare('SELECT json_extract(data,"$.name") AS name FROM fixture').first();check(json.name==='עברית','existing JSON SQL is compatible');
 await runtime.bucket.put('../literal-key',new Uint8Array([0,255,1,128]),{httpMetadata:{contentType:'image/png'}});let object=await runtime.bucket.get('../literal-key');check(object.size===4&&object.httpMetadata.contentType==='image/png','object metadata');assert.deepEqual([...new Uint8Array(await object.arrayBuffer())],[0,255,1,128]);checks++;
 await runtime.bucket.put('text','שלום',{httpMetadata:{contentType:'text/plain'}});check(await(await runtime.bucket.get('text')).text()==='שלום','UTF-8 files');
 await runtime.bucket.put('json','{"value":17}');check((await(await runtime.bucket.get('json')).json()).value===17,'JSON files');check((await runtime.bucket.head('json')).size>0,'head lookup');
 await runtime.snapshot(root+'/backup.sqlite');runtime.close();runtime=openStorage(root+'/live');check((await runtime.db.prepare('SELECT balance FROM fixture').first()).balance===100,'business data survives restart');check(await(await runtime.bucket.get('text')).text()==='שלום','files survive restart');
 mkdirSync(root+'/restore');copyFileSync(root+'/backup.sqlite',root+'/restore/megalinks.sqlite');const restored=openStorage(root+'/restore');try{check((await restored.db.prepare('SELECT balance FROM fixture').first()).balance===100,'restored backup has records');check(await(await restored.bucket.get('text')).text()==='שלום','same restored backup has files');}finally{restored.close();}
 await runtime.bucket.delete(['text','json']);check(await runtime.bucket.get('text')===null&&await runtime.bucket.head('json')===null,'object deletion');
 mkdirSync(root+'/assets');writeFileSync(root+'/assets/font.ttf','font');const assets=fileAssets(root+'/assets');check((await assets.fetch('https://site.test/font.ttf')).status===200,'static branding asset');check((await assets.fetch('https://site.test/%2e%2e%2fbackup.sqlite')).status===404,'asset traversal denied');
 console.log('RAILWAY STORAGE PASSED:',checks,'checks; migrations, atomic rollback, files, restart and actual backup restore');
}finally{runtime.close();rmSync(root,{recursive:true,force:true});}
