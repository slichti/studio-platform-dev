CREATE TABLE `custom_field_definitions` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`entity_type` text NOT NULL,
	`key` text NOT NULL,
	`label` text NOT NULL,
	`field_type` text NOT NULL,
	`options` text,
	`is_required` integer DEFAULT false NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `cf_def_tenant_entity_idx` ON `custom_field_definitions` (`tenant_id`,`entity_type`);--> statement-breakpoint
CREATE UNIQUE INDEX `cf_def_unique_key_idx` ON `custom_field_definitions` (`tenant_id`,`entity_type`,`key`);--> statement-breakpoint
CREATE TABLE `custom_field_values` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`definition_id` text NOT NULL,
	`entity_id` text NOT NULL,
	`value` text,
	`updated_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`definition_id`) REFERENCES `custom_field_definitions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `cf_val_entity_idx` ON `custom_field_values` (`entity_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `cf_val_unique_idx` ON `custom_field_values` (`entity_id`,`definition_id`);--> statement-breakpoint
CREATE TABLE `member_tags` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`name` text NOT NULL,
	`color` text,
	`description` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `member_tag_tenant_idx` ON `member_tags` (`tenant_id`);--> statement-breakpoint
CREATE TABLE `members_to_tags` (
	`member_id` text NOT NULL,
	`tag_id` text NOT NULL,
	PRIMARY KEY(`member_id`, `tag_id`),
	FOREIGN KEY (`member_id`) REFERENCES `tenant_members`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `member_tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `push_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`recipient_token` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`status` text DEFAULT 'queued',
	`sent_at` integer DEFAULT (strftime('%s', 'now')),
	`metadata` text,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `webhook_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`endpoint_id` text NOT NULL,
	`event_type` text NOT NULL,
	`payload` text NOT NULL,
	`status_code` integer,
	`response_body` text,
	`error` text,
	`duration_ms` integer,
	`attempt_count` integer DEFAULT 1,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`endpoint_id`) REFERENCES `webhook_endpoints`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `webhook_log_tenant_idx` ON `webhook_logs` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `webhook_log_endpoint_idx` ON `webhook_logs` (`endpoint_id`);--> statement-breakpoint
CREATE INDEX `webhook_log_event_idx` ON `webhook_logs` (`event_type`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_tenant_roles` (
	`id` text PRIMARY KEY NOT NULL,
	`member_id` text NOT NULL,
	`role` text NOT NULL,
	`custom_role_id` text,
	`permissions` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`member_id`) REFERENCES `tenant_members`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`custom_role_id`) REFERENCES `custom_roles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_tenant_roles`("id", "member_id", "role", "custom_role_id", "permissions", "created_at") SELECT "id", "member_id", "role", "custom_role_id", "permissions", "created_at" FROM `tenant_roles`;--> statement-breakpoint
DROP TABLE `tenant_roles`;--> statement-breakpoint
ALTER TABLE `__new_tenant_roles` RENAME TO `tenant_roles`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `member_role_idx` ON `tenant_roles` (`member_id`,`role`);--> statement-breakpoint
CREATE INDEX `member_custom_role_idx` ON `tenant_roles` (`member_id`,`custom_role_id`);--> statement-breakpoint
CREATE TABLE `__new_tenants` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`custom_domain` text,
	`branding` text,
	`mobile_app_config` text,
	`settings` text,
	`custom_field_definitions` text,
	`stripe_account_id` text,
	`stripe_customer_id` text,
	`stripe_subscription_id` text,
	`current_period_end` integer,
	`marketing_provider` text DEFAULT 'system' NOT NULL,
	`resend_credentials` text,
	`twilio_credentials` text,
	`flodesk_credentials` text,
	`currency` text DEFAULT 'usd' NOT NULL,
	`zoom_credentials` text,
	`mailchimp_credentials` text,
	`zapier_credentials` text,
	`google_credentials` text,
	`slack_credentials` text,
	`google_calendar_credentials` text,
	`resend_audience_id` text,
	`status` text DEFAULT 'active' NOT NULL,
	`tier` text DEFAULT 'launch' NOT NULL,
	`subscription_status` text DEFAULT 'active' NOT NULL,
	`is_public` integer DEFAULT false NOT NULL,
	`sms_usage` integer DEFAULT 0 NOT NULL,
	`email_usage` integer DEFAULT 0 NOT NULL,
	`streaming_usage` integer DEFAULT 0 NOT NULL,
	`sms_limit` integer,
	`email_limit` integer,
	`streaming_limit` integer,
	`billing_exempt` integer DEFAULT false NOT NULL,
	`storage_usage` integer DEFAULT 0 NOT NULL,
	`member_count` integer DEFAULT 0 NOT NULL,
	`instructor_count` integer DEFAULT 0 NOT NULL,
	`last_billed_at` integer,
	`archived_at` integer,
	`grace_period_ends_at` integer,
	`student_access_disabled` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now'))
);
--> statement-breakpoint
INSERT INTO `__new_tenants`("id", "slug", "name", "custom_domain", "branding", "mobile_app_config", "settings", "custom_field_definitions", "stripe_account_id", "stripe_customer_id", "stripe_subscription_id", "current_period_end", "marketing_provider", "resend_credentials", "twilio_credentials", "flodesk_credentials", "currency", "zoom_credentials", "mailchimp_credentials", "zapier_credentials", "google_credentials", "slack_credentials", "google_calendar_credentials", "resend_audience_id", "status", "tier", "subscription_status", "is_public", "sms_usage", "email_usage", "streaming_usage", "sms_limit", "email_limit", "streaming_limit", "billing_exempt", "storage_usage", "member_count", "instructor_count", "last_billed_at", "archived_at", "grace_period_ends_at", "student_access_disabled", "created_at") SELECT "id", "slug", "name", "custom_domain", "branding", "mobile_app_config", "settings", "custom_field_definitions", "stripe_account_id", "stripe_customer_id", "stripe_subscription_id", "current_period_end", "marketing_provider", "resend_credentials", "twilio_credentials", "flodesk_credentials", "currency", "zoom_credentials", "mailchimp_credentials", "zapier_credentials", "google_credentials", "slack_credentials", "google_calendar_credentials", "resend_audience_id", "status", "tier", "subscription_status", "is_public", "sms_usage", "email_usage", "streaming_usage", "sms_limit", "email_limit", "streaming_limit", "billing_exempt", "storage_usage", "member_count", "instructor_count", "last_billed_at", "archived_at", "grace_period_ends_at", "student_access_disabled", "created_at" FROM `tenants`;--> statement-breakpoint
DROP TABLE `tenants`;--> statement-breakpoint
ALTER TABLE `__new_tenants` RENAME TO `tenants`;--> statement-breakpoint
CREATE UNIQUE INDEX `tenants_slug_unique` ON `tenants` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `tenants_custom_domain_unique` ON `tenants` (`custom_domain`);--> statement-breakpoint
ALTER TABLE `appointments` ADD `location_id` text REFERENCES locations(id);--> statement-breakpoint
ALTER TABLE `audit_logs` ADD `target_type` text;--> statement-breakpoint
CREATE INDEX `audit_tenant_idx` ON `audit_logs` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `audit_target_idx` ON `audit_logs` (`target_type`,`target_id`);--> statement-breakpoint
ALTER TABLE `classes` ADD `waitlist_capacity` integer DEFAULT 10;--> statement-breakpoint
ALTER TABLE `classes` ADD `payroll_model` text;--> statement-breakpoint
ALTER TABLE `classes` ADD `payroll_value` integer;--> statement-breakpoint
ALTER TABLE `gift_cards` ADD `stripe_payment_id` text;--> statement-breakpoint
ALTER TABLE `payroll_config` ADD `payout_basis` text DEFAULT 'net';--> statement-breakpoint
ALTER TABLE `purchased_packs` ADD `status` text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE `subscriptions` ADD `canceled_at` integer;--> statement-breakpoint
ALTER TABLE `tenant_members` ADD `custom_fields` text;