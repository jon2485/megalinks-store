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

## Railway production sign-in

The production gateway reuses the staging sign-in structure and brand tokens,
with the title "כניסה למגה לינקס" and without staging labels. It retains RTL
labels, LTR credentials, show/hide behavior, inline errors and 48px controls.
No application screen was redesigned for the Node runtime adaptation.
