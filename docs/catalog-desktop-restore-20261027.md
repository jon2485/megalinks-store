# Catalog desktop control restoration — 2026-10-27

The desktop home catalog restores the original filter/search and three existing
action sizes while preserving approved mobile sizing. At 1440px, the regression
had stacked three 1360px-wide actions; the scoped fix restores three equal actions
up to 282px each with 12px gaps. The control row caps at 870px, category width is
220px, filter/search height is 52px, and action height is 60px with 18px labels,
21px icons and the established pill corners.

The added rule is limited to 701px and above in
`app/account-navigation-refinements.css`. Original values come from
`app/catalog-filter-dialog.css` and `app/catalog-experience.css`; the former is
byte-identical to baseline `93c30f6`. The add-site action remains at the opposite
edge in the same wrapping row and moves below if space is insufficient. Business
logic, callbacks and the mobile layout owner remain unchanged.

Production build, TypeScript, handler and catalog-home-actions checks passed.
All final browser checks passed in `tests/catalog-controls-browser.mjs`, using the actual Catalog
component and built CSS with isolated API fixtures at 390px, 700px, 701px, 1024px,
1440px and 1920px. Coverage includes desktop geometry, exact unchanged mobile
geometry against baseline, search/filter/bulk interactions and overflow. Before
and after captures plus geometry reports are saved in
`.sites-runtime/catalog-controls-browser/`. These are fixture checks, without an
authenticated live-site or deployed-pixel claim. Staging remains pending.

The separately requested three wide seller-page mockups and site table rows are
generated proposals only, awaiting approval, and are not implemented here.

The final report at `.sites-runtime/catalog-controls-browser/final.json` and
`/tmp/catalog-desktop-restore-browser.log` confirms exact baseline equality for
mobile hero/art/search/category/action geometry. Desktop filter/search heights
are 52px; the three actions have equal widths, 60px height and 18px labels. At
1440px they are 282px wide on one row with add-site at the opposite left edge;
at 1024px add-site wraps below aligned left. Search/filter/bulk checks passed.
Fresh independent finish review: SHIP with no material findings. Staging approval and deployment remain pending.
The original measured mobile geometry is preserved in `tests/fixtures/catalog-controls-before.json` so the browser check also runs in a fresh checkout.
