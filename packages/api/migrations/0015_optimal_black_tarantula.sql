CREATE TABLE `refunds` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`amount` integer NOT NULL,
	`reason` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`type` text NOT NULL,
	`reference_id` text NOT NULL,
	`stripe_refund_id` text,
	`member_id` text,
	`performed_by` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`member_id`) REFERENCES `tenant_members`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`performed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `refund_tenant_idx` ON `refunds` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `refund_ref_idx` ON `refunds` (`reference_id`);