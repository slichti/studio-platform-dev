CREATE TABLE `community_topics` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL REFERENCES `tenants`(`id`),
	`name` text NOT NULL,
	`description` text,
	`icon` text,
	`color` text,
	`created_at` integer DEFAULT (strftime('%s', 'now'))
);
--> statement-breakpoint
CREATE INDEX `community_topic_tenant_idx` ON `community_topics` (`tenant_id`);
