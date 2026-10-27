# Approved wide seller workspace — 2026-10-27

The user approved all three wide desktop compositions and requested Railway
publication. The local implementation fills the customer seller stage, places
each destination's title before shared tabs, uses horizontal connected pastel
guides on desktop, and presents actual owned sites and articles as row tables.
At 900px and below guides become vertical and table rows become labeled cards.
The real brand header, original uploaded images and actual records remain.

`app/seller-wide.css` owns the scoped composition; `app/seller-workspace.tsx` and
`app/seller-articles.tsx` retain the real handlers. `app/seller-display.ts` formats
money/dates/months. The customer selling route joins the existing premium shell;
two generic table styles exclude only `.seller-wide-table` via zero-specificity
selectors. Other catalog/admin/fullscreen journey owners retain their scope.

Site rows preserve pending/no-actions, active request-change plus canonical
pause/remove menu, and rejected correction. Requested price can fall back to
pending proposal data. Articles remain metadata-only with an expanded inline
report row, cancel/focus return and the existing save endpoint. Payments uses
closed immutable statement publications/net when available, provisional current
publications otherwise, and explicit missing-price text. Invoice/payout handlers
and canonical dialogs remain unchanged; no business/finance rules change.

Approved references are listed exactly in `.impeccable/surfaces/seller-hub.md`.
They supersede the earlier giant owned-site card and vertical desktop guide.
The existing fullscreen onboarding remains approved and implemented separately.

Final production build (`/tmp/seller-wide-build.log`), TypeScript, both handler
suites, 48 API requests, catalog checks and all nine real-component browser
captures/actions passed. Scoped lint: zero errors, two existing image warnings.
Table body navy color and at least 15px text size were checked. Fresh finish
review: SHIP; all nine captures match the approved compositions with no material
findings. Browser fixture `tests/seller-wide-browser.mjs` covers actual brand
header/canonical dialogs with isolated APIs at 390px, 1440px and 1920px; its nine
captures are `.sites-runtime/seller-wide-browser/{sites,articles,payments}-{390,1440,1920}.png`.
Actions cover pending/active/rejected records, add/edit, pause, report validation/
failure/retry/focus, history, invoice/payout and paid/missing/empty/loading/error
states. No authenticated live or deployed-pixel verification is implied.
Railway deployment remains pending.

The month picker retains an accessible native transparent input with a visible
Hebrew month label. The desktop back action is at left, the first guide icons
remain at RTL start/right, and a soft overlay tones the original waves. The old
`tests/seller-hub-browser.mjs` entry imports the current wide browser suite, so
obsolete layout assertions are retired. The approved fullscreen onboarding
remains stable under its separate owner.

Finish review: SHIP, no material fixes required across all nine captures. The
actual header/uploaded imagery and mobile record-card reflow are the documented
adaptations. Cosmetic mobile payment-total label wrapping is nonblocking and
retained. Restore branch: `restore/before-seller-wide-20261027`, commit
`851f380187e85488be3125f69c36bcf0ed5278a4`. The publication bundle also includes
the preceding desktop catalog restoration. Staging/deployment remain pending.
