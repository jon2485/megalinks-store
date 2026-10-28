# Approved order screen refinement

Mode: Operate. Explicit user approval on 2026-10-28; subsequent request is to
check all screens again before staging publication. No new aesthetic direction.

Approved reference files in the conversation workspace generated_images/:
- exec-7f37895c-b68a-4013-a821-96b1fb247293.png: collapsed list with customer name.
- exec-9de2f537-46b1-4b97-993a-84d66bc42d98.png: compact regular order.
- exec-1f0a8c88-89de-4246-992d-b168f1cc3d99.png: compact open monthly order.
- exec-eb6513af-c592-4861-b371-3cbde71885e7.png: payment disclosure composition.
- exec-498616b6-1f2e-414a-923a-e7556a5ae203.png: management and inline refund.

The user's later explicit copy overrides the billing mock: show order creation
with time, manager-confirmed receipt with time, proof and final assigned month.
The declared bank transfer date and customer report timestamp are not additional
visible rows. All names, status, money, timestamps, files and counts remain live.
Mock sample data is never shipped into runtime. Existing shared global navigation
and six real finance destinations retain their established owners.

Runtime owner: app/orders-approved.css, composed with orders-reference.css.
Behavior: UX-CONTRACT.md; data sources and security: existing API and private file
endpoint. No PRODUCT.md exists; this refinement introduces no new product claims.

Direction: precise white compact records on ice, fine separators, navy Heebo,
teal links and closure pills. Main reading order is identity, amount/status,
URL/price lines, two subtotal columns and total, then quiet management/export.
Monthly lines add a date. Payment detail is a disclosure. Management reuses
RefundForm with explicit state-dependent warnings and audited backend actions.

Evidence: tests/orders-approved-browser.mjs uses real components/CSS with isolated
synthetic API fixtures at 320/390/1440. tests/orders-finance-browser.mjs checks all
six sibling pages. Captures under .sites-runtime/orders-approved-browser/ are
valid browser-rendered evidence, not mocked raster UI. No physical iOS Safari or
signed-in live financial mutation is certified by these tests.

Final bounded finish review: ship to staging. The first review requested only
recapturing monthly views from the document top; these were replaced at the same
320/390/1440 paths and reviewed again. No material findings remain within this
scope. No automated pixel-diff or global clean-audit claim is made. Strict static
audit retains legacy/ownership findings; new shared Textarea instances explicitly
use resize-none, and the native-select scanner flag is the existing authored
Radix Select, not a newly introduced browser-native select.
