# Cart and checkout visual reference — 2026-10-21

This task-specific reference records the approved cart and checkout presentation.
Runtime visual ownership remains with `app/cart-checkout-refresh.css`, scoped to
the existing cart/checkout surface. It is not a replacement for the project-wide
design context.

## Colors

Navy (#09294a) anchors headings and the order summary. Cyan (#00b8d4) and blue
(#087fd3) support actions and selected states. White item/form surfaces sit over
light ice backgrounds. Existing publication logos and cart artwork are retained.

## Typography

Use the existing Heebo family with Arial fallback and Hebrew RTL reading order.
Money is isolated LTR, with a leading shekel sign, thousands separators and two
decimal places through `formatPurchaseMoney`. Displayed prices and totals use
the existing cart/quote projection.

## Layout

At desktop widths, a compact white item list or billing/payment surface occupies
the right side, with the navy order summary at left. The desktop summary remains
visible and sticky. Below 1024px, the layout becomes one column and checkout
begins with a collapsed order-summary disclosure.

At phone widths up to 640px, cart initially shows two item cards and offers a
show-more disclosure. The total and primary action occupy a fixed bottom bar
with safe-area spacing. Checkout payment choices become vertical radio rows;
desktop choices retain three or four equal columns according to the existing
available options. Form fields use a single column on phones.

## Components

The quantity picker remains a native HTML `select`, with its browser/OS-owned
popup and keyboard selection behavior. Scoped CSS removes the inherited closed
control arrow/padding and centers its numeric value. Existing adjacent decrease
and increase buttons remain separate controls; this is not a custom listbox.

The existing radio-group primitive owns payment selection. Native
`details`/`summary` owns coupon and bank-detail disclosure. Checkout's order
summary and the cart's item-list disclosure use their existing labeled buttons
and expanded state. Shared components retain their interaction ownership.

Visible focus, reduced-motion overrides and forced-color treatments belong to
the scoped stylesheet. Browser and real-device verification must be reported
separately; this reference records the current implementation and approved
visual direction, not a visual test result.
