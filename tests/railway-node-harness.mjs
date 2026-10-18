// Run the existing Worker API assertions against the built Node production server.
import {getRuntime} from '../runtime/node-env.mjs';
import {mkdtempSync,rmSync} from 'node:fs';
export class NodeTestRuntime{
 constructor(options){this.directory=mkdtempSync('/tmp/ml-node-suite-');Object.assign(process.env,options.bindings||{},{POSTFLOW_DATA_DIR:this.directory,VINEXT_TRUST_PROXY:'1'});this.runtime=getRuntime();this.fetch=globalThis.fetch;if(options.outboundService)globalThis.fetch=(input,init)=>options.outboundService(new Request(input,init));else if(options.fetchMock)globalThis.fetch=(input,init)=>this.fetch(input,{...init,dispatcher:options.fetchMock});this.ready=import('vinext/server/prod-server').then(({startProdServer})=>startProdServer({host:'127.0.0.1',port:0,outDir:new URL('../dist',import.meta.url).pathname}));}
 async getD1Database(){return this.runtime.db;}
 async getR2Bucket(){return this.runtime.bucket;}
 async dispatchFetch(input,init={}){const {port}=await this.ready;const original=new URL(typeof input==='string'?input:input.url),headers=new Headers(init.headers);const {trustedHosts}=await import('vinext/server/prod-server');trustedHosts.add(original.host);headers.set('x-forwarded-host',original.host);headers.set('host',original.host);headers.set('x-forwarded-proto',original.protocol.slice(0,-1));return this.fetch('http://127.0.0.1:'+port+original.pathname+original.search,{...init,headers,redirect:'manual'});}
 async dispose(){globalThis.fetch=this.fetch;const {server}=await this.ready;await new Promise(r=>server.close(r));this.runtime.close();rmSync(this.directory,{recursive:true,force:true});}
}
