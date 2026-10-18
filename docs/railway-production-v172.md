# Railway Production v172

## Scope and release policy

Project `4d90cd94-2461-4ede-88cc-c285aa68a74f`, production environment
`fbcf5115-6180-4951-8152-f7911d1dbaeb`, service
`9afde236-60ca-48cf-a812-5b0eec0eb3da`.

The user explicitly selected independent Production in Railway. Existing
ChatGPT Sites production v173 remains published and untouched. This launch does
not transfer its users, orders, files, provider secrets or data. GitHub main was
not modified. Its incomplete upload caused the original Production build failure
(missing `scripts/run-framework.mjs` and application directories).

Future default: requested fixes are published to Staging first. Promote reviewed
code to Production only after an explicit user instruction. Never copy test DB,
files, credentials or provider configurations as part of code promotion.

## Runtime

`POSTFLOW_RUNTIME=node` selects Vinext's supported Node production build.
Cloudflare imports resolve to `runtime/node-env.mjs` only for this build; the
existing Cloudflare build path remains available. No Wrangler dev process or D1/
R2 emulator runs in Production. Original SQL, business functions and interfaces
are retained through the storage adapter. A compatible HTMLRewriter implementation
preserves article sanitization and link/image handling in Node.

Production runs Node 24, one replica, a loopback Vinext backend on 8787 and an
external authenticated gateway on PORT (8080). Only the gateway may have a domain.
Startup validates the exact project, environment, service and `/data` volume.
The data root must be `/data/production`, never a staging directory.

## Durable state and recovery

Dedicated 5000 MB volume: `megalinks-production-data`, ID
`61d405b5-9894-4af4-9b42-1c56fa88f244`. It is independent from the Staging volume.

`node:sqlite` stores business records and object bodies/metadata in one SQLite
file. WAL, FULL synchronous commits, foreign keys and a busy timeout are enabled.
Existing SQL string-literal behavior is enabled for compatibility with the D1
queries. Batch statements use BEGIN IMMEDIATE / COMMIT with full rollback.
Migrations have SHA-256 checksums and are applied transactionally; changed applied
migrations stop startup. Neither the DB nor object contents live in the container
image or temporary working directory.

SQLite backup snapshots include records and files together. Snapshots run before
migrations, every six hours and on graceful shutdown; the newest seven are retained
in `/data/production-backups`. An actual snapshot restore was verified in tests.
These are same-volume recovery copies, **not off-site disaster recovery**. Volume
loss requires a separately configured off-site backup process. Capacity and backup
size must be monitored. Keep one replica; this is not an HA or multi-node DB.

## Identity and access

The confirmed owner has a separately generated production password hash. Accounts
are explicitly provisioned; there is no open registration or first-user admin.
The gateway strips external identity and forwarded headers and injects only the
verified identity and configured canonical host. The Node backend trusts that
single configured forwarded host. Sessions have separate keys and storage from
Staging, use `__Host-megalinks_session`, Secure/HttpOnly/SameSite cookies, expire
in eight hours and are revoked at logout. Requests exceeding endpoint body limits
or failing strict Origin validation never reach the application. Rate limits and
concurrency caps apply to password checks.

Private credentials are delivered separately. Production secrets live in Railway
variables; never commit them or reuse the Staging encryption/session keys.
Only the owner account is provisioned initially. Customer/supplier accounts need
explicit authentication provisioning; existing user role checks remain in place.

## Focused business fix

Node's request timing exposed an existing concurrent top-up approval edge case:
a second approval could see a new ledger entry after reading a stale pending
request and return 409. `lib/finance.ts` now rereads the same request before
rejecting an existing reference, returning idempotent success only when that
request already has the same decision. Other requests cannot reuse the reference,
and the transactional ledger still prevents duplicate credits.

## Validation

- Node production build and TypeScript pass; lint for the new Node/gateway modules passes.
  The existing finance module retains six pre-existing explicit-any lint findings;
  its runtime change introduces no new any annotations.
- `tests/railway-storage.mjs`: 16 assertions; six migrations, idempotency,
  atomic rollback, JSON SQL compatibility, binary/text/JSON objects, restart,
  actual backup restore of data and files, and static-path traversal.
- `tests/railway-production-smoke.mjs`: 22 assertions against real Node/Vinext,
  SQLite and gateway; login, owner identity, cookie isolation, 1186-site catalog,
  same-origin writes, CSRF, body limits, SSR/static files and revoked sessions.
- Existing integration assertions run unchanged via the Node harness:
  `node scripts/test-railway-node.mjs integration.mjs` — 630 checks.
  `supplier-privacy.mjs` — 911; `payment-audit.mjs` — 120;
  `writing-workflow.mjs` — 127. External providers are isolated test doubles.
- Gateway security regression: 37 checks.

## Remaining service configuration

No real payment, email, WhatsApp, AI, WordPress or Sheets credentials were imported.
Provider contract tests do not prove a live connection. Demo checkout is disabled.
This is an initially owner-accessible Production installation, not a claim that
public customer onboarding or real external payment/publication is configured.
No full browser/mobile workflow or load/HA certification is claimed.

## Deploy and operate

Build: `POSTFLOW_RUNTIME=node node node_modules/vinext/dist/cli.js build`.
Start: `node scripts/railway-production-start.mjs`. Health: `/healthz`.
Required variables: POSTFLOW_RUNTIME, POSTFLOW_DEPLOYMENT_ENV, POSTFLOW_DATA_DIR,
POSTFLOW_OWNER_EMAIL, SETTINGS_ENCRYPTION_KEY, POSTFLOW_PRODUCTION_ACCOUNTS,
POSTFLOW_PRODUCTION_SESSION_KEY, POSTFLOW_PRODUCTION_ORIGIN.

Back up the original database before any later schema changes. Restore to the
production volume with the service stopped, validate records and file hashes,
and preserve the matching SETTINGS_ENCRYPTION_KEY. Rotate account/session keys
independently from the encryption key. Promote code without substituting any
production variables, volume IDs, databases or files with their staging values.
