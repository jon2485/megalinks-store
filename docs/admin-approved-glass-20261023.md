# Approved administrative glass system — 2026-10-23

The owner approved the work-center, orders and five-tab phone navigation mockups,
then authorized the whole administrative interface and a staging deployment.

## Implementation

- One admin-only silver-blue glass adapter over existing screens and controls;
  self-hosted Heebo, navy logo header, opaque readable text, RTL and bidi data.
- Complete grouped navigation stays canonical in `lib/admin-navigation.ts`.
  All original destinations remain; pricing aliases are explicit. Desktop rail,
  always-visible complete-menu button and phone Sheet share this owner.
- Mobile-only detached five-item frosted dock: work center, orders, articles,
  customers, support. Transparent moving selection; safe area, reduced motion,
  reduced transparency and forced colors have explicit variants.
- First work-center section is a real, read-only update feed, 20/page, with
  action/information filters, literal search, paging and empty/error/retry states.
  Existing nine treatment queues and every embedded action remain accessible.
- Payment events open the exact order and its pending report/receipt; article
  events open the exact editor; support opens that ticket. No read approves a
  payment, dispatches a supplier or marks anything handled.
- Server badges count distinct actionable identities across overlapping queues;
  zero is hidden and stale values remain marked. Existing business statuses own
  resolution, without a new generic handled flag or schema.
- Orders retain paid/unpaid, month, query, expansion and scroll when returning
  from the full detail. Expanded rows restore after detail content is ready.
- Full-page support reply opts into dirty signaling and browser-exit/back guards;
  failure retains content, duplicate save is blocked, success clears dirty state.
  The original modal support form retains its existing behavior.
- Knowledge management joins the common rail/header/tabs without dropping editor
  fields, category/image/date controls or publication actions.
- Existing financial/publication mutations, amounts, statuses and permissions
  retain their original owners. New private nested routes are noindex.

## Verification

- TypeScript and production build passed.
- Scoped lint: zero errors and warnings. Scoped premium strict audit: zero findings.
- 40 actual built Worker/D1/R2 checks passed: authentication, role boundaries,
  feed paging/search/filter/clamping, exact destinations, distinct badges,
  ownership, noindex and read-only behavior.
- Isolated support actions passed: dirty state, status change, failed-save draft
  retention, exact PATCH payload, duplicate prevention and successful dirty clear.
- Existing order-history, lobby-panels, pricing-admin-ui, admin-finance-ui and
  admin-complete-actions tests passed. Staging's required cart/checkout actions,
  phone actions and cart feedback tests also passed.
- AST comparison preserved all 28 existing screen mutation calls and four
  workspace mutation calls; other original exported screen functions are
  byte-identical except the approved order navigation and opt-in support variant.
- An independent finish reviewer identified three workflow gaps; all three are
  resolved in the final source verdict. This is a limited source verdict.

## Visual evidence and limits

The real compiled application was inspected through the supported browser preview
with isolated seeded data. Observed: populated desktop work center, complete
phone Sheet with close/focus return, populated phone feed/dock, and 25 phone route
layouts including exact order/ticket pages without horizontal overflow at the
390px frame (375px content after the visible scrollbar). No fixture data or QA
server is included in the release.

The browser transport failed during the remaining desktop matrix, followed by two
300-second transport timeouts. No complete final desktop/mobile pixel-fidelity,
all-dialog or whole-site visual claim is made. The light selected-sidebar,
contrast and final workflow fixes passed source checks; their final rendered
captures were unavailable. A blank mobile screenshot was excluded as invalid.

A pre-existing `monthly-admin-ui` assertion against unrelated checkout copy still
fails; this change does not touch that copy. The monthly runtime owner and
financial handlers are preserved; no full-site test claim is made.

Staging only, based on live commit 573e6cfa62f3038dd1cec20c7104e28d69a038d0.
Source snapshots for edited existing files matched that immutable release before
changes. Production hosting, variables, database schema, volume and secrets are
outside this release. Rollback is the previous pinned staging commit.
