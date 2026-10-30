// Settlement follows the procurement mode frozen at dispatch, never today's
// website settings. NULL means monthly; zero is a finite, exhausted allocation.
// The ledger fallback also covers older dispatches with no JSON snapshot.
export const monthlySupplierArticle = `COALESCE(json_extract(a.data,'$.supplier_stock_total'),(SELECT da.stock_total FROM supplier_dispatch_allocations da WHERE da.article_id=a.id)) IS NULL`;
