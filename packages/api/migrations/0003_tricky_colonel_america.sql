CREATE TABLE `course_prerequisites` (
	`id` text PRIMARY KEY NOT NULL,
	`course_id` text NOT NULL,
	`prerequisite_id` text NOT NULL,
	`tenant_id` text NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`prerequisite_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `course_prereq_idx` ON `course_prerequisites` (`course_id`,`prerequisite_id`);
--> statement-breakpoint
CREATE INDEX `course_prereq_tenant_idx` ON `course_prerequisites` (`tenant_id`);