# Approved knowledge hub, article and CMS — code only

User approved all three mockups and explicitly requested no Railway deployment.
This change is based on reviewed staging source `4847a59`; no deployment settings
or hosting identities are changed. Previous approved cart/account work is retained.

## Routes and behavior

- `/knowledge`: server-rendered published articles, one featured story, two-column
  cards, explicit search/clear, category filters and 24-item paging.
- `/knowledge/[slug]`: published snapshot only, Article/share metadata, heading
  anchors, contents, related articles and catalog actions. Missing/unpublished 404.
- `/admin-knowledge`: role-gated searchable/paged management list.
- `/admin-knowledge/new` and `/admin-knowledge/[id]`: shared RTL RichEditor with
  named compact variant, formatted headings/lists/links, table insertion, undo,
  cover and inline images/captions/alt, categories/tags and SEO fields.
- Explicit draft save, preview, publish and reversible unpublish. Draft changes
  never silently replace a published snapshot. Compare-and-swap rejects stale
  updates while preserving the entered draft in the UI. Stable slugs lock after
  the first save. The preview is private and transient, not a shareable URL.

Migration `0006_knowledge.sql` adds isolated posts, categories and media tables.
Three initial categories are inserted; no example articles are published or
inserted into a real environment. Five sample articles exist only in ignored QA
fixtures. Drizzle schema, journal and generated snapshot match the migration.

Existing actor/admin boundaries, shared controls/dialogs, Sonner, local Heebo,
brand logo and R2 binding remain canonical. Uploads accept verified PNG/JPEG/WebP
up to 8 MB; a knowledge image becomes public only while referenced by a published
snapshot. The general private file endpoint is not opened. Server sanitization
removes scripts, event attributes, external/foreign images and unsafe link/style
values. Save and upload locks prevent duplicate operations.

## Design and verification

Approved layout/palette mapped to scoped knowledge CSS: navy, blue/cyan, pale
wave background, light glass panels, quiet article paper. The existing real logo
is preserved; generated mockup logo variations are not a replacement brand asset.
Five coordinated image assets were generated separately and compressed to WebP.
Photographic details and cropping are not a claim of pixel identity with a
flattened generated mockup.

Passed: TypeScript, production build, 41 real isolated Worker/D1/R2 knowledge HTTP
checks, 47 SEO checks, cart/checkout/phone/confirmation regressions, admin workspace
navigation contract and existing editor formatting/link/paste tests.

Actual React/browser inspection: desktop hub/article/editor, public hub at 390px,
article at 360px, editor at 320px. Document widths matched available client widths
(375/375, 345/345 and 305/305, with classic scrollbar). Admin save, new category,
tag, preview and preserved content after a simulated save failure were exercised
against isolated browser fixtures. No real account, customer order or publication
was mutated during these checks. The full project static premium audit retains
72 pre-existing findings, with no findings in knowledge files; it is not a clean
whole-project certification. Physical phones and real staging writes are untested.

Deployment is intentionally deferred. When separately authorized, the migration
must run before requests are served; the existing staging bootstrap already
applies the migration directory. Staging remains protected by its existing login.
