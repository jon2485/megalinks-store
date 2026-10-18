// Railway staging bootstrap only. Does not change application or production logic.
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync, spawn } from "node:child_process";
import { resolve } from "node:path";
import {createStagingGateway} from "./railway-staging-gateway.mjs";

if (process.env.POSTFLOW_DEPLOYMENT_ENV !== "staging") {
  throw new Error("This bootstrap is restricted to the Railway staging environment.");
}
if (process.env.RAILWAY_ENVIRONMENT_ID !== "1bae3915-f298-4ca6-b31d-aa79526f1eac" ||
    process.env.RAILWAY_PROJECT_ID !== "4d90cd94-2461-4ede-88cc-c285aa68a74f" ||
    process.env.RAILWAY_VOLUME_MOUNT_PATH !== "/data") {
  throw new Error("Refusing to start outside the isolated staging environment and volume.");
}
const owner=String(process.env.POSTFLOW_OWNER_EMAIL||'').trim().toLowerCase();
const accounts=JSON.parse(process.env.POSTFLOW_STAGING_ACCOUNTS||'[]');
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
// two required bindings cross the boundary; no live provider credentials do.
const workerSecrets={POSTFLOW_OWNER_EMAIL:owner,SETTINGS_ENCRYPTION_KEY:process.env.SETTINGS_ENCRYPTION_KEY};
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
gateway.on('error',error=>{console.error('Staging gateway failed:',error.code);server.kill('SIGTERM');process.exitCode=1;});
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {gateway.close();server.kill(signal);});
}
server.on("error", error => { console.error(error); process.exitCode = 1; });
server.on("close", code => { gateway.close();process.exitCode = code ?? 1; });
