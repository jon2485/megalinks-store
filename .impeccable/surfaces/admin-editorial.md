# Administrative editorial surface — approved 2026-10-24

## Authority and scope

The approved direction extends the liked article editor across every existing
administrative page: Hebrew RTL, existing Heebo, navy brand header, faint waves on
an ice/white ground, blue primary actions, 12px work panels and 8px controls.
The original reference is
`../generated_images/exec-f7022388-8be7-463b-9ed7-9bd29491e577.png`
(relative to the repository root). The approved family of administration boards
and the user-approved direction supplied for this pass are composition references;
generated records, names, amounts and logo drift are not application content.

This records the supplied approval and finished source. No pre-existing surface
brief or PRODUCT.md was found in the repository or checked workspace ancestors;
product, permission and business facts remain with the existing application and
UX-CONTRACT.md. Documentation does not create product policy.

## Operating concept

A complete searchable header menu supplies all existing destinations and aliases.
Desktop devotes the work surface to its records and forms without a persistent
navigation rail. The navy header retains the real Mega Links logo and account
controls. Breadcrumbs give current-page context. Original account/pricing tabs
continue to expose distinct workflows; the redundant generic section tabs are
visually suppressed.

Existing work-center mobile feed structure and its five-shortcut frosted pill
dock remain. The full menu remains available at every width. Real queue counts,
loading, empty, error, stale, busy and selected states keep their original owners.
Opening a record does not imply resolution, approval or supplier dispatch.

## Page and responsive composition

The runtime main currently uses a single available-width stage capped at 1600px,
36px desktop gutters and 24px top spacing. Work panels use a 24px rhythm; desktop
forms may pair the work column with a 320–360px aside. Full-page site editing
uses a 330px metadata column and explicit return/save actions. Customer profile
and payment sections remain editable within their account page. Long forms use
natural document scrolling.

At 1000px and below, work/aside and list/detail grids collapse to one column.
At 767px and below, gutters are 16px and work-panel padding is 18px; actions wrap,
fields stay 16px, and the page reserves 118px plus the safe-area inset for the
preserved mobile dock. The dock keeps all five destinations and shares the bottom
lane with WhatsApp: dock left 8px/right 64px; WhatsApp right 8px/bottom 26px, with
safe-area offsets. Source-header labels remain visible on opted-in phone table
cards and record actions remain reachable. Native table semantics and
source handlers remain present. Unopted tables keep their existing behavior.

The finance hero follows the RTL reading edge without its floating decorative
icon. On phones, its three existing summary figures use compact full-width rows
and reset inner-card padding. The admin-only utility footer is compact and white;
all links and contact actions remain available. The site editor opens at the
page top and focuses its title with `preventScroll`. Its Hebrew logo-upload zone
retains a transparent accessible native file input and visible containing focus.

## Ownership and constraints

- Runtime model B: `app/admin-editorial.css` is canonical for this admin-scoped
  refinement; `app/admin-approved-glass.css` retains the underlying header, menu,
  feed and dock. The editorial owner supplies compact header/footer refinements
  and the shared mobile dock/WhatsApp lane. Root DESIGN.md mirrors the scoped
  tokens and its sidecar extends them. Higher-specificity editorial selectors
  supersede the obsolete knowledge rail/grid exception independently of CSS order;
  actual computed-style verification remains with the browser review.
- `app/admin-editorial-surface.tsx` supplies the authenticated wrapper, breadcrumbs,
  skip target and the opt-in table-presentation context.
- `components/ui/table.tsx` and `table-presentation.tsx` derive phone cell labels
  only in the opted-in context; existing record handlers remain canonical.
- `app/catalog-pricing-workspace.tsx` and `catalog-website-form.tsx` own the real
  site editor, data and saves. `app/customer-account-admin.tsx` owns account forms.
- `app/admin-draft-guard.tsx` protects independently saved draft sections;
  `workspace.tsx` remains the route/dirty navigation owner. Existing APIs, validation,
  confirmations, versions and errors remain authoritative.
- Radix retains dialog/Sheet focus, dismissal and busy locks; Sonner retains
  notifications. Portal styling is scoped to a currently mounted admin surface.
- Keep customer, supplier, catalog and public knowledge styling unchanged. Do not
  promote these page compositions or admin-scoped values to global defaults.

## Evidence and verification limits

The document pass inspected DESIGN.md, UX-CONTRACT.md, editorial CSS/surface,
table presentation context, draft guard, administrative shell, workspace routing,
site-pricing editor and the preceding approved-glass owner. It extracted the
implemented repeated token values rather than treating generated comp text as
runtime truth. Existing unrelated design sections were preserved without repair.

After the reviewer correction batch, this pass rechecked the editorial owner,
site-editor opening behavior and file-upload source; scoped token values are
unchanged. Typecheck, build and action-test success were supplied by the
implementation owner. That owner also reports zero strict-audit issues in new
files and 23 findings in touched incumbent files, identical to the immutable
baseline; this does not establish whole-application premium compliance.

Reviewer recaptures and actual computed-style validation remain pending. This
file does not certify screenshot fidelity, browser focus, real-device behavior or
live financial mutations. Later visual corrections require a source and token
recheck before the documentation pass closes.
