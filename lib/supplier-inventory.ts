// Settlement follows the procurement mode frozen at dispatch, never today's
// website settings. NULL means monthly; zero is a finite, exhausted allocation.
// The ledger fallback also covers older dispatches with no JSON snapshot.
export const monthlySupplierArticle = `COALESCE(json_extract(a.data,'$.supplier_stock_total'),(SELECT da.stock_total FROM supplier_dispatch_allocations da WHERE da.article_id=a.id)) IS NULL`;
// An article the supplier is paid for: published and not refunded, or refunded after publication when the admin
// chose to keep the supplier payment (owner decision 11.11.2026: the admin is asked at that refund).
// An article published at an exchange supplier (owner 23.11.2026) is paid with an exchange, never with money: the
// mark frozen at purchase wins, and older articles fall back to the site's current mark.
export const exchangeSupplierArticle = `(COALESCE(json_extract(a.data,'$.supplier_exchange'),0)=1 OR EXISTS(SELECT 1 FROM websites xw WHERE xw.id=a.website_id AND json_extract(xw.data,'$.stock_mode')='exchange'))`;
export const supplierPayableArticle = `((COALESCE(json_extract(a.data,'$.supplier_cost_kept'),0)=1 OR (a.status='published' AND COALESCE(json_extract(a.data,'$.publication_refunded'),0)=0)) AND NOT ${exchangeSupplierArticle})`;
