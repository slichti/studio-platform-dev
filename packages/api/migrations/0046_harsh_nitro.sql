ALTER TABLE `users` ADD `is_platform_admin` integer DEFAULT false;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `is_system_admin`;