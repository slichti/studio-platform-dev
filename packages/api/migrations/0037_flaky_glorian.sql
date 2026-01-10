CREATE TABLE `chat_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`user_id` text NOT NULL,
	`content` text NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`room_id`) REFERENCES `chat_rooms`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `chat_message_room_idx` ON `chat_messages` (`room_id`);--> statement-breakpoint
CREATE INDEX `chat_message_user_idx` ON `chat_messages` (`user_id`);--> statement-breakpoint
CREATE TABLE `chat_rooms` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`type` text NOT NULL,
	`name` text NOT NULL,
	`metadata` text,
	`is_archived` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `chat_room_tenant_idx` ON `chat_rooms` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `chat_room_type_idx` ON `chat_rooms` (`tenant_id`,`type`);--> statement-breakpoint
CREATE TABLE `website_pages` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`content` text,
	`is_published` integer DEFAULT false NOT NULL,
	`seo_title` text,
	`seo_description` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `website_page_tenant_idx` ON `website_pages` (`tenant_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `website_page_slug_idx` ON `website_pages` (`tenant_id`,`slug`);--> statement-breakpoint
CREATE TABLE `website_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`domain` text,
	`theme` text,
	`navigation` text,
	`global_styles` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `website_settings_tenant_id_unique` ON `website_settings` (`tenant_id`);