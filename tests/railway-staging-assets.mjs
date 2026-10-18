import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {realpathSync,readdirSync,readFileSync} from 'node:fs';
const require=createRequire(realpathSync('node_modules/wrangler')+'/package.json');
const {Miniflare}=require('miniflare');
const mf=new Miniflare({modules:[{type:'ESModule',path:'dist/server/index.js'},...readdirSync('dist/server',{recursive:true}).filter(p=>/\.(m?js)$/.test(p)&&p!=='index.js').map(p=>({type:'ESModule',path:'dist/server/'+p}))],compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],r2Buckets:['BUCKET'],assets:{directory:'dist/client',binding:'ASSETS',routerConfig:{has_user_worker:true,invoke_user_worker_ahead_of_assets:false}},cf:false});
try{
 const db=await mf.getD1Database('DB');
 for(const migration of readdirSync('drizzle').filter(p=>p.endsWith('.sql')).sort())for(const part of readFileSync('drizzle/'+migration,'utf8').split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean))await db.prepare(part).run();
 const startup=readFileSync('scripts/railway-staging-start.mjs','utf8');
 assert(startup.includes('config.assets.run_worker_first=false'),'gateway protects ingress; assets must precede dynamic Worker routing');
 const root=await mf.dispatchFetch('https://staging.test/');assert.equal(root.status,200);const html=await root.text();
 const assets=[...new Set([...html.matchAll(/(?:src|href)="([^"\s]+\.(?:js|css)(?:\?[^"\s]*)?)"/g)].map(m=>m[1]).filter(p=>p.startsWith('/_next/')))];
 assert(assets.length>5,'SSR must reference real JS/CSS assets');
 for(const path of assets){const r=await mf.dispatchFetch(new URL(path,'https://staging.test'));assert.equal(r.status,200,path);const body=await r.text();assert(body.length>0&&!body.trimStart().startsWith('<'),path+' must be code, not fallback HTML');assert.match(r.headers.get('content-type')||'',path.includes('.css')?/text\/css/:/javascript/);}
 console.log('STAGING ASSETS PASSED:',assets.length,'SSR-referenced JS/CSS files return real code with HTTP 200');
}finally{await mf.dispose();}
