CREATE TABLE `marketing_automations` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`trigger_type` text NOT NULL,
	`subject` text NOT NULL,
	`content` text NOT NULL,
	`is_enabled` integer DEFAULT false NOT NULL,
	`metadata` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `automation_tenant_trigger_idx` ON `marketing_automations` (`tenant_id`,`trigger_type`);