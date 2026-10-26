CREATE TABLE seller_profiles (user_id TEXT PRIMARY KEY NOT NULL, supplier_id TEXT UNIQUE NOT NULL, payout_details TEXT NOT NULL DEFAULT '', payout_approved INTEGER NOT NULL DEFAULT 0, created TEXT NOT NULL);
--> statement-breakpoint
CREATE TABLE seller_sites (id TEXT PRIMARY KEY NOT NULL,user_id TEXT NOT NULL,website_id TEXT UNIQUE,domain TEXT UNIQUE NOT NULL,created TEXT NOT NULL);
--> statement-breakpoint
CREATE TABLE seller_requests (id TEXT PRIMARY KEY NOT NULL,user_id TEXT NOT NULL,site_id TEXT,kind TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',proposal TEXT NOT NULL,baseline TEXT NOT NULL DEFAULT '',note TEXT NOT NULL DEFAULT '',review_token TEXT,created TEXT NOT NULL,updated TEXT NOT NULL);
--> statement-breakpoint
CREATE UNIQUE INDEX seller_pending_site ON seller_requests(site_id) WHERE status='pending' AND site_id IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX seller_pending_payout ON seller_requests(user_id,kind) WHERE status='pending' AND kind='payout';
--> statement-breakpoint
CREATE TABLE seller_statements (id TEXT PRIMARY KEY NOT NULL,user_id TEXT NOT NULL,month TEXT NOT NULL,net INTEGER NOT NULL,status TEXT NOT NULL DEFAULT 'awaiting_invoice',data TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 1,created TEXT NOT NULL,updated TEXT NOT NULL,UNIQUE(user_id,month));
