CREATE TABLE `referrals` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`referrer_id` text NOT NULL,
	`referee_id` text,
	`code` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`reward_type` text,
	`reward_value` integer,
	`rewarded_at` integer,
	`expires_at` integer,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`referrer_id`) REFERENCES `tenant_members`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`referee_id`) REFERENCES `tenant_members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `referral_tenant_idx` ON `referrals` (`tenant_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `referral_code_idx` ON `referrals` (`tenant_id`,`code`);--> statement-breakpoint
CREATE INDEX `referral_referrer_idx` ON `referrals` (`referrer_id`);