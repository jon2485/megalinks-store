# Site application journey — approved 2026-10-27

Status: the user approved the new full-screen introduction and animation and
requested all prior approvals staged together on the existing Railway service.
The extension is implemented. Dedicated artwork, production build, TypeScript,
both seller handler suites and full-flow real-component browser verification
passed. Fresh finish review: SHIP, no material findings across all nine screens; source publication and staging
deployment remain pending.
No production deployment or authenticated live-account check is claimed.

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

- The full flow uses a full-screen dialog, width 100vw, visualViewport height,
  square outer corners and content capped at 1240px. Questions retain the 690px
  cap; existing review/edit columns remain and collapse at 700px.
- The approved intro pairs dedicated website-to-earnings artwork and RTL text on
  desktop; phones stack artwork above copy. Existing waves ground and the real
  MegaLinks logo remain. Phone gutters are 20px; footer respects the safe area.
- visualViewport height and center follow keyboard changes without the prior
  clearance subtraction. The dialog remains the sole vertical scroll owner;
  existing LTR controls and full values remain reachable.

### Latest approved introduction

Reference: `/workspace/scratch/480206aee6f5/generated_images/exec-0e036406-0bb5-4e9b-9360-9a146b43c5c2.png`.
This is now approved for implementation, including its animation. The intro reads
“זה הזמן להרוויח כסף מהאתר שלך!”, followed by the approved publication earnings
copy, short-details hint, “בוא נמשיך” action and manager-approval note. The removed
one-question subtitle stays absent. The original 420ms RTL chapter transition
remains; business logic, seven fields and final submission owners are unchanged.

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

- The original `megalinks-logo.png` and `checkout-waves.webp` ground are reused.
  The new transparent website-to-earnings illustration was extracted with imagegen
  from the approved mock, generated as
  `/workspace/scratch/480206aee6f5/generated_images/exec-39372c8f-eae3-44f5-aa4c-6b8d1afecfc8.png`,
  and encoded as `public/brand/site-earning-intro-20261027.webp` (200086 bytes,
  approximately 196 KiB). The extraction preserves the approved illustration
  as a transparent standalone asset; this is new generated artwork, rather than
  reused catalog art. Prompt provenance is preserved in the fallback sidecar
  `public/brand/site-earning-intro-20261027.webp.json`; embedding preserved the
  image bytes.
  The previous generic glass-link/publication illustration is superseded only
  in this intro.
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

The final fullscreen implementation passed production build (`/tmp/fullscreen-build.log`),
TypeScript, both seller handler suites and real-component browser checks
(`/tmp/fullscreen-browser.log`). Browser coverage includes all seven fields,
edit/cancel, upload and request failures, upload cache/retry, busy locks, keyboard
and reduced motion at 320px, 390px and 1440px. New assertions verify full-screen
width, loaded dedicated art and the live 420ms intro-to-questions transition.
The six seller-hub captures also passed with populated owned-site cards. Fresh
finish review: SHIP, no material findings across all nine screens. Earlier baseline evidence is retained below. The user's
latest authorization includes all prior approvals together on the existing
Railway staging service. Deployment has not yet been established by this brief.

Earlier baseline passed: typecheck; production build; scoped lint (0 errors, four form img warnings,
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
