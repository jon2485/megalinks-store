CREATE TABLE IF NOT EXISTS `activity` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`resource` text NOT NULL,
	`action` text NOT NULL,
	`data` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `activity_resource_created` ON `activity` (`resource`,`created`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `articles` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`user_id` text NOT NULL,
	`website_id` text NOT NULL,
	`status` text NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`content` text DEFAULT '' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`published_url` text DEFAULT '' NOT NULL,
	`data` text NOT NULL,
	`updated` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `articles_user_status` ON `articles` (`user_id`,`status`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `articles_order` ON `articles` (`order_id`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `cart` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`website_id` text NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	`data` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `cart_user` ON `cart` (`user_id`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `coupons` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`percent` integer NOT NULL,
	`max_uses` integer DEFAULT 0 NOT NULL,
	`uses` integer DEFAULT 0 NOT NULL,
	`expires` text DEFAULT '' NOT NULL,
	`user_email` text DEFAULT '' NOT NULL,
	`min_total` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `coupons_code` ON `coupons` (`code`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `favorites` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`website_id` text NOT NULL,
	`kind` text DEFAULT 'favorite' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `favorites_unique` ON `favorites` (`user_id`,`website_id`,`kind`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `files` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`size` integer NOT NULL,
	`key` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `files_user` ON `files` (`user_id`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`status` text NOT NULL,
	`data` text NOT NULL,
	`created` text NOT NULL,
	`updated` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `jobs_user_kind` ON `jobs` (`user_id`,`kind`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `ledger` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`amount` integer NOT NULL,
	`reason` text NOT NULL,
	`reference` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `ledger_reference` ON `ledger` (`reference`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `ledger_user` ON `ledger` (`user_id`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`number` text NOT NULL,
	`status` text NOT NULL,
	`subtotal` integer NOT NULL,
	`discount` integer DEFAULT 0 NOT NULL,
	`vat` integer NOT NULL,
	`total` integer NOT NULL,
	`payment` text NOT NULL,
	`paid` integer DEFAULT 0 NOT NULL,
	`data` text NOT NULL,
	`idempotency` text NOT NULL,
	`created` text NOT NULL,
	`updated` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `orders_idempotency` ON `orders` (`user_id`,`idempotency`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `orders_user_created` ON `orders` (`user_id`,`created`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `records` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`user_id` text NOT NULL,
	`data` text NOT NULL,
	`created` text NOT NULL,
	`updated` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `records_kind_user` ON `records` (`kind`,`user_id`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`hash` text NOT NULL,
	`kind` text NOT NULL,
	`user_id` text NOT NULL,
	`resource` text NOT NULL,
	`expires` text NOT NULL,
	`used` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `tokens_hash` ON `tokens` (`hash`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`role` text DEFAULT 'customer' NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`company` text DEFAULT '' NOT NULL,
	`credits` integer DEFAULT 0 NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `users_email` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `websites` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`url` text NOT NULL,
	`category` text NOT NULL,
	`price` integer NOT NULL,
	`dr` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`data` text NOT NULL,
	`updated` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `websites_active_category` ON `websites` (`active`,`category`);
--> statement-breakpoint
DROP TRIGGER IF EXISTS ledger_check;
--> statement-breakpoint
DROP TRIGGER IF EXISTS ledger_apply;
--> statement-breakpoint
DROP TRIGGER IF EXISTS coupon_limit;
--> statement-breakpoint
ALTER TABLE users ADD COLUMN credit_guard integer NOT NULL DEFAULT 0 CONSTRAINT users_nonnegative CHECK (credits >= 0);
--> statement-breakpoint
ALTER TABLE coupons ADD COLUMN usage_guard integer NOT NULL DEFAULT 0 CONSTRAINT coupons_usage_limit CHECK (uses >= 0 AND (max_uses = 0 OR uses <= max_uses));
