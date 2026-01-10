CREATE TABLE `platform_config` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text,
	`enabled` integer DEFAULT false NOT NULL,
	`description` text,
	`updated_at` integer DEFAULT (strftime('%s', 'now'))
);