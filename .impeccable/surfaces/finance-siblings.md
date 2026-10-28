# Approved finance siblings

Mode: Operate. Ordinary extension of the established compact admin orders world.
The user approved the sibling mockups and deployment on 2026-10-28; the last
explicit correction makes the top-up amount primary and wallet balances secondary.

## Scope and visual authority

Monthly accounts, order-local price editing, order purchase closure and receipt,
bank payment-report review, wallet top-ups, financial month report and invoices.
Preserve the original MegaLinks logo, navy/ice/white, Heebo Hebrew RTL and all six
real category destinations. Existing main orders, customer, seller and global
design systems keep their owners. No new product narrative or PRODUCT.md is
introduced.

Runtime CSS is canonical (model B): `app/finance-records.css` defines scoped
`--fin-*` roles and reusable record/detail/form styling. It inherits the existing
orders shell; `app/orders-reference.css`, `app/orders-approved.css` and
`app/orders-unified.css` remain canonical for their established scopes. These
local roles do not replace global brand tokens. `DESIGN.md` records this as a
narrow approved extension; `UX-CONTRACT.md` owns workflow rules.

## Direction as built

One shell title, original category navigation and one white bordered work panel.
Search/filter controls precede aligned desktop records; expansion reveals actual
facts and compact URL/price rows, subtotal/VAT lines, a pale gross-total strip and
explicit actions. The same record DOM reflows at 767px into compact identity,
amount/status and wrapped details. Purchase dates stay with monthly items.

Top-up amount occupies the large pale-blue lead block. Current and projected
wallet balances remain smaller below it. Four compact report facts show method,
declared payment date, report timestamp and reference/proof. This hierarchy
supersedes the earlier top-up mock's emphasis on the resulting balance.

Shared Button, Input, Textarea, Select and Dialog retain semantics, focus and
portal ownership. Real links and the existing private file endpoint own downloads
and proof. Blue/outline/destructive actions, explicit busy/error/result states,
existing global toast and reduced-motion disclosure behavior remain consistent.
The active category title replaces a duplicated inner heading/breadcrumb.

## Workflow invariants

- Monthly rows identify one actual order. Repeated purchased sites are valid
  distinct items with real purchase timestamps and immutable price snapshots.
- Order-local price editing is available before payment, purchase/month closure,
  invoice or pending/approved report. Existing article version, expected total,
  ownership and financial guards apply. Preserve writing amount, show net/VAT/
  gross preview, audit the change, protect drafts and lock duplicate requests.
- Cancellation keeps existing stage-dependent stop/removal confirmation, unpaid
  debt reduction, paid wallet credit and required external-refund documentation.
- Closing purchases is distinct from receiving payment. The closure dialog loads
  live items/dates/net/VAT/gross and offers a private real-PDF preflight before
  confirmation. GET `?preview=pdf` or `?preview=1` executes no prepared operations,
  stores no records/jobs and leaves purchase closure unchanged.
- Confirmed closure snapshots the selected order and all its sites, audits the
  action and sends a real branded PDF attachment with subject
  `הזמנה חודשית מספר xxxx נסגרה לתשלום`, using the actual number without `#`.
  Delayed PDF/mail jobs are visible rather than presented as delivered.
- Selected monthly receipt includes `order_id` and reuses `completeOrderPayment`
  to settle only that order. Preserve monthly type, proof/reference and separate
  declared date; Israel final-approval timestamp determines financial month.
- Bank review shows full order items and all report facts with approve/reject
  and history filters. Actual bank receipt requires confirmation; rejection or
  top-up cancellation requires its note. Card never enters manual review, and
  verified gateway top-up credit stays immediate and once-only.
- Financial month summary is read-only on final-payment basis, with explicit
  missing dates/costs and complete applied-range export. Invoices reuse existing
  attachment/download/history; a statement is not a tax invoice or receipt.
- Top-up/invoice lists retain server pages of 30. Monthly/report lists use latest
  1,000 rows and local pages of 30; monthly displays its cap note. The month report
  keeps local pages of 20. Do not describe local pagination as server pagination.

## Implementation owners

UI: `app/finance-records.tsx`, `app/finance-records.css`, `app/monthly-admin.tsx`,
`app/monthly-order-actions.tsx`, `app/order-item-price-editor.tsx`,
`app/order-presentation.tsx`, `app/admin-finance.tsx`, `app/admin-month-close.tsx`,
`app/admin-order-approved.tsx`, `app/payment-reports.tsx`, `app/admin-shell.tsx`.

Server: `lib/workflow-routes.ts`, `lib/account-management.ts`,
`lib/order-statement.ts`, `lib/order-close-email.ts`, `lib/payment-reports.ts`,
`lib/finance.ts`, `lib/payment-evidence.ts`; existing shared payment, refund,
private-file, PDF and mail owners remain in use. No new dependency, migration or
environment configuration is required.

## Approved references

All files below are in
`/workspace/scratch/467f3ef512a8/generated_images/`:

| Surface | Approved mock |
|---|---|
| Monthly accounts | `exec-6fa56969-9bf9-405e-aada-bd7c9ac1f78c.png` |
| Item price | `exec-c3707ac3-94f2-45df-afc7-9ae8816a8ca6.png` |
| Purchase closure | `exec-e1fbe4c4-d24f-47ae-9efd-62c43efacab6.png` |
| Payment reports | `exec-e64134a1-cb5d-4d3b-a05b-b938d6ffed94.png` |
| Top-ups, with later hierarchy correction | `exec-9bd67dcd-5a5d-49b1-9102-16e047bff4a7.png` |
| Financial month report | `exec-1358e3a5-0e41-409a-80f5-fe25fd60bad1.png` |
| Invoices | `exec-d25585da-6373-4b1c-9ec6-1bb17c0f4315.png` |

Names, money, dates, status, site URLs and counts in the mocks are illustrative;
runtime uses actual records. The top-up correction is the final visual authority.

## Checked evidence and limits

| Check | Evidence |
|---|---|
| Production build passed | `/tmp/finance-siblings-review-build.txt` |
| Typecheck and scoped lint completed without output | `/tmp/finance-siblings-typecheck.txt`; `/tmp/finance-siblings-lint.txt` |
| 90 monthly lifecycle checks, including read-only real-PDF preview | `/tmp/monthly-order-lifecycle-review.txt`; `tests/monthly-order-lifecycle.mjs` |
| 117 finance / 119 report / 250 account checks | `/tmp/finance-siblings-regression.txt`; `/tmp/finance-siblings-reports.txt`; `/tmp/finance-siblings-account.txt` |
| Monthly UI assertions passed | `/tmp/finance-siblings-monthly-ui.txt` |
| All six routes/expansions and actions at 320/390/1440px | `/tmp/finance-siblings-browser-review.txt`; `tests/finance-siblings-browser.mjs` |
| Main compact-order regression at 320/390/1440px | `/tmp/finance-siblings-orders-browser.txt` |

Browser captures are in `.sites-runtime/finance-siblings-browser/`, including
`monthly-close-dialog-{320,390,1440}.png` with actual item rows and totals and
`admin-topups-expanded-{320,390,1440}.png` with the corrected hierarchy.

The verification uses isolated synthetic APIs/data, with no live financial
mutation. Physical iOS Safari, authenticated live behavior, deployed pixels and
pixel-exact fidelity are not certified. Context launcher was unavailable; detector
timed out without output. Pre-existing global documentation/ownership drift is
preserved outside this scope and is not canonized as a new rule. No clean global
audit is claimed. Independent finish review returned **ship** after manual
comparison of all 24 captures; the material closure-preflight fix is resolved,
with no partial or unresolved findings in this scope. This is a manual comparison,
not an automated pixel diff. Actual deployment remains a separate completion
record and is not asserted here.


## Month-close site visibility correction — 2026-10-28

The final user correction is that orders looked permanently open and could not
be closed. The report now starts with compact closed summary rows. The row's
native button opens or closes all its detail, with one record open at a time;
expansion remains on the report page. This replaces the earlier always-visible
site-preview requirement. Site links appear within the expanded record without
requiring order navigation; the order-details action remains explicit.

`app/finance-records.tsx` removes the optional preview slot.
`app/admin-month-close.tsx` places `FinanceItems` with
`presentation="month-report"` first inside the same hidden body as billing facts
and the order action. `app/finance-records.css` scopes the compact white site rows
to that body. Full linked URLs remain on the right, historical remaining net
prices on the left, with fine separators and monthly purchase date/time. No
repeated subtotal/VAT/grand-total blocks are added. Valid range submission and
report-page changes close detail. Monthly, top-up and payment-report lists use
functional state toggles so repeated activation reliably opens and recloses.

The thesis remains compact scanning followed by one complete detail. The
approved navy/ice/white, Heebo RTL world and existing `--fin-*` owners are
preserved; the first viewport contains closed rows. This narrow repair inherits
the incumbent composition and adds no new visual identity, seed or system rule.
`PRODUCT.md` was already absent; no init or new product context was introduced.
Backend accounting, authorization, item API projection, filters, full applied-
range export and local 20-order paging remain unchanged. No financial write or
migration is introduced.

| Scoped check | Evidence |
|---|---|
| Production build passed | `/tmp/finance-collapse-build.txt` |
| Successful typecheck and scoped lint, empty logs | `/tmp/finance-collapse-typecheck.txt`; `/tmp/finance-collapse-lint.txt` |
| Existing month-close item projection, historical prices/dates, refunds, URL fallback, authorization and totals passed | `/tmp/finance-collapse-api.txt`; `tests/month-close-sites.mjs` |
| Billing/refund and history handler checks passed | `/tmp/finance-collapse-handlers.txt`; `/tmp/finance-collapse-history.txt` |
| All six finance surfaces/actions at 320/390/1440px; mouse/Enter/Space repeated toggles, one-open-record, sites hidden on collapse, monthly dates and no overflow | `/tmp/finance-collapse-browser.txt`; `tests/finance-siblings-browser.mjs` |
| Main approved-order browser regression passed | `/tmp/finance-collapse-orders-browser.txt` |

Current captures are
`.sites-runtime/finance-siblings-browser/month-close-sites-{closed,expanded,reclosed,monthly}-{320,390,1440}.png`.
The fresh independent reviewer manually inspected expanded and reclosed captures
at 320/390/1440px and the monthly capture at 390px, returning **ship** for the
scoped runtime correction with no material fixes required. These checks use
isolated fixtures and perform no live financial writes. Physical iOS, live
authenticated pixels and an automated pixel diff are not certified. Context
loading was unavailable earlier and the detector timed out without output;
no clean detector result is claimed. The corrected source has not yet been
deployed. Earlier out-of-scope documentation drift is preserved, not repaired or
promoted into a design-system rule.
