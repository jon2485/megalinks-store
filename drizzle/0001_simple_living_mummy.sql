CREATE TABLE `credit_accounts` (
	`user_id` text PRIMARY KEY NOT NULL,
	`enabled` integer DEFAULT 0 NOT NULL,
	`credit_limit` integer DEFAULT 0 NOT NULL,
	`balance` integer DEFAULT 0 NOT NULL,
	`demo_balance` integer DEFAULT 0 NOT NULL,
	CONSTRAINT "monthly_balance_limit" CHECK(balance >= 0 AND balance <= credit_limit AND demo_balance >= 0 AND demo_balance <= credit_limit)
);
--> statement-breakpoint
CREATE TABLE `monthly_charges` (
	`order_id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`month` text NOT NULL,
	`amount` integer NOT NULL,
	`demo` integer DEFAULT 0 NOT NULL,
	`settled` integer DEFAULT 0 NOT NULL
);
