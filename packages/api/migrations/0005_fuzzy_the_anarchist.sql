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
CREATE INDEX `subscription_tenant_idx` ON `subscriptions` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `subscription_user_idx` ON `subscriptions` (`user_id`);--> statement-breakpoint
CREATE INDEX `subscription_stripe_sub_idx` ON `subscriptions` (`stripe_subscription_id`);--> statement-breakpoint
CREATE INDEX `subscription_member_plan_idx` ON `subscriptions` (`member_id`,`plan_id`,`status`);--> statement-breakpoint
CREATE INDEX `pos_order_tenant_created_idx` ON `pos_orders` (`tenant_id`,`created_at`);