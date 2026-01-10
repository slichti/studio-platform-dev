CREATE TABLE `appointments` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL REFERENCES tenants(id),
	`service_id` text NOT NULL REFERENCES appointment_services(id),
	`instructor_id` text NOT NULL REFERENCES tenant_members(id),
	`member_id` text NOT NULL REFERENCES tenant_members(id),
	`start_time` integer NOT NULL,
	`end_time` integer NOT NULL,
	`status` text DEFAULT 'confirmed',
	`notes` text,
	`zoom_meeting_url` text,
	`google_event_id` text,
	`created_at` integer DEFAULT (strftime('%s', 'now'))
);
--> statement-breakpoint
CREATE INDEX `apt_tenant_time_idx` ON `appointments` (`tenant_id`,`start_time`);--> statement-breakpoint
CREATE INDEX `apt_instructor_time_idx` ON `appointments` (`instructor_id`,`start_time`);--> statement-breakpoint
CREATE INDEX `apt_member_idx` ON `appointments` (`member_id`);--> statement-breakpoint
ALTER TABLE `classes` ADD `google_event_id` text;--> statement-breakpoint
ALTER TABLE `tenants` ADD `marketing_provider` text DEFAULT 'system' NOT NULL;--> statement-breakpoint
ALTER TABLE `tenants` ADD `google_calendar_credentials` text;--> statement-breakpoint
ALTER TABLE `tenants` ADD `last_billed_at` integer;--> statement-breakpoint
ALTER TABLE `tenants` ADD `archived_at` integer;--> statement-breakpoint
ALTER TABLE `tenants` ADD `grace_period_ends_at` integer;--> statement-breakpoint
ALTER TABLE `tenants` ADD `student_access_disabled` integer DEFAULT false NOT NULL;
