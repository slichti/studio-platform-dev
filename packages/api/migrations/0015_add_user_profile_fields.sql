-- Migration to add enriched profile fields to users table
ALTER TABLE `users` ADD COLUMN `phone` text;
ALTER TABLE `users` ADD COLUMN `dob` integer; -- Timestamp
ALTER TABLE `users` ADD COLUMN `address` text;
ALTER TABLE `users` ADD COLUMN `is_minor` integer DEFAULT 0;
