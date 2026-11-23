-- Supplier stock pool (owner, 23.11.2026): one stock number per supplier, shared by all its sites.
-- A row is the place an article took in its supplier's pool; a cancellation before publication deletes it.
CREATE TABLE IF NOT EXISTS supplier_pool_allocations (
 article_id TEXT PRIMARY KEY NOT NULL REFERENCES articles(id),
 supplier_id TEXT NOT NULL,
 demo INTEGER NOT NULL CHECK(demo IN (0,1)),
 sequence INTEGER NOT NULL CHECK(sequence>0),
 pool_total INTEGER NOT NULL,
 created TEXT NOT NULL,
 UNIQUE(supplier_id,demo,sequence)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS supplier_pool_allocations_supplier ON supplier_pool_allocations(supplier_id,demo);
