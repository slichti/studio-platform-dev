CREATE TABLE `automation_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`automation_id` text NOT NULL,
	`user_id` text NOT NULL,
	`channel` text NOT NULL,
	`triggered_at` integer DEFAULT (strftime('%s', 'now')),
	`metadata` text,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`automation_id`) REFERENCES `marketing_automations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `automation_log_unique_idx` ON `automation_logs` (`automation_id`,`user_id`,`channel`);--> statement-breakpoint
CREATE INDEX `automation_log_tenant_idx` ON `automation_logs` (`tenant_id`);--> statement-breakpoint
ALTER TABLE `marketing_automations` ADD `delay_hours` integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE `marketing_automations` ADD `channels` text DEFAULT ('["email"]');--> statement-breakpoint
ALTER TABLE `marketing_automations` ADD `coupon_config` text;--> statement-breakpoint
CREATE INDEX `automation_tenant_idx` ON `marketing_automations` (`tenant_id`);--> statement-breakpoint
ALTER TABLE `tenants` ADD `mailchimp_credentials` text;--> statement-breakpoint
ALTER TABLE `tenants` ADD `zapier_credentials` text;--> statement-breakpoint
ALTER TABLE `tenants` ADD `google_credentials` text;--> statement-breakpoint
ALTER TABLE `tenants` ADD `slack_credentials` text;