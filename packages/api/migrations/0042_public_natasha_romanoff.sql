CREATE TABLE `video_shares` (
	`id` text PRIMARY KEY NOT NULL,
	`video_id` text NOT NULL,
	`tenant_id` text NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`video_id`) REFERENCES `videos`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_videos` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text,
	`title` text NOT NULL,
	`description` text,
	`r2_key` text NOT NULL,
	`cloudflare_stream_id` text,
	`duration` integer DEFAULT 0,
	`size_bytes` integer DEFAULT 0,
	`status` text DEFAULT 'processing',
	`source` text DEFAULT 'upload',
	`trim_start` integer DEFAULT 0,
	`trim_end` integer DEFAULT 0,
	`class_id` text,
	`tags` text,
	`poster_url` text,
	`access_level` text DEFAULT 'members',
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`class_id`) REFERENCES `classes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_videos`("id", "tenant_id", "title", "description", "r2_key", "cloudflare_stream_id", "duration", "size_bytes", "status", "source", "trim_start", "trim_end", "class_id", "tags", "poster_url", "access_level", "created_at") SELECT "id", "tenant_id", "title", "description", "r2_key", "cloudflare_stream_id", "duration", "size_bytes", "status", "source", "trim_start", "trim_end", "class_id", "tags", "poster_url", "access_level", "created_at" FROM `videos`;--> statement-breakpoint
DROP TABLE `videos`;--> statement-breakpoint
ALTER TABLE `__new_videos` RENAME TO `videos`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `video_tenant_idx` ON `videos` (`tenant_id`);