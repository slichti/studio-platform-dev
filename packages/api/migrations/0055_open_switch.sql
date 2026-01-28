CREATE TABLE `platform_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`description` text,
	`stripe_price_id_monthly` text,
	`stripe_price_id_annual` text,
	`monthly_price_cents` integer DEFAULT 0,
	`annual_price_cents` integer DEFAULT 0,
	`trial_days` integer DEFAULT 14 NOT NULL,
	`features` text NOT NULL,
	`highlight` integer DEFAULT false,
	`active` integer DEFAULT true,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `platform_plans_slug_unique` ON `platform_plans` (`slug`);