# Approved customer account presentation, 2026-10-20

Scope: customer articles, orders and wallet only; staging deployment only.
Base: f33a15cb107a4c2b5054594e34c28d81e4714b2e.

Implemented cart-style white panels, navy/cyan palette, compact horizontal
account navigation, real article/order rows, customer wallet empty states, and
responsive 3-by-2 navigation/mobile cards. Header/footer, API readers, financial
transitions, existing dialog owners and all original action callbacks are retained.
Source truth and canonical owners: DESIGN.md and UX-CONTRACT.md.

Validation:
- Frozen pnpm installation; production build and TypeScript: pass.
- ESLint on changed TSX: no errors; existing unused imports/image advisories.
- Existing client-hub, customer-order-screen, purchased-ui, customer-articles-ui:
  pass; drafts, writing, approval, published links, demos and cancellation retained.
- wallet-usage and payment-reports: pass (122 report/closure/lobby assertions).
- Full isolated integration: 630 checks; supplier privacy: 911 checks.
- Real Chromium rendering of the built application, all three customer screens
  at 1440, 768, 390 and 360px: no horizontal overflow; account navigation targets
  >=44px. Real React components with API fixtures only, no live account writes.
- Article search/clear/input focus/AI navigation, order expansion/collapse and
  product details, top-up and usage dialogs: pass.
- Empty, request-error and populated wallet states, reduced motion: exercised.
- Browser reports no uncaught runtime errors. Intentional 503 responses test
  request error states. Build data is isolated from the live staging database.

Limit: these runtime UI checks use fixtures and do not verify a signed-in live
staging customer's balances or submit actual financial actions. Live staging
authentication remains unchanged. No exact pixel-identity guarantee is inferred
from generated mockup images: real product data, permissions and the existing
global header/footer remain authoritative.
