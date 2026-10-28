# Catalog interaction contract

## Article customer assignment — approved 2026-10-26

The supplied current My Articles screenshot is the visual authority. Keep the
existing four columns, status tabs, month groups, rows and article actions.
`ArticleCustomerAssignment` adds only the current customer and an outlined action
inside the article details. Its scoped stylesheet does not redefine the list grid.

The canonical Radix Dialog opens in place. Existing-client selection and the new
client form are tabs in that same dialog; neither navigates away. Dialog, tabs,
radio buttons, Input, Textarea, Button and Sonner retain their shared owners.
`CustomerFields` is shared with My Customers. Search is local over an owned
id/name/company projection, clears immediately, renders 20 matches at a time
with explicit load more, and Enter in search does not submit the assignment.
New-client fields are app-validated, retain their draft on failure, and identify
the invalid field. Busy locks prevent duplicate submissions or closing mid-save;
discarding unsaved choices/details uses the maintained AlertDialog.

`lib/article-customer.ts` owns assignment metadata in an internal records kind,
with an independent version and an idempotent request key. New customer creation
and the link write share one guarded D1 batch. Both the article and customer must
belong to the acting account. This metadata never edits article content, content
versions, publication status, order totals or payments. Separate metadata keeps
later editor autosaves and publication callbacks from reverting the association.
Effective-customer SQL joins are shared by article list/detail, order detail and
My Customers. Checkout customer_id remains the fallback until an explicit link
exists; clearing or deleting a linked client does not restore an old association.

Validated in isolated fixtures: 39 assignment API requests, existing cart-to-client
propagation, client/account action tests, assignment form handlers, production
build, typecheck, scoped ESLint, 41 supplier requests and 963 privacy checks.
Current browser render, focus trapping/restoration and exact screenshot fidelity
are still unverified; the source-only finish review cannot certify those.

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

## Customer selling capability — approved 2026-10-26

`purchased/selling` is a category in the existing personal account, not a homepage
CTA. Existing purchasing roles remain unchanged. `seller_profiles` binds a user
ID to an internal supplier record; pending site proposals never alter the live
catalog. Only administrators review creation, editing, price, pause/removal,
payout-detail and cancellation requests. Site approval includes ownership and
retail-price confirmation. Existing order fee snapshots remain immutable.

Supplier delivery reuses dispatchArticle, its Word email attachment and secure
single-resource token. Customer supplier-inbox authorization uses the immutable
owner_user_id stamped on the dispatch job, never an arbitrary contact address.
Legacy supplier-role accounts retain their existing email-based access.

Month close runs through the authenticated Railway maintenance timer, after the
entire local calendar month has ended, with catch-up on restart. Only verified,
non-demo, non-refunded publications and recorded fees enter the durable monthly
statement. The unique seller/month and email keys prevent duplicate requests.
No publications means no invoice request; missing fees block statement creation.
The intended pay date is the 10th of the next month. This is not automatic banking:
admin approval of an owned PDF invoice and approved payout details precede an
explicit actual-transfer confirmation/reference. Payment receipt insertion and
statement CAS are atomic. Changed publications block approval/payment and require
recalculation plus a new invoice; paid statements cannot be recalculated.

Payout details are encrypted in both proposals and live profiles. Supplier-facing
responses explicitly project only the user's sites, requests, fees and statements;
request baselines/review tokens, other sellers, buyers and internal audit data
are not returned. Invoice and logo files are owner/admin protected; only approved
active-site image bytes are public. Referenced invoice/history/logo files cannot
be deleted. Request decisions and settlement actions are audited.

Button/Input/Textarea, ctx.open/Radix dialogs and Sonner retain canonical ownership.
Seller native select/month controls retain OS-owned popup geometry. The supplier
area uses the approved blue/navy framed account design and the existing inbox.
Lists offer bounded initial renders with explicit additional rows. CSS owns only
the new selling surfaces and the wrapping seven-category account row. Preview
fixtures are not deployment data. Browser layout verification remains unavailable.

Validation for the selling extension: TypeScript/production build, 38 isolated
Worker requests, seller UI actions and calendar-boundary tests pass. Shared mail
attachment, cart/checkout/phone/feedback checks pass; publication scheduling has
83 checks, admin feed40 and supplier/privacy963. Independent source review scored
its atomic-publication-month fix resolved. Layout detector has no findings; the
new native month/select variants are explicit OS-owned exceptions in this
contract. Pre-existing global static-audit findings remain outside this change.
No production fixtures, credentials or real email sends are part of validation.

## Customer seller refinements — 2026-10-26

The site-application portion of this approval is superseded by the approved
animated journey documented below. Its shared controls, original seven fields,
RTL/LTR requirements, existing endpoints and manager-approval policy remain in
force. Other seller refinements in this section retain their existing scope.

`seller-articles.tsx` reads only paginated metadata from GET selling/articles.
Existing customers without sites receive an empty list, not a supplier-role error.
Only deliveries stamped for the acting owner and an owned approved seller site
are listed. No article body, image/document IDs, costs or attachments are returned.
The inline report aliases the existing owned publication-report route after an
additional owner/site check, preserving domain validation, concurrency guards,
publication stamp, token invalidation and existing email dispatch. Full articles
remain in the existing emailed Word attachment; no content or download controls
are mounted in this customer tracking view. The legacy supplier portal is unchanged.

Personal category widths are equal, with scoped Arial Hebrew navigation type and
hover/focus feedback. The filled teal homepage add-site CTA opens My Sites through
the existing authenticated route. The delicate-glass desktop dropdown and four article-stage controls are now approved.
The assignment action sits beneath the existing article actions with pale teal fill.
All 11 personal-area routes remain reachable in the existing Radix NavigationMenu,
with exact selection for the lobby versus nested routes. The mobile dropdown is also approved: `mobile-personal-menu.tsx` uses the
canonical Radix Popover beneath a named account trigger, with the same 11 routes,
44px touch rows, exact current-page highlight, close/select behavior and
viewport-bounded scrolling. It replaces the personal category strip only below
768px; the global website drawer and its destinations remain available.

Validation: production build, typecheck, metadata/report integration, existing
seller workflow and privacy checks, scoped ESLint and handler tests. Current
authenticated desktop/mobile renders remain unverified. Fresh source review resolved legacy supplier navigation, nested selection,
requested-page/clamped-page response matching and manager-published history.
No current browser pixel approval is claimed.

Rollback point for this release: public branch `restore/before-account-glass-20261026`,
commit `45b7047ad8a3f92275a778b7ecda3b356b8dc445`, the previously successful
Railway staging deployment `8dca96e4-49ff-4cd2-8cfc-1bbd8411d169`. No schema
changes or destructive data operations accompany these UI refinements.
The source review found and resolved legacy supplier navigation, nested route
highlights, requested-page/clamped-page matching and manager-published history.

## Approved article controls — 2026-10-26
Desktop uses four equal shallow status filters (approved exec-070e89ef board).
Mobile uses a single row of text tabs with inline counts, shortened visible labels
בעריכה / לאישור / לפרסום / פורסמו and an active teal underline (exec-8c68789a).
Existing stage predicates, counts, month/search filtering and primary/AI/link actions
are unchanged. Actions center vertically in their desktop cell and within the
mobile action row. Assignment moves to the canonical Radix dropdown's more-actions
item, opening the existing guarded dialog. Show it only when owned customer options
exist or an owned article is already assigned. Unknown/failed options do not opt in;
existing assignments remain manageable. First-time users add a customer through
My Customers. Assigned names appear in article details, never as an extra action row.
Rollback source: restore/before-article-tabs-20261026 at 98f27e3766842c5b278a0cf54552f416a521e83b.
This is frontend-only; no schema, order, publication or payment mutations changed.
Validation: typecheck, production build, scoped lint (no errors), assignment API
39 requests, assignment dialog/menu handlers, account navigation, and conditional
visibility tests passed. Authenticated browser pixels/touch/focus were not verified.

## Approved personal launcher — 2026-10-26
Six core destinations use a full 3-column / 2-row mobile launcher: updates,
articles, orders, balance, customers, profile. Support occupies a full footer row.
Current destination uses an underline, with no selected background tile. Hidden
from this menu: notifications, files, API; their existing account links/routes
remain available. A separate solid teal My Sites action opens purchased/selling,
which now renders SellerWorkspace independently of ClientHub with a back action.
Existing catalog/sign-in links remain valid. Seller workflows and approval rules
are unchanged. Legacy supplier portal retained for supplier accounts.
Restore: restore/before-personal-grid-20261026 at a78df11710fffd95f8dfb6a774b53163ea8b1fbd.
Source/handler and build verification do not certify authenticated browser pixels.

## Personal launcher placement correction — 2026-10-26
On mobile, mount the unchanged launcher permanently in document flow immediately
after ClientHub's heading/purchase-button header, before page content. Remove its
local account trigger, popover, close control and overlay heading. Grid, underline,
support row, sites CTA and legacy supplier destination keep their actions. Desktop
navigation and the standalone sites destination are unchanged. The document scrolls;
there is no fixed position, internal scroller or height limit on this inline panel.
Restore: restore/before-inline-personal-grid-20261026 at 2d47329.

## Approved mobile first screen and stage motion — 2026-10-26
Phones show the approved stable account welcome typography, purchase action,
permanent six-destination launcher and My Sites before the content. A small arrow
(with accessible name but no visible caption) focuses and scrolls to page content.
100svh minus measured page offset fills the first screen, with natural growth for
short viewports/long names/enlarged text; no clipping or internal scrolling. The
cue nudges every four seconds only while its intro is visible and document active.
Four article filters retain one compact mobile row, small icons and counters;
colors match the launcher and only an underline indicates selection. One measured
RTL-safe marker slides between actual button bounds. Below-fold account content
and stage results get short entrance transitions. Account-to-account navigation
preserves scroll instead of jumping to top; leaving to catalog/editor/My Sites
retains normal navigation. All existing dirty guards, filtering and handlers stay.
Reduced motion removes spatial animation and uses immediate scroll. No dependencies.
Restore: restore/before-mobile-account-motion-20261026 at 0d9ac1e.
Validation: typecheck, scoped lint, navigation/assignment handler checks and motion
scroll/reduced-motion tests. Authenticated browser/device visual QA remains pending.

## Approved order/customer cards and branded site form — 2026-10-27
Mobile customer orders retain disclosure/payment actions and all actual statuses.
Their compact rows place the date at the true middle column, order number/status
at RTL start and the disclosure at the opposite side. Rows grow for long labels.
Mobile customer cards group actual name/company, contact labels/values, update
date and the existing articles action; one customer uses singular count copy.
The site-application presentation in this approval is superseded by the animated
journey documented below. Customer/order card presentation and all original
business, field, upload and manager-approval contracts remain authoritative.
These are presentation changes. Desktop customer/order layout stays with its owner.
Restore: restore/before-customer-cards-site-form-20261027 at 7c24b47.
Actual validation: order/payment UI, seller form/workspace handlers, customer actions,
typecheck and scoped lint/build. Authenticated device pixels not verified.

## Mobile catalog action sizing correction — 2026-10-27
Only the mobile catalog actions at widths up to700px return to three equal grid
columns (filter/export/bulk). Controls use64px minimum height,13px labels and20px
icons, growing naturally for wrapped/enlarged text. The existing add-site action
spans the next row. No hero dimensions, illustration, heading, search, category,
scroll cue, desktop styling or action handler changed. The site-form mockup was
outside this sizing correction; its later approved journey is documented below.


## Approved animated site application journey — 2026-10-27

My Sites → Add site opens the approved introduction, two question chapters,
complete review, consolidated edit form and success state in the existing shared
Radix Dialog. Existing-site updates enter the full edit form first, then review.
The original fields remain: site name, full site URL, sample article URL, logo or
image, price before VAT, delivery email and optional publication instructions.
`lib/site-application.ts` centralizes client field definitions/validation; server
ownership, permissions, file checks, pricing/publication policy and approval stay
in `lib/customer-sellers.ts`.

Completed answers reopen in place. The review exposes all values and an explicit
edit-all action. Consolidated changes apply to the local review draft only after
validation; cancelling those edits restores the prior review values and image.
Cancelling an initial existing-site edit requests close and respects the dirty
check. No navigation, question, review or edit-save action writes an application
or uploads a file. Only final submission uploads a selected PNG/JPEG/WebP via the
existing `POST files`, then sends the original payload to `POST selling/sites`
with existing create/edit kind and site identity. Publication still requires
manager approval. Shared `api`, `ctx.run` and Sonner retain request, refresh and
feedback ownership; shared Input/Textarea/Button retain native control semantics.

One synchronous busy lock blocks duplicate final submission, mutation and
closing while a request is active. Failed requests keep the draft and show an
inline alert; retries reuse a successfully uploaded file ID until the selected
file changes. Dirty close, Escape and backdrop dismissal invoke the optional
registered `modal.beforeClose` guard and canonical AlertDialog. Continue editing
retains details; explicit discard closes without an application submission.
Browser unload also guards unsent changes. Successful completion clears the
unsent guard and returns to My Sites through the existing close callback. Other
modal users retain existing behavior when no guard is registered.

One bounded dialog owns vertical scrolling. Desktop caps at 1040px; at 700px and
below artwork stacks above copy and review/edit columns collapse. visualViewport
updates keep the dialog in the visible keyboard area. Hebrew labels/actions use
RTL; URL/email/numeric controls retain LTR direction and full values wrap. Chapter
motion uses an inert, aria-hidden outgoing clone, cancels/cleans animations, locks
repeated chapter changes and focuses the arriving field/heading. Reduced motion
uses immediate transitions. The four-part path exposes the current step; errors
are linked to their field and keyboard focus reaches the first invalid field.

`app/site-application-brand.css` owns this approved Rubik/navy/ice/teal-blue scoped
extension (model B), mirrored in DESIGN.md and `.impeccable/design.json`. The only
global CSS adjustment is a zero-specificity `:where` exclusion for this named
surface in three blanket dialog text rules. It leaves their specificity for
other dialogs intact. Original artwork/logo and locally served OFL Rubik faces
are documented in `.impeccable/surfaces/site-application-journey.md`.

Verification: typecheck, production build, lint with 0 errors (four form image
warnings and two pre-existing seller-workspace image warnings), journey
schema/handler tests, seller UI, 48 existing seller API requests and existing
cart/checkout/catalog checks passed. A real-component Playwright fixture at
320px, 390px and 1440px covers validation, edit/cancel, existing-site payload,
file/request failure, cached-upload retry, duplicate/busy-close locks, guarded
close, keyboard and reduced motion, with no runtime errors. Fixture APIs do not
certify authenticated live accounts or physical iOS Safari. The strict global
audit retains 76 legacy/ownership findings, none in the new journey/form/schema/
motion files. Finish review disposition: ship, with no material issues.

Restore: public branch `restore/before-site-journey-20261027`, commit
`a4162c8f12605a11c714b060a73e321d6e6623b0`. Source publication and deployment to
the existing staging service/environment are pending; no live release is claimed.

## Seller payout form presentation — 2026-10-27

The approved four fields serialize to the existing payment_details string and
POST selling/payout. Existing encryption, duplicate-pending rejection, manager
approval and payment transfer rules remain server-owned and unchanged. All four
structured fields must be filled; inline errors preserve inputs and focus the
first missing field. Bank/account identifiers are text with numeric input mode
so leading zeros survive. Stored free text that cannot be parsed losslessly
remains editable as free text; converting to separate fields is explicit.
The canonical seller Action supplies duplicate-submit locking, error/retry and
success feedback. Canonical Dialog owns focus, Escape and close controls.

## Orders and final payment approval
- Final approval in Israel time determines financial month. Open orders have no
  final financial month. Purchase/billing month remains separate for debt tracking.
- Card reports cannot enter manual review. Wallet credit is granted once, only
  after a signed amount/currency-checked gateway callback. Provider availability
  is configuration-driven; no success is inferred from redirect.
- Bank wallet requests record execution date, report time, reference and optional
  proof; approval, rejection and cancellation are distinct audited decisions.
- Unpaid item cancellation reduces debt without wallet credit. Paid item refunds
  default to wallet; external refunds require a description and are recorded only.
- Sent/published articles require an explicit stop/removal confirmation before
  refund. Pending cancellation blocks publication. Version and financial guards
  prevent duplicate and concurrent changes. Per-component refund history persists.

## Orders reference layout — 2026-10-28
The attached approved mockup is the visual authority for the main orders list.
Desktop uses one semantic, paginated table; phones use compact cards. Existing
order details retain all cancellation, refund, payment and assignment controls.
The canonical Select owns category, status and month popups, focus and keyboard
behavior. Category selection keeps the six existing destination routes.
Combined status filtering is read-only. Final approval remains the month basis
for paid records; open records filter by creation date. Payment confirmation
wins over any stale pending report when displaying a status. Search ignores
stale responses, supports IME/Enter/clear and preserves the committed filters in
existing in-memory admin state, consistent with the application navigation.
Export covers the full filtered result and locks duplicate requests. Loading,
empty results and failed requests remain explicit and recoverable.
Verification: typecheck, scoped ESLint and production build passed; handler tests,
117 orders-finance API checks, 119 payment-report regression checks and 82 split
payment/receipt checks passed. Real component browser fixtures covered all six
routes at 390px and 1440px, category popup geometry/navigation, filtering/search,
order-detail navigation, export failure, final month and refund failure/retry.
No customer records or payment provider actions were changed by verification.

## Compact order disclosures — 2026-10-28
The whole order summary is one native button with aria-expanded/aria-controls.
Closed detail regions are inert; visited regions retain their state to animate
closing. Opening another row closes the previous row. Details load on first open.
Existing detail navigation remains available through ניהול ההזמנה. Paid closure
uses paymentConfirmed; cancellation/demo/unpaid precedence remains unchanged.
Publication states use the canonical stages dictionary alongside each article.

## Approved compact order workflow — 2026-10-28
Sources: the user's explicit 2026-10-28 approval and billing-field correction;
lib/payment-evidence.ts, lib/order-finance.ts, lib/payment-reports.ts and the
existing refund API remain authoritative for financial behavior. No financial
write endpoints or historical amounts/dates are modified.

Canonical owners: AdminOrderHistory owns filters/paging/scroll/disclosure;
CompactOrderDetails owns the compact URL/price view; ApprovedPaymentDetails owns
the native payment disclosure; AdminOrderManagement owns the existing
admin-order/:id route; RefundForm retains mutation/state/version ownership with
an explicit order-inline presentation. InvoiceAttachment, PaymentOrderActions,
ReportReview, Radix Select and the existing private file endpoint are reused.

Billing has exactly four facts: order creation with Israel date/time; confirmed
receipt timestamp with Israel date/time (label תאריך ביצוע התשלום); reference with
its existing private proof link; final approval month. A customer's declared
transfer date or report submission time never substitutes for confirmed receipt.
Unpaid monthly purchases show the purchase dates per item and an unassigned final
financial month. A paid record missing approval evidence remains explicitly
undocumented; the UI does not infer a timestamp from updated/created.

Refunds keep the existing full/publication/writing rules and financial history.
For the inline variant sent/published items require checked stop/removal
confirmation before submission; external refunds require descriptive documentation.
The same synchronous lock blocks repeated submits. Failures retain the draft.
Success remains visible until the explicit return action; history comes from
actual article refund_history and order activity, including time/method/note.
Other refund entry points retain their existing pending-stop workflow.

Verification: production build, typecheck and scoped ESLint; 117 existing finance
API checks; six-route browser regression at 390/1440; new handler checks for the
four fields, safe URLs, final month, private proof, publication guard and duplicate
lock; real-component browser coverage at 320/390/1440 for list, regular/monthly
details, billing and management, including external refund failure/retry.
Synthetic fixtures perform no live customer or provider writes.

## Approved finance sibling workflows — 2026-10-28

The user approved these sibling mockups and deployment, then corrected the
top-up amount hierarchy. This section supersedes only earlier presentation-only
or “no financial write endpoints” descriptions for the explicitly scoped
monthly-order price, statement-preview/closure and selected-order receipt work.
It also supersedes the old grouped customer/month display in the monthly list
and the report's earlier optional order-date basis. Existing permissions,
financial guards, immutable historical purchases, refund rules and verified
gateway approval remain authoritative. No new dependency, migration or
environment variable is required.

| Task | Canonical owner | Current contract |
|---|---|---|
| Finance shell and records | `AdminSectionTabs`; `FinancePage`, `FinanceRecord`, `FinanceItems`; `app/finance-records.css` | Keep the original logo and all six real categories. The active category supplies one page title. A native disclosure button exposes `aria-expanded`/`aria-controls`; one record opens at a time. URLs, amounts, statuses, dates and counts come from the real response. Shared controls, private files, `ctx.run` and global toast remain canonical. |
| Monthly list and item snapshots | `MonthlyView`; GET `monthly?view=orders`; existing order detail API | Each row is one actual order, rather than a customer/month aggregate. Repeated purchases of the same site are valid separate items. Each item retains its actual `purchased_at` and purchase-price snapshot; later catalogue/customer-price updates do not reprice earlier items. Missing legacy timestamps remain honest fallbacks, never invented purchase times. |
| Local price editing | `OrderItemPriceEditor`; POST `admin/customer-account/:user/price`; `AdminOrderManagement` | The monthly UI permits an item edit before paid/settled, purchase or monthly closure, invoice attachment and pending/approved report. The server validates article version, order ownership, expected total and existing financial guards. Only the chosen item/order and its unsettled debt change; the customer catalogue does not. Writing stays unchanged. Preview net/VAT/gross before save, record price history/activity, lock duplicate/busy actions, preserve failed drafts and use the existing dirty-navigation/unload guard. |
| Cancellation and refund | Existing `RefundForm`; customer-account refund handler | Unpaid cancellation reduces debt without wallet credit. Paid refunds retain wallet/external destination rules; an external refund requires a note and records the outside action. Sent/published items keep the stop/removal warning and explicit confirmation or existing pending-stop flow. Price editing does not bypass component/version/duplicate guards. |
| Close purchases and send statement | `CloseMonthlyOrder`; POST `admin/customer-account/:user/order-statement/:order`; `prepareOrderStatement`, `closeOrderForStatement` | Load the current order items, dates, net, VAT and gross before enabling confirmation. The expected total must still match on submission. Closure snapshots all sites/prices, closes only that order to purchases, records actor/activity and queues its branded PDF email. The exact monthly subject is `הזמנה חודשית מספר xxxx נסגרה לתשלום`, with `xxxx` replaced by the actual number without `#`. The real PDF is attached through the existing mail job; mail/PDF delay is shown honestly. Closure does not confirm receipt of money. |
| Read-only statement preflight | GET the same private order-statement route with `?preview=pdf` (`?preview=1` for summary data) | Admin and customer/order ownership checks apply. Render the current statement and real branded PDF before confirmation; return private/no-store PDF bytes. Preparation may assemble operations, but preview executes no batch, creates no record/job and does not close purchases. Stored final summaries remain authoritative once closed. |
| Receive one monthly payment | `ReceiveMonthlyPayment`; POST `admin/monthly/settle` with `order_id`; existing `completeOrderPayment` | Include the selected order, user, billing month and expected amount. Require bank reference, valid declared date and checked receipt confirmation; optional proof uses the existing private file flow. Settle only that selected order and its debt, retain original monthly order type, and preserve the reference/proof. The legacy aggregate endpoint branch remains available to existing callers. |
| Bank report decisions and history | `AdminPaymentReports`, `ReportReview`; `lib/payment-reports.ts` | Show complete order items and method, declared date, report time, amount, reference/proof and decision. Checked actual receipt enables approval; rejection requires its note. Existing request/version/amount checks and duplicate locks govern the decision. Approved/rejected reports remain available through their status filters. Card payments cannot enter manual review. |
| Top-up review | `AdminTopups`, `TopupReview`; existing wallet-topup endpoints and `lib/finance.ts` | Lead with the top-up amount in the large pale-blue block, followed by smaller current/projected balance facts and four compact report facts. Approval requires checked bank receipt; rejection/cancellation require notes. Actual returned wallet balance and handled details replace projections after approval. Verified gateway card credit remains immediate and once-only; it has no manual approve/reject controls. |
| Financial month report | `AdminMonthClose`; existing report/export API and amount/cost snapshots | This surface uses final-payment basis. Israel final-approval timestamp determines the financial month, separately from creation, purchase, declared transfer and report dates. Draft from/to dates apply only on submission; matching response/applied range owns the summary and export. The report is read-only, uses local 20-row pages, and exports its complete selected dataset. Missing dates/costs remain explicit and profit excludes unrecorded expenses. |
| Invoices and receipts | `AdminInvoices`, `InvoiceReview`, existing `InvoiceAttachment` | Reuse private download, attachment/version/history and exact-order navigation. A monthly purchase statement is distinct from a tax invoice or receipt. |

Top-up and invoice lists retain existing server pagination at 30 rows. Monthly
orders and payment reports load their latest 1,000 rows and display local pages
of 30; they do not offer server pagination. The monthly view explicitly explains
the 1,000-order cap and directs older-history work to the customer account.

Verification evidence checked: production build, empty successful typecheck and
scoped lint logs; 90 monthly-lifecycle checks including real PDF preview bytes,
permission checks and unchanged record/job/purchase-closure state; 117 finance,
119 report and 250 account checks; monthly UI assertions; real-component browser
fixtures for all six routes, expanded records and actions at 320/390/1440px,
including final closure dialogs with items and the top-up amount hierarchy. The
main compact-order browser regression also passed. Exact evidence paths and
approved references are in `.impeccable/surfaces/finance-siblings.md`.

These checks use isolated synthetic data and perform no live financial mutation.
Physical iOS Safari, deployed pixels and a pixel-exact comparison are not
certified. Impeccable context loading was unavailable and the detector timed out
without output, so no clean global audit is claimed. The final independent
closure-preflight review returned **ship** after manual inspection of all 24
captures: the material preflight fix is resolved, with no partial or unresolved
findings in this scope. Actual deployment remains a separate completion record.


## Month-close site visibility correction — 2026-10-28

All month-close records start closed. The native row button exposes
`aria-expanded`/`aria-controls` and opens or closes the complete detail body:
site rows first, then billing facts and the explicit order-details action.
Only one record is open at a time. Repeated mouse, Enter and Space activation
must reclose it. Expansion stays on the report page and reveals its URLs there;
opening an order remains a separate explicit action. No optional site preview
sits outside the hidden body. Applying a valid report range resets the page and
closes the detail; changing the local report page also closes it. Monthly,
top-up and payment-report row toggles use functional state updates.

Expanded rows show actual full site URLs and historical remaining net prices;
monthly items retain purchase date/time. The existing item projection, historical
URL preference, legacy URL/timestamp fallbacks, admin authorization, accounting,
filters, applied-range export and local 20-order paging remain unchanged. This
runtime correction adds no backend, API projection, financial write or migration.

Production build, typecheck, scoped lint, month-close API checks, billing/refund
and history handler checks, all-six-finance browser coverage and the main
approved-order browser regression passed. Browser fixtures cover 320/390/1440px,
repeated mouse/keyboard toggles, one-open-record behavior, hidden sites on closure,
monthly dates and actions without overflow. Fresh independent manual review
returned **ship** for this scoped correction with no material unresolved findings.
Evidence and verification limits are in `.impeccable/surfaces/finance-siblings.md`.
The corrected source has not yet been deployed.
