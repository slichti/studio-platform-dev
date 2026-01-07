CREATE TABLE `reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`member_id` text NOT NULL,
	`target_type` text DEFAULT 'studio' NOT NULL,
	`target_id` text,
	`rating` integer NOT NULL,
	`content` text,
	`is_testimonial` integer DEFAULT false,
	`is_approved` integer DEFAULT false,
	`is_public` integer DEFAULT true,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`member_id`) REFERENCES `tenant_members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `review_tenant_idx` ON `reviews` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `review_member_idx` ON `reviews` (`member_id`);--> statement-breakpoint
CREATE INDEX `review_approved_idx` ON `reviews` (`tenant_id`,`is_approved`);