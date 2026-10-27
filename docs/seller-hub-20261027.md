# Seller hub implementation brief — 2026-10-27

Status: approved scope implemented locally; source publication and deployment
pending. No authenticated live-site verification is claimed.

## Approved change

The seller My Sites, articles and payments surfaces use the approved bulk-order
instruction language: three pastel numbered steps with a connector, emphasized
teal-to-blue heading text and underline-selected navigation. Responsive rules
adapt guide copy and report controls for phones; payment steps remain vertical
with the external numbered rail at desktop as well. Shared catalog, admin and site-application owners
remain separate.

The articles title is exactly “כל הכתבות לפרסום, במקום אחד”. Supporting copy says
articles and files arrive by email and publication can be reported here or by
email. Article rows show the actual site URL from `w.url AS site_url` in the
seller-scoped query in `lib/customer-sellers.ts`. Inline reporting retains its
existing endpoint, explicit submission, URL validation and busy lock.

## Screenshot-led refinement

User screenshots IMG3437/IMG3438 showed duplicated My Sites headings and a hidden
connector. The redundant shell and intro headings were removed, keeping the back
control. “האתרים שלך יכולים להרוויח בשבילך” now leads before tabs. The guide sits
without a white wrapper on the existing waves ground, uses self-hosted Rubik
regular/bold, and centers “איך זה עובד?”. An external right number rail exposes
connecting segments on My Sites and payments. Payments reads “אז כמה הרווחתי?”.
The new product-card mock is preview only; no product-card redesign is implemented.

## Implementation owners

- `app/seller-hub-approved.css`: scoped presentation, responsive and reduced-motion rules.
- `app/seller-guide.tsx`: numbered guide and emphasized title components.
- `app/seller-workspace.tsx`: seller tabs and My Sites/payments composition.
- `app/seller-articles.tsx`: articles heading, email copy, site URL and inline report.
- `DESIGN.md`, `.impeccable/design.json`, `.impeccable/surfaces/seller-hub.md`: durable scoped design context.

## Validation and browser evidence

Production build, TypeScript and handler checks passed after the refinement,
as did the six real-component desktop/phone browser captures.

`tests/seller-hub-browser.mjs` renders actual production components with built CSS
and isolated API fixtures. It exercises tab changes at 390px and 1440px, site URL
rendering and opening/filling the inline publication report; it asserts no page
runtime errors or horizontal overflow. The saved full-page captures are:

| Surface | Phone | Desktop |
| --- | --- | --- |
| My Sites | `.sites-runtime/seller-hub-browser/sites-390.png` | `.sites-runtime/seller-hub-browser/sites-1440.png` |
| Articles, report open | `.sites-runtime/seller-hub-browser/articles-390.png` | `.sites-runtime/seller-hub-browser/articles-1440.png` |
| Payments | `.sites-runtime/seller-hub-browser/payments-390.png` | `.sites-runtime/seller-hub-browser/payments-1440.png` |

The sample fixture has empty site/payment lists and one pending article. It does
not establish populated-record coverage, authenticated live behavior, delivery of
email, a real saved publication, physical-device behavior or deployment state.
Source publication and existing-staging deployment remain separate pending work.
