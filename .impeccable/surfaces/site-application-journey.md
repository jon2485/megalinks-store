# Site application journey — approved 2026-10-27

Status: implementation and finish review complete; ship disposition with no
material issues. Source publication and existing-staging deployment are pending.
The owner approved the full animated preview and requested desktop/mobile
adaptation and smooth Hebrew RTL controls. No production deployment is in scope.

## Scope and authority

This surface is My Sites → Add site and the existing-site update form. It extends
the existing MegaLinks identity with a scoped question journey. It supersedes only
the older three-frame and dark/fading-header site-application guidance. Customer
cards, seller tabs, catalog, administration and their existing tokens keep their
owners. No PRODUCT.md was located; no business facts are inferred here.

`app/site-application-brand.css` is canonical (model B). DESIGN.md mirrors actual
`site-journey-*` palette, typography, corners, spacing and component primitives;
`.impeccable/design.json` extends those with motion, breakpoint, snippet and source
metadata. The primary action gradient and shadow are sidecar extensions because
they do not fit primitive color/component fields.

## Composition and responsive behavior

- The introduction places copy at right/RTL start and existing glass-link artwork
  at left on desktop. A compact navy logo header and four-part underline path
  remain throughout the journey.
- The dialog caps at 1040px; questions cap at 690px. Review uses unequal two-column
  framing, and the full editor uses two equal columns with instructions spanning.
- At 700px and below the dialog caps at 560px with 10px viewport-side clearance;
  artwork stacks above copy and review/editing use one column. At 350px and below,
  page gutters reduce and the secondary header label hides. All values may wrap.
- The dialog owns vertical scrolling. visualViewport changes update its height
  and vertical center for keyboard space. URL/email/numeric controls remain LTR
  inside the RTL reading order; shared real controls retain focus and semantics.

## Visual system

Use the scoped local MegaLinksRubik face, regular 400 and bold 700, with existing
Heebo/Arial/sans-serif fallback. Root DESIGN.md contains exact observed role scales
and palettes, including responsive display type. Navy content sits on white/ice;
teal-to-blue actions and cyan header/progress detail carry the brand moment.
Fields retain visible labels, full values, containing focus treatment and inline
errors. Buttons, input, textarea, Dialog, AlertDialog, Lucide and Sonner remain
canonical project components. Documentation previews are illustrative primitives,
not new application controls.

Chapter arrival is 420ms, exit 320ms, with the same 420ms height interpolation and
`cubic-bezier(.16,1,.3,1)`. Question bodies reveal over 280ms with a 14px rise.
The outgoing clone is inert and aria-hidden, IDs removed and controls disabled;
transitions clean up and arriving content receives focus. Reduced motion removes
spatial movement and reveals immediately. Hover/pressed responses remain brief.

## Workflow contract

All seven existing fields remain. Questions are grouped into site details and
publication details, with completed answers editable in place. Full review offers
consolidated editing and cancelling without applying the edit buffer. Existing
sites begin in that editor. The only network writes occur on explicit final
submission: existing upload API if needed, then the existing application endpoint
and original create/edit payload. Server permission/price/publication/manager
approval owners remain unchanged.

Unsent changes invoke a registered optional modal guard for close/Escape/backdrop
and the shared discard AlertDialog; browser unload is guarded too. Busy locks
block duplicates and dismissal. Failure keeps details and supplies retry; a
successfully uploaded file ID is reused on request retry until file replacement.
UX-CONTRACT.md records the complete interaction and mutation boundary.

## Asset provenance

- `public/brand/home-publication-20261020.webp` and `megalinks-logo.png` are reused
  unchanged from the existing repository. No new raster, stock or generated asset
  was acquired for this implementation.
- Google Fonts CSS source:
  `https://fonts.googleapis.com/css2?family=Rubik:wght@400;500;600;700;800&display=swap`.
  Acquired regular 400 TTF:
  `https://fonts.gstatic.com/s/rubik/v31/iJWZBXyIfDnIV5PNhY1KTN7Z-Yh-B4i1UA.ttf`;
  bold 700 TTF:
  `https://fonts.gstatic.com/s/rubik/v31/iJWZBXyIfDnIV5PNhY1KTN7Z-Yh-4I-1UA.ttf`.
- FontTools subset these to U+0020–017F, U+0590–05FF, U+20AA, en/em dash, curly
  quotes, ellipsis and LTR/RTL marks, then encoded the local
  `rubik-regular.woff` and `rubik-bold.woff`. Original TTF intermediates were
  removed. Only 400/700 faces are declared, within the named surface.
- Copyright 2015 The Rubik Project Authors; SIL Open Font License 1.1 is retained
  verbatim in `public/brand/Rubik-OFL.txt`, obtained from
  `https://raw.githubusercontent.com/google/fonts/main/ofl/rubik/OFL.txt`.

## Evidence and release boundary

Passed: typecheck; production build; scoped lint (0 errors, four form img warnings,
two pre-existing seller-workspace img warnings); new schema/handler tests; seller
UI; 48 existing seller API requests; cart/checkout/catalog checks. The
real-component Playwright fixture uses isolated APIs at 320px, 390px and 1440px,
covering validation, edit/cancel, existing-site payload, failures/retry, upload
cache, duplicate/busy-close locks, guarded close, keyboard and reduced motion.
No runtime errors were observed. These are not authenticated live-account or
physical Safari checks. Global strict audit: 76 legacy/ownership findings, none
in the new journey/form/schema/motion files. No whole-application compliance claim.

The global CSS delta excludes only this named surface from three blanket dialog
text rules through zero-specificity `:where`; other dialog specificity is preserved.
The optional modal guard retains normal behavior for unregistered dialogs.

Restore branch: `restore/before-site-journey-20261027`, commit
`a4162c8f12605a11c714b060a73e321d6e6623b0`. Existing staging source/config may be
updated only within the already approved service/environment; runtime secrets
and data stay put. Publication and deployment remain pending the parent task.
