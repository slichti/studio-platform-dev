CREATE TABLE `marketing_campaigns` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`subject` text NOT NULL,
	`content` text NOT NULL,
	`status` text DEFAULT 'draft',
	`sent_at` integer,
	`stats` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);

--> statement-breakpoint

CREATE TABLE `email_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`campaign_id` text,
	`recipient_email` text NOT NULL,
	`subject` text NOT NULL,
	`status` text DEFAULT 'sent',
	`sent_at` integer DEFAULT (strftime('%s', 'now')),
	`metadata` text,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`campaign_id`) REFERENCES `marketing_campaigns`(`id`) ON UPDATE no action ON DELETE no action
);

--> statement-breakpoint

CREATE INDEX `email_log_tenant_idx` ON `email_logs` (`tenant_id`);
--> statement-breakpoint
CREATE INDEX `email_log_campaign_idx` ON `email_logs` (`campaign_id`);
--> statement-breakpoint
CREATE INDEX `email_log_email_idx` ON `email_logs` (`recipient_email`);
--> statement-breakpoint
CREATE INDEX `email_log_sent_at_idx` ON `email_logs` (`sent_at`);
