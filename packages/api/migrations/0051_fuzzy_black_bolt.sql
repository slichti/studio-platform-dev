CREATE TABLE `scheduled_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`report_type` text NOT NULL,
	`frequency` text NOT NULL,
	`recipients` text NOT NULL,
	`last_sent` integer,
	`next_run` integer NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `scheduled_reports_tenant_idx` ON `scheduled_reports` (`tenant_id`);--> statement-breakpoint
ALTER TABLE `products` ADD `low_stock_threshold` integer DEFAULT 5;--> statement-breakpoint
ALTER TABLE `tenants` ADD `is_public` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `mfa_enabled` integer DEFAULT false;--> statement-breakpoint
ALTER TABLE `users` ADD `push_token` text;--> statement-breakpoint
CREATE INDEX `user_stripe_customer_idx` ON `users` (`stripe_customer_id`);--> statement-breakpoint
CREATE INDEX `booking_class_status_idx` ON `bookings` (`class_id`,`status`);--> statement-breakpoint
CREATE INDEX `class_tenant_start_idx` ON `classes` (`tenant_id`,`start_time`);--> statement-breakpoint
CREATE INDEX `pack_member_credits_idx` ON `purchased_packs` (`member_id`,`remaining_credits`);