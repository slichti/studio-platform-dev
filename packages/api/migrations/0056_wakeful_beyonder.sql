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
INSERT INTO `__new_tenant_roles`("id", "member_id", "role", "custom_role_id", "permissions", "created_at") 
SELECT lower(hex(randomblob(16))), "member_id", "role", "custom_role_id", "permissions", "created_at" 
FROM `tenant_roles`
WHERE "member_id" IN (SELECT "id" FROM `tenant_members`)
AND ("custom_role_id" IS NULL OR "custom_role_id" IN (SELECT "id" FROM `custom_roles`));--> statement-breakpoint
DROP TABLE `tenant_roles`;--> statement-breakpoint
ALTER TABLE `__new_tenant_roles` RENAME TO `tenant_roles`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `member_role_idx` ON `tenant_roles` (`member_id`,`role`);--> statement-breakpoint
CREATE INDEX `member_custom_role_idx` ON `tenant_roles` (`member_id`,`custom_role_id`);--> statement-breakpoint
ALTER TABLE `tenants` ADD COLUMN `custom_field_definitions` text;--> statement-breakpoint
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