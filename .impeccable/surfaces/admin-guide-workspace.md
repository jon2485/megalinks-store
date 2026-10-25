# Administrative guide workspace — approved 2026-10-25

## Authority and scope

The supplied approval covers framed Hebrew RTL notifications, orders and the
separate mobile month-summary report. It preserves the existing Mega Links
navy/cyan identity, local Heebo, real header/menu and five-destination dock. The
latest approved order rule keeps every unpaid monthly order in monthly-open
until payment is confirmed; closing purchases or issuing a monthly PDF does not
prove receipt of money. UX-CONTRACT.md records the implemented workflow owners.
No PRODUCT.md exists in this repository; this brief creates no product policy.

The approved composition references, relative to the repository root, are:

- `../generated_images/exec-459eda6d-8653-4c3a-aa86-4015fac14bc9.png` — open/handled notifications.
- `../generated_images/exec-2267a0bb-23ba-4b45-b40b-7c5483ef92ed.png` — order choices and expandable payment report.
- `../generated_images/exec-53f8191c-6170-480b-a789-e96b7a443bbb.png` — mobile month summary and report orders.

Reference text, names, amounts, counts, logo drift and illustrated dock geometry
are illustrative. Runtime uses actual records and the existing shared header/dock.
Viewing the references is not a comparison against a rendered application capture.

## Incumbent comparison and visual ownership

The source was compared with DESIGN.md, UX-CONTRACT.md, the existing
`admin-editorial` surface brief, `app/admin-editorial.css`,
`app/admin-approved-glass.css` and `app/admin-design-v172.css`.

| Relationship | Incumbent retained | Scoped guide addition |
|---|---|---|
| Identity and shell | Heebo/Arial, navy/cyan, authenticated editorial wrapper, complete searchable header menu, five-item phone dock and document scrolling | Three `.admin-guide` surfaces within the existing shell; no new navigation rail or shell owner |
| Visual language | White editorial work, pale blue boundaries, explicit blue actions, RTL/bidi and real status labels | Guide heading waves, framed records, prominent state/category choices, expandable report details and aligned summary lines |
| Tokens and controls | Runtime model B, inherited `--admin-v172-*`, existing native single-select/date variants, original record/payment dialogs | Local guide aliases and closed-field styling; scoped frame/heading/spacing variants |

`app/admin-guide-workspace.css`, imported by `app/workspace.tsx`, is canonical only
under `.admin-design-v172 .admin-guide`. `AdminUpdateFeed`, `AdminOrderHistory` and
`AdminMonthClose` opt into it. Header/menu/dock remain with the existing shared
owners; dialogs, Sonner and embedded order/payment controls keep their owners.
Customer, supplier, catalog and other administrative surfaces keep theirs.

`--guide-ink/copy/line/blue` inherit respectively from
`--admin-v172-ink/muted/line/blue`. Their fallbacks are `#071f4b`, `#50627d`,
`#cfe5ef` and `#0872d5`; the inherited values take precedence. Local ice is
`#f1fbff`. Frames use white, a pale inherited border, 14px corners and
`0 4px 16px #18426104`; controls retain 8px corners. Focus is a local visible
`#1689da` outline; the search shell owns its containing focus indicator. Selected
choices use pale cyan, while green/amber/info treatments accompany textual status.
These are scoped CSS values, not new global design primitives. This documentation
merge preserves the incumbent frontmatter and `.impeccable/design.json` unchanged.

## Composition and responsive behavior

The guide stage caps at 1180px; at viewport widths of 1360px and above,
notifications cap at 980px and orders at 1020px. The heading pairs a navy title
with its refresh, report link or back action over local
`public/brand/admin-guide-waves.svg`. Titles use `clamp(30px, 3.2vw, 44px)`,
weight 800 and line-height 1.3. Fields remain 16px, controls 15px and hints/meta
13–14px. Amounts use tabular figures and `bdi`; Hebrew labels and long values wrap.

Notifications place open/handled choices, search and type filter before the
record stack. Each frame presents title/status, record/customer facts, timestamp,
detail and exact-record/handling actions. Orders place three full-width category
choices before month/search/export controls. Each record has order/customer/date,
payment status, method and gross amount, expandable original details and a visible
record action. Pending reports expose their real reported date, amount, reference
and proof; approving money remains a separate existing action. Archive/customer
tools remain in an explicit secondary disclosure.

The month-summary page is separate from orders and from the existing monthly
account close/PDF workflow. Range/date-basis controls, summary and order list use
separate frames. Five summary rows distinguish net, VAT, gross, direct cost and
calculated profit; cyan highlights profit. Warning copy explains missing cost and
payment-date data. The report list uses native `details/summary`, showing compact
identity/income on phones and retaining the other facts inside each disclosure.

At 760px and below, titles become 30px, frame padding generally becomes 18px,
filters use a two-column layout and the date-basis field spans both columns.
Notification actions remain paired until 390px, where they stack. At 390px and
below, the month-summary link spans its heading row. Controls have 46px minimum
height; search clear and record/back actions retain at least 44px targets. The
existing editorial shell owns phone gutters and bottom dock/safe-area clearance.
Reduced-motion rules remove movement; forced-colors rules preserve choice/status
boundaries. These are source-backed behaviors, pending rendered verification.

## Interaction and data constraints

- Notification handling is explicit persisted metadata with an immutable snapshot,
  actor/time and exact event version. Opening a record never handles it. Handling
  never approves a payment or publication. Reopen requires the same unchanged
  event; updated events can appear open while older snapshots stay in history.
- The order categories are exclusive: unpaid monthly/on-account orders stay
  monthly-open despite purchase/monthly closure or reported/rejected payment;
  confirmed paid/settled orders are closed; ordinary unpaid orders are in process.
  Fully cancelled orders and demos belong to the archive.
- Native `select` and `input[type=date]` deliberately retain OS-owned popup
  geometry and native semantics. Guide CSS owns the closed control, visible
  label and focus only. No custom native-popup rendering is implied.
- Search text commits on submit, with explicit clear; selects/category choices
  commit directly. Queries, filters, page and scroll stay in the transient
  `adminViewState` map for internal return navigation. The current `go()` is
  path-only; sensitive customer query text is not placed in page URLs, browser
  storage or analytics. Report range/basis edits stay drafts until explicit show.
- Applied request/filter checks prevent mismatched prior results from rendering.
  Both server lists use 20 records/page. The report reads the complete range and
  paginates 20 locally. Exports use the applied filters/range across every page.
  Excel aggregates one row per client with all selected order numbers and totals.
- Report income is confirmed order net/VAT/gross after recorded refunds, without
  a second wallet-top-up revenue count. Direct costs are purchase snapshots before
  VAT, including writing when recorded. Missing/ambiguous zero/writing costs are
  incomplete values, never invented zeroes. Profit remains null where costs are
  missing. Recorded supplier cost persists after a customer refund; supplier cash
  payments and unrecorded business costs are not claimed by this report.
- Payment date and order date are explicit bases with Israel-day boundaries.
  Missing confirmed-payment dates are flagged rather than inferred from creation.
  The report is a GET/read-only workflow, not a financial settlement operation.

## Evidence and verification limits

This pass read the three guide components and CSS, `lib/admin-navigation.ts`,
workspace routing, order classification/data, notification version/history logic,
date-range helpers, report builder/server/workbook, return-state implementation,
the incumbent design owners and the three approved reference images. Existing
unrelated documentation drift was preserved.

The implementation owner reports production build, typecheck and scoped ESLint
passing; report integration covers exclusive order categories, 1,005-row filtered
export, auth, cost/refund/date boundaries, grouped workbook totals and the legacy
settled payment method. Notification integration covers durable history,
idempotency, version conflicts and no financial/publication effects. Order/guide
handler suites, existing glass/cart checks and 919 supplier-privacy checks passed.

The unchanged payment-report test passes 97 checks before an inherited retired
lobby-alias assertion; only a temporary copy adapted to the already-existing
exact-order route passed all 122. The original suite is not recorded as fully
passing. The Impeccable detector reports palette/type advisories without
non-advisory findings. The unconfigured strict audit reports 75 findings. With
temporary explicit declarations of the existing native Select/Date variants,
the five guide modules have zero findings and 48 legacy findings remain globally.
No audit waiver manifest is committed. This brief does not certify global audit
compliance or repair unrelated audit findings.

The independent source reviewer reports the legacy settlement-method issue fixed
and a source-only pass. Actual browser capture is blocked: cloud Chrome cannot
reach the running local `0.0.0.0:7777` server and returns
`ERR_CONNECTION_REFUSED`. Screenshot fidelity, computed layout, 200% zoom,
native popups, real focus/touch and live financial E2E are not certified. Any later
visual corrections require a scoped source/token recheck before this brief can
record rendered approval.
