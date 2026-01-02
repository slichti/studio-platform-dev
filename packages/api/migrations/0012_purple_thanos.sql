ALTER TABLE `bookings` ADD `attendance_type` text DEFAULT 'in_person' NOT NULL;--> statement-breakpoint
ALTER TABLE `classes` ADD `zoom_meeting_id` text;--> statement-breakpoint
ALTER TABLE `classes` ADD `zoom_password` text;--> statement-breakpoint
ALTER TABLE `classes` ADD `zoom_enabled` integer DEFAULT false;