# Content and publication workspace

Mode: Operate. Ordinary extension of the approved compact Orders and Editorial
Desk world, documented 2026-10-29 from the implemented source and current
production-component evidence.

## Scope and visual authority

Administrative approvals, all submitted articles, publication queue, writing
instructions and the navigation wrapper around the existing knowledge library.
The original MegaLinks logo, navy/ice/white, pale-blue boundaries and Heebo
Hebrew RTL remain authoritative. This work introduces no new identity, global
tokens or visual-world replacement. Existing Orders, finance, customer, supplier
and knowledge-body owners remain in place.

The approved content reference is
`/workspace/scratch/467f3ef512a8/generated_images/exec-9032571d-7273-4d94-afe3-7dffe135c610.png`.
The user's later requirements govern submitted lifecycle coverage, five equal
single-row tiles, compact chevron disclosures and content-only facts. Reference
identities, counts, statuses, dates and URLs are illustrative; runtime uses real
records.

Runtime CSS is canonical (model B). `app/content-workspace.css` aliases local
ink/copy/line/action roles to the established orders/editorial owners, with
incumbent fallbacks. It scopes the content heading/panel and named
`.admin-content-review` ArticleStudio presentation. `DESIGN.md` and
`UX-CONTRACT.md` receive completion sections only; their prior text, frontmatter
and `.impeccable/design.json` are preserved.

## Direction as built

Content and publication is one primary menu destination. Five equal icon tiles
remain in one row at every checked width, in RTL order: ממתינים לאישור,
כל הכתבות, תור פרסום, הנחיות כתיבה, ספריית ידע. The current destination
uses the existing cyan edge and ice selection fill. Article review retains the
originating list's selected tile. The knowledge body is unchanged.

One white bordered workspace contains the active list heading, search/filter
controls, semantic article records and pagination. Desktop uses aligned columns;
at 760px and below the same records become compact title/account, URL and
time/status lines. The small native 44px chevron button owns expansion. Four
detail columns become two on phones, with wrapping Hebrew and bidi-isolated
identifiers/URLs. Explicit actions follow the facts; no financial subtotal,
payment summary or article body is added to the list response.

Heebo/Arial retains the established hierarchy. The scoped page heading is
30px/26px desktop/phone; panel headings are 23px/21px, article titles 15px/14px,
and quieter metadata 13px/12px. Inputs remain 16px. Fine dividers, white records,
ice open-row treatment, blue primary actions, outline actions and restrained
status colors carry the incumbent world. Focus remains explicit. The short
disclosure/chevron motion is removed under `prefers-reduced-motion`.

The canonical ArticleStudio remains functional rather than becoming a separate
preview implementation. Its admin mode starts with the article preview, folds
site requirements into a native disclosure, removes the old billing paragraph
and uses four actual administrative stages. Review and approval precede actual
supplier possession; customer progress keeps its existing three-stage behavior.

## Workflow and data boundaries

- All Articles includes actually submitted lifecycle states, including returned
  drafts, requested professional writing and published articles. Unsubmitted
  drafts, unrequested professional writing and scheduling a date alone stay out.
- The review queue retains existing actionable-order, refund and cancellation
  guards. Published is a real All Articles status filter.
- The publication queue contains sent, unpublished, non-refunded deliveries.
  Original `supplier_sent_at`, allocation `created`, then actual first delivery
  history determine age and ascending order. Article/job update or reminder
  timestamps never substitute. Missing dates stay undocumented and sort before
  known delivery dates; no wait age is fabricated.
- Submission/review/writing timestamps are recorded by their real transitions;
  first timestamps remain durable. Dispatch persists the allocation delivery
  timestamp once. Display uses Israel time through `content-presentation.ts`.
- Native expansion reveals title, actual account `user_name`, order-number link,
  submission time and wait; sent articles add supplier and delivery time. Only
  one record opens at a time. Repeated mouse/Enter/Space can close it.
- View Article uses the original studio and returns to the originating list.
  The number link opens the exact order. Sent/unpublished/non-cancel-pending
  records may send a reminder; pending cancellation keeps View and its
  explanation but removes the reminder and note. Published records retain the
  safe external article link. Reminder recording does not imply delivery.
- Search is a literal substring over title/account/site/order number. Server
  article pages contain 20 rows; Excel covers the complete filtered result.
  Instructions use local pages of 20 over the existing records API limit of
  1,000. Request-key matching suppresses stale filtered responses.
- Search/filter/page/expansion and parent-list return state live only in the
  existing in-memory `admin-view-state`; no localStorage or browser persistence
  is added.
- Writing instruction CRUD reuses canonical `records/instruction`, validates
  name/text, locks duplicate mutations, keeps failed drafts and protects dirty
  close/Escape/discard/unload paths. Update/delete compare `expected_updated_at`.
  The existing AI prompt consumes the text for new generations; existing
  articles and client/supplier messages are not rewritten.
- Existing ArticleStudio save/import/images/credits/validation/approve/reject,
  versions, locks and dirty callbacks remain canonical. No financial write,
  dependency, schema migration or environment configuration is introduced.

## Implementation owners

UI: `app/admin-content-workspace.tsx`, `app/content-category-nav.tsx`,
`app/content-workspace.css`, with integration in `app/admin-shell.tsx`,
`app/workspace.tsx`, `lib/admin-navigation.ts` and the existing
`app/article-studio.tsx`.

Server/data: `lib/admin-content.ts`, `lib/content-presentation.ts`, the existing
`app/api/[...path]/route.ts`, `lib/publication.ts` and
`lib/scheduled-approval.ts`. GET `admin/content` inherits `admin(u)`; instruction
records retain their admin guard. The SQL projection omits financial values,
article bodies and supplier email.

Reused controls: `FinanceSearch`, `FinanceSelect`, `FinancePages`, `FinanceFacts`,
`FinanceFact`, `FinanceEmpty`, shared Button/Dialog/Input/Textarea, the existing
API and `admin-view-state`. The semantic content records do not adopt the legacy
editorial table-card model.

## Checked evidence and limits

| Check | Evidence checked |
|---|---|
| Final production build, typecheck and scoped new-file ESLint passed after reviewer fixes | `/tmp/content-build.txt`, `/tmp/content-tsc.txt`, `/tmp/content-lint.txt`; final rerun confirmed by implementation owner |
| Content API passed: submitted privacy/lifecycle, real queue clock, no billing payload, literal search, full export, paging, admin guard and instruction validation/CAS | `/tmp/content-api-final.txt`; `tests/admin-content.mjs` |
| Final production-component browser passed for four content routes at 320/390/1440px, equal tiles, repeated disclosures, filters, reminders, instruction recovery and reduced motion | `/tmp/content-browser.txt`; `tests/content-browser.mjs` |
| Final admin review/sent stage captures at all three widths and pending-cancellation reminder/note gating passed | `tests/content-browser.mjs`; current `.sites-runtime/content-browser/` captures; final rerun confirmed by implementation owner |
| Six finance siblings and approved compact orders passed at 320/390/1440px | `/tmp/content-finance.txt`; `/tmp/content-orders.txt` |
| 923 supplier privacy / 83 scheduling / 127 writing checks passed | `/tmp/content-privacy.txt`; `/tmp/content-schedule-final.txt`; `/tmp/content-writing.txt` |
| Supplier mail and real studio handler checks passed | `/tmp/content-supplier-mail.txt`; `/tmp/content-studio-actions.txt` |

Captures are in `.sites-runtime/content-browser/`:
`admin-{articles,approvals,publication,instructions}-{320,390,1440}.png`,
`admin-{articles,approvals,publication}-expanded-{320,390,1440}.png`,
`article-{review,sent}-{320,390,1440}.png`,
`published-filter-open-390.png` and `pending-cancellation-390.png`.
This documentation pass manually sampled `admin-articles-1440.png`,
`admin-publication-expanded-390.png` and `article-review-320.png` against the
runtime component/CSS owners; it does not replace the independent final review.

Both material reviewer fixes are implemented: pending cancellation removes
reminder/note treatment while preserving View/explanation, and administrative
`admin_review` progress no longer implies supplier delivery. Independent final
review returned **ship** for those two scored fixes, confirming truthful, fitting
review/sent progress at 320/390/1440px and pending-cancellation View/explanation
without reminder/helper treatment. The prior full review accepted the remaining
incumbent-world scope. This is a scoped finish disposition, not a whole-app
certification. The `studio-actions` harness change loads CSS only; its assertions
are unchanged.

Checks use isolated synthetic data and perform no live email, AI, customer or
financial writes. Physical iOS Safari, authenticated deployed behavior,
whole-application certification and automated pixel-exact fidelity are not
certified. The context launcher was unavailable. The premium static audit
(`/tmp/content-premium-audit.json`) reported 80 findings across legacy/global
scope, including a content search-form/select parser warning; editor textarea
findings were corrected. No clean detector or whole-app result is claimed.

`PRODUCT.md`, comparison state and a quality card were absent before this work.
That pre-existing drift is not initialized, repaired or canonized here; neither
is the broader documentation/sidecar drift outside the authorized append scope.
No deployment is asserted. The authorized release target is the existing
Railway STAGING environment only, with deployment recorded separately.
