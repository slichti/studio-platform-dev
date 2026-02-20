-- Migration 0068: Add missing enrolled, prereqs, and course_id columns

CREATE TABLE IF NOT EXISTS `course_enrollments` (
	`id` text PRIMARY KEY NOT NULL,
	`course_id` text NOT NULL,
	`user_id` text NOT NULL,
	`tenant_id` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`progress` integer DEFAULT 0,
	`enrolled_at` integer DEFAULT (strftime('%s', 'now')),
	`completed_at` integer,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
CREATE UNIQUE INDEX IF NOT EXISTS `user_course_enrollment_idx` ON `course_enrollments` (`user_id`,`course_id`);
CREATE INDEX IF NOT EXISTS `enrollment_tenant_idx` ON `course_enrollments` (`tenant_id`);

CREATE TABLE IF NOT EXISTS `course_prerequisites` (
	`id` text PRIMARY KEY NOT NULL,
	`course_id` text NOT NULL,
	`prerequisite_id` text NOT NULL,
	`tenant_id` text NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`prerequisite_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
CREATE UNIQUE INDEX IF NOT EXISTS `course_prereq_idx` ON `course_prerequisites` (`course_id`,`prerequisite_id`);
CREATE INDEX IF NOT EXISTS `course_prereq_tenant_idx` ON `course_prerequisites` (`tenant_id`);

ALTER TABLE `classes` ADD COLUMN `course_id` text REFERENCES `courses`(`id`);
ALTER TABLE `quizzes` ADD COLUMN `course_id` text REFERENCES `courses`(`id`);
