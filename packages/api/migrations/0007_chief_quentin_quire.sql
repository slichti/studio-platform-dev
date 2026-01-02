CREATE TABLE `leads` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`email` text NOT NULL,
	`first_name` text,
	`last_name` text,
	`phone` text,
	`status` text DEFAULT 'new' NOT NULL,
	`source` text,
	`notes` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `lead_tenant_email_idx` ON `leads` (`tenant_id`,`email`);--> statement-breakpoint
CREATE INDEX `lead_status_idx` ON `leads` (`status`);--> statement-breakpoint
ALTER TABLE `tenants` ADD `sms_usage` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `tenants` ADD `email_usage` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `tenants` ADD `sms_limit` integer;--> statement-breakpoint
ALTER TABLE `tenants` ADD `email_limit` integer;