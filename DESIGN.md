---
version: alpha
name: Mega Links
description: Hebrew publication catalog with existing cyan and navy identity and restrained content-forward motion.
colors:
  primary: "#071f4b"
  background: "#f7f8fa"
  foreground: "#172b32"
  card: "#ffffff"
  accent: "#e8f8fb"
  destructive: "#ca4b4b"
typography:
  body:
    fontFamily: "Arial, Helvetica, sans-serif"
    fontSize: "16px"
  display:
    fontFamily: "Heebo, Arial, Helvetica, sans-serif"
rounded:
  DEFAULT: "0.7rem"
  catalog-card: "28px"
spacing:
  catalog-gap: "16px"
  catalog-max: "1760px"
---

# Mega Links design context

## Overview

Product register: a Hebrew publication marketplace for choosing sites, comparing
existing prices and preparing publication orders. Preserve the current identity,
logo, card contents and operations. The signature is content arriving into view,
like publications being brought forward on a desk. The approved reference is the
latest split homepage preview: Hebrew text at right, the original glass-link
illustration at left, and the original product cards below. Current explicit scope
is presentation only: preserve all existing application callbacks and policies.

Runtime CSS is canonical (ownership model B). This document mirrors its values;
it does not generate CSS. Existing business and permission constraints remain
in `docs/security.md`, `docs/supplier-data-privacy.md` and the server implementation.

## Colors

Navy anchors titles/actions; cyan surfaces and borders provide catalog depth.
Existing orange purchase actions remain unchanged. Brand values are owned by
`app/globals.css` (`:root` and the `.azure-catalog` section), with Tailwind aliases
in its `@theme inline` block. Motion introduces no new brand palette.

## Typography

Use the existing Heebo family for the catalog body and display, with Arial fallback, Hebrew RTL, and LTR domains.
Use the existing responsive title sizes and numeric currency formatting.

## Layout

Preserve the catalog route and result card anatomy. The hero pairs the chosen
two-line title/subtitle at right with the approved illustration at left, including
phone widths. Search and the existing multi-category picker share a dedicated row
under the catalog heading. The category button stays at right; the search icon
expands to fill the remaining row in 420ms, with both controls 52px tall. Search is
in normal flow and never overlays catalog actions. All 18 categories remain in
the picker; no shortcut tiles. At narrow widths the category track shrinks to
174px while the input retains the remaining width. The category label can wrap
without ellipsis, including selected-category counts. Phone control rows share
the action row's 510px maximum width. The hero illustration keeps
its original appearance with no added CSS drop shadow or ground shadow.
The category trigger uses the dedicated `catalog-home-category-trigger` class,
without legacy margin/min-width utilities or selectors tied to `data-slot=button`.
Radix's asChild trigger owns the rendered `data-slot=popover-trigger`; styling
must follow the stable feature class. Category and search occupy explicit columns
on the same grid row, so legacy shortcut-button rules cannot move or overlap them.
The CTA is "לצפייה בקטלוג". Result grid stays one column by default, two at md,
four at xl. Motion wrappers fill the existing grid cells without layout reflow.
At desktop container widths of 1024px and above, the split hero uses a 1600px
stage, a 40–62px heading and 440–580px illustration. Search/category and the
three action buttons share the same 870px maximum width and RTL start edge,
so the expanded search ends exactly above the end of the bulk-order button.
On phones up to 440px the intro retains side-by-side text and artwork with equal
columns, a 25–29px title, 14px body/CTA, 280px reserved artwork and a 340px minimum
composition height. Text wraps naturally rather than shrinking to fit two lines.
The shared existing header is compact and sticky on desktop and phone; its real
navigation/account/cart controls are unchanged. The document owns page scrolling.

## Elevation & Depth

Preserve original PublicationCard styling in catalog-view.tsx and globals.css:
cyan outer border/shadow, framed real logo, tags, DR/UR/delivery panel, green price
box and orange purchase action. catalog-experience.css owns only the split intro,
lower search/category controls and scoped opening animations. No card restyling,
pointer tilt or extra hover lift is enabled by this presentation change.

## Shapes

Keep current 28px catalog cards, inner panels and existing action-button shapes.
Keep branding and footer unchanged. Header geometry is owned by
workspace-header-compact.css, with a compact sticky shell and existing controls.

## Components

The existing Button, Input, Select, Popover and Dialog in `components/ui` retain
ownership of semantics and interactions; Sonner retains notification ownership.
`PublicationCard` retains content and purchase/favorite callbacks. The separate
`CatalogMotionGrid` owns viewport reveals and cleanup only.

Motion tokens are owned by `.azure-catalog` in `app/catalog-motion.css`:
`--catalog-motion-duration` = 520ms, `--catalog-motion-ease` =
cubic-bezier(.22, .65, .32, 1). Hero enters with a quiet fade/upward movement.
Cards move 24px upward with no scale, with 55ms between intersecting cards
and a 110ms maximum delay per batch. Each card reveals once per mounted
instance, so favorite changes do not restart entrance animations.

The illustration floats 6px once and settles within 4.5 seconds. There is no video
player or pause button. The category popover enters in 260ms; the existing
filter/list dialog enters in 300ms without changing its shared focus/close behavior.
The inline search focuses its input on opening; its close control and Escape clear
the query, collapse the field and return focus to the magnifier. Input focus is
indicated on the rounded outer shell, without a square inner focus frame.
Reduced-motion preference
removes movement and reveals every card immediately, including a preference
change at runtime. Without JavaScript or IntersectionObserver, cards stay visible.
Keyboard focus reveals a pending card immediately. Print reveals all content.
Animation shells own entrance transforms; original inner-card hover styling stays.

## Do's and Don'ts

- Preserve data, permissions, routes, card anatomy and catalog behavior.
- Keep labels direct, in Hebrew, and iconography in the existing Lucide family.
- Do not apply motion rules globally to admin tables, checkout or other cards.
- Do not use exaggerated springs, large tilts, new brand gradients or fake data.

The approved illustration at public/brand/home-publication.webp is decorative and
aria-hidden, remains visible alongside the copy on phones and has reserved image
geometry. It contains no invented publication names, endorsements or metrics.
Existing real website logos remain untouched. No preview data ships into the app.

Intro token mapping (runtime model B): `--catalog-ink` = #0a234c,
`--catalog-cyan` = #00bed4, `--catalog-blue` = #087af7,
`--catalog-copy` = #617184, `--catalog-surface` = #ffffff, owned by
`app/catalog-experience.css`. Intro components consume these catalog-scoped tokens.
The matching original global brand tokens are not changed.

## Railway staging sign-in

The staging gateway owns only its isolated sign-in document. Existing application
UI, navigation and business permissions are unchanged. It mirrors the canonical
navy `#071f4b`, background `#f7f8fa`, foreground `#172b32`, card `#ffffff`, cyan
`#e8f8fb`, Arial fallback and 16px body baseline from this document. Labels and
feedback are Hebrew RTL; email and password values are LTR. The single form uses
48px controls, visible focus, masked password with a show/hide button, inline
errors and a stable disabled submit state. No animation or external assets.
It intentionally uses a standalone HTML document because the server must reject
unauthenticated requests before serving the application or its static assets.

## Limited admin v172 design slice (2026-10-18)

Approved direction: Tabler-inspired work navigation with Mega Links navy/cyan,
white surfaces, Heebo/Arial, 16px baseline, restrained 8–12px corners and clear
focus/hover states. Runtime ownership stays with CSS (model B).
`app/admin-design-v172.css` owns only `.admin-design-v172` descendants. This class
is emitted only for an authenticated administrator on an existing admin route.
No global tokens, shared component styles, portals or customer/supplier pages change.

The desktop layout has a 244px RTL sidebar, a 28px gutter and the existing React
content. At 1100px the same navigation becomes an in-flow disclosure with a
44px labeled toggle; no modal, overlay, gesture or duplicate focus trap is added.
The search covers the existing 21 destinations in the same 9 admin areas.
Navigation links delegate ordinary activation to the unchanged `ctx.go` dirty
guard. Deep routes and browser history handlers remain owned by workspace.tsx.
The existing browser-popstate dirty-guard gap is documented, not silently fixed.
The skip link targets the admin-only focusable content wrapper.

NEW-01: ordinary destination selection closes the in-flow mobile navigation and
returns focus to its toggle when that toggle is visible. Modified link activation
keeps the current navigation/editor intact. The same ctx.go call still owns the
dirty decision; closing this presentation disclosure does not save or discard data.

This slice styles the actual AdminOrderHistory and CatalogPricingWorkspace;
filters, totals, exports, pagination, four pricing tabs and all mutations keep
original implementations. Form dialogs and their save mechanisms stay untouched.
No prototype save code or demo records are imported. This paragraph describes the
first, limited rollout; the subsequently authorized full presentation rollout is
documented below. Browser/assistive-technology and live business-write workflows
remain unverified rather than inferred from HTTP or fixture tests.

## Full admin presentation rollout (2026-10-18)

The user authorized all administrative screens, still on the design branch and
protected Railway Staging only. Production, main and business data stay untouched.
The rollback branch for the previously accepted slice is
`restore/admin-ui-before-full-20261018` at `b3e62a8473a2f808144a802bafb0fadb622db8cc`.

Extend the approved Tabler-inspired navy/cyan workspace through every existing
admin screen. Use the current Hebrew Heebo/Arial fonts, 24–30px page headings,
14–16px controls/body, 12–13px metadata, 8–10px corners, white surfaces, cool gray
dividers and tabular monetary figures. Do not introduce new font downloads,
gradients, metrics, graphs, activity feeds or demo data. The UI/UX Pro Max broad
system query suggested a marketing/glass style; that mismatch was rejected. Its
focused enterprise-minimalism guidance supports the already approved direction.

The 232px sidebar has nine areas. Four grouped areas use native `details/summary`;
the active area starts open and all 21 original destinations remain real links.
The existing mobile disclosure and ctx.go dirty guard remain owners of navigation.
Search now has a localized clear button with input focus restoration. Do not add
route/history writes, permissions, save logic or new network calls to navigation.

The dashboard keeps all nine real task queues and the exact AdminLobbyPanel.
Above 1080px of content width, a 268px queue column sits beside the work panel;
below it the queues form a 3/2-column grid above the panel. No task action, count,
dirty guard, polling behavior or selection callback changes. The document owns
the working panel's vertical scroll, including long embedded editor forms.

The same admin-only CSS themes orders, payment review, topups, invoices, monthly
accounts, customer permissions/account views, catalog/tier/customer prices and
Sheets, suppliers/settlements, content/publication, promotions/bundles, service,
settings/reports/audit and integration logs. Native table overflow remains local.
Controls, labels, available/disabled states and confirmation/save handlers remain
canonical to their original React components. No dormant view is enabled.

Radix owns portals, focus, Escape, dismiss and busy locks. Portals are themed only
under `body:has(.admin-design-v172)`, which requires the authenticated admin route
class to be currently present. No persistent body flag or shared primitive change
is introduced. Long dialogs get a viewport-bounded scroll area; fields remain
16px on phones and all original form sections stay reachable. Essential actions
are not hidden. Decorative support/hero waves and redundant table headings may
be hidden in the documented compact layouts, never data or operations.

All full-rollout runtime tokens belong to `app/admin-design-v172.css` (model B).
Ink #071f4b, background #f4f6fa, surface #fff, muted #526579, line #d8e0e9,
action #086b91, success #18735a, warning #8a5a0a, danger #ac304a.
Focus #087ac8 stays visible. Reduced motion/forced colors are supported. The
shared customer/supplier styles and top-level primitives remain byte-identical.
# Admin workflow Stage 1 — approved 2026-10-19

Scope: admin-only presentation, based on `9dc747bbea5a8ec4736c536b1bbb6470d7dc1241`.
Keep Mega Links Heebo/Arial, navy/turquoise, existing semantic queue tones and compact
tables. The three sidebar headings are visual separators; nine domains and all 21
destinations retain the canonical routes. The center is called מרכז העבודה.

Operate: put the real treatment panel first in reading order; desktop places a
240px compact queue column beside it. On narrow containers show the selected queue
and a disclosure before the panel; the full selector is hidden until requested.
The original nine queues and default payment-report panel remain. Composite queues
show individual subcounts plus a presence label, never an invented combined total.
Keep original dirty guards, embedded panel callbacks, record search and financial
decisions. Opening a record does not resolve it.

Sidebar attention is a small count only for a single reliable queue, otherwise a
presence dot. Accessible text states the individual queue counts. Existing data is
shared by sidebar/lobby with one enabled 30-second admin-only reader. Retain stale
data with an explicit refresh error rather than implying it is current. No unread,
revenue, urgency or activity metrics are invented. No hooks, animations or new fonts.

Stage 1 static Impeccable scan has no primary findings; radius/type/color advisories
remain evidence to review visually against this established brand. Browser layout,
touch, zoom and focus QA are pending; static scans and SSR are not visual approval.
