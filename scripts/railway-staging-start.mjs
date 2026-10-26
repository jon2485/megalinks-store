// Railway staging bootstrap only. Does not change application or production logic.
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync, spawn } from "node:child_process";
import { resolve } from "node:path";
import {randomBytes} from 'node:crypto';
import {createStagingGateway} from "./railway-staging-gateway.mjs";
import {appendStagingCustomers} from "./staging-customer-accounts.mjs";

if (process.env.POSTFLOW_DEPLOYMENT_ENV !== "staging") {
  throw new Error("This bootstrap is restricted to the Railway staging environment.");
}
if (process.env.RAILWAY_ENVIRONMENT_ID !== "1bae3915-f298-4ca6-b31d-aa79526f1eac" ||
    process.env.RAILWAY_PROJECT_ID !== "4d90cd94-2461-4ede-88cc-c285aa68a74f" ||
    process.env.RAILWAY_VOLUME_MOUNT_PATH !== "/data") {
  throw new Error("Refusing to start outside the isolated staging environment and volume.");
}
const owner=String(process.env.POSTFLOW_OWNER_EMAIL||'').trim().toLowerCase();
const accounts=appendStagingCustomers(JSON.parse(process.env.POSTFLOW_STAGING_ACCOUNTS||'[]'),JSON.parse(process.env.POSTFLOW_STAGING_CUSTOMER_ACCOUNTS||'[]'),owner);
if(!owner || !accounts.some(a=>a.email.toLowerCase()===owner))throw new Error("Staging owner must be an explicitly provisioned account");
const gateway=createStagingGateway({accounts,sessionSecret:process.env.POSTFLOW_STAGING_SESSION_KEY,
  origin:process.env.POSTFLOW_STAGING_ORIGIN,upstreamPort:8787,stateDir:'/data/staging-auth'});
const configPath = resolve("dist/server/wrangler.json");
const config = JSON.parse(readFileSync(configPath, "utf8"));
if (!Array.isArray(config.d1_databases) || config.d1_databases.length !== 1) {
  throw new Error("Expected exactly one local staging D1 database.");
}
if(config.d1_databases[0].database_id!=="00000000-0000-4000-8000-000000000000" ||
   config.d1_databases.some(b=>b.remote) || (config.r2_buckets||[]).some(b=>b.remote) ||
   config.services?.length)throw new Error("Remote bindings are forbidden in staging");
// The Node gateway authenticates every request, including static assets.
// Let Wrangler serve built assets before the application Worker; vinext does
// not resolve /_next/static/chunks through its dynamic route handler.
if(config.assets)config.assets.run_worker_first=false;
config.d1_databases[0].migrations_dir = resolve("drizzle");
writeFileSync(configPath, JSON.stringify(config));
// Wrangler does not automatically expose process.env to the Worker. Only these
// Only required runtime bindings cross the boundary; no live provider keys do.
// This internal loopback key is ephemeral unless an existing automation key is configured.
const automationKey=process.env.POSTFLOW_AUTOMATION_KEY||randomBytes(32).toString('hex');
const workerSecrets={POSTFLOW_OWNER_EMAIL:owner,SETTINGS_ENCRYPTION_KEY:process.env.SETTINGS_ENCRYPTION_KEY,POSTFLOW_AUTOMATION_KEY:automationKey,POSTFLOW_STAGING_ORIGIN:process.env.POSTFLOW_STAGING_ORIGIN};
if(Buffer.from(workerSecrets.SETTINGS_ENCRYPTION_KEY||'','base64').length!==32)throw new Error("A 32-byte encryption key is required");
writeFileSync(resolve("dist/server/.dev.vars"),Object.entries(workerSecrets).map(([k,v])=>k+'='+JSON.stringify(v)).join('\n'),{mode:0o600});
const executable = resolve("node_modules/wrangler/bin/wrangler.js");
const persist = "/data/wrangler-state";
const env = { ...process.env, CI: "true", WRANGLER_SEND_METRICS: "false" };
const migrated = spawnSync(process.execPath, [executable, "d1", "migrations", "apply",
  config.d1_databases[0].binding, "--local", "--config", configPath, "--persist-to", persist],
  { env, stdio: "inherit" });
if (migrated.error) throw migrated.error;
if (migrated.status !== 0) process.exit(migrated.status ?? 1);
const server = spawn(process.execPath, ["--import", resolve("scripts/sites-env.mjs"),
  executable, "dev", "--config", configPath, "--local", "--persist-to", persist,
  "--ip", "127.0.0.1", "--port", "8787", "--host", new URL(process.env.POSTFLOW_STAGING_ORIGIN).hostname, "--upstream-protocol", "https", "--inspector-port", "0"],
  { env, stdio: "inherit" });
gateway.listen(Number(process.env.PORT||8080),'0.0.0.0',()=>console.log('Staging access gateway ready'));
let releasing=false;
async function releaseDueArticles(){
 if(releasing)return;releasing=true;
 try{const result=await fetch('http://127.0.0.1:8787/api/maintenance/scheduled-articles',{method:'POST',headers:{authorization:'Bearer '+automationKey,host:new URL(process.env.POSTFLOW_STAGING_ORIGIN).host},signal:AbortSignal.timeout(15000)});if(!result.ok)console.warn('Scheduled article release deferred; next minute will retry.');const settlement=await fetch('http://127.0.0.1:8787/api/maintenance/seller-months',{method:'POST',headers:{authorization:'Bearer '+automationKey,host:new URL(process.env.POSTFLOW_STAGING_ORIGIN).host},signal:AbortSignal.timeout(30000)});if(!settlement.ok)console.warn('Seller month close deferred; next minute will retry.');}
 catch{/* Worker may still be starting; next minute retries without losing durable submissions. */}
 finally{releasing=false;}
}
const releaseTimer=setInterval(releaseDueArticles,60000);releaseTimer.unref();
const firstRelease=setTimeout(releaseDueArticles,1500);firstRelease.unref();
gateway.on('error',error=>{console.error('Staging gateway failed:',error.code);server.kill('SIGTERM');process.exitCode=1;});
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {clearInterval(releaseTimer);clearTimeout(firstRelease);gateway.close();server.kill(signal);});
}
server.on("error", error => { console.error(error); process.exitCode = 1; });
server.on("close", code => { clearInterval(releaseTimer);clearTimeout(firstRelease);gateway.close();process.exitCode = code ?? 1; });
