DROP INDEX `class_tenant_start_idx`;--> statement-breakpoint
CREATE INDEX `class_instructor_idx` ON `classes` (`instructor_id`);--> statement-breakpoint
CREATE INDEX `member_status_idx` ON `bookings` (`member_id`,`status`);--> statement-breakpoint
CREATE INDEX `user_tenant_idx` ON `tenant_members` (`user_id`,`tenant_id`);