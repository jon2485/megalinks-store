# Catalog interaction contract

## Administrative guide workflows — approved 2026-10-25

This is the current scoped contract for work-center notifications, administrative
orders and the separate `/admin-month-close` report. It supersedes earlier
no-generic-handling, unchanged-pagination and presentation-only statements for
these explicitly authorized additions. Existing authorization, payment approval,
publication, refund and supplier-settlement owners remain authoritative. The
visual owner is `app/admin-guide-workspace.css`; composition and verification
limits are recorded in `.impeccable/surfaces/admin-guide-workspace.md`.

| Capability | Canonical owner | Current contract |
|---|---|---|
| Notification handling | `lib/admin-updates.ts`; admin-only control-center updates API; `AdminUpdateFeed` | Open/handled views use persisted `admin_update_handled` records with event snapshot, actor, timestamp and exact event version. Mark is idempotent; stale versions return 409. Reopen is offered only while that exact source event still exists unchanged. Changed events appear open while the earlier snapshot stays in history. |
| Exact-record action | Existing `ctx.go` and order/article/support routes | Opening an event reaches its real record and performs no handling or financial/publication approval. Marking handled changes notification metadata only; the underlying payment report, money and publication state stay with their original handlers. |
| Order categories | `lib/admin-order-buckets.ts`; SQL classification in `lib/admin-order-data.ts` | Three primary choices are mutually exclusive. Unpaid monthly/on-account orders remain monthly-open despite purchase closure, monthly PDF closure or pending/rejected reports. Confirmed paid/settled orders are closed; ordinary unpaid orders are in process. Fully cancelled orders and demos are in the separate archive. |
| List and return state | `AdminOrderHistory`, `AdminUpdateFeed`, `lib/admin-view-state.ts` | Notifications and orders use server pagination at 20 records/page. Search text applies on explicit submit; clear applies an empty query and restores input focus. Category/select changes apply directly. Query/filter/page/scroll, plus order expansion, survive internal record navigation in transient memory. |
| Native Select/Date | Native `select` and `input[type=date]` in the three guide components | Existing deliberate native variants remain: CSS owns closed fields and focus styling; the OS owns popup geometry. No authored popup, new picker dependency or popup-level styling is claimed. |
| Report range and export | `AdminMonthClose`; `lib/admin-month-server.ts`; `lib/admin-date-range.ts`; GET `admin/month-close` | From/to and payment/order date basis are drafts until “הצגת סיכום”. Invalid dates/ranges keep the prior applied range and expose field errors. Responses must match the applied range/basis before rendering/export. Export uses that applied range, never unsaved dates. The report is read-only and does not close purchases or settle a monthly account. |
| Report data and workbook | `lib/admin-month-report.ts`; `lib/admin-report-workbook.ts`; existing effective-order amounts | The report reads the complete selected dataset, shows 20 orders/page locally and exports every selected record without a page cap. Excel has one row per client, all their selected order numbers/contact details, numeric amounts and totals. The order-list export also uses every committed bucket/month/query filter across all pages. |

The current workspace `go()` owns path-only navigation. Sensitive customer search
queries remain in the transient `adminViewState` map, not browser storage,
analytics or page URLs. This is internal return-state restoration, not a promise
of restoration after reload or in a new tab. Response/filter/requested-page checks
prevent an earlier result being shown as the newly selected dataset. Export locks
prevent duplicate downloads; failed requests keep recoverable error feedback.

Closed-order filtering uses confirmed payment dates; other order categories use
order dates, with an explicit unknown-date group. The report offers payment date
by default or order date explicitly. Israel calendar-day boundaries are computed
with `Asia/Jerusalem`, including DST. Paid orders without a recorded payment date
are flagged and excluded from payment-date ranges rather than silently assigned
their creation date. Order-date reports may list unpaid orders, which contribute
no confirmed income.

Report net/VAT/gross income comes from confirmed order amounts after recorded
refunds; wallet top-ups are not separately added as revenue. Direct costs are
immutable purchase snapshots before VAT, including recorded writing costs. An
unrecorded cost, ambiguous legacy zero or missing writing cost remains missing;
affected cost/profit totals are null and visibly incomplete. A recorded explicit
zero is valid. Refunds reduce income without erasing a recorded supplier cost.
Calculated profit excludes unrecorded business expenses and is not a claim of
supplier cash paid, full business profit or a tax return.

Implementation-owner-reported validation passed: production build, typecheck,
scoped ESLint, order/report integration including 1,005-row filtered export and
legacy settlement method, notification persistence/version handling, order and
guide UI handlers, existing glass/cart checks and 919 supplier-privacy checks.
The original payment-report suite still stops at an inherited retired lobby-route
assertion after 97 checks; only a temporary copy adapted to the existing exact
route passed all 122. No full pass of the unchanged suite is claimed. The global
strict audit reports 75 findings without ownership configuration; a temporary
explicit declaration of the existing native Select/Date variants leaves zero in
the five guide modules and 48 legacy findings globally. No audit waiver manifest
is added and no whole-application compliance is claimed. Browser capture is blocked by cloud Chrome's
`ERR_CONNECTION_REFUSED` against the local port 7777 server; screenshot fidelity,
native popups, real focus/touch/zoom and live financial E2E remain unverified.

## Approved editorial administration — 2026-10-24

The current admin presentation supersedes earlier presentation-only caveats below
for the explicitly migrated workflows. Domain rules remain server-owned. No API,
schema, financial amount, permission or supplier visibility policy changes.

| Capability | Canonical owner | Source of truth | Allowed variants | Verification |
|---|---|---|---|---|
| Table Selection | Existing screen selection/filter handlers | Existing APIs and screen state | Existing selection scope; same handlers in desktop tables and labeled mobile records | admin-editorial, admin-complete-actions, admin-finance-ui |
| Select/Listbox | components/ui/select.tsx and existing native selects; SupplierPicker | Existing control ownership | Radix authored popup; OS-owned native selects accepted; searchable supplier picker unchanged | catalog-workspace-actions; browser supplier open/close |
| Date | Existing native date fields and PublicationDatePicker | Existing domain scheduling contract | Native OS-owned fields stay native; maintained authored publication calendar stays authored | Existing action/scheduling checks; no date policy change |
| Form | CatalogWebsiteForm, ActionForm and original record forms | Existing validation, API versions, busy locks and errors | Full-page site editor; existing dialogs; independently saved customer panels | catalog-workspace-actions, pricing-admin-ui, admin-finance-ui |
| Scrollbar | Global stylesheet plus admin-editorial.css | DESIGN.md runtime model B | Document scrolling for full-page forms; internal overflow only where existing data table requires it | Browser width/scroll checks at 390 and 1280 |
| Toast | Existing Sonner provider | Existing success/error callbacks | Existing localized outcomes | Existing action suites |
| CRUD | Existing handlers and server; Workspace.go; useAdminDraftGuard | docs/security.md, docs/supplier-data-privacy.md, original API handlers | Return/stay behavior preserved; app-owned unsaved guard for full-page site/profile editors | 35 API call expressions preserved; real isolated Worker 40-check suite |

The same-route navigation is a no-op and must not clear a dirty editor. Separate
editor routes mount separate state. Site saves clear only the site draft after
success; failed saves retain it. Customer profile and monthly-limit panels own
independent dirty keys. Choosing the already active customer tab is a no-op.
The new guard handles app navigation, browser history and unload for those
opt-in editors. It does not claim to retrofit every historical modal with drafts.

All 24 admin destinations remain reachable through the complete searchable
header menu, including attention counts. The five mobile shortcuts remain real
links with the moving glass selection indicator. Duplicate section navigation
is suppressed; catalog-internal tabs remain available. Customer/supplier table
markup is unchanged outside the opt-in admin presentation context.

The approved customer-account tabs expose the already implemented orders,
articles, profile and history content. No new financial eligibility is inferred.
Screenshots use isolated fixture data; no preview records or authentication
headers are included in release source.

This task documents the existing catalog and its presentation redesign.
It does not establish new payment, permission, retention or order policies.
Visual ownership and motion tokens: [DESIGN.md](DESIGN.md).

| Capability | Canonical owner | Source of truth | Allowed variants | Verification |
|---|---|---|---|---|
| Search/filter | PremiumCatalog in app/catalog-view.tsx | Existing local filter and sort implementation | Inline expanding search, full multi-category picker, existing filter dialog | Catalog home actions and catalog-list-filter tests; build |
| Select/Listbox | components/ui/select.tsx | Maintained authored shared primitive | Sort select | Existing component behavior; unchanged |
| Overlay | components/ui/dialog.tsx and popover.tsx | Maintained shared primitives | Filter dialog and multi-category popover | Unchanged focus/navigation |
| Toast | Sonner | Existing toast calls in catalog-view.tsx | Favorite login hint and list validation | Unchanged |
| Header | WorkspaceHeader / workspace-navigation.tsx | Existing real navigation/account/cart callbacks | Compact sticky desktop/mobile geometry only | Catalog home actions and CSS checks |
| Catalog reveal | CatalogMotionGrid / observeCatalogCards | app/catalog-motion.tsx | Viewport, keyboard, reduced motion, no IO | tests/catalog-motion.mjs |

Search/filtering remains local and synchronous; no remote requests or debounce
are introduced. The localized search close action and Escape empty the query
immediately, collapse the inline field and return focus to the magnifier. The
input is disabled while collapsed, focuses on opening, and has a rounded outer
focus indicator. Keep selected filters, pricing and existing page
clamping/reset behavior. No changes to favorites or order callbacks.

Search expansion uses CSS width transition within its reserved row, without a
portal or overlay. Filter/category opening animations are CSS-only enhancements
on maintained Radix primitives. Their focus, Escape, outside dismissal, selection
and existing apply/reset behavior are unchanged. Reduced motion disables these
transitions and entrances. Do not
replace real dialogs, exports, orders or favorites with preview-only substitutes.

Presentation cannot delay an action, add a confirmation, hide a focused control
or discard data. Result markup remains readable before hydration. Observers and
listeners disconnect on result changes/unmount; pending cards become visible.

Authoritative business evidence remains in `docs/security.md`,
`docs/supplier-data-privacy.md`, `lib/server.ts` and existing order handlers.
This presentation change does not alter any of those sources.

SEO follows `docs/seo-audit.md`. Initial HTML uses a minimal anonymous regular-tier
catalog projection; full live/personalized pricing remains API-owned. Public
heading rendering must not depend on a browser request. Private routes are
noindex and never included in the sitemap; indexing controls are not authorization.
Unknown routes return 404 without breaking existing nested article/admin routes.

## Administrative presentation extension

This section records the existing owners; it does not change policy or activate
dormant account tabs. See `docs/admin-design-v172/full-upgrade.md` for scope and
verification limitations.

| Capability | Canonical owner | Source of truth | Allowed presentation | Verification |
|---|---|---|---|---|
| Navigation/dirty | workspace.tsx go/navigate + existing popstate | Existing handlers; documented inherited popstate gap | AdminNavigation grouped details, real links, mobile disclosure | Navigation contract + fixture handlers; browser unverified |
| Dashboard | AdminLobby / AdminLobbyPanel | Original API queues and local dirty guard | Queue/work-panel layout and scoped CSS | Exact call/event AST + lobby interaction tests |
| Forms/prices/saves | CatalogWebsiteForm, CatalogPricingWorkspace, PersonalPriceEditor, ActionForm, original finance/account forms | Existing API payloads, versions, busy flags and errors | Admin-only field/dialog geometry and colors | Save contract, fixture actions; no live mutations |
| Table selection/filter/paging | Each existing screen implementation | Existing local/API behavior | Scoped table density, overflow and status tones | Existing regression fixtures; browser unverified |
| Select/Listbox | components/ui/select.tsx; original native controls | Existing Radix/select ownership | Admin-live portal colors/radius only; native geometry unchanged | Source equality; open-popup browser check unverified |
| Date | Original native date fields | Existing type, value, onChange and domain date handling | Field styling only, OS popup remains native | Source equality; browser unverified |
| Dialog/confirm | components/ui/dialog.tsx and original ctx.open | Existing Radix focus, dismissal, callback and busy locks | Live admin :has CSS scope; viewport-limited scroll | Shared component equality, fixture save/error tests; focus browser unverified |
| Toast | Existing Sonner provider | Original success/error calls | Unchanged | Source equality |
| Scrollbar | admin-design-v172.css | Admin-scoped tokens; document scroll for forms | Standard properties with WebKit/forced-color fallbacks | CSS contract; computed-style/browser unverified |
| CRUD/auth/finance | Original React handlers and lib/server.ts | docs/security.md; docs/supplier-data-privacy.md; original server | Presentation only; no API or permission changes | Protected-source equality, isolated server tests; live financial E2E unverified |

Permissions, amounts, retention, cancellation, settlement and save semantics are
not redefined by this design. Existing aliases/B1, dormant exports/B2–B3, shared
role surfaces/B5 and known dirty-signaling gaps stay as documented in the original
completion review. No hardening claim is made for these inherited behaviors.
# Admin workflow Stage 1 contract — 2026-10-19

| Capability | Owner and source | Stage 1 behavior | Evidence/limit |
|---|---|---|---|
| Sidebar grouping | admin-navigation.ts remains canonical; AdminNavigation owns presentation | Three headings, nine original domains, 21 original destinations and aliases; original select/ctx.go preserved | Route/dirty/source tests; browser back gap remains inherited |
| Attention | Existing admin/control-center read API, admin-attention.tsx context | One enabled 30s read shared by lobby/sidebar; ctx.revision refresh; count for one queue, dot for heterogeneous queues; stale disclosure | Pure-function, role-boundary and real React SSR fixtures |
| Treatment | AdminLobby original guard/go/choose/localCtx and AdminLobbyPanel | Payment reports by default; nine compact queues; real panel first; mobile disclosure with selected-row/toggle focus | Handler/SSR/CSS contracts; actual browser focus/touch pending |
| Seen/handled | Existing server business status and explicit price review | Opening does not write; no generic checkbox, localStorage, new endpoint or schema | Existing handlers byte-identical; future generic resolution requires separate approval |

Existing financial approval, top-up, refund, supplier, catalog and save owners remain
unchanged. This stage cannot certify live end-to-end business workflows or mobile
rendering. See docs/admin-workflow-stage1/README.md and handled-state-plan.md.

## Admin foundation Stage A

Current scope is the three root workflows only, based on b6406ff. All original
handlers, readers, mutations and domain transitions retain their previous owners.
The 21 destinations, aliases, nine queues, default payment reports and real shared
attention reader remain unchanged. No generic handled write is added.

| Capability | Canonical owner | Stage A presentation | Verification |
|---|---|---|---|
| Queue navigation | Original AdminLobby guard/go/choose/selectQueue | The expanded selector follows its trigger before the real panel, matching DOM/focus order | Original dirty continuation/approval fixture, nine queue fixtures; browser focus unverified |
| Order filtering/export/expansion | AdminOrderHistory original state and handlers | Compact summary, real responsive rows, expanded original CustomerOrderDetail; native month select remains OS-owned | Order interaction + finance suites; visual/native-popup checks pending |
| User selection | UsersAdmin original selected/search/role and original ClientActions | One action set for the selected account; side-by-side at content width >=800px, list/detail below | New selection/back/search/filter fixtures and original account action/save suites |
| User presentation focus | Local presentation refs and detailsOpen only | Selection focuses account heading; back returns to selected list button using one animation frame | Ref/handler fixture; actual browser focus pending |
| Search clear | Existing local state, original dirty guard for lobby | Clear resets original query/selection/expansion and focuses the input | Fixtures; no new requests or search semantics |
| Forms, financial actions, Toast, Date | Existing components and UX contract above | No form, modal, validation, native date, monetary or save changes | Original component source equality and regression fixtures |

Search and lists intentionally retain existing in-memory state and dataset sizes;
no new URL writes, pagination, ordering or automatic saves are authorized here.
All existing customer/supplier/auth/API projections remain protected sources.
The known workspace popstate dirty gap and financial-dialog close behavior are
recorded as inherited risks, not repaired by this presentation extension.


## Cart / checkout presentation — 2026-10-21
| Capability | Canonical owner / evidence | Presentation |
| --- | --- | --- |
| Cart mutation, quantity, writing | CartFlow / EditorialAddon, existing cart API | Same explicit saves, quantity locks and errors; writing starts collapsed |
| Quote and confirmation | Existing quote API and CartFlow checkout handler | Actual list/discount/writing/subtotal/VAT/total; no new price rules |
| Payment eligibility | ctx.user.monthly_account.enabled + existing checkout API | Three/four equal tiles; no new permission decision |
| Checkout item review | Existing cart/quote projection | Read-only summary; editing through cart route |
| Phone/invoice | Existing Field/Input and billing draft | Phone directly below invoice, LTR phone value |
| Added feedback | notifyCartAdded after successful cart POST, CartFeedbackButton | 2400ms label/check state; timer cleanup and reduced-motion path |
Existing server financial state, request payloads, idempotency, invoice guidance,
credit splits and monthly checks retain their owners. Source tests and build
do not establish browser or real-device visual approval.

## Knowledge publishing — approved 2026-10-22

| Capability | Owner | Contract / evidence |
|---|---|---|
| CRUD and permissions | knowledge-server.ts; existing actor/admin; drizzle/0006_knowledge.sql | Only admins read drafts/upload/write; public reads project only published snapshots; no new customer permissions |
| Draft vs publication | knowledge_posts draft/published/version | Manual explicit save; saving a published article leaves its published snapshot unchanged; publish replaces the snapshot; unpublish preserves draft and requires app-owned confirmation |
| Conflict recovery | Server version compare-and-swap | Reject stale writes with 409 and preserve entered UI content; never overwrite another editor silently |
| List/search | Public KnowledgeHub and admin KnowledgeList | 24 per page, explicit submit/clear, public URL query restoration, abort/sequence guard for stale public reads |
| Editing | Existing RichEditor and knowledge variant | Native paragraph select deliberately retains OS-owned popup; existing formatting/link dialogs/selection/history; no new provider or external editor dependency |
| Images | knowledge_media + existing R2 binding | Admin-only uploads of verified JPEG/PNG/WebP up to 8MB; public media only when referenced by a published post; captions and alt text; no general private-file exposure |
| Fields/checkbox/dialog | Shared Input/Textarea/Checkbox/Dialog | Visible containing labels, resize-none textareas, native file picker, Radix focus/Escape/return; no browser prompt/confirm |
| Navigation and dirty state | Existing postflow:dirty + editor beforeunload/popstate guard | Save remains in editor; list uses existing ctx.go; browser back while dirty restores editor and asks through app-owned dialog |
| Feedback | Existing Sonner, inline error/status | Success only after API success; duplicate-save lock and disabled editing while saving; failure keeps draft; no implied autosave |
| Public SEO | Server-rendered public routes, knowledge-seo and sitemap | Only published slugs; Article metadata/schema; admin and previews noindex; staging gateway still controls access |
| Catalog notes | Existing shared Radix Popover; PublicationCard controlled open state | Only public notes/restrictions already supplied to the customer; Hebrew label, left chevron; visible pressed/open state; Escape/outside/close and focus restoration; viewport collision handling; disabled when no notes |
| Knowledge hub | Existing knowledge API, KnowledgeHub and KnowledgeCard hub variant | Search, clear, filters, pagination, retry and article links keep their real actions; no preview records are published; stale requests cannot overwrite newer results |

The business decision to publish is explicit and admin-owned. The API rejects
publication without title, excerpt, substantial text, category and a cover with
alt text. Slugs are editable before first save and then locked to preserve links.
Categories can be created without leaving the editor; tags are plain labels.
The editor preview is transient and is not a public preview URL. No deletion
or AI generation is implied. The approved scheduling extension below adds
explicit date-based publication.

### Publication dates — approved 2026-10-22

The blog editor owns a Hebrew calendar with free earlier/later selection.
Saving a draft never changes the published snapshot. Explicit publication with
a future date schedules the snapshot; public pages, search, media and sitemap
exclude it until that day starts in Asia/Jerusalem. Clearing the date and
publishing makes it available immediately. Moving an already published article
to a future day explicitly makes it unavailable until that day.

Customer publication scheduling is a separate approval workflow: submitting a
future-dated article creates `scheduled`, not `admin_review` or a supplier job.
At the start of the chosen Israel day the durable queue releases it into
`admin_review`. Only a later explicit manager approval can dispatch the supplier.
The Railway staging bootstrap polls every minute and retries after restarts;
admin reads also release due entries. Unpaid, cancelled, refunded or pending
cancellation articles do not advance. Completing professional writing cannot
bypass the future-date hold. Withdrawing a scheduled submission uses version
checking and restores editing; changing the date requires submitting again.

The shared calendar is the sole date-picker owner: Hebrew locale, RTL weekday
order, editable day.month.year field, explicit confirm/cancel, field-level error,
keyboard dismissal, and scrollable mobile dialog. Customer dates cannot be past;
blog administrators can backdate. Scoped calendar table resets prevent legacy
table padding from clipping dates. Dates and numbers use bidi isolation.


## Approved admin work center and complete navigation — 2026-10-23

This approved extension replaces presentation, not financial or publication
policy. Canonical owners remain existing API authorization, finance, record
forms, publication handlers, Radix Sheet/Dialog and Sonner.

| Capability | Canonical owner | Contract |
|---|---|---|
| Full navigation | lib/admin-navigation.ts, AdminMenuContent | Original domains, pages and aliases remain reachable; header menu on every route, desktop rail; knowledge editor included |
| Phone quick navigation | AdminMobileDock | Five destinations, current-page semantics, sliding transparent indicator; no desktop dock; full menu retains every other option |
| Work-center updates | admin-updates.ts and AdminUpdateFeed | Admin-only read, 20/page, stable date/id sorting, literal search, action/info filters, bounded page and empty/error/retry states |
| Exact record | admin-order/:id, admin-article/:id, admin-support/:id | Payment opens that order and its pending report/receipt; article opens that editor; support opens that ticket |
| Attention | admin-control-center + admin-attention | Distinct actionable identities across overlapping queues; zero hidden; existing resolved states remove counts after refresh; read never marks handled |
| Forms and payments | Original OrderDetails, ReportReview, SupportTicketForm and APIs | Existing validation, optimistic versions, confirmation and duplicate guards; no auto approval or supplier dispatch |
| List return | admin-view-state in-memory map | Feed query/filter/page and scroll survive internal record navigation; no customer query saved to persistent browser storage |
| Existing screens | Existing list/detail components + scoped CSS | Filters, exports, totals, statuses, dialogs, edits and deletions retain existing owners and remain reachable on mobile |

Source: docs/security.md, docs/supplier-data-privacy.md, existing payment-reports,
order-finance, order-summary and API admin/owns guards. New ticket GET is owner
or admin only; other customers cannot read it. New nested pages are private and
noindex, and do not bypass server authorization. Domain values in the mockups are
illustrative; production always shows actual API values.


## Customer cancellation update details — approved 2026-10-26

The cancellation action in ClientUpdates opens CustomerCancellationDialog through
the existing ctx.open/Radix dialog, preserving focus/dismissal and the established
customer-order glass presentation. It reads the existing owned article endpoint
and shows the matching transaction, recorded cancellation date/amount and the
customer-facing refund_reason (or legacy cancel_reason). It never opens the
article writer, issues a refund, approves a cancellation, or displays internal
admin_notes. Missing recorded amounts/reasons remain explicit rather than being
invented; publication-only cancellation distinguishes retained writing charges.
The exact refund reason is added to the existing article allowlist; raw audit
payloads, supplier fields and general administrative notes remain private.
Source: existing lib/account-management.ts refund reason, customer-privacy.ts
projection, order-finance.ts component amounts and the existing article owns guard.
