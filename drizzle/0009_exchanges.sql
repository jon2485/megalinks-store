-- Exchange suppliers (owner, 23.11.2026): a supplier whose sites the sheet marks "החלפה" publishes for us and gets
-- one link back for each verified publication instead of money. One row is one exchange: the customer article
-- published at the supplier (source) and the order the supplier took in return (target).
-- booked_cents is the cost counted on the source article; adjustments hold differences booked in a later month.
CREATE TABLE IF NOT EXISTS exchanges (
 id TEXT PRIMARY KEY NOT NULL,
 supplier_id TEXT NOT NULL,
 source_article_id TEXT UNIQUE,
 source_order_id TEXT,
 source_month TEXT,
 earned_at TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('open','claiming','taken','void','debt')),
 target_order_id TEXT UNIQUE,
 target_article_id TEXT UNIQUE,
 target_website_id TEXT,
 chosen_at TEXT,
 site_cost_cents INTEGER,
 booked_cents INTEGER NOT NULL,
 claim TEXT,
 note TEXT,
 created TEXT NOT NULL,
 updated TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS exchanges_supplier ON exchanges(supplier_id,status);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS exchange_adjustments (
 id TEXT PRIMARY KEY NOT NULL,
 exchange_id TEXT NOT NULL,
 month TEXT NOT NULL,
 amount_cents INTEGER NOT NULL,
 reason TEXT NOT NULL,
 created TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS exchange_adjustments_month ON exchange_adjustments(month);
