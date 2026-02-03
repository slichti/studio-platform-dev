CREATE TABLE `referral_codes` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`user_id` text NOT NULL,
	`member_id` text,
	`code` text NOT NULL,
	`clicks` integer DEFAULT 0,
	`signups` integer DEFAULT 0,
	`earnings` integer DEFAULT 0,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`active` integer DEFAULT true,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`member_id`) REFERENCES `tenant_members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `referral_code_unique_idx` ON `referral_codes` (`tenant_id`,`code`);--> statement-breakpoint
CREATE INDEX `referral_user_idx` ON `referral_codes` (`user_id`);--> statement-breakpoint
CREATE TABLE `referral_rewards` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`referrer_user_id` text NOT NULL,
	`referred_user_id` text NOT NULL,
	`status` text DEFAULT 'pending',
	`amount` integer NOT NULL,
	`currency` text DEFAULT 'usd',
	`paid_at` integer,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`referrer_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`referred_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `reward_referrer_idx` ON `referral_rewards` (`referrer_user_id`);