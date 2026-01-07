ALTER TABLE `locations` ADD `is_primary` integer DEFAULT false;--> statement-breakpoint
ALTER TABLE `locations` ADD `settings` text;--> statement-breakpoint
ALTER TABLE `locations` ADD `is_active` integer DEFAULT true;