# Supplier data privacy

Supplier identities, contacts, acquisition costs, inventory, procurement
configuration and internal notes are administrator-only data. Public and
customer responses use explicit projections for websites, articles, orders
and shared promotion records. Internal audit JSON is not a customer message
channel. The final API JSON boundary also removes private fields recursively,
including legacy JSON-string columns; a serialization failure returns a generic
error instead of the original response. API tokens do not grant administrator
privileges, even when the token owner is an administrator.

Only administrators may read supplier finance. Supplier accounts retain their
assigned publication inbox and article content, without internal contacts,
inventory totals, internal notes or acquisition costs. Inventory allocation
remains server-side. New publication and reminder emails no longer contain
inventory counters. Customer notifications exclude supplier mail jobs. Customer
article and order responses contain customer selling prices and their own
briefs/billing details; these are not acquisition costs.

Fields deliberately designated `public_notes`, `customer_notes` and
`publishing_restrictions` are customer-facing publication instructions. Keep
supplier contracts and internal comments in supplier/internal fields. As with
any customer-facing editor, an authorized administrator can manually paste
private text into public content or upload a file containing it; structured
field filtering is not semantic review of manually authored content.

Downloads are checked for record ownership or an explicit article/invoice
relationship. Linked administrator uploads use generic customer download names,
so private source filenames are not exposed. Generated Word and PDF templates
select publication content or customer billing fields, not supplier records.
No private supplier datasets belong under `public/` or in client imports.
Field labels in administrator JavaScript do not contain the actual data.

Regression coverage: `node tests/supplier-privacy.mjs` after building. The suite
seeds isolated private canaries and probes public, customer, agency, API token,
supplier and administrator routes. It checks nested/legacy fields, histories,
notifications, Word XML, PDF text, file access/filenames and browser bundles.
Run the integrated purchasing/writing/finance suite as well. Tests use isolated
D1/R2 and mocked external services; no production supplier data is written.
