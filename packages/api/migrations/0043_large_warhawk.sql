CREATE TABLE `sub_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`class_id` text NOT NULL,
	`original_instructor_id` text NOT NULL,
	`covered_by_user_id` text,
	`status` text DEFAULT 'open' NOT NULL,
	`message` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`class_id`) REFERENCES `classes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`original_instructor_id`) REFERENCES `tenant_members`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`covered_by_user_id`) REFERENCES `tenant_members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `sub_req_tenant_status_idx` ON `sub_requests` (`tenant_id`,`status`);--> statement-breakpoint
CREATE INDEX `sub_req_class_idx` ON `sub_requests` (`class_id`);--> statement-breakpoint
CREATE TABLE `waitlist` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`class_id` text NOT NULL,
	`user_id` text NOT NULL,
	`position` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`offer_expires_at` integer,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`class_id`) REFERENCES `classes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `waitlist_class_pos_idx` ON `waitlist` (`class_id`,`position`);--> statement-breakpoint
CREATE UNIQUE INDEX `waitlist_user_class_idx` ON `waitlist` (`user_id`,`class_id`);--> statement-breakpoint
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
	`video_provider` text DEFAULT 'offline' NOT NULL,
	`livekit_room_name` text,
	`livekit_room_sid` text,
	`trim_start` integer,
	`trim_end` integer,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_videos`("id", "tenant_id", "title", "description", "r2_key", "cloudflare_stream_id", "duration", "size_bytes", "status", "source", "video_provider", "livekit_room_name", "livekit_room_sid", "trim_start", "trim_end", "created_at") SELECT "id", "tenant_id", "title", "description", "r2_key", "cloudflare_stream_id", "duration", "size_bytes", "status", "source", "video_provider", "livekit_room_name", "livekit_room_sid", "trim_start", "trim_end", "created_at" FROM `videos`;--> statement-breakpoint
DROP TABLE `videos`;--> statement-breakpoint
ALTER TABLE `__new_videos` RENAME TO `videos`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `video_tenant_idx` ON `videos` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `video_status_idx` ON `videos` (`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `unique_video_share` ON `video_shares` (`video_id`,`tenant_id`);--> statement-breakpoint
CREATE INDEX `video_share_tenant_idx` ON `video_shares` (`tenant_id`);