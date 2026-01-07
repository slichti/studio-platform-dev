CREATE TABLE `branding_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`cloudflare_stream_id` text NOT NULL,
	`active` integer DEFAULT false,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `branding_tenant_type_idx` ON `branding_assets` (`tenant_id`,`type`);--> statement-breakpoint
CREATE TABLE `videos` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
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
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`class_id`) REFERENCES `classes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `video_tenant_idx` ON `videos` (`tenant_id`);--> statement-breakpoint
ALTER TABLE `classes` ADD `video_provider` text DEFAULT 'offline' NOT NULL;--> statement-breakpoint
ALTER TABLE `classes` ADD `livekit_room_name` text;--> statement-breakpoint
ALTER TABLE `classes` ADD `livekit_room_sid` text;