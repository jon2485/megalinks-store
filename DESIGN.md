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

## Admin foundation Stage A 2026-10-19

This authorized extension starts at b6406ff and changes only AdminLobby,
AdminOrderHistory and UsersAdmin. The existing navy/cyan Operate identity and
runtime Model B tokens are retained. No new global token or shared primitive changes.
The scoped `admin-foundation-*` variants live in admin-design-v172.css and consume
`--admin-v172-ink/muted/line/surface/bg/accent/blue/focus` from that file.

The signature is a stable list/detail working area: compact queue navigation next
to real treatment, month-grouped orders with a quiet four-cell summary strip, and
a bounded user list beside a wider account panel. Spacing uses 4/8/12/16/20px;
headings are 26px (24px on phones), body/controls 14–16px, metadata 12–13px,
and account totals 22px. Corners remain 5–10px, flat except existing overlays.
No new animation, decorative metric, asset, font or brand color is introduced.

The expanded mobile queue selector moves before the treatment panel in both DOM
and visual order so it follows the toggle. Selected-queue context remains above
both. All original guard decisions remain identical. Users below an 800px content
width show list OR selected details with a visible back action; desktop shows
both. User lists alone own a 38rem bounded scroller; detail forms retain natural
document scrolling. No fixed viewport height is imposed on shared shells.

This section supersedes earlier Stage 1 wording requiring work-panel-first DOM
order, and full-rollout wording about duplicate mobile user actions. It does not
supersede business, permission, data or save contracts. The CSS is implemented;
visual rendering at required viewports and 200% zoom is not yet verified.


## Cart and checkout approved refinement — 2026-10-21
The existing scoped `cart-checkout-refresh.css` remains the visual owner; keep
Heebo, navy/cyan, original cart art and checkout waves. Desktop shell stays.
Cart phone cards align the original logo/name/domain, actual list/current prices,
discount, quantity and removal. Writing disclosure starts collapsed and reports
any persisted selection; explicit actions remain owned by EditorialAddon.
Checkout uses a read-only item summary (logo, name, quantity, line total), with
cart edits reached through the existing back route. Phone follows invoice name
in DOM order; desktop keeps the phone directly underneath invoice name.
Payment tiles use three equal columns, or four when the existing monthly
permission supplies the fourth option. On phones, descriptions outside the
chosen-payment guidance are omitted from the tiles to retain readable labels.
The final amount and all summary figures come from the existing quote/cart
projection, in cents. Catalog confirmation stays in the existing purchase button
for 2400ms after the canonical success event; its short icon transition respects
reduced motion. This is presentation only and does not change payment transitions.
Browser/real-device visual verification is pending when execution is unavailable.
Cart reference detail correction: the native quantity select removes inherited
arrow/padding and centers both text alignment modes. List/current prices stack
above a bold red discount at all widths. Custom writing uses a centered word
stepper and the compact blue “שמירה” button; stepping only changes the draft.

## Approved knowledge hub and editorial workspace — 2026-10-22

The three approved mockups extend the existing identity, not the cart or other
administrative surfaces: public `/knowledge`, public `/knowledge/[slug]`, and
the authenticated `admin-knowledge` list/editor. Runtime model B remains canonical.
`app/knowledge.css` owns `--knowledge-ink` #071f4b, copy #425574, blue #087af7,
cyan #00bed4, line #cfe5ef, ice #effaff and translucent white surfaces. These
map to public cards, article contents/callouts and editorial panels through the
same scoped variables. Heebo is the existing local font; no font change or CDN.

The public signature is a pale cyan wave masthead above a featured article and
two-column compact article grid. Use editorial photography, 13–16px card copy,
18px reading text and bold navy titles. Article copy remains calm white, with
restrained glass reserved for the contents panel and callouts. The real existing
brand logo and header remain canonical rather than copying generated logo drift.
Desktop article contents sit at left; phones put compact contents above the
article. Related cards stack at phone widths. No mock claims or sample articles
are automatically published.

The admin editor uses a wide RTL writing column at right and a 330px metadata
column at left, 12px panel corners, 42–44px actions, a sticky toolbar and explicit
draft/preview/publish actions. Below 650px it becomes a single column, retains
all fields and tools, and keeps bottom actions in document flow. The screenshot
approved this editor-specific absence of a persistent admin sidebar; other admin
screens retain theirs. Shared RichEditor owns editing, links and undo; its named
`knowledge` variant supplies the compact toolbar and optional table insertion.
The original order-article editor keeps its existing default variant.
## Approved catalog glass and knowledge masthead — 2026-10-23

The approved catalog reference is the final silver-blue metrics strip and matching
category/Dofollow pills. `app/catalog-product-glass.css` owns their surface, edge,
shadow, Heebo typography and state tokens. Preserve the product card, price panel,
real DR/UR values, country, favorite and existing actions. Replace the displayed
delivery cell with the publication-notes action; the original delivery data stays
unchanged. The notes chevron sits to the left of the Hebrew label, and the speech
bubble leads at the right. Its controlled Radix popover owns disclosure and focus.

The public hub now follows the approved centered navy title and cyan-to-blue
second line, without decorative illustrations. `knowledge-hub-approved.css` owns
only `.knowledge-hub` layouts: search above wrapping categories, one featured
article and a three-column desktop photo grid that becomes a single mobile column.
It consumes the existing knowledge palette and Heebo font. Article reading and
the administrative editor keep their established layout.

## Publication scheduling — 2026-10-22

Preserve the approved navy/cyan/pale-glass UI. Place the customer calendar card
above the existing article save/send actions, and the blog picker in the editor's
publication settings. Both use the same Hebrew, RTL, confirmable calendar dialog.
No supplier dispatch before the chosen Israel day AND subsequent manager approval.
The selected date remains readable in the locked scheduled state, with an explicit
withdraw-and-edit action. Calendar table resets are scoped to this dialog to avoid
altering existing tables or other screens.


## Approved administrative glass system — 2026-10-23

The owner approved the work-center, orders and mobile navigation mockups.
This section supersedes the earlier flat/dark-sidebar administrative presentation
only. Customer and supplier screens retain their existing visual ownership.
The register is Operate: real records and explicit actions lead the page.

Runtime owner is `app/admin-approved-glass.css` (model B), loaded after the
legacy adapters. Tokens: ink `#0b274d`, muted `#546b85`, line `#d6e5f0`,
background `#f1f7fc`, action `#0872d5`, focus `#006fc6`. Heebo remains the
self-hosted display/body/data face; tabular numerals and bidi isolation preserve
Hebrew reading. The navy logo header is shared by every administrative route.
Silver-blue translucent surfaces use one elevation and a restrained inner
highlight. Body text stays opaque for contrast. Controls are at least 44px high,
with hover, focus, pressed, disabled and busy feedback.

Desktop uses the complete grouped navigation rail and an airy work surface.
The first work-center section is an operational update feed with pagination,
filter/search and exact-record actions. Existing treatment queues remain below
in an explicit disclosure; none of their actions is removed. Existing orders,
financial summaries, exports and dialogs retain their calculations and handlers.
All other administrative screens consume this same surface/control adapter.

Below 768px only, a detached 5-item frosted pill provides work center, orders,
articles, customers and support. Its translucent active capsule slides between
the equal targets using logical RTL order. It reserves safe-area space and
never replaces the complete menu. The header always exposes “כל אזורי הניהול”;
its accessible Sheet shares the exact same canonical navigation list, including
prices, suppliers, settings, reports and logs. Reduced motion removes movement;
reduced transparency uses an opaque fallback; forced colors retains selection.

Badges display server-counted distinct actionable records, never queue sums.
Zero hides the badge. Stale data remains explicitly marked, not reset to zero.
The menu includes the pre-existing pricing aliases as explicit destinations.
No mockup records, invented statistics or preview amounts are shipped.

## Mobile catalog first viewport — approved 2026-10-23

Only phones at viewport widths up to 700px adopt the approved full-height hero.
`app/catalog-mobile-hero.css`, loaded after existing catalog styles, owns this
variant. Desktop/tablet retain their existing composition and controls. The
original Heebo face, navy heading, cyan/blue accent, checkout-waves background,
home-publication-20261020 illustration and existing header remain in use.

The first viewport contains artwork, the unchanged Hebrew headline/copy, the
refined turquoise/blue “לצפייה בקטלוג” button and a 44px glass down-arrow.
The document still scrolls naturally. A min-height based on 100svh minus the
measured hero document offset reserves the first screen; content may grow on
short screens or with enlarged text. Nothing is clipped or hidden. Header
measurement accounts for font/header resizing and scroll-margin keeps the
catalog destination below the sticky header. Both buttons share native smooth
scroll and focus the existing catalog region without an intermediate jump.
Reduced motion uses immediate scrolling and removes button movement. The arrow
is hidden above 700px. Catalog filters, purchases, prices and exports are unchanged.
