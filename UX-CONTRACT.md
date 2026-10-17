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
