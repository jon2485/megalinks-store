import {HTMLRewriter} from '@worker-tools/html-rewriter/base64';
globalThis.HTMLRewriter ??= HTMLRewriter;
import {openStorage,fileAssets} from './node-storage.mjs';
import {resolve} from 'node:path';
const symbol=Symbol.for('megalinks.railway.runtime');
export function getRuntime(){if(!process.env.POSTFLOW_DATA_DIR)return undefined;return globalThis[symbol]??=openStorage(process.env.POSTFLOW_DATA_DIR);}
export const env=new Proxy({}, {get(_target,key){if(key==='DB')return getRuntime()?.db;if(key==='BUCKET')return getRuntime()?.bucket;if(key==='ASSETS')return fileAssets(resolve('dist/client'));return process.env[key];}});
const tasks=new Set();
export function waitUntil(promise){const tracked=Promise.resolve(promise).catch(()=>console.error('Background operation failed')).finally(()=>tasks.delete(tracked));tasks.add(tracked);}
export async function settleBackground(){await Promise.allSettled([...tasks]);}
