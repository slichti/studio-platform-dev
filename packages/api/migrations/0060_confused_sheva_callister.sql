CREATE TABLE `backup_metadata` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`tenant_id` text,
	`backup_date` integer NOT NULL,
	`file_size` integer NOT NULL,
	`r2_key` text NOT NULL,
	`status` text NOT NULL,
	`record_count` integer,
	`error_message` text,
	`created_at` integer DEFAULT (strftime('%s', 'now'))
);
--> statement-breakpoint
CREATE INDEX `backup_type_idx` ON `backup_metadata` (`type`,`backup_date`);--> statement-breakpoint
CREATE INDEX `backup_tenant_idx` ON `backup_metadata` (`tenant_id`,`backup_date`);--> statement-breakpoint
CREATE TABLE `restore_history` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`tenant_id` text,
	`backup_key` text NOT NULL,
	`backup_date` integer NOT NULL,
	`restored_by` text NOT NULL,
	`restored_at` integer NOT NULL,
	`status` text NOT NULL,
	`records_restored` integer,
	`duration_ms` integer,
	`details` text,
	`error_message` text
);
--> statement-breakpoint
CREATE INDEX `restore_type_idx` ON `restore_history` (`type`,`restored_at`);--> statement-breakpoint
CREATE INDEX `restore_tenant_idx` ON `restore_history` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `restore_user_idx` ON `restore_history` (`restored_by`);