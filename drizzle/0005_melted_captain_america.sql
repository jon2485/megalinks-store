CREATE TABLE `pricing_members` (
	`user_id` text PRIMARY KEY NOT NULL,
	`tier_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tier_id`) REFERENCES `pricing_tiers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `pricing_overrides` (
	`scope` text NOT NULL,
	`owner_id` text NOT NULL,
	`website_id` text NOT NULL,
	`price` integer NOT NULL,
	`checked_cost` integer,
	`updated` text NOT NULL,
	PRIMARY KEY(`scope`, `owner_id`, `website_id`),
	FOREIGN KEY (`website_id`) REFERENCES `websites`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "pricing_override_valid" CHECK(scope IN ('tier','user') AND price >= 0)
);
--> statement-breakpoint
CREATE INDEX `pricing_overrides_site` ON `pricing_overrides` (`website_id`);--> statement-breakpoint
CREATE TABLE `pricing_state` (
	`id` integer PRIMARY KEY NOT NULL,
	`version` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `pricing_tiers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`discount_bps` integer DEFAULT 0 NOT NULL,
	CONSTRAINT "pricing_discount_valid" CHECK(discount_bps BETWEEN 0 AND 10000)
);
