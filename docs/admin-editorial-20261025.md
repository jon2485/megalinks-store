# Approved editorial administration

Source base: deployed staging commit `d5c1b58e73ce8e138676cbeb67f8641ffd737bd3`.
Destination: the existing Railway staging service only. Production, secrets,
volume, schema, payment policy and server handlers are unchanged.

## Changes

- Apply the approved article-editor language throughout the authenticated admin
  surface: original Heebo, Hebrew RTL, navy header, white/ice wave background,
  blue actions, generous fields and restrained panel depth.
- Use the complete header menu instead of a persistent desktop rail; preserve all
  24 destinations, existing catalog tabs, attention counts and five mobile links.
- Adapt existing table cells to labeled phone records through an opt-in context.
  Original callbacks, links, data, permissions and non-admin markup stay owned by
  their existing components.
- Move site editing into a spacious full-page workspace with all original fields,
  uploads, supplier selection, prices, restrictions, visibility and save actions.
- Expose the existing customer account orders, articles, profile and history
  sections with clear tabs. Protect independent unsaved panels and site drafts;
  repeated navigation to the current route/tab cannot clear the dirty flag.
- Keep phone summaries readable, open editors at document top, retain a Hebrew
  accessible upload target, and position WhatsApp beside the glass dock.
- Retain every footer link/contact action in a compact administrative footer.

## Validation

- TypeScript, production build and scoped lint passed.
- Shared/native table SSR and independent draft-key tests passed.
- Existing catalog, supplier, settlement, pricing, finance, monthly order,
  cancellation, exact-record lobby and support save/recovery checks passed.
- All required cart/checkout/phone/add-feedback regression checks passed.
- The real isolated Worker/D1/R2 suite passed 40 auth/feed/route/count/ownership
  checks. No live financial approval, refund or supplier dispatch was performed.
- All 35 existing API call expressions in the touched application files are
  preserved against the immutable deployed source.
- Browser layout checks covered the 24 admin routes at 390px and 1280px; no page
  horizontal overflow was detected. Representative populated desktop/phone
  captures covered users, finance, site editing, article records and knowledge.
- Browser site-save exercised the existing minimum-price warning, explicit
  acknowledgment and successful return to the catalog using isolated data only.
  Dirty-navigation cancellation and same-route preservation were also exercised.
- Computed table cells are 15px: desktop padding 20px/18px, phone 4px/0.
  Knowledge main is a block without a rail; phone WhatsApp is in the dock lane.
- Strict static audit of new primitives reports zero findings. Whole touched-file
  reports retain the same 23 inherited findings as the deployed baseline and add
  none; this is not a claim that historical forms are fully migrated.
- Independent finish review disposition: **ship**, for reviewed source, approved
  boards and supplied representative captures. All listed material fixes resolved.
- DESIGN.md and its sidecar were rechecked against final runtime ownership.

Populated supplier editing was exercised in component fixtures but not visually
verified with a populated browser record. Real iOS hardware and pixel-diff
certification of every generated board were not performed.

Only the explicit application/test/documentation files are packaged. The local
authenticated preview server, synthetic records, temporary package command,
screenshots, build output and QA headers are excluded. The original package.json
was restored byte-for-byte before release preparation.
