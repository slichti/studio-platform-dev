PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_marketing_automations` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text,
	`trigger_event` text NOT NULL,
	`trigger_condition` text,
	`template_id` text,
	`audience_filter` text,
	`subject` text NOT NULL,
	`content` text NOT NULL,
	`is_enabled` integer DEFAULT false NOT NULL,
	`metadata` text,
	`timing_type` text DEFAULT 'immediate' NOT NULL,
	`timing_value` integer DEFAULT 0,
	`delay_hours` integer DEFAULT 0,
	`channels` text DEFAULT ('["email"]'),
	`coupon_config` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_marketing_automations`("id", "tenant_id", "trigger_event", "trigger_condition", "template_id", "audience_filter", "subject", "content", "is_enabled", "metadata", "timing_type", "timing_value", "delay_hours", "channels", "coupon_config", "created_at", "updated_at") SELECT "id", "tenant_id", "trigger_event", "trigger_condition", "template_id", "audience_filter", "subject", "content", "is_enabled", "metadata", "timing_type", "timing_value", "delay_hours", "channels", "coupon_config", "created_at", "updated_at" FROM `marketing_automations`;--> statement-breakpoint
DROP TABLE `marketing_automations`;--> statement-breakpoint
ALTER TABLE `__new_marketing_automations` RENAME TO `marketing_automations`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `automation_tenant_idx` ON `marketing_automations` (`tenant_id`);