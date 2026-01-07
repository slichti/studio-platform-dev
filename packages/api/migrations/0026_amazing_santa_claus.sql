ALTER TABLE `bookings` ADD `waitlist_position` integer;--> statement-breakpoint
ALTER TABLE `bookings` ADD `waitlist_notified_at` integer;--> statement-breakpoint
CREATE INDEX `booking_waitlist_idx` ON `bookings` (`class_id`,`waitlist_position`);