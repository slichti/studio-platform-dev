CREATE TABLE `webhook_endpoints` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`url` text NOT NULL,
	`secret` text NOT NULL,
	`events` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`description` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `webhook_tenant_idx` ON `webhook_endpoints` (`tenant_id`);--> statement-breakpoint
ALTER TABLE `bookings` ADD `is_guest` integer DEFAULT false;--> statement-breakpoint
ALTER TABLE `bookings` ADD `guest_name` text;--> statement-breakpoint
ALTER TABLE `bookings` ADD `guest_email` text;--> statement-breakpoint
ALTER TABLE `bookings` ADD `spot_number` text;--> statement-breakpoint
ALTER TABLE `challenges` ADD `period` text;--> statement-breakpoint
ALTER TABLE `challenges` ADD `frequency` integer DEFAULT 1;--> statement-breakpoint
ALTER TABLE `class_pack_definitions` ADD `image_url` text;--> statement-breakpoint
ALTER TABLE `locations` ADD `layout` text;--> statement-breakpoint
ALTER TABLE `tenant_members` ADD `churn_score` integer DEFAULT 100;--> statement-breakpoint
ALTER TABLE `tenant_members` ADD `churn_status` text DEFAULT 'safe';--> statement-breakpoint
ALTER TABLE `tenant_members` ADD `last_churn_check` integer;--> statement-breakpoint
ALTER TABLE `user_challenges` ADD `metadata` text;