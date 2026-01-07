DROP INDEX `automation_tenant_trigger_idx`;--> statement-breakpoint
ALTER TABLE `marketing_automations` ADD `trigger_event` text NOT NULL;--> statement-breakpoint
ALTER TABLE `marketing_automations` ADD `trigger_condition` text;--> statement-breakpoint
ALTER TABLE `marketing_automations` ADD `timing_type` text DEFAULT 'immediate' NOT NULL;--> statement-breakpoint
ALTER TABLE `marketing_automations` ADD `timing_value` integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE `marketing_automations` DROP COLUMN `trigger_type`;