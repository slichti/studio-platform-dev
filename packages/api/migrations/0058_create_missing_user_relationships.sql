-- Repair migration for missing user_relationships table
-- This table was intended to be created in 0016 but was skipped or lost.

CREATE TABLE `user_relationships` (
	`id` text PRIMARY KEY NOT NULL,
	`parent_user_id` text NOT NULL,
	`child_user_id` text NOT NULL,
	`type` text DEFAULT 'parent_child' NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`parent_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`child_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `parent_idx` ON `user_relationships` (`parent_user_id`);--> statement-breakpoint
CREATE INDEX `child_idx` ON `user_relationships` (`child_user_id`);
