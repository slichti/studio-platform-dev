CREATE TABLE `platform_seo_topics` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now'))
);
--> statement-breakpoint
CREATE TABLE `tenant_seo_content_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`topic_id` text NOT NULL,
	`frequency` text DEFAULT 'weekly' NOT NULL,
	`next_run_at` integer,
	`is_active` integer DEFAULT true NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`topic_id`) REFERENCES `platform_seo_topics`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tenant_seo_topic_idx` ON `tenant_seo_content_settings` (`tenant_id`,`topic_id`);--> statement-breakpoint
ALTER TABLE `community_posts` ADD `topic_id` text REFERENCES platform_seo_topics(id);--> statement-breakpoint
ALTER TABLE `community_posts` ADD `is_generated` integer DEFAULT false;--> statement-breakpoint
CREATE INDEX `community_post_topic_idx` ON `community_posts` (`topic_id`);