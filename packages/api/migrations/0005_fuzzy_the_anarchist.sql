CREATE TABLE `api_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`name` text NOT NULL,
	`key_hash` text NOT NULL,
	`prefix` text NOT NULL,
	`last_used_at` integer,
	`expires_at` integer,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `api_keys_key_hash_unique` ON `api_keys` (`key_hash`);--> statement-breakpoint
CREATE INDEX `api_key_tenant_idx` ON `api_keys` (`tenant_id`);--> statement-breakpoint
CREATE TABLE `course_item_completions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`tenant_id` text NOT NULL,
	`course_id` text NOT NULL,
	`item_id` text NOT NULL,
	`completed_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`item_id`) REFERENCES `video_collection_items`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `course_item_completion_unique` ON `course_item_completions` (`user_id`,`item_id`);--> statement-breakpoint
CREATE INDEX `course_item_completion_course_idx` ON `course_item_completions` (`user_id`,`course_id`);--> statement-breakpoint
ALTER TABLE `bookings` ADD `reminder_sent_at` integer;--> statement-breakpoint
ALTER TABLE `leads` ADD `converted_at` integer;--> statement-breakpoint
ALTER TABLE `leads` ADD `converted_member_id` text REFERENCES tenant_members(id);--> statement-breakpoint
ALTER TABLE `membership_plans` ADD `trial_days` integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE `payroll_config` ADD `metadata` text;--> statement-breakpoint
ALTER TABLE `subscriptions` ADD `paused_until` integer;--> statement-breakpoint
CREATE INDEX `subscription_tenant_idx` ON `subscriptions` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `subscription_user_idx` ON `subscriptions` (`user_id`);--> statement-breakpoint
CREATE INDEX `subscription_stripe_sub_idx` ON `subscriptions` (`stripe_subscription_id`);--> statement-breakpoint
CREATE INDEX `subscription_member_plan_idx` ON `subscriptions` (`member_id`,`plan_id`,`status`);--> statement-breakpoint
CREATE INDEX `pos_order_tenant_created_idx` ON `pos_orders` (`tenant_id`,`created_at`);