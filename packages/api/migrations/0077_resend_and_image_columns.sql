ALTER TABLE `class_pack_definitions` ADD `image_library` text;--> statement-breakpoint
ALTER TABLE `classes` ADD `image_library` text;--> statement-breakpoint
ALTER TABLE `courses` ADD `image_library` text;--> statement-breakpoint
ALTER TABLE `membership_plans` ADD `image_library` text;--> statement-breakpoint
ALTER TABLE `tenants` ADD `resend_domain_id` text;--> statement-breakpoint
ALTER TABLE `tenants` ADD `resend_domain_status` text;--> statement-breakpoint
ALTER TABLE `tenants` ADD `resend_domain_records` text;--> statement-breakpoint
ALTER TABLE `tenants` ADD `resend_api_key_id` text;--> statement-breakpoint
ALTER TABLE `tenants` ADD `resend_api_key` text;--> statement-breakpoint
ALTER TABLE `tenants` ADD `resend_newsletter_segment_id` text;--> statement-breakpoint
ALTER TABLE `users` ADD `is_unsubscribed` integer DEFAULT false;