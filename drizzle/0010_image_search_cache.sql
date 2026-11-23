CREATE TABLE IF NOT EXISTS image_search_cache (key TEXT PRIMARY KEY NOT NULL, data TEXT NOT NULL, created TEXT NOT NULL);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS image_search_cache_created ON image_search_cache(created);
