# Approved customer refinements — 25 October 2026

This is a narrow extension of the existing MegaLinks client design. Preserve the
existing header, product-card body, prices, actions, Heebo typography, navy ink,
icy blue surfaces and approved glass treatment. `DESIGN.md` and
`.impeccable/design.json` remain unchanged. This document records prepared code;
it does not certify a Railway deployment or replace the separate finish review.

## Cart and account

The original three wave paths, fills and opacity values are retained. Their SVG
now belongs to the full-width cart root rather than the constrained hero. The
root owns positioning and isolation; the wave layer spans its width, with the
existing fade and a responsive 330px/280px height. No background artwork is
replaced. Product logos use `object-fit: contain`, centered content and bounded
intrinsic sizing so the full mark remains visible.

The cart's existing plus disclosure is named “כתיבה ושיוך ללקוח”. It exposes an
optional customer assignment independently of optional paid writing. The
native `<select>` is deliberate: its popup geometry and keyboard interaction
remain browser/OS-owned, matching the existing cart quantity control. Loading,
error and busy states disable selection; the existing save callback handles
errors. Saving assignment sends only `customer_id`.

Existing server ownership checks reject another account's customer. Existing
order creation carries the cart brief's `customer_id` into purchased articles;
“My Customers” retrieves those articles under the selected owned customer.
Assignment does not activate paid writing or change price calculations.

Account phone text is right aligned while retaining `dir="ltr"` for digit order.
The sign-out icon is horizontally mirrored; the existing sign-out link remains.

## Compact catalog metrics and scheduling

Only the DR/UR/notes strip is reduced. It keeps the existing three-column glass
surface and dividers, with 22px numbers, 12px labels, 4px vertical padding and a
44px minimum notes target. The remaining product card, prices, tags, imagery and
purchase actions remain present. The existing notes popover still owns opening,
closing and focus behavior; its open-state surface and rotating chevron remain.

`PublicationDatePicker` remains the authored date owner, composed from the
shared Calendar and Radix Dialog. Its customer variant adds the approved icy
glass surface, Hebrew RTL title and explanatory copy, calendar icon, typed date,
Israel timezone hint, month/year selectors, circular blue selected day and
apply/cancel/reset/close controls. The customer reset action is aligned to
the right, matching the approved Hebrew composition. Sunday remains the rightmost weekday. Outside
month dates are hidden in the customer variant. The dialog is bounded by the
viewport and scrolls when necessary.

No scheduling policy changes: a future submission reaches the manager's
approval queue on the requested day, according to Israel time, and reaches the
supplier only after approval. Existing date validation and state transitions
remain authoritative.

## Bulk Excel template

The real XLSX template has RTL layout, a frozen header, wide wrapped columns,
52-point explicit row heights and 25 blank rows for entry. Input cells are not
merged. The example row has a pale turquoise fill (`FFDDF5FA`), “לדוגמה” in its
filled example values, and an explicit “סוג שורה” marker:
“דוגמה בלבד — לא להזמנה”.

`parseBulkSheet` excludes rows carrying that exact marker before empty-row,
row-count and product mapping checks. An example-only file reports no orders;
it never creates a cart item. Legacy templates and existing validation remain
supported. Users enter real orders in the blank rows, one article per row.

## Verification and limits

TypeScript and the production build passed. The following targeted suites
passed: `cart-checkout-actions`, `checkout-phone-actions`, `cart-add-feedback`,
`bulk-order`, `cart-export`, `publication-scheduling`, and the new
`cart-customer-assignment` test. The latter uses an isolated real Worker/database
and covers assignment/clearing, foreign ownership rejection, optional writing,
purchase propagation, customer article visibility and cross-account privacy.
Scheduling verification comprises 83 date/Worker requests.

The documenter independently inspected the supplied desktop/mobile cart,
catalog and scheduling captures. They show complete catalog cards, compact
metrics, contained cart marks, a full-width desktop wave layer and a bounded
RTL calendar with all dialog actions visible. The implementation owner also
exercised the real local preview at 1365px and 390px:
full-width waves, contained logos, complete catalog cards, notes opening,
customer selection persistence, date selection/application and past-date error.
Account phone alignment/direction and sign-out mirroring were checked through
computed styles. These checks are not an iOS-device or full-site certification.
The preview uses isolated fixture identity/data; no fixture authentication,
HTTP-only preview shim or local server belongs in release source. No live
purchases, financial operations, messages, schema, secrets or storage changes
were performed for verification.

The focused addon/calendar/metrics strict audit has zero findings with explicit
native-select ownership. The full-project audit remains nonclean: 48 violations and 24 unresolved
findings, including legacy issues and unconfigured native-control ownership.
The new customer select is among the ownership findings when no global
manifest is supplied; its documented native ownership resolves that finding
in the scoped audit. This is not a clean whole-project audit. The design detector's
199 palette/radius/type advisories are not canonized into global tokens.
`PRODUCT.md` is absent. Pre-existing design-document/token drift remains
unrepaired because this task does not authorize a system migration.


## Final scoped review

The independent finish review matched the original waves, contained cart logos,
compact metrics and complete product cards. Its one material fix was the
customer calendar reset action alignment. The reset now uses zero logical-start
margin and automatic logical-end margin; desktop and 390px mobile recaptures
show it at the right edge beneath the action buttons. The reviewer scored that
fix resolved and returned `ship` at the previously stated component scope, with
no visible regression from the correction. The final production build and
TypeScript check passed after this CSS correction. No whole-site, live-purchase
or iOS-device certification is inferred.
