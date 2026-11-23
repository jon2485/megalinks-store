// Orders in the trash (23.11.2026): only abandoned orders, moved there by the admin and restorable.
// The mark lives in the order's data ('trashed_at', 'trashed_by'), like the other order flags (demo, on_account).
/** SQL condition: the order (table alias `alias`) is not in the trash. */
export const liveOrderSql=(alias='o')=>`COALESCE(json_extract(${alias}.data,'$.trashed_at'),'')=''`;
/** The same test on a parsed order row. */
export const orderTrashed=(o:{trashed_at?:unknown}|null|undefined)=>!!(o&&o.trashed_at);
