// Settlement follows the procurement mode frozen at dispatch, never today's
// website settings. NULL means monthly; zero is a finite, exhausted allocation.
// The ledger fallback also covers older dispatches with no JSON snapshot.
export const monthlySupplierArticle = `COALESCE(json_extract(a.data,'$.supplier_stock_total'),(SELECT da.stock_total FROM supplier_dispatch_allocations da WHERE da.article_id=a.id)) IS NULL`;
// An article the supplier is paid for: published and not refunded, or refunded after publication when the admin
// chose to keep the supplier payment (owner decision 11.11.2026: the admin is asked at that refund).
export const supplierPayableArticle = `(COALESCE(json_extract(a.data,'$.supplier_cost_kept'),0)=1 OR (a.status='published' AND COALESCE(json_extract(a.data,'$.publication_refunded'),0)=0))`;
