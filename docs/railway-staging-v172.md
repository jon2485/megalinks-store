# Mega Links v172: isolated Railway staging

Scope: only `railway-staging-v172`, project
`4d90cd94-2461-4ede-88cc-c285aa68a74f`, environment
`1bae3915-f298-4ca6-b31d-aa79526f1eac`, service
`4eb5f337-7344-42b8-9f53-4bbc23c50436`. Never merge this bootstrap into main or
use it for production. No existing application logic was replaced.

## Verified baseline, 2026-10-18

- GitHub head before changes: `a933772a6068d3ab4e8862d91255a4bf68cd158d`.
- Deployment `2a958d40-f344-4901-b6f3-77e78f7fea4e`: SUCCESS. Runtime logs show
  all six migrations completed against **local** D1, then HTTP 200 on `/`.
- Source: this branch only. One replica in ams, 5000 MB staging volume at
  `/data`, volume ID `3735ab2e-6ade-4ce7-abe8-b3cf918a5c86`.
- Read-only production inventory: no services, volumes, buckets or shared variables
  in Railway production. Production was not changed.
- Initially no public domains or TCP proxies; owner and encryption settings absent.

## Access boundary

`railway-staging-start.mjs` refuses other Railway environment/project IDs and
requires `/data`. It rejects remote D1/R2 bindings and service bindings, keeps
migrations local and starts Wrangler on **127.0.0.1:8787**. The gateway alone
listens on Railway's external PORT. Public domains must target that PORT (8080).
Never add a domain/TCP proxy pointing at 8787.

Every application route and static asset requires login. Only `/healthz` (generic
readiness) and sign-in endpoints are anonymous. API/MCP requests without a valid
session receive 401. The login form has no registration or role selection.
The configured owner's email was explicitly confirmed by the user.

Provisioned accounts live in the service-only `POSTFLOW_STAGING_ACCOUNTS` JSON:
`[{id,email,name,salt,hash}]`. Passwords use scrypt N=32768/r=8/p=1, a random
salt, 64-byte output and constant-time comparison. No passwords are committed.
`POSTFLOW_STAGING_SESSION_KEY` is a separate random 32-byte Base64 HMAC key.
Sessions use random 256-bit identifiers, hashed at rest in `/data/staging-auth`,
signed cookies, 8-hour expiration and immediate logout revocation. Cookies use
`__Host-`, Secure, HttpOnly and SameSite=Lax. Credential rotation invalidates
existing sessions. Session storage is intentionally single-replica only.

Login attempts are bounded (20 per socket IP/5 minutes, at most 4 concurrent
scrypt checks). Because Railway can share a proxy address, this is conservative
and may temporarily throttle all testers together. Request Origin is mandatory
and must match the configured HTTPS origin on every unsafe method. All incoming
identity/forwarded headers are stripped; only the verified account's identity is
injected for the original application authorization checks. The session cookie
is never passed to the Worker. All gateway responses use no-store and noindex. The gateway login document uses
Referrer-Policy: same-origin, so browsers retain the Origin header on native
form POST navigation; no-referrer would produce a null Origin and fail CSRF.
Proxied application responses retain no-referrer.

Only `POSTFLOW_OWNER_EMAIL` and `SETTINGS_ENCRYPTION_KEY` are explicitly written
to the Worker's private ignored `.dev.vars` file (mode 0600). Process environment
variables are not automatically Worker bindings. No production credentials,
customer exports, live providers or Google Sheets access were copied.

## Verification completed locally

- `pnpm install --frozen-lockfile`, `pnpm build`, `pnpm exec tsc --noEmit`: pass.
- ESLint on the three gateway/startup/test scripts: pass.
- `node tests/railway-staging-gateway.mjs`: 37 checks, including spoofed identity,
  all-route gating, CSRF, password rejection, tampering, restart persistence,
  logout revocation, rate limits and safe return URLs.
- `node tests/integration.mjs`: 630 checks, 1186 catalog sites; authentication,
  permissions, pricing, coupons, idempotency, article versions, approval,
  supplier tokens, wallet/credit ledger, refunds, uploads, support, API keys,
  encrypted secrets and server rendering. External providers are fixtures.
- `node tests/supplier-privacy.mjs`: 911 checks; customer/agency/supplier paths,
  nested/legacy JSON, cost canaries, exports/files, activity and emails.
- `node tests/security-audit.mjs`: 39 checks; encryption, secret migration,
  private metadata, URL safety, CSRF, permissions, rate limits and body bounds.
- `node tests/sheets-sync-integration.mjs`: scoped source/token checks, staged
  receipt, auto-update, repeated delivery, price approval, stale/invalid rows.
- Full local bootstrap + HTTP gateway smoke: authenticated `/api/me` is admin,
  `/api/catalog` returns 1186 sites, `/api/admin/settings` succeeds, POST quote
  reaches business validation and correctly rejects an empty cart.

The premium static UI audit reports pre-existing issues in application forms
(e.g. native date/select ownership); it is not a clean full-site UI certification.
These unrelated components were left intact as requested.

## Remaining external validation / limits

- Live Google Sheets is not configured. Local server-contract tests are not a
  successful real Google Sheet round trip. Staging deliberately blocks anonymous
  push/automation ingress; any future integration needs explicit scoped credentials
  and its own authenticated transport, not a broad exception to this gateway.
- No production payments, mail, AI or publication were sent. Provider test fixtures
  do not establish real provider readiness. Demo checkout is not enabled live.
- Only the confirmed owner is provisioned live. Customer/supplier identities and
  transactions used by test suites are disposable fixtures, not imported clients.
- Local D1/R2 on a Railway volume is for testing only. No production reliability,
  backup/restore, multi-replica or disaster recovery claim is made.
- Browser and live deployment checks are recorded in the delivery report; source
  tests alone do not prove mobile usability or all browser workflows.

## Operations

Runtime variables: POSTFLOW_DEPLOYMENT_ENV=staging, POSTFLOW_OWNER_EMAIL,
POSTFLOW_STAGING_ACCOUNTS, POSTFLOW_STAGING_SESSION_KEY,
POSTFLOW_STAGING_ORIGIN (exact HTTPS origin), SETTINGS_ENCRYPTION_KEY.
Healthcheck: `/healthz`. Startup: `node scripts/railway-staging-start.mjs`.
Keep one replica. Restart preserves D1/R2 and session state on the volume.
Change the account hash with a newly generated password to revoke sessions;
never rotate SETTINGS_ENCRYPTION_KEY without migrating encrypted data.
Do not paste passwords/keys into issues, commits or logs. Deliver login details
privately, separately from this document. Deleting domains can close access
without deleting volume data. A rollback must preserve the access gateway;
never roll back to the ungated initial image while a domain exists.

## Live checks, 2026-10-18

Protected deployment `861d7dfb-dd87-442f-aa90-5d9956e8f4b3` succeeded, then
the staging-only domain was created on port 8080. Fifteen external HTTP checks
passed: unauthenticated routes/static files/supplier routes blocked; forged
identity blocked; login and owner admin identity; 1186 live catalog records
matched to source IDs/names/URLs/prices with private fields absent; admin settings;
empty-cart validation; CSRF rejection; logout and replay rejection. Live settings
confirm no external provider secrets. Full-project ESLint passed as well.
Browser testing exposed the native-form Origin/referrer interaction described
above; the corrective commit preserves strict Origin validation.
