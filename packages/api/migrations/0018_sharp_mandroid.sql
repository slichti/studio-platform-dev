CREATE TABLE `challenges` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`type` text NOT NULL,
	`target_value` integer NOT NULL,
	`reward_type` text NOT NULL,
	`reward_value` text,
	`start_date` integer,
	`end_date` integer,
	`active` integer DEFAULT true,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `challenge_tenant_idx` ON `challenges` (`tenant_id`);--> statement-breakpoint
CREATE TABLE `user_challenges` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`user_id` text NOT NULL,
	`challenge_id` text NOT NULL,
	`progress` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`completed_at` integer,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`challenge_id`) REFERENCES `challenges`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_challenge_idx` ON `user_challenges` (`user_id`,`challenge_id`);--> statement-breakpoint
CREATE INDEX `user_challenge_tenant_idx` ON `user_challenges` (`tenant_id`);