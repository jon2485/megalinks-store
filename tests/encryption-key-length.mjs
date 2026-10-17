import assert from 'node:assert/strict';
import {createCipheriv,createDecipheriv,randomBytes} from 'node:crypto';
import {createRequire} from 'node:module';
import {mkdirSync,realpathSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const require=createRequire(realpathSync('node_modules/wrangler')+'/package.json'),{build}=require('esbuild');
globalThis.encryptionFixtureEnv={};
const result=await build({entryPoints:['lib/server.ts'],bundle:true,platform:'node',format:'esm',write:false,plugins:[{name:'server-fixture',setup(b){b.onResolve({filter:/^(cloudflare:workers|@\/app\/chatgpt-auth)$/},a=>({path:a.path,namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},a=>({loader:'js',contents:a.path==='cloudflare:workers'?'export const env=globalThis.encryptionFixtureEnv;':'export async function getChatGPTUser(){return null}'}));}}]});
mkdirSync('.sites-runtime',{recursive:true});writeFileSync('.sites-runtime/encryption-key-length.mjs',result.outputFiles[0].text);const {encrypt,decrypt}=await import(pathToFileURL(realpathSync('.sites-runtime/encryption-key-length.mjs')));
let checks=0;
// Independent Node AES-256-GCM fixtures use the original stored format:
// Base64(12-byte IV || ciphertext || 16-byte authentication tag).
for(const key of [Buffer.alloc(32),Buffer.alloc(32,255),...Array.from({length:12},()=>randomBytes(32))]){
 const value='FAKE_LOCAL_GEMINI_SECRET_מפתח_בדיקה_🔐',iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);
 const legacy=Buffer.concat([iv,cipher.update(value,'utf8'),cipher.final(),cipher.getAuthTag()]).toString('base64');
 globalThis.encryptionFixtureEnv.SETTINGS_ENCRYPTION_KEY=key.toString('base64');
 assert.equal(await decrypt(legacy),value,'existing ciphertext decrypts with the exact original key bytes');checks++;
 const fresh=Buffer.from(await encrypt(value),'base64'),reader=createDecipheriv('aes-256-gcm',key,fresh.subarray(0,12));reader.setAuthTag(fresh.subarray(-16));assert.equal(Buffer.concat([reader.update(fresh.subarray(12,-16)),reader.final()]).toString('utf8'),value,'new ciphertext remains compatible with original independent AES-256 format');checks++;
 const another=Buffer.from(await encrypt(value),'base64');assert(!fresh.subarray(0,12).equals(another.subarray(0,12)),'each encryption uses a new random IV');checks++;
 globalThis.encryptionFixtureEnv.SETTINGS_ENCRYPTION_KEY=' \n'+key.toString('base64')+'\n';assert.equal(await decrypt(legacy),value,'valid Base64 decoding remains identical, including previously accepted whitespace');checks++;
}
const validKey=randomBytes(32),plain='FAKE_LOCAL_SECRET_NOT_FOR_PRODUCTION';globalThis.encryptionFixtureEnv.SETTINGS_ENCRYPTION_KEY=validKey.toString('base64');const validCiphertext=await encrypt(plain);
for(const size of [0,1,16,24,31,33,48,64]){
 const encoded=randomBytes(size).toString('base64');globalThis.encryptionFixtureEnv.SETTINGS_ENCRYPTION_KEY=encoded;
 for(const run of [()=>encrypt(plain),()=>decrypt(validCiphertext)]){await assert.rejects(run,error=>{assert.equal(error.status,503);assert(error.message.includes('SETTINGS_ENCRYPTION_KEY'));assert(error.message.includes(size===0?'לא הוגדר':'32 בתים'));assert(!error.message.includes(plain));if(encoded)assert(!error.message.includes(encoded));return true;});checks++;}
}
for(const encoded of ['%%%INVALID_BASE64%%%','not-base64!']){
 globalThis.encryptionFixtureEnv.SETTINGS_ENCRYPTION_KEY=encoded;
 for(const run of [()=>encrypt(plain),()=>decrypt(validCiphertext)]){await assert.rejects(run,error=>{assert.equal(error.status,503);assert(error.message.includes('אינו Base64 תקין'));assert(!error.message.includes(encoded));return true;});checks++;}
}
globalThis.encryptionFixtureEnv.SETTINGS_ENCRYPTION_KEY=validKey.toString('base64');assert.equal(await decrypt(validCiphertext),plain,'failed validation never alters a valid key or persisted ciphertext');checks++;
console.log('AES-256 KEY LENGTH PASSED:',checks,'checks: exact 32-byte requirement, clear secret-free 503 errors, malformed Base64, randomized IV and independent legacy/new ciphertext compatibility. No production secrets read or changed.');
