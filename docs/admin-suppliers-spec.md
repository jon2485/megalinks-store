# Spec: Suppliers area in admin (09.11.2026)

Goal: let an admin manage suppliers, their sites and their payments from one place, quickly and without mistakes, in the "sky" design with the current order and functionality kept.

## Who the suppliers are
- **Manual supplier**: an admin added them. There's no account and no invoice in the system. Payment is recorded manually with a reference.
- **Supplier with an account**: a customer who added their own site. Every month a statement is created from their published articles, they upload a PDF invoice, the admin approves it, and only then records the payment.

Statement states (unchanged): waiting for invoice → invoice under review → (sent back for correction) → approved for payment → paid. For manual suppliers: waiting to record payment → paid.

## Area structure
Heading "ספקים" with three tabs (same style as orders): ספקים ואתרים · בקשות וחשבוניות · התחשבנות, with a light/dark switch.

## 1. Suppliers and sites
| Element | Where | What it does |
|---|---|---|
| "הוספת ספק" | Top of the screen, primary | Opens a new supplier card |
| Search + readiness filter | Under the heading | Search by supplier, contact or site. Filter: ready / missing email / missing cost / missing agreement / paused / no sites |
| Row | List | Supplier (name + contact person) · type (with account / manual) · sites (count, active / paused) · readiness |
| "פרטי הספק" | In every row, always visible | Supplier card for editing |
| Open row | Expand | Supplier sites (edit, pause / show), plus: "שיוך אתר", "התחשבנות הספק" (statements filtered to this supplier), "כתבות של הספק" (articles screen searching by supplier), email and phone as links |

Fixed: the column headings didn't match the content.

## 2. Requests and invoices
- Supplier requests: in a pending request, the main button "בדיקת הבקשה" opens the review right in the row.
- The invoices sub-tab uses the same statements list (including the new invoice column).

## 3. Statements (the important screen)
**Summary at the top** (clicking one filters the list):
- To pay now: statements approved for payment, count + amount including VAT.
- Invoices to review.
- Waiting for an invoice (including invoices sent back for correction).
- Manual suppliers to record: count + net amount.

**Columns:** supplier / month · articles · net cost · **invoice** (new) · status · action.

**Invoice column:**
- Supplier with an account and an invoice: invoice number, receipt date, "צפייה בחשבונית" button (opens the PDF in a new tab).
- Waiting for an invoice: "טרם התקבלה" + the planned payment date.
- Sent back for correction: "הוחזרה לתיקון".
- Manual supplier: "ספק ידני · ללא חשבונית במערכת".

**Main button by status:**
- Invoice under review → "בדיקת החשבונית" (invoice screen with the PDF next to it, approve / send back for correction).
- Approved for payment → "דיווח תשלום" (window: amount, transfer reference, confirmation that the transfer was made, warning if payment details are unapproved).
- Manual supplier waiting → "דיווח תשלום" (window: reference + confirmation).
- Otherwise → "פירוט".

**Open row:** articles list with links, totals (before VAT, VAT, total), paid / balance, reference, supplier payment details status, invoice history, "צפייה בחשבונית", "פרטי הספק".

## Not changing
Approval, rejection, payment and recalculation logic stays as it is (`lib/customer-sellers.ts`, `lib/admin-suppliers.ts`). A payment report can't be recorded before the invoice is approved, or while the supplier's payment details are unapproved or awaiting a change.

## Update 09.11.2026: supplier page and payments (after owner feedback)
**Supplier page** (`admin-supplier/<id>`):
- Top card: name, type, contact person, email, phone and supplier website as links.
- Quick buttons: "האתרים של הספק (N)", "כתבות שפורסמו אצלו" (articles screen filtered to published), "התחשבנות ותשלומים" (filtered to the supplier), "בקשות" (supplier with an account, with a pending-request count).
- "פרטים ואופן התנהלות" tab:
  - Details form, plus a new "אופן ההתנהלות" field (how to send articles, response times, who to contact about payment).
  - Agreement and internal notes, payment details, snapshot.
- "אתרים" tab: a table with:
  - Site columns: site, price list shown on the site, cost price, margin, notes (internal + publishing restrictions), status (active / paused + "בקשה ממתינה").
  - Actions per site: "עריכה" (quick window: price list, cost, internal notes, visible in catalog). The "⋯" menu has: full edit, articles on the site, open the site, remove from supplier.
  - Above the table: "צירוף אתרים לספק" (window with search, multi-select, marks a site that's moving from another supplier, up to 100 per action) and "אתר חדש".
- There's no supplier-level cost: each site is priced on its own.
- Removing a site from a supplier: it stays in the catalog without a supplier, with a recommended option to pause it until a new supplier is linked.

**Supplier payments:**
- Statements are split into "תשלומים שטרם בוצעו" (default) / "תשלומים שבוצעו" / "הכול".
- "דיווח תשלום" opens a window with: summary (supplier, month, articles, invoice, amount), payment date, payment method (bank transfer / check / cash / card / Bit or PayBox / other), reference number, note to the supplier (goes into the email), and the confirmation "העברתי את התשלום לספק בפועל".
- After saving: status "שולם", and the supplier gets an email with the date, method, reference and note.
- Each paid row shows the payment date and method.
- Rules haven't changed: for a supplier with an account, you can't record a payment before the invoice is approved or while the payment details are unapproved.
