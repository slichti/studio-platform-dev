CREATE TABLE `class_instructors` (
	`class_id` text NOT NULL,
	`instructor_id` text NOT NULL,
	`is_substitute` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	PRIMARY KEY(`class_id`, `instructor_id`),
	FOREIGN KEY (`class_id`) REFERENCES `classes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`instructor_id`) REFERENCES `tenant_members`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `class_series_instructors` (
	`series_id` text NOT NULL,
	`instructor_id` text NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	PRIMARY KEY(`series_id`, `instructor_id`),
	FOREIGN KEY (`series_id`) REFERENCES `class_series`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`instructor_id`) REFERENCES `tenant_members`(`id`) ON UPDATE no action ON DELETE cascade
);