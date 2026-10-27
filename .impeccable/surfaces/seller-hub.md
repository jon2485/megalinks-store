# Seller hub — approved wide composition, 2026-10-27

Mode: Operate. Status: all three wide desktop mocks explicitly approved and
implemented. Final production build, TypeScript, scoped lint, 48 API requests,
handler/catalog checks and all nine real-component browser captures/actions
passed. Fresh finish review: SHIP; all nine captures match the approved compositions,
with no material findings. The user requested Railway publication;
deployment remains pending. No live-account or deployed-pixel claim is made.

## Scope and authority

`app/seller-wide.css` is canonical (model B) for the customer seller composition,
extending retained `app/seller-hub-approved.css` primitives. This supersedes the
older 1120px desktop cap, vertical desktop guides and giant owned-site card
composition. Administration, catalog and the approved fullscreen site application
journey retain their separate owners. The actual brand header remains unchanged.

Approved wide references:

- My Sites: `/workspace/scratch/480206aee6f5/generated_images/exec-1b3010b1-a84b-43c5-b1ba-d2f965a1692b.png`.
- Articles: `/workspace/scratch/480206aee6f5/generated_images/exec-83f19561-93c1-4752-9043-c4778b89d31b.png`.
- Payments: `/workspace/scratch/480206aee6f5/generated_images/exec-3767116e-8b75-45da-baeb-3202059ecbcb.png`.

## Composition and responsive system

The customer seller premium shell fills the available width; desktop fixtures
assert more than 90% viewport width. Each of the three destinations places its
approved title and copy before the shared underline tabs. Headlines use local
SellerRubik bold, `clamp(36px,3.7vw,56px)`; body uses regular. The actual site
logo/upload and data provide record identity, without invented screenshots.

Desktop guides place three pastel panels below a horizontal connected number
rail; their first icons remain at RTL start/right. A soft overlay tones the waves
and the back action sits at desktop left. At 900px and below, steps stack with an external right number rail and
tables become labeled record cards. Full URLs and values wrap. The payments
publication table and summary sit side by side on desktop and stack on narrow
screens. Existing brand waves, heading gradient and pastel guide remain approved
surface exceptions. No new global brand palette is introduced.

## Real workflows and data

My Sites uses real rows for identity/upload, full URL, requested pre-VAT price,
status and permitted actions. Pending proposal prices safely fall back to the
existing proposal value. Pending rows expose no mutation controls. Active sites
retain request-change and canonical DropdownMenu pause/remove actions; rejected
requests retain the correction workflow. Existing manager approval remains.

Articles uses a metadata-only table. The title remains exactly “כל הכתבות לפרסום,
במקום אחד”; copy explains that content arrives by email and reporting is available
here or by email. The actual site URL comes from the existing `site_url` query
projection. Inline reporting expands a table row, retains URL validation and
retry, and supplies cancel with focus return to its trigger. It keeps the
existing explicit save endpoint rather than adding a new publication owner.

Payments reads immutable closed `statement.publications` and `statement.net` when
a statement exists; otherwise it shows provisional current publications. Missing
prices remain “חסר מחיר מתועד”, never an invented zero. Existing invoice and
payout handlers open canonical dialogs. `app/seller-display.ts` formats integer
agorot, Hebrew dates and month labels. The month picker retains its native transparent input with a visible Hebrew
label and keyboard access. No finance, permission or payment-transfer
rules change. Two generic global table rules exclude only `.seller-wide-table`
through zero-specificity `:where`, preserving other table owners.

## Fullscreen journey boundary

The approved fullscreen site application, dedicated transparent earnings artwork,
real brand logo, existing 420ms RTL animation and removed one-question subtitle
remain as documented in `.impeccable/surfaces/site-application-journey.md`.
The wide composition reuses the actual add/edit journey and canonical dialogs;
it does not replace their submission or dismissal contracts.

## Evidence and release boundary

`tests/seller-wide-browser.mjs` renders actual header/components and canonical
Dialog with isolated API fixtures at 390px, 1440px and 1920px. Nine captures are
saved as `.sites-runtime/seller-wide-browser/{sites,articles,payments}-{390,1440,1920}.png`.
Coverage includes pending/active/rejected actions, full-width stage, add/edit,
canonical dropdown/dialog workflows, inline report validation/failure/retry/focus,
published history, invoice upload, payout, provisional months and paid/missing/
empty/loading/error states. These are fixture actions, not live mutations.

Final production build (`/tmp/seller-wide-build.log`), TypeScript, handler,
48 API requests and catalog checks passed. Scoped lint had zero errors and two
existing image warnings. All nine final captures and canonical-header/dialog
browser action/error/missing/paid/month checks passed; table body text was checked
for navy color and at least 15px size. The legacy seller-hub browser entry now
imports the wide browser suite, replacing obsolete assertions. Fresh finish
review: SHIP; all nine captures match the approved compositions with no material
findings.
The user explicitly approved all three compositions and requested Railway
publication; deployment is pending. Implementation handoff:
`docs/seller-wide-20261027.md`.
