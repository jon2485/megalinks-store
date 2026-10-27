# Catalog desktop controls — restoration, 2026-10-27

Mode: Operate. Status: approved narrow restoration implemented locally. Production
build, TypeScript, handler and catalog-home-actions checks passed. All six-width
browser checks passed. Fresh finish review is in progress; staging approval and
deployment remain pending. This brief makes no live-site pixel claim.

## Scope and authority

The user requested the original desktop home catalog filter/search dimensions and
three action sizes, preserving the approved mobile layout. The latest scoped
`@media(min-width:701px)` block in `app/account-navigation-refinements.css` restores
values from `app/catalog-filter-dialog.css` and `app/catalog-experience.css`.
The filter stylesheet is byte-identical to baseline `93c30f6`; no catalog business
logic, navigation callbacks or mobile sizing owner changes.

The observed 1440px regression made each existing action span the full 1360px
workspace and stack. The restoration returns the three equal actions to their
established row dimensions. This is a sizing repair, rather than a new catalog
visual system.

## Composition and behavior

The tool row caps at 870px with a 220px category column, flexible search and 12px
gap. Both filter and search remain 52px tall. The three actions share equal
widths, capped at 282px apiece: 870px overall including two 12px gaps. They retain
60px height, 18px labels, 21px icons and 999px pill corners. Narrow desktop widths
use `(100% - 24px) / 3`. Search opening remains in normal flow and aligned with
the category control.

The existing add-site action stays at the opposite edge of the same flex row,
with wrapping below when the row cannot fit all controls. The restoration starts
at 701px. Approved 390px and 700px geometry is intentionally unchanged.

## Evidence and boundaries

`tests/catalog-controls-browser.mjs` bundles the actual Catalog component with
production-built CSS and isolated data. It records before/after geometry and
captures at 390px, 700px, 701px, 1024px, 1440px and 1920px. It checks desktop
control/action dimensions and equal widths, search input and alignment, filter
dialog opening, bulk navigation, overflow and exact mobile action geometry
against baseline. Evidence is stored in `.sites-runtime/catalog-controls-browser/`.
All six-width browser checks passed: mobile hero/art/search/category/action
geometry exactly matches baseline; desktop filter/search are 52px tall and three
actions retain equal 60px height, 18px type and 282px width at wide sizes. At
1440px they share one row with add-site at left; at 1024px add-site wraps below
aligned left. Search/filter/bulk interactions passed. Results are recorded in
`/tmp/catalog-desktop-restore-browser.log` and
`.sites-runtime/catalog-controls-browser/final.json`. Production build,
TypeScript, handler and catalog-home-actions checks passed. No authenticated live-account or deployed-pixel claim follows
from these fixtures.

The separate three wide seller-page mockups and site table-row concepts remain
generated proposals awaiting approval. They are not implemented by this repair.

Fresh independent finish review: SHIP, no material fixes. Mobile toolbar captures
are pixel-identical at 390px and 700px. Original geometry is stored in
`tests/fixtures/catalog-controls-before.json` for repeatable fixture checks.
Staging approval and deployment remain pending.
