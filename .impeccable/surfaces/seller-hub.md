# Seller hub — approved 2026-10-27

Mode: Operate. Status: approved scoped extension implemented locally. Source
publication and deployment remain pending. This brief makes no live-account claim.

## Scope and authority

My Sites, publication articles and payments extend the existing bulk-order guide
language: three pastel numbered steps connected in sequence, a bold two-line
heading with an emphasized teal-to-blue line, and underline-selected tabs.
The explicitly approved heading gradient and connected pastel numbered steps are
pinned surface exceptions to generic gradient-text and decorative-card avoidance.
The original catalog, administration and site application journey retain their
visual and behavioral owners. No new product or business claims are inferred.

`app/seller-hub-approved.css` is canonical (model B). Root DESIGN.md mirrors its
reusable scoped primitives; `.impeccable/design.json` records gradients, depth,
motion, breakpoints and provenance under `surfaceSystems.seller-hub`.
The owner-approved implementation uses `app/seller-guide.tsx`,
`app/seller-workspace.tsx` and `app/seller-articles.tsx` with existing shared controls.

## Approved visual references

- My Sites: `/workspace/scratch/480206aee6f5/generated_images/exec-b628e3b5-7ed1-405a-ab1d-4276321d252f.png`.
- Articles: `/workspace/scratch/480206aee6f5/generated_images/exec-271f782b-f0dc-4fc2-9fa1-affedfad10bb.png`.
- Payments: `/workspace/scratch/480206aee6f5/generated_images/exec-6bed8cfe-367b-40d5-ad77-daf37ec83371.png`.

These are approval references, not live screenshots. The final approved articles
heading below supersedes the wording in that mock. Existing runtime assets are
reused; no generated mock is inserted as product UI.

## Composition

The centered stage caps at 1120px. My Sites puts its primary heading before tabs
and its three-step guide before the
existing site records and uses an explicit add-site action. Step colors run from
pale blue to pale teal to lavender with matching numbered discs. The connecting
line remains behind the discs. Payments reuses a vertical three-step guide before
its existing month selector, publication summary and invoice records.

The articles heading reads exactly “כל הכתבות לפרסום, במקום אחד”, broken between
“לפרסום,” and “במקום אחד”. Supporting copy states that content arrives by email
and publication can be reported here or by email. The publication report form is
inline beneath the selected record; its labels, validation and save action remain
real controls. Existing pending/published choices use underline selection.

Article rows expose the actual site URL, isolated LTR. The seller-scoped query in
`lib/customer-sellers.ts` projects `w.url AS site_url`; this is a real site value,
not a URL inferred from a publication or a fixture label. New-window links retain
`noopener noreferrer`. Existing permissions and server mutation owners remain.

## Screenshot-led refinement — 2026-10-27

User screenshots IMG3437/IMG3438 exposed duplicate My Sites headings and an
obscured connector. The refinement removes the redundant shell and intro titles
while retaining the back control. “האתרים שלך יכולים להרוויח בשבילך” is the first
page heading, before tabs. The guide is transparent over the existing
`checkout-waves.webp` ground; its former white wrapper and shadow are removed.
“איך זה עובד?” is centered. Number markers now sit outside each pastel panel in
an external right rail; separate segments connect marker centers visibly in both
My Sites and payments. This supersedes the earlier desktop horizontal payment
composition. The payment title is exactly “אז כמה הרווחתי?”.

SellerRubik uses existing self-hosted regular 400 and bold 700 WOFFs, with
Heebo/Arial/sans-serif fallback and the existing Rubik OFL license. The scoped
heading is `clamp(32px,4.3vw,48px)`, with 34px on phones. Copy is regular weight;
headings use bold. The new product-card mock is preview only and has not been
implemented. This refinement changes no product-card workflow or business owner.

## Responsive behavior and interaction

At 600px and below, headings become 34px, guide padding shrinks, step icons remain visible at 26px,
number discs reduce to 32px and report actions fill the available width. Step copy
wraps within the remaining column; URLs wrap rather than widen cards. Payment steps retain a vertical single-column guide at desktop as well.
All three destinations retain their existing state and callbacks.

Tabs use real buttons with `aria-pressed`. The ordered guide retains semantic
step order; visible discs and decorative icons are hidden from assistive reading.
Button feedback uses brief color/shadow transitions and a 1px press response;
selection underlines scale over 250ms. Reduced motion removes these transitions
and the press transform. Forced colors restores readable heading text and step
borders. Existing shared control focus, labels and error owners remain intact.

## Verification and release boundary

`tests/seller-hub-browser.mjs` bundles actual SellerWorkspace components with
production-built styles and isolated API responses. Its assertions exercise the
three tabs at 390px and 1440px, actual-site URL rendering, opening/filling the
inline report form, no horizontal overflow and no runtime page errors. The six
full-page snapshots are in `.sites-runtime/seller-hub-browser/`:
`sites-390.png`, `sites-1440.png`, `articles-390.png`, `articles-1440.png`,
`payments-390.png`, `payments-1440.png`.

The fixture uses sample records and stubbed APIs. It does not authenticate a live
seller, save a real publication, send email, transfer money or prove deployment.
The factual implementation/evidence handoff is `docs/seller-hub-20261027.md`.
