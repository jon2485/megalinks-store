// Railway staging bootstrap only. Does not change application or production logic.
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync, spawn } from "node:child_process";
import { resolve } from "node:path";

if (process.env.POSTFLOW_DEPLOYMENT_ENV !== "staging") {
  throw new Error("This bootstrap is restricted to the Railway staging environment.");
}
const configPath = resolve("dist/server/wrangler.json");
const config = JSON.parse(readFileSync(configPath, "utf8"));
if (!Array.isArray(config.d1_databases) || config.d1_databases.length !== 1) {
  throw new Error("Expected exactly one local staging D1 database.");
}
config.d1_databases[0].migrations_dir = resolve("drizzle");
writeFileSync(configPath, JSON.stringify(config));
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
  "--ip", "0.0.0.0", "--port", process.env.PORT || "8787", "--inspector-port", "0"],
  { env, stdio: "inherit" });
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.kill(signal));
}
server.on("error", error => { console.error(error); process.exitCode = 1; });
server.on("close", code => { process.exitCode = code ?? 1; });
