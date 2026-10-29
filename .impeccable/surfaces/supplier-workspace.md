# Supplier workspace

Mode: Operate. Ordinary extension of the incumbent compact Orders and Editorial
Desk system. The latest approved supplier update alone is authorized for the
existing Railway STAGING environment. No identity refresh or global migration.

## Scope and visual authority

The five surfaces are the supplier directory with inline sites; the combined
requests/invoices board; the independently saved supplier/profile and site
editor; invoice review with real history; and supplier settlements. Preserve the
real MegaLinks logo/chrome, navy/ice/white, fine pale-blue boundaries and Heebo
Hebrew RTL. The three category tiles remain equal in one row on both phones and
desktop, labelled ספקים ואתרים / בקשות וחשבוניות / התחשבנות.

Runtime CSS is canonical (model B). `app/supplier-workspace.css` owns supplier
layout and scoped role aliases to the existing Orders/editorial colors. Shared
`ContentCategoryNavigation` uses its supplier variant. Shared finance record,
fact, search, select, page and empty components and shared UI primitives retain
semantics and control ownership. Existing global tokens, frontmatter and
`.impeccable/design.json` remain byte-for-byte unchanged. The root DESIGN/UX
additions are append-only surface documentation.

## Direction contract

THESIS: Compact supplier scanning opens into the complete selected task: sites,
request comparison, invoice review or historical publication costs. The approved
incumbent world is extended without introducing a different supplier identity.

OWN-WORLD: Navy Heebo Hebrew RTL on ice and white, pale separators, existing
cyan selected navigation, blue/outline actions, quiet metadata and tabular money.
The real product logo and global chrome remain visible.

STORY: Administrators find a supplier, inspect actual sites and readiness,
review proposed changes, and distinguish invoice approval from a confirmed
payment. Historical publication costs and actual invoice facts stay legible.

FIRST VIEWPORT: Original chrome and one supplier heading lead to three equal
single-row category tiles, then a white bordered panel with controls and compact
closed records. A selected record expands inline. Editor and invoice detail
are explicit destinations with return actions.

FORM: The existing compact Orders/editorial form, as expressed by the five
approved supplier references. This is an incumbent-world extension; no new world,
seed key, alternative concept selection or replacement comp was generated.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

At this handoff the documentation is complete for the current source; the fresh
independent finish review and authorized staging deployment remain pending.
The parent release record must append the actual verdict and deployment result.

## Direction as built

Directory records align supplier identity, origin, site count and readiness on
desktop. The same native record disclosure reflows at 760px to compact phone
identity/status metadata, with complete site details and actions inside its
hidden body. Request price comparison uses current cost, requested cost,
customer sale and difference before VAT. Invoice/settlement facts retain actual
publication snapshots and the shared net/VAT/total hierarchy.

The profile/site editor uses two columns above 1000px and profile/sites tabs at
or below that breakpoint. Each section owns its separate save. Site editing is
the supplier presentation of the existing catalog form. Canonical list filters
use authored Select; advanced category, WordPress and date controls intentionally
retain the platform-native popup behavior of their existing owners. No new
popup system is introduced.

Invoice review uses two columns above 1000px with a protected document iframe.
At smaller widths, the PDF remains available through its explicit private link.
The history disclosure shows real audit events or an honest empty state. Blue
focus, busy/error recovery, native record semantics and scoped reduced-motion
disclosure remain inherited. No new illustration, logo or shipping raster was
created; the references are composition evidence only, never runtime data.

## Workflow invariants

- Directory counts/readiness derive from real active/paused sites, delivery
  email, cost and procurement verification. Administrator-only cost data stays
  outside customer/supplier list projections.
- One record opens at a time. Repeated mouse, Enter and Space activation opens
  and recloses it, hiding the entire body. Search/filter/page changes close it.
  Request-key matching prevents old directory/settlement responses under new
  filters. Pages contain 20 records; requests page locally over their existing
  response. View state uses only the existing in-memory owner.
- Supplier profile and site saves are independent. Optional profile
  `expected_updated_at`, canonical site version checks, busy/duplicate locks,
  warning handling and retained failed drafts protect current work. The shared
  draft guard protects route/tab/site changes and unload. Catalog default
  presentation and its existing 27-field payload remain unchanged.
- Request review reuses canonical pricing/lifecycle handlers. Baseline cost and
  live customer sale are read only for administrators; approval confirms
  ownership/price/terms, rejection supplies its reason and cancellation retains
  its existing handling/refund prerequisite. Changes affect future purchases,
  preserving historical publication snapshots.
- Matching account statements replace the legacy supplier/month group.
  Publication costs are immutable snapshots; missing costs remain explicit.
  Actual invoice VAT/total, paid/due values and transfer reference are displayed.
  Demo/cancelled records have a separate history view.
- Stored invoice submission time is preferred. Only current `invoice_review`
  may fall back to statement `updated`, written by the existing upload handler
  on submission. Approved/paid legacy records without the stored time stay
  unknown. History uses actual audit rows or stored submission time, never an
  event inferred from updated time or status. Empty history stays empty.
- Invoice approval never marks payment received. Actual payment requires the
  approved invoice, approved payout and no pending payout change, statement
  version, real transfer reference and confirmation of the completed transfer.
  Existing atomic/one-time guards remain canonical. Recalculation explains the
  invoice-history/new-invoice consequence before its explicit action.
- Legacy manual supplier payments retain their net-only owner and explicit
  before-VAT label. Account statements do not use this bypass. Payout details
  remain encrypted and are decrypted only after explicit administrator reveal,
  never by default or in list payloads.
- Private document URLs and safe external links retain their existing endpoint
  owners. An attached invoice is not described as independently verified.
  Runtime names, timestamps, amounts and counts come from actual records.

## Implementation owners

UI: `app/admin-suppliers-workspace.tsx`, `app/supplier-workspace.css`,
`app/supplier-request-review.tsx`, `app/supplier-statement-review.tsx`.
Integration reuses `app/content-category-nav.tsx`, `app/admin-shell.tsx`,
`app/workspace.tsx` and `lib/admin-navigation.ts`. The existing
`app/catalog-website-form.tsx` adds only its supplier presentation branch; its
default presentation and payload owner remain canonical.

Data/read presentation: `lib/admin-suppliers.ts`,
`lib/supplier-presentation.ts`, with administrator-only route wiring in
`app/api/[...path]/route.ts`. Supplier profile CRUD retains its existing owner
and adds optional CAS. Existing pricing, seller request/invoice/payment,
private-file and encrypted payout owners retain the lifecycle behavior.
No existing finance/request lifecycle handler or Orders/content/customer CSS
source is changed by this supplier extension.

Shared owners: `ContentCategoryNavigation`; `FinanceRecord`, `FinanceFacts`,
`FinanceFact`, `FinanceSearch`, `FinanceSelect`, `FinancePages`, `FinanceEmpty`;
Button/Input/Textarea/Checkbox/DropdownMenu; `useAdminDraftGuard`; `pricingApi`;
`admin-view-state`. A `DropdownMenuTrigger asChild` delegates to a real Button;
the source parser's trigger warning is not a missing action.

## Approved references and provenance

All five approved references are under
`/workspace/scratch/467f3ef512a8/supplier-approved-refs/`:

| Surface | Approved reference |
|---|---|
| Supplier directory | `MegaLinks Suppliers Admin Mockup.png` |
| Requests/invoices board | `MegaLinks supplier review dashboard.png` |
| Invoice review | `RTL invoice review dashboard comparison.png` |
| Settlements | `RTL Supplier Reconciliation Dashboard.png` |
| Supplier/profile and site editor | `Hebrew supplier and website admin mockup.png` |

These references were supplied as approved composition authority. Their sample
records do not ship. Existing real logo assets retain their existing provenance;
this extension creates no shipping raster requiring new image-generation
provenance. The context/QUALITY BAR/formal comp-spec/build-state artifacts were
not available, and no automated comp-diff fidelity is asserted.

## Current checked evidence

| Check | Current evidence |
|---|---|
| Final production build passed | `/tmp/suppliers-only-final-build.txt`; earlier current build `/tmp/suppliers-only-build.txt` |
| Typecheck passed; scoped lint has zero errors and one image-performance advisory | `/tmp/suppliers-only-tsc.txt`; `/tmp/suppliers-only-lint.txt` |
| Supplier admin API: counts, readiness, search, pages, selected site, encrypted reveal/admin guard, immutable costs, statement deduplication, actual history, invoice/payment separation, profile CAS/delete guards | `/tmp/suppliers-only-api.txt`; `tests/admin-suppliers.mjs` |
| 48 D1 supplier lifecycle requests, including existing ownership, invoice/VAT, encrypted payout, atomic one-time payment and legacy bypass/file guards | `/tmp/suppliers-only-lifecycle.txt`; existing customer-seller lifecycle suite |
| 967 privacy checks across public/customer/agency/API/supplier paths and private data/files | `/tmp/suppliers-only-privacy.txt`; `tests/supplier-privacy.mjs` |
| Catalog workspace actions and unchanged 27-field save contract | `/tmp/suppliers-only-catalog.txt`; `/tmp/suppliers-only-save.txt` |
| Five real-component supplier surfaces at 320/390/1440px; three equal tiles, repeated keyboard/mouse disclosure, filters/no results, profile CAS, site failure/retry/draft/visibility, request decisions, invoice/payment/ref/busy locks, actual/empty history, payout reveal, reduced motion | `/tmp/suppliers-only-browser.txt`; `tests/suppliers-browser.mjs` |
| Current content browser regression, four routes at 320/390/1440px | `/tmp/suppliers-only-content.txt` |
| Current approved-order browser regression at 320/390/1440px | `/tmp/suppliers-only-orders.txt` |
| Current six-finance browser regression at 320/390/1440px | `/tmp/suppliers-only-finance.txt` |

Captures are in `.impeccable/review/suppliers/`:
`admin-{suppliers,seller-requests,supplier-finance}-{320,390,1440}.png`,
`admin-{suppliers,seller-requests,supplier-finance}-expanded-{320,390,1440}.png`,
`supplier-editor-{320,390,1440}.png`, `invoice-review-{320,390,1440}.png`,
`invoice-history-{320,390,1440}.png` and `supplier-filter-open-390.png`.
This documentation pass manually sampled directory-expanded desktop,
request-expanded phone, site-editor phone, invoice-history 320px and
settlement-expanded desktop, checked the runtime CSS and component owners, and
read the current logs above. It does not replace the independent finish review.

## Limits, drift and release state

The browser fixture renders actual components, chrome and CSS with synthetic HTTP
responses. No live finance, mail, AI or customer write is performed. The PDF
fixture verifies private iframe/link wiring; the native browser PDF plugin,
authenticated deployed behavior and physical iOS are not certified. There is no
automated pixel-exact comparison or whole-application certification.

Recovered earlier work was lost; prior verdict/testing is not accepted for this
source. Current checks were rerun. `PRODUCT.md`, the QUALITY BAR card and formal
comparison spec/build state were unavailable. The incompatible Impeccable
launcher/detect/comp-diff were not repaired or rerun. The current strict premium
audit (`/tmp/suppliers-only-audit.json`) retains repo-wide legacy findings and
source-parser false positives; the real `asChild` action and inherited native
advanced controls retain their actual owners. No clean global audit/score is
claimed. Pre-existing global documentation/sidecar drift is preserved, neither
repaired nor canonized as a new system rule or invented release gate.

The source was assembled on local checkpoint `112fc78` from exact live STAGING
base `1ddd946e4581161b422d7555abea5ab878cd637b`. Before these append-only
records, the remote review checkpoint was
`de8bd37665a70c416ce86e772882127e3d81f094` on
`review/suppliers-only-20261029`, tree
`07e4cf393272966080d7a40b8868c305066c859d`, matching that local source tree.
These identifiers describe review provenance, not a release.

The fresh independent finish review is pending at this handoff. Railway has not
been staged or deployed for this update. Only the final approved supplier patch
may be released over the exact live STAGING base; unrelated staging changes and
other services, environments, configuration or variables are outside scope.
Append the actual scoped verdict and deployment evidence after they complete.


## Post-correction verification — 2026-10-29

The last correction preserves supplier assignment in the actual save: the
supplier presentation initializes `f.supplier_id` from a nonempty explicit
`defaultSupplier`, overriding the old supplier of a selected existing site.
The default catalog branch retains `site.supplier_id || defaultSupplier`. The
selected-site control also occupies a complete phone row; this pass inspected
the refreshed `supplier-editor-390.png` and confirmed that its URL is readable.
No new design tokens, popup owner or global rules are introduced.

| Current recheck | Evidence |
|---|---|
| Production build and typecheck passed again | `/tmp/suppliers-only-verdict-build.txt`; `/tmp/suppliers-only-verdict-tsc.txt` |
| Canonical admin catalog API reassigns `manual-site` to `seller:buyer`; statement net stays frozen at 75,000 cents | `/tmp/suppliers-only-verdict-api.txt`; `tests/admin-suppliers.mjs` |
| Production form selects another supplier's `other.example`, saves and asserts the actual site ID plus intended supplier ID; full 320/390/1440px matrix recaptured and all supplier actions passed | `/tmp/suppliers-only-verdict-browser.txt`; `tests/suppliers-browser.mjs` |
| Default catalog 27-field save contract passed again | `/tmp/suppliers-only-verdict-save.txt` |

The parent release owner also checked that the 12 protected source files remain
byte-identical to the exact live base. This append preserves all preceding
DESIGN/UX/surface bytes, the original frontmatter/tokens and the unchanged design
sidecar. The fresh independent reviewer is scoring the correction findings; no
final verdict or deployment is asserted. Existing fixture/PDF/live/physical-iOS
and automated-comparison limits remain applicable.
