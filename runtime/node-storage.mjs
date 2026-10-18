// Durable, single-replica Railway storage. No Wrangler or Cloudflare emulation.
import {DatabaseSync,backup} from 'node:sqlite';
import {mkdirSync,chmodSync,readFileSync,readdirSync,existsSync} from 'node:fs';
import {resolve,sep} from 'node:path';
import {createHash} from 'node:crypto';
export function openStorage(directory){
 mkdirSync(directory,{recursive:true,mode:0o700});
 const filename=resolve(directory,'megalinks.sqlite');const sqlite=new DatabaseSync(filename,{enableDoubleQuotedStringLiterals:true});chmodSync(filename,0o600);
 sqlite.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
 class Statement{
  constructor(sql,args=[]){this.sql=sql;this.args=args;}
  bind(...args){return new Statement(this.sql,args.map(x=>x===undefined?null:typeof x==='boolean'?Number(x):x));}
  execute(mode){const start=performance.now(),statement=sqlite.prepare(this.sql);let rows=[],meta;
   if(mode==='run'){const result=statement.run(...this.args);meta={changes:Number(result.changes),last_row_id:Number(result.lastInsertRowid)};}
   else {rows=statement.all(...this.args).map(row=>Object.fromEntries(Object.entries(row).map(([k,v])=>[k,typeof v==='bigint'?Number(v):v])));meta={changes:0,last_row_id:0};}
   return {results:rows,success:true,meta:{...meta,duration:performance.now()-start,served_by:'railway-sqlite',rows_read:rows.length,rows_written:meta.changes}};
  }
  async run(){return this.execute('run');}
  async all(){return this.execute('all');}
  async first(column){const row=this.execute('all').results[0]||null;return column?(row?.[column]??null):row;}
  async raw(){return this.execute('all').results.map(Object.values);}
 }
 const db={prepare:sql=>new Statement(sql),async batch(statements){sqlite.exec('BEGIN IMMEDIATE');try{const results=statements.map(s=>s.execute(/^\s*(SELECT|WITH|PRAGMA)\b/i.test(s.sql)?'all':'run'));sqlite.exec('COMMIT');return results;}catch(error){sqlite.exec('ROLLBACK');throw error;}},async exec(sql){const start=performance.now();sqlite.exec(sql);return {count:1,duration:performance.now()-start};}};
 sqlite.exec('CREATE TABLE IF NOT EXISTS _railway_migrations (name TEXT PRIMARY KEY, digest TEXT NOT NULL, applied TEXT NOT NULL); CREATE TABLE IF NOT EXISTS _railway_objects (key TEXT PRIMARY KEY, body BLOB NOT NULL, metadata TEXT NOT NULL, uploaded TEXT NOT NULL, etag TEXT NOT NULL);');
 const bucket={
  async put(key,value,options={}){const bytes=typeof value==='string'?Buffer.from(value):value instanceof ArrayBuffer?Buffer.from(value):ArrayBuffer.isView(value)?Buffer.from(value.buffer,value.byteOffset,value.byteLength):Buffer.from(await new Response(value).arrayBuffer());const etag=createHash('sha256').update(bytes).digest('hex');sqlite.prepare('INSERT INTO _railway_objects(key,body,metadata,uploaded,etag) VALUES (?,?,?,?,?) ON CONFLICT(key) DO UPDATE SET body=excluded.body,metadata=excluded.metadata,uploaded=excluded.uploaded,etag=excluded.etag').run(key,bytes,JSON.stringify(options.httpMetadata||{}),new Date().toISOString(),etag);return {key,size:bytes.length,etag};},
  async get(key){const row=sqlite.prepare('SELECT * FROM _railway_objects WHERE key=?').get(key);if(!row)return null;const bytes=Buffer.from(row.body);return {key,size:bytes.length,uploaded:new Date(row.uploaded),etag:row.etag,httpEtag:'"'+row.etag+'"',httpMetadata:JSON.parse(row.metadata),body:new Blob([bytes]).stream(),async arrayBuffer(){return bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);},async text(){return bytes.toString('utf8');},async json(){return JSON.parse(bytes.toString('utf8'));}};},
  async head(key){const row=sqlite.prepare('SELECT key,length(body) AS size,metadata,uploaded,etag FROM _railway_objects WHERE key=?').get(key);return row?{key,size:row.size,httpMetadata:JSON.parse(row.metadata),uploaded:new Date(row.uploaded),etag:row.etag}:null;},
  async delete(key){for(const k of Array.isArray(key)?key:[key])sqlite.prepare('DELETE FROM _railway_objects WHERE key=?').run(k);}
 };
 return {db,bucket,sqlite,filename,async migrate(migrationDir){for(const name of readdirSync(migrationDir).filter(n=>n.endsWith('.sql')).sort()){const sql=readFileSync(resolve(migrationDir,name),'utf8'),digest=createHash('sha256').update(sql).digest('hex'),existing=sqlite.prepare('SELECT digest FROM _railway_migrations WHERE name=?').get(name);if(existing){if(existing.digest!==digest)throw new Error('Applied migration changed: '+name);continue;}sqlite.exec('BEGIN IMMEDIATE');try{sqlite.exec(sql.replaceAll('--> statement-breakpoint',''));sqlite.prepare('INSERT INTO _railway_migrations VALUES (?,?,?)').run(name,digest,new Date().toISOString());sqlite.exec('COMMIT');}catch(error){sqlite.exec('ROLLBACK');throw error;}}},async snapshot(path){await backup(sqlite,path);chmodSync(path,0o600);},close(){sqlite.close();}};
}
export function fileAssets(directory){const root=resolve(directory);return {async fetch(input){const url=new URL(typeof input==='string'?input:input.url);let pathname;try{pathname=decodeURIComponent(url.pathname);}catch{return new Response(null,{status:400});}const file=resolve(root,'.'+pathname);if(!file.startsWith(root+sep)||!existsSync(file))return new Response(null,{status:404});try{const bytes=readFileSync(file);const type=file.endsWith('.png')?'image/png':file.endsWith('.ttf')?'font/ttf':file.endsWith('.jpg')?'image/jpeg':'application/octet-stream';return new Response(bytes,{headers:{'Content-Type':type}});}catch{return new Response(null,{status:404});}}};}
