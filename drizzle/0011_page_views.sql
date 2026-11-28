-- "תנועה באתר" (owner 28.11.2026): one row per page view, with no cookie, no IP and no personal detail.
-- visitor is a one-way hash that changes every day, so a person cannot be followed from day to day.
CREATE TABLE IF NOT EXISTS page_views (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  day TEXT NOT NULL,
  ts INTEGER NOT NULL,
  visitor TEXT NOT NULL,
  path TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT '',
  device TEXT NOT NULL DEFAULT '',
  seconds INTEGER NOT NULL DEFAULT 0
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS page_views_day ON page_views(day, visitor);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS page_views_ts ON page_views(ts);
