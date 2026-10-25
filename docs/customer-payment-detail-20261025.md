# Approved customer order payment detail

Extends live staging commit `93c30f6` with the owner's approved inline accordion
composition: full-width sites, payment facts on the right, summary on the left,
and the attached document below. Each semantic area has a delicate frame.
The final requested title is **סיכום התשלום:**. Site identity consists only of
the existing name and validated URL, with no logo, initial or decorative avatar.
The surrounding hero, customer tabs, collapsed order rows and admin UI remain.

`customer-order-screen.tsx` still owns fetching, polling and expansion;
`CustomerPaymentDetail` owns this customer-only presentation. Existing amount,
refund, order ownership and payment-report handlers remain authoritative.
`customer-payment-detail.css` inherits account ink/action/type and scopes the
approved 14px section frames, 16px spacing and pale blue line to this surface.
The payment/summary columns stack below 800px. Site fields reflow below 480px;
invoice actions wrap without dropping controls. RTL DOM order is site/date/price,
payment/summary and document/actions. URLs and amounts use bidi isolation.
Focus, hover, active, reduced motion and forced colors have scoped treatments.
No system identity migration or global token changes are made.

Payment facts distinguish paid from purchase-closed, pending, cancelled and
demo orders. The existing receipt/settlement method is selected read-only and
exposed as `confirmed_payment_method` through the customer allowlist. Private
receipt references and staff data are not exposed by this addition. Split
wallet/card payments retain both sources; missing dates are not inferred from
the order creation time. Existing net/VAT/refund math is reused.

Invoice controls retrieve the original admin-uploaded PDF through the owned
order endpoint. `?view=inline` opts into inline disposition for viewing; the
default remains attachment for downloading. Both retain authentication,
ownership, private/no-store, nosniff and restrictive CSP headers. Document type
and number come from saved metadata; missing documents have no false actions.
The generated order statement is never substituted for the uploaded invoice.

## Verification

- TypeScript and production build passed.
- Customer order render/action checks cover the full 30-item list, paid/unpaid
  and purchase-closed states, actual method/date, split payment, document types,
  absent document/date, demo, cancellation and refunds. Admin output preserved.
- Isolated Worker document tests verify exact uploaded bytes, inline/download
  headers, missing file, owner/customer/supplier/anonymous permissions and
  safe confirmed method projection without private receipt data.
- Existing 120-check payment audit, payment closure/report actions, and cart,
  checkout-phone and add-to-cart feedback checks passed.
- Legacy payment-ui and order-display-consistency suites hit pre-existing
  assertions for old copy in untouched checkout/financial-detail components.
  Those unrelated tests/components were not rewritten to conceal the failures.
- Impeccable scoped detector returned only design token advisories, no primary
  findings. Existing project token drift was not changed by this task.

Visual limitation: cloud Browser could not reach the local fixture server;
the live staging customer route requires a sign-in. Consequently this release
does not claim fresh browser/pixel, mobile-device or whole-site verification.
No QA auth shim, fixture identity/data or local preview server is shipped.
