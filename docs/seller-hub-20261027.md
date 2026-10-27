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
The subsequently approved owned-site card is implemented as described below.

## Approved owned-site card

The approved reference is
`/workspace/scratch/480206aee6f5/generated_images/exec-62ad13e3-e72c-455c-b4bf-27274f689ed1.png`.
The card now groups the actual uploaded owner image/logo, identity and status,
full URL, actual price with “לפני מע״מ”, and pending-review notice. The image
source is preserved; no invented site screenshot is substituted. Active and
rejected actions retain their handlers and conditions; pending records have no
edit/pause/remove actions. URLs wrap on phones and existing actions stack.

The requested site-form subtitle “שאלה אחת בכל פעם פשוט וקל” was removed from
`app/seller-site-form.tsx`. The fullscreen onboarding concept
`/workspace/scratch/480206aee6f5/generated_images/exec-0e036406-0bb5-4e9b-9360-9a146b43c5c2.png`
is now approved and implemented, including animation and its dedicated transparent
artwork. Production build, TypeScript, both seller handler suites and full-flow
real-component browser checks passed; fresh finish review: SHIP, no material findings across all nine screens.

## Implementation owners

- `app/seller-hub-approved.css`: scoped presentation, responsive and reduced-motion rules.
- `app/seller-guide.tsx`: numbered guide and emphasized title components.
- `app/seller-workspace.tsx`: seller tabs and My Sites/payments composition.
- `app/seller-articles.tsx`: articles heading, email copy, site URL and inline report.
- `app/seller-site-form.tsx`: requested subtitle removal only.
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

The latest My Sites fixtures include pending and active records and a long URL;
their 390px/1440px captures cover the approved card layout. The fixture image is
a stand-in. Payment lists remain empty and articles use one pending record. The
checks do not establish authenticated live behavior, delivery of
email, a real saved publication, physical-device behavior or deployment state.
Source publication and existing-staging deployment remain separate pending work.

## Latest staging authorization

The user requested all prior approved seller-card, hub and full-screen onboarding
changes staged together on the existing Railway service. This authorizes staging
work; source publication and deployment remain pending. The full-screen extension
retains the existing business logic and real brand logo. Its implementation and
verification are tracked in `.impeccable/surfaces/site-application-journey.md`.
