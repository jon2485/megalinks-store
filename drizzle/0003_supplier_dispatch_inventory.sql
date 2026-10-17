CREATE TABLE IF NOT EXISTS supplier_dispatch_counters (
 website_id TEXT NOT NULL REFERENCES websites(id),
 demo INTEGER NOT NULL CHECK(demo IN (0,1)),
 sent_count INTEGER NOT NULL DEFAULT 0 CHECK(sent_count>=0),
 PRIMARY KEY(website_id,demo)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS supplier_dispatch_allocations (
 article_id TEXT PRIMARY KEY NOT NULL REFERENCES articles(id),
 website_id TEXT NOT NULL REFERENCES websites(id),
 demo INTEGER NOT NULL CHECK(demo IN (0,1)),
 sequence INTEGER NOT NULL CHECK(sequence>0),
 stock_total INTEGER,
 supplier_email TEXT NOT NULL,
 created TEXT NOT NULL,
 UNIQUE(website_id,demo,sequence)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS supplier_dispatch_allocations_website ON supplier_dispatch_allocations(website_id,demo);
--> statement-breakpoint
INSERT OR IGNORE INTO supplier_dispatch_counters(website_id,demo,sent_count)
SELECT a.website_id,CASE WHEN COALESCE(json_extract(j.data,'$.demo'),0)=1 THEN 1 ELSE 0 END,COUNT(*)
FROM jobs j JOIN articles a ON a.id=json_extract(j.data,'$.article_id')
WHERE j.kind='supplier_publication' AND j.status IN ('succeeded','demo','completed','demo_completed')
GROUP BY a.website_id,CASE WHEN COALESCE(json_extract(j.data,'$.demo'),0)=1 THEN 1 ELSE 0 END;
