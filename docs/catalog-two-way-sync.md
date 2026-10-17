# Catalog and pricing workspace

The four RTL tabs are sites/prices, customer tiers, personal pricebooks and Sheets synchronization. The compact catalog opens a shared website dialog; the supplier picker searches existing suppliers and can create one in a nested dialog without submitting the website form. Catalog writes use pricing versions and website revisions. Existing orders keep their captured prices. Uploaded catalog logos have a separate public image endpoint; ordinary account files remain private.

## Google activation

The connected Drive connector can read/edit spreadsheet cells but cannot install or authorize its bound Apps Script. The owner must replace only MegaLinksSync.gs with the code available under Catalog and pricing → Sheets synchronization → Connection instructions, run installMegaLinksSync and approve Google permissions once. An existing script-property token is retained. The API key is never embedded in the script. Once enabled, on-edit/on-change triggers and a five-minute trigger perform round trips while the Site is closed.

Only the existing `אתרים` tab is synchronized. Tier membership, tier discounts and personal overrides remain in the website's administrator tools. Unknown spreadsheet columns and formulas are preserved. Optional blanks preserve values; __CLEAR__ explicitly clears optional fields. Missing websites are appended, never deleted; active=false hides a product without changing historic orders.

## Merge and confirmation

The server keeps a private R2 baseline from the last confirmed round trip. For each changed field it compares the baseline, the current website and the incoming spreadsheet. One-sided changes pass through; different fields merge. Different changes to the same field stop the import and require explicit administrator choices. A missing baseline requires review of existing-site differences, rather than assuming either source is authoritative. Existing confirmed one-way snapshots can seed migration.

The response contains only specific spreadsheet cells with before/after values and append rows. Apps Script rechecks live cells before writing, protects formula cells and records a before/after journal. It reads the spreadsheet again and sends a scoped confirmation token. Only a matching acknowledgement advances the baseline. Computed/unmapped columns are excluded from the confirmation digest so cost changes may legitimately recalculate minimums. Changed cells, rows, failed writes or stale acknowledgements do not advance the baseline. Conflict choices survive a later Google callback only while both field values still match the reviewed values.

Service requests are authenticated with POSTFLOW_SHEETS_SYNC_KEY, scoped to the known spreadsheet/tab, timestamp-checked and serialized. Catalog changes also use transactional pricing and website guards. Older script protocols cannot downgrade the two-way connection or silently replace pending website edits.

Spreadsheet UI edits are not covered by Apps Script's script lock. The write checks and post-write acknowledgement detect concurrent changes; a tiny edit between the final cell read and its write cannot be made atomic through SpreadsheetApp. The journal retains the before/after values for investigation. This is eventual synchronization, not an instantaneous shared database.

## Verification

Isolated Miniflare tests cover both directions, different-field merging, same-field conflicts and both choices, stale requests/acknowledgements, live spreadsheet changes, formula preservation, clearing, additions, URL duplicates, supplier creation, public-logo upload and administrator restrictions. VM tests exercise the generated Apps Script against mocked Google services. The full application and pricing regression suites are also run. Live Google authorization must be completed by the owner before an actual production round trip can be verified.
