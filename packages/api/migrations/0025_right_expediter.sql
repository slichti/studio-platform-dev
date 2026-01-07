CREATE TABLE `video_collection_items` (
	`id` text PRIMARY KEY NOT NULL,
	`collection_id` text NOT NULL,
	`video_id` text NOT NULL,
	`order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`collection_id`) REFERENCES `video_collections`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`video_id`) REFERENCES `videos`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `collection_item_idx` ON `video_collection_items` (`collection_id`);--> statement-breakpoint
CREATE TABLE `video_collections` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`slug` text NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `collection_tenant_idx` ON `video_collections` (`tenant_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `collection_tenant_slug_idx` ON `video_collections` (`tenant_id`,`slug`);--> statement-breakpoint
ALTER TABLE `videos` ADD `poster_url` text;--> statement-breakpoint
ALTER TABLE `videos` ADD `access_level` text DEFAULT 'members';