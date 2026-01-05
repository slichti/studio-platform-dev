CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`status` text DEFAULT 'todo' NOT NULL,
	`priority` text DEFAULT 'medium' NOT NULL,
	`due_date` integer,
	`assigned_to_id` text,
	`related_lead_id` text,
	`related_member_id` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`assigned_to_id`) REFERENCES `tenant_members`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`related_lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`related_member_id`) REFERENCES `tenant_members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `task_tenant_idx` ON `tasks` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `task_assignee_idx` ON `tasks` (`assigned_to_id`);--> statement-breakpoint
CREATE INDEX `task_lead_idx` ON `tasks` (`related_lead_id`);--> statement-breakpoint
CREATE INDEX `task_tenant_status_idx` ON `tasks` (`tenant_id`,`status`);