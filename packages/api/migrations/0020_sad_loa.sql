CREATE TABLE `automation_enrollments` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`automation_id` text NOT NULL,
	`user_id` text NOT NULL,
	`current_step_index` integer DEFAULT 0 NOT NULL,
	`next_execution_at` integer NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`context_data` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`automation_id`) REFERENCES `marketing_automations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `automation_enrollment_tenant_idx` ON `automation_enrollments` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `automation_enrollment_auto_idx` ON `automation_enrollments` (`automation_id`);--> statement-breakpoint
CREATE INDEX `automation_enrollment_user_idx` ON `automation_enrollments` (`user_id`);--> statement-breakpoint
CREATE INDEX `automation_enrollment_status_idx` ON `automation_enrollments` (`status`);--> statement-breakpoint
CREATE INDEX `automation_enrollment_execution_idx` ON `automation_enrollments` (`next_execution_at`);--> statement-breakpoint
ALTER TABLE `marketing_automations` ADD `steps` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `marketing_automations` DROP COLUMN `template_id`;--> statement-breakpoint
ALTER TABLE `marketing_automations` DROP COLUMN `audience_filter`;--> statement-breakpoint
ALTER TABLE `marketing_automations` DROP COLUMN `subject`;--> statement-breakpoint
ALTER TABLE `marketing_automations` DROP COLUMN `content`;--> statement-breakpoint
ALTER TABLE `marketing_automations` DROP COLUMN `timing_type`;--> statement-breakpoint
ALTER TABLE `marketing_automations` DROP COLUMN `timing_value`;--> statement-breakpoint
ALTER TABLE `marketing_automations` DROP COLUMN `delay_hours`;--> statement-breakpoint
ALTER TABLE `marketing_automations` DROP COLUMN `channels`;--> statement-breakpoint
ALTER TABLE `marketing_automations` DROP COLUMN `recipients`;--> statement-breakpoint
ALTER TABLE `marketing_automations` DROP COLUMN `coupon_config`;