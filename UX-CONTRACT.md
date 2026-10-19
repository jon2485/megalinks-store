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
