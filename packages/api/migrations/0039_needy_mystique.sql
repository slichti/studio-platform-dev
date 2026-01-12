ALTER TABLE `chat_rooms` ADD `status` text DEFAULT 'open' NOT NULL;--> statement-breakpoint
ALTER TABLE `chat_rooms` ADD `priority` text DEFAULT 'normal' NOT NULL;--> statement-breakpoint
ALTER TABLE `chat_rooms` ADD `assigned_to_id` text REFERENCES users(id);--> statement-breakpoint
ALTER TABLE `chat_rooms` ADD `customer_email` text;--> statement-breakpoint
CREATE INDEX `chat_room_status_idx` ON `chat_rooms` (`tenant_id`,`status`);--> statement-breakpoint
CREATE INDEX `chat_room_assignee_idx` ON `chat_rooms` (`assigned_to_id`);