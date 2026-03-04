ALTER TABLE `membership_plans` ADD `interval_count` integer DEFAULT 1;--> statement-breakpoint
ALTER TABLE `membership_plans` ADD `auto_renew` integer DEFAULT true;