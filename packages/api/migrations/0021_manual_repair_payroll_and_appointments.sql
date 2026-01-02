-- 0021_manual_repair_payroll_and_appointments.sql

CREATE TABLE IF NOT EXISTS `payroll_config` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL REFERENCES tenants(id),
	`user_id` text NOT NULL REFERENCES users(id),
	`member_id` text REFERENCES tenant_members(id),
	`pay_model` text NOT NULL,
	`rate` integer NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now'))
);

CREATE TABLE IF NOT EXISTS `payouts` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL REFERENCES tenants(id),
	`instructor_id` text NOT NULL REFERENCES tenant_members(id),
	`amount` integer NOT NULL,
	`currency` text DEFAULT 'usd',
	`period_start` integer NOT NULL,
	`period_end` integer NOT NULL,
	`status` text DEFAULT 'processing',
	`paid_at` integer,
	`notes` text,
	`created_at` integer DEFAULT (strftime('%s', 'now'))
);

CREATE TABLE IF NOT EXISTS `payroll_items` (
	`id` text PRIMARY KEY NOT NULL,
	`payout_id` text NOT NULL REFERENCES payouts(id),
	`type` text NOT NULL,
	`reference_id` text NOT NULL,
	`amount` integer NOT NULL,
	`details` text,
	`created_at` integer DEFAULT (strftime('%s', 'now'))
);

CREATE TABLE IF NOT EXISTS `appointment_services` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL REFERENCES tenants(id),
	`title` text NOT NULL,
	`description` text,
	`duration_minutes` integer NOT NULL,
	`price` integer DEFAULT 0,
	`currency` text DEFAULT 'usd',
	`is_active` integer DEFAULT true,
	`created_at` integer DEFAULT (strftime('%s', 'now'))
);

CREATE TABLE IF NOT EXISTS `availabilities` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL REFERENCES tenants(id),
	`instructor_id` text NOT NULL REFERENCES tenant_members(id),
	`day_of_week` integer NOT NULL,
	`start_time` text NOT NULL,
	`end_time` text NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now'))
);

CREATE TABLE IF NOT EXISTS `student_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL REFERENCES tenants(id),
	`student_id` text NOT NULL REFERENCES tenant_members(id),
	`author_id` text NOT NULL REFERENCES tenant_members(id),
	`note` text NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS `payroll_config_member_idx` ON `payroll_config` (`member_id`);
CREATE INDEX IF NOT EXISTS `payroll_item_payout_idx` ON `payroll_items` (`payout_id`);
CREATE INDEX IF NOT EXISTS `payroll_item_ref_idx` ON `payroll_items` (`reference_id`);
CREATE INDEX IF NOT EXISTS `avail_instructor_idx` ON `availabilities` (`instructor_id`);
CREATE INDEX IF NOT EXISTS `student_idx` ON `student_notes` (`student_id`);
