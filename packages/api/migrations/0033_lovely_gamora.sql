CREATE TABLE `community_reactions` (
	`post_id` text NOT NULL,
	`member_id` text NOT NULL,
	`type` text DEFAULT 'like' NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	PRIMARY KEY(`post_id`, `member_id`, `type`),
	FOREIGN KEY (`post_id`) REFERENCES `community_posts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`) REFERENCES `tenant_members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `community_reaction_post_idx` ON `community_reactions` (`post_id`);--> statement-breakpoint
CREATE TABLE `community_topic_access_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`topic_id` text NOT NULL,
	`type` text NOT NULL,
	`target_id` text NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`topic_id`) REFERENCES `community_topics`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `community_topic_rule_idx` ON `community_topic_access_rules` (`topic_id`);--> statement-breakpoint
CREATE TABLE `community_topic_memberships` (
	`id` text PRIMARY KEY NOT NULL,
	`topic_id` text NOT NULL,
	`member_id` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`topic_id`) REFERENCES `community_topics`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`) REFERENCES `tenant_members`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `community_topic_member_idx` ON `community_topic_memberships` (`topic_id`,`member_id`);--> statement-breakpoint
CREATE TABLE `community_topics` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`icon` text,
	`color` text,
	`visibility` text DEFAULT 'public' NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `community_topic_tenant_idx` ON `community_topics` (`tenant_id`);--> statement-breakpoint
DROP TABLE `community_likes`;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_community_posts` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`author_id` text NOT NULL,
	`content` text NOT NULL,
	`type` text DEFAULT 'post' NOT NULL,
	`image_url` text,
	`likes_count` integer DEFAULT 0,
	`comments_count` integer DEFAULT 0,
	`reactions_json` text,
	`is_pinned` integer DEFAULT false,
	`topic_id` text,
	`media_json` text,
	`is_generated` integer DEFAULT false,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`author_id`) REFERENCES `tenant_members`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`topic_id`) REFERENCES `community_topics`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_community_posts`("id", "tenant_id", "author_id", "content", "type", "image_url", "likes_count", "comments_count", "reactions_json", "is_pinned", "topic_id", "media_json", "is_generated", "created_at") SELECT "id", "tenant_id", "author_id", "content", "type", "image_url", "likes_count", "comments_count", "reactions_json", "is_pinned", "topic_id", "media_json", "is_generated", "created_at" FROM `community_posts`;--> statement-breakpoint
DROP TABLE `community_posts`;--> statement-breakpoint
ALTER TABLE `__new_community_posts` RENAME TO `community_posts`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `community_post_tenant_idx` ON `community_posts` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `community_post_pinned_idx` ON `community_posts` (`tenant_id`,`is_pinned`);--> statement-breakpoint
CREATE INDEX `community_post_topic_idx` ON `community_posts` (`topic_id`);--> statement-breakpoint
ALTER TABLE `community_comments` ADD `parent_id` text REFERENCES community_comments(id);--> statement-breakpoint
CREATE INDEX `community_comment_parent_idx` ON `community_comments` (`parent_id`);--> statement-breakpoint
ALTER TABLE `membership_plans` ADD `is_intro_offer` integer DEFAULT false;--> statement-breakpoint
ALTER TABLE `membership_plans` ADD `intro_offer_limit` integer DEFAULT 1;--> statement-breakpoint
ALTER TABLE `membership_plans` ADD `win_back_period_days` integer;--> statement-breakpoint
ALTER TABLE `tenants` ADD `community_custom_domain` text;--> statement-breakpoint
CREATE UNIQUE INDEX `tenants_community_custom_domain_unique` ON `tenants` (`community_custom_domain`);