CREATE TABLE `tenant_invitations` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`email` text NOT NULL,
	`role` text DEFAULT 'student' NOT NULL,
	`token` text NOT NULL,
	`expires_at` integer NOT NULL,
	`accepted_at` integer,
	`invited_by` text NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tenant_invitations_token_unique` ON `tenant_invitations` (`token`);--> statement-breakpoint
CREATE INDEX `invitation_tenant_email_idx` ON `tenant_invitations` (`tenant_id`,`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `invitation_token_idx` ON `tenant_invitations` (`token`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_classes` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`instructor_id` text,
	`location_id` text,
	`series_id` text,
	`title` text NOT NULL,
	`description` text,
	`start_time` integer NOT NULL,
	`duration_minutes` integer NOT NULL,
	`capacity` integer,
	`waitlist_capacity` integer DEFAULT 10,
	`price` integer DEFAULT 0,
	`member_price` integer,
	`currency` text DEFAULT 'usd',
	`payroll_model` text,
	`payroll_value` integer,
	`type` text DEFAULT 'class' NOT NULL,
	`allow_credits` integer DEFAULT true NOT NULL,
	`included_plan_ids` text,
	`zoom_meeting_url` text,
	`zoom_meeting_id` text,
	`zoom_password` text,
	`zoom_enabled` integer DEFAULT false,
	`thumbnail_url` text,
	`cloudflare_stream_id` text,
	`recording_status` text,
	`video_provider` text DEFAULT 'offline' NOT NULL,
	`livekit_room_name` text,
	`livekit_room_sid` text,
	`status` text DEFAULT 'active' NOT NULL,
	`min_students` integer DEFAULT 1,
	`auto_cancel_threshold` integer,
	`auto_cancel_enabled` integer DEFAULT false,
	`google_event_id` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`instructor_id`) REFERENCES `tenant_members`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`series_id`) REFERENCES `class_series`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_classes`("id", "tenant_id", "instructor_id", "location_id", "series_id", "title", "description", "start_time", "duration_minutes", "capacity", "waitlist_capacity", "price", "member_price", "currency", "payroll_model", "payroll_value", "type", "allow_credits", "included_plan_ids", "zoom_meeting_url", "zoom_meeting_id", "zoom_password", "zoom_enabled", "thumbnail_url", "cloudflare_stream_id", "recording_status", "video_provider", "livekit_room_name", "livekit_room_sid", "status", "min_students", "auto_cancel_threshold", "auto_cancel_enabled", "google_event_id", "created_at") SELECT "id", "tenant_id", "instructor_id", "location_id", "series_id", "title", "description", "start_time", "duration_minutes", "capacity", "waitlist_capacity", "price", "member_price", "currency", "payroll_model", "payroll_value", "type", "allow_credits", "included_plan_ids", "zoom_meeting_url", "zoom_meeting_id", "zoom_password", "zoom_enabled", "thumbnail_url", "cloudflare_stream_id", "recording_status", "video_provider", "livekit_room_name", "livekit_room_sid", "status", "min_students", "auto_cancel_threshold", "auto_cancel_enabled", "google_event_id", "created_at" FROM `classes`;--> statement-breakpoint
DROP TABLE `classes`;--> statement-breakpoint
ALTER TABLE `__new_classes` RENAME TO `classes`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `tenant_time_idx` ON `classes` (`tenant_id`,`start_time`);--> statement-breakpoint
CREATE INDEX `series_idx` ON `classes` (`series_id`);--> statement-breakpoint
CREATE INDEX `class_tenant_start_idx` ON `classes` (`tenant_id`,`start_time`);--> statement-breakpoint
CREATE TABLE `__new_marketing_automations` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text,
	`trigger_event` text NOT NULL,
	`trigger_condition` text,
	`template_id` text,
	`audience_filter` text,
	`subject` text NOT NULL,
	`content` text,
	`is_enabled` integer DEFAULT false NOT NULL,
	`metadata` text,
	`timing_type` text DEFAULT 'immediate' NOT NULL,
	`timing_value` integer DEFAULT 0,
	`delay_hours` integer DEFAULT 0,
	`channels` text DEFAULT '["email"]',
	`recipients` text DEFAULT '["student"]',
	`coupon_config` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_marketing_automations`("id", "tenant_id", "trigger_event", "trigger_condition", "template_id", "audience_filter", "subject", "content", "is_enabled", "metadata", "timing_type", "timing_value", "delay_hours", "channels", "recipients", "coupon_config", "created_at", "updated_at") SELECT "id", "tenant_id", "trigger_event", "trigger_condition", "template_id", "audience_filter", "subject", "content", "is_enabled", "metadata", "timing_type", "timing_value", "delay_hours", "channels", "recipients", "coupon_config", "created_at", "updated_at" FROM `marketing_automations`;--> statement-breakpoint
DROP TABLE `marketing_automations`;--> statement-breakpoint
ALTER TABLE `__new_marketing_automations` RENAME TO `marketing_automations`;--> statement-breakpoint
CREATE INDEX `automation_tenant_idx` ON `marketing_automations` (`tenant_id`);--> statement-breakpoint
ALTER TABLE `scheduled_reports` ADD `custom_report_id` text REFERENCES custom_reports(id);