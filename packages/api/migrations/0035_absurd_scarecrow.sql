CREATE TABLE `platform_config` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text,
	`enabled` integer DEFAULT false NOT NULL,
	`description` text,
	`updated_at` integer DEFAULT (strftime('%s', 'now'))
);
--> statement-breakpoint
ALTER TABLE `appointments` ADD `google_event_id` text;--> statement-breakpoint
ALTER TABLE `classes` ADD `google_event_id` text;--> statement-breakpoint
ALTER TABLE `tenants` ADD `marketing_provider` text DEFAULT 'system' NOT NULL;--> statement-breakpoint
ALTER TABLE `tenants` ADD `google_calendar_credentials` text;--> statement-breakpoint
ALTER TABLE `tenants` ADD `last_billed_at` integer;--> statement-breakpoint
ALTER TABLE `tenants` ADD `archived_at` integer;--> statement-breakpoint
ALTER TABLE `tenants` ADD `grace_period_ends_at` integer;--> statement-breakpoint
ALTER TABLE `tenants` ADD `student_access_disabled` integer DEFAULT false NOT NULL;