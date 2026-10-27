# Unified orders and final approval

Business source: owner's explicit instructions of 27–28 October 2026 in this
project. Runtime rules live in payment-reports, split-payment, wallet-card,
finance, account-management and payment-evidence. No production data was edited.

All six existing order/finance routes retain their URLs and handlers and share
one Orders header: desktop category tiles and a mobile portal Select. Existing
record details, financial exports, uploads and actions remain available.

The reporting month uses the server's final confirmation timestamp in Israel
time. Order creation, declared transfer date, report time and approval time remain
separate. Legacy receipts use trusted record creation/paid_at timestamps; absent
approval evidence is marked unknown rather than backfilled from a claimed date.
Purchase-month debt ledgers stay grouped by purchase month, clearly distinct from
the final financial month shown inside each order's payment summary.

Cards cannot be manually reported or manually approved. Wallet topups use the
existing generic payments adapter (create_payment + signed payment-callback),
with purpose wallet_topup, immutable topup_id/order_id, cents, ILS and a provider
idempotency key. Only a signed paid callback matching the amount grants wallet
credit. Browser redirects and failed callbacks never grant credit. Provider
integration must support this payload; isolated mock tests do not certify live
merchant connectivity, clearing or a particular processor's native API.

Bank topups require transfer date, reference, amount and optional image/PDF.
Pending approval, rejection and cancellation remain distinct audited records.
Card checkout sessions appear as awaiting gateway, never awaiting manual review.

Per-item cancellation reduces unpaid totals/monthly debt without credit. Paid
refunds default to wallet or record an externally completed reimbursement with
required description. External recording does not execute a processor refund or
bank transfer. Component claims, guards and an immutable per-component record
prevent repeat refunds. History includes timestamp, destination, note, amount,
prior article state and manager. Customer projection excludes manager identities.

Sent/published articles enter a pending cancellation until the manager explicitly
confirms stopping/removing publication. Supplier reporting is blocked while
pending. The warning distinguishes published from sent, scheduled and draft.
Supplier liabilities are retained; refunding a customer does not erase supplier
costs. Native date/month controls retain browser/OS popup ownership, while the
category picker and other Select controls use existing authored Radix primitives.

Verification uses isolated D1/R2 and mock providers; no real payment, refund,
supplier dispatch or mail delivery was attempted. Browser fixtures render actual
components and built CSS with synthetic data at 390px and 1440px.

Release checks: build and TypeScript passed. orders-finance:112, payment-audit:120,
payment-reports:119 and split-payment:82 API assertions passed. Actual component
browser fixture passed all six categories at 390/1440, portal navigation, final
month, published warning and external-refund failure/retry. Cart/checkout action,
phone and add-feedback regressions passed. New focused UI/module ESLint passed.
Project-wide premium static audit still reports legacy cross-project ownership
and form/style findings; it is not represented as a clean global audit.

Final verification (28 October): all six routes were rendered with the actual
admin-design-v172/editorial ancestors, including AdminOrderHistory rather than
only its detail component. Narrow summary labels now have a minimum usable line
width and a compact-height browser assertion. Main-list expansions expose the
same shared item-cancellation action and final-payment-month component as the
other financial views. Hebrew typography, 390/1440 layout, authored category
selection, paid/unpaid actions, external refund failure/retry and published-state
warning passed. Production build and TypeScript passed after these adjustments.
