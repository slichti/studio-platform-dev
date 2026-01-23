CREATE TABLE `processed_webhooks` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now'))
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
	`width` integer,
	`height` integer,
	`size_bytes` integer DEFAULT 0,
	`status` text DEFAULT 'processing' NOT NULL,
	`source` text DEFAULT 'upload',
	`video_provider` text DEFAULT 'offline' NOT NULL,
	`livekit_room_name` text,
	`livekit_room_sid` text,
	`trim_start` integer,
	`trim_end` integer,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_videos`("id", "tenant_id", "title", "description", "r2_key", "cloudflare_stream_id", "duration", "width", "height", "size_bytes", "status", "source", "video_provider", "livekit_room_name", "livekit_room_sid", "trim_start", "trim_end", "created_at", "updated_at") SELECT "id", "tenant_id", "title", "description", "r2_key", "cloudflare_stream_id", "duration", "width", "height", "size_bytes", "status", "source", "video_provider", "livekit_room_name", "livekit_room_sid", "trim_start", "trim_end", "created_at", "updated_at" FROM `videos`;--> statement-breakpoint
DROP TABLE `videos`;--> statement-breakpoint
ALTER TABLE `__new_videos` RENAME TO `videos`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `video_tenant_idx` ON `videos` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `video_status_idx` ON `videos` (`status`);