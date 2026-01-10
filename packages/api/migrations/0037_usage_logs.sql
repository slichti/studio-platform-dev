CREATE TABLE `usage_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`metric` text NOT NULL,
	`value` integer DEFAULT 1 NOT NULL,
	`timestamp` integer DEFAULT (strftime('%s', 'now')),
	`meta` text,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `usage_tenant_metric_idx` ON `usage_logs` (`tenant_id`,`metric`,`timestamp`);--> statement-breakpoint
CREATE INDEX `usage_metric_idx` ON `usage_logs` (`metric`,`timestamp`);