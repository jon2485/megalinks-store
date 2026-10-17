# Runtime secrets and security controls

Production values belong in protected Sites runtime secrets, never source,
`.openai/hosting.json`, `NEXT_PUBLIC_*`, `VITE_*`, or browser storage.
Local `.env*` files must stay untracked. Do not paste secret values into logs,
issues, screenshots or audit reports.

Supported secret names:

| Service | Runtime secret |
| --- | --- |
| Gemini | `GEMINI_API_KEY` |
| Existing Gemini key migration | `GEMINI_API_KEY_ENCRYPTED` (original AES-GCM ciphertext, not plaintext) |
| OpenAI | `OPENAI_API_KEY` |
| Groq | `GROQ_API_KEY` |
| xAI | `XAI_API_KEY` |
| Email webhook | `POSTFLOW_EMAIL_SECRET` |
| WordPress application password | `POSTFLOW_WORDPRESS_PASSWORD` |
| Payment webhook | `POSTFLOW_PAYMENTS_SECRET` |
| WhatsApp webhook | `POSTFLOW_WHATSAPP_SECRET` |
| Pexels | `PEXELS_API_KEY` |
| Google Sheets synchronization | `POSTFLOW_SHEETS_SYNC_KEY` |
| Optional month-close automation | `POSTFLOW_AUTOMATION_KEY` |
| Encryption key | `SETTINGS_ENCRYPTION_KEY` (exactly 32 bytes, Base64) |

`POSTFLOW_OWNER_EMAIL` and `POSTFLOW_ADMIN_EMAILS` identify trusted platform
accounts. Database roles also support explicitly appointed administrators.
Review both when revoking administrator access. Identity headers are supplied
by Sites dispatch; never trust these headers on an unprotected alternate host.

The current Gemini migration copies the existing ciphertext into a protected
runtime secret without revealing or rotating the provider key. On the first
request after deployment the server verifies decryption and atomically
removes the matching database copy, selecting environment storage. Other
configuration changes are not overwritten. Do not remove or rotate the
existing encryption key without a coordinated secret migration. Raw
`GEMINI_API_KEY`, when configured, takes precedence over its encrypted wrapper.
The legacy encrypted-server storage option remains available for compatibility;
new integrations default to environment storage in the management form.

Integration metadata has an explicit field allowlist; credentials never appear
in settings responses. New webhook URLs cannot contain credentials, query
parameters or fragments. Send authentication through the protected secret
header. HTTPS and public hostname checks reject literal IP addresses and local
suffixes, including trailing-dot variants; this is not DNS pinning.

AI budgets are database-atomic per account and UTC hour: 20 article generations
and 5 strategy generations for customers, 100 of each for administrators.
These protect account-level usage, not a global provider spending ceiling.
Requests consume a claim before the provider call; retries/failures can count.

Request bodies are bounded by actual bytes received, not just Content-Length.
Supplier pages and token API responses use no-store; Referrer-Policy is
no-referrer. Uploaded HTML is downloaded with restrictive CSP. Content is
sanitized on the server; record ownership and admin roles are checked there.
Provider error text is not exposed to clients or persisted as job failures.

Run the security regression suite after dependency/security changes:

```
node tests/security-audit.mjs
node tests/gemini-secrets.mjs
node tests/encryption-key-length.mjs
node tests/integration.mjs
node tests/payment-audit.mjs
node tests/supplier-mail.mjs
```

Miniflare tests use isolated D1/R2 fixtures and mocked providers. They do not
send real mail or charge payment providers. A passing test suite is not proof
that every vulnerability is absent. Review `pnpm audit --json`, including dev
transitives, and follow up on advisories without a published patch.
