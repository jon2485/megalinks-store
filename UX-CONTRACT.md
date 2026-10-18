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
