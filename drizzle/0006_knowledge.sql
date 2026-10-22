CREATE TABLE `knowledge_categories` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `knowledge_categories_name_unique` ON `knowledge_categories` (`name`);--> statement-breakpoint
CREATE TABLE `knowledge_media` (
	`id` text PRIMARY KEY NOT NULL,
	`storage_key` text NOT NULL,
	`type` text NOT NULL,
	`name` text NOT NULL,
	`size` integer NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `knowledge_posts` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`draft` text NOT NULL,
	`published` text,
	`version` integer DEFAULT 1 NOT NULL,
	`created` text NOT NULL,
	`updated` text NOT NULL,
	`published_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `knowledge_posts_slug_unique` ON `knowledge_posts` (`slug`);--> statement-breakpoint
CREATE INDEX `knowledge_published` ON `knowledge_posts` (`published_at`);
--> statement-breakpoint
INSERT OR IGNORE INTO knowledge_categories(id,name,created) VALUES
 ('site-selection','בחירת אתרים','2026-10-22T00:00:00.000Z'),
 ('publication','פרסום כתבות','2026-10-22T00:00:00.000Z'),
 ('marketing','תוכן שיווקי','2026-10-22T00:00:00.000Z');
