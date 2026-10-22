# Catalog interaction contract

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
