// Owner 16.11.2026: "the orders stay, but of the sites, only the new ones I add from now on". An archived site (data.archived_at)
// stays in the database only so old orders keep showing it: every list, count and search skips it, and the Sheets sync neither
// matches it nor brings it back, so a sheet row with the same address becomes a new site. Supplier settlements still see it.
export const liveSites="json_extract(data,'$.archived_at') IS NULL";
