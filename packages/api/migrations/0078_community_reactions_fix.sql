-- Migration to fix missing community columns and tables
-- Added manually to resolve discrepancy between schema.ts and existing migrations

-- Add reactions_json to community_posts
ALTER TABLE `community_posts` ADD `reactions_json` text;

-- Create community_reactions table (if not exists)
CREATE TABLE IF NOT EXISTS `community_reactions` (
	`post_id` text NOT NULL,
	`member_id` text NOT NULL,
	`type` text DEFAULT 'like' NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	PRIMARY KEY(`post_id`, `member_id`, `type`),
	FOREIGN KEY (`post_id`) REFERENCES `community_posts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`) REFERENCES `tenant_members`(`id`) ON UPDATE no action ON DELETE no action
);

-- Create indexes for community_reactions
CREATE INDEX IF NOT EXISTS `community_reaction_post_idx` ON `community_reactions` (`post_id`);
