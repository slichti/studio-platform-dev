CREATE TABLE IF NOT EXISTS `articles` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`title` text NOT NULL,
	`content` text,
	`html` text,
	`reading_time_minutes` integer DEFAULT 0,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `article_tenant_idx` ON `articles` (`tenant_id`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `assignment_submissions` (
	`id` text PRIMARY KEY NOT NULL,
	`assignment_id` text NOT NULL,
	`user_id` text NOT NULL,
	`tenant_id` text NOT NULL,
	`content` text,
	`file_url` text,
	`status` text DEFAULT 'submitted' NOT NULL,
	`grade` integer,
	`feedback_html` text,
	`submitted_at` integer DEFAULT (strftime('%s', 'now')),
	`graded_at` integer,
	FOREIGN KEY (`assignment_id`) REFERENCES `assignments`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `assign_sub_user_idx` ON `assignment_submissions` (`user_id`,`assignment_id`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `assignments` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`instructions_html` text,
	`require_file_upload` integer DEFAULT false,
	`points_available` integer DEFAULT 100,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `assignment_tenant_idx` ON `assignments` (`tenant_id`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `course_access_codes` (
	`id` text PRIMARY KEY NOT NULL,
	`course_id` text NOT NULL,
	`tenant_id` text NOT NULL,
	`code` text NOT NULL,
	`max_uses` integer,
	`used_count` integer DEFAULT 0 NOT NULL,
	`expires_at` integer,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `access_code_course_code_idx` ON `course_access_codes` (`course_id`,`code`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `access_code_tenant_idx` ON `course_access_codes` (`tenant_id`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `course_comments` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`course_id` text NOT NULL,
	`collection_item_id` text NOT NULL,
	`author_id` text NOT NULL,
	`content` text NOT NULL,
	`parent_id` text,
	`is_pinned` integer DEFAULT false,
	`is_approved` integer DEFAULT true,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`collection_item_id`) REFERENCES `video_collection_items`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`author_id`) REFERENCES `tenant_members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `course_comment_item_idx` ON `course_comments` (`collection_item_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `course_comment_course_idx` ON `course_comments` (`course_id`);--> statement-breakpoint
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
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `user_course_enrollment_idx` ON `course_enrollments` (`user_id`,`course_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `enrollment_tenant_idx` ON `course_enrollments` (`tenant_id`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `course_modules` (
	`id` text PRIMARY KEY NOT NULL,
	`course_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `course_module_idx` ON `course_modules` (`course_id`);--> statement-breakpoint
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
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `course_prereq_idx` ON `course_prerequisites` (`course_id`,`prerequisite_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `course_prereq_tenant_idx` ON `course_prerequisites` (`tenant_id`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `course_resources` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`collection_item_id` text NOT NULL,
	`title` text NOT NULL,
	`url` text,
	`r2_key` text,
	`file_type` text,
	`size_bytes` integer,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`collection_item_id`) REFERENCES `video_collection_items`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `course_resource_item_idx` ON `course_resources` (`collection_item_id`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `courses` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`slug` text NOT NULL,
	`thumbnail_url` text,
	`price` integer DEFAULT 0,
	`member_price` integer,
	`status` text DEFAULT 'draft' NOT NULL,
	`is_public` integer DEFAULT false NOT NULL,
	`content_collection_id` text,
	`delivery_mode` text DEFAULT 'self_paced' NOT NULL,
	`cohort_start_date` integer,
	`cohort_end_date` integer,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`content_collection_id`) REFERENCES `video_collections`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `course_tenant_idx` ON `courses` (`tenant_id`);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `course_tenant_slug_idx` ON `courses` (`tenant_id`,`slug`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `quiz_questions` (
	`id` text PRIMARY KEY NOT NULL,
	`quiz_id` text NOT NULL,
	`question_text` text NOT NULL,
	`question_type` text NOT NULL,
	`options` text,
	`correct_answer` text NOT NULL,
	`explanation` text,
	`points` integer DEFAULT 1,
	`order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`quiz_id`) REFERENCES `quizzes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `quiz_question_idx` ON `quiz_questions` (`quiz_id`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `quiz_submissions` (
	`id` text PRIMARY KEY NOT NULL,
	`quiz_id` text NOT NULL,
	`user_id` text NOT NULL,
	`tenant_id` text NOT NULL,
	`score` integer NOT NULL,
	`passed` integer NOT NULL,
	`answers` text NOT NULL,
	`finished_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`quiz_id`) REFERENCES `quizzes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `quiz_sub_user_quiz_idx` ON `quiz_submissions` (`user_id`,`quiz_id`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `quizzes` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`randomize_order` integer DEFAULT false,
	`passing_score` integer DEFAULT 0,
	`active` integer DEFAULT true,
	`course_id` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `quiz_tenant_idx` ON `quizzes` (`tenant_id`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `rooms` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`capacity` integer,
	`layout` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `room_tenant_idx` ON `rooms` (`tenant_id`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `tag_assignments` (
	`id` text PRIMARY KEY NOT NULL,
	`tag_id` text NOT NULL,
	`target_id` text NOT NULL,
	`target_type` text DEFAULT 'member' NOT NULL,
	`assigned_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `tag_assign_target_idx` ON `tag_assignments` (`target_id`,`target_type`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `tag_assign_tag_idx` ON `tag_assignments` (`tag_id`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `tags` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`name` text NOT NULL,
	`color` text DEFAULT '#6366f1',
	`description` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `tag_tenant_idx` ON `tags` (`tenant_id`);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `tag_unique_name_idx` ON `tags` (`tenant_id`,`name`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `video_purchases` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`user_id` text NOT NULL,
	`class_id` text NOT NULL,
	`price_paid` integer DEFAULT 0 NOT NULL,
	`stripe_payment_id` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`class_id`) REFERENCES `classes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `video_purchase_tenant_user_idx` ON `video_purchases` (`tenant_id`,`user_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `video_purchase_user_class_idx` ON `video_purchases` (`user_id`,`class_id`);--> statement-breakpoint
DROP TABLE `member_tags`;--> statement-breakpoint
DROP TABLE `members_to_tags`;--> statement-breakpoint
DROP INDEX `cf_def_tenant_entity_idx`;--> statement-breakpoint
DROP INDEX `cf_def_unique_key_idx`;--> statement-breakpoint
ALTER TABLE `custom_field_definitions` ADD `target_type` text DEFAULT 'member' NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `cf_def_tenant_target_idx` ON `custom_field_definitions` (`tenant_id`,`target_type`);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `cf_def_unique_key_idx` ON `custom_field_definitions` (`tenant_id`,`target_type`,`key`);--> statement-breakpoint
ALTER TABLE `custom_field_definitions` DROP COLUMN `entity_type`;--> statement-breakpoint
DROP INDEX `cf_val_entity_idx`;--> statement-breakpoint
DROP INDEX `cf_val_unique_idx`;--> statement-breakpoint
ALTER TABLE `custom_field_values` ADD `target_id` text NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `cf_val_target_idx` ON `custom_field_values` (`target_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `cf_val_unique_idx` ON `custom_field_values` (`target_id`,`definition_id`);--> statement-breakpoint
ALTER TABLE `custom_field_values` DROP COLUMN `entity_id`;--> statement-breakpoint
-- Redundant classes alterations removed (handled by 0064)
--> statement-breakpoint--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_class_series` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`instructor_id` text,
	`location_id` text,
	`title` text NOT NULL,
	`description` text,
	`duration_minutes` integer NOT NULL,
	`price` integer DEFAULT 0,
	`currency` text DEFAULT 'usd',
	`recurrence_rule` text NOT NULL,
	`valid_from` integer NOT NULL,
	`valid_until` integer,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`instructor_id`) REFERENCES `tenant_members`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_class_series`("id", "tenant_id", "instructor_id", "location_id", "title", "description", "duration_minutes", "price", "currency", "recurrence_rule", "valid_from", "valid_until", "created_at") SELECT "id", "tenant_id", "instructor_id", "location_id", "title", "description", "duration_minutes", "price", "currency", "recurrence_rule", "valid_from", "valid_until", "created_at" FROM `class_series`;--> statement-breakpoint
DROP TABLE `class_series`;--> statement-breakpoint
ALTER TABLE `__new_class_series` RENAME TO `class_series`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_video_collection_items` (
	`id` text PRIMARY KEY NOT NULL,
	`collection_id` text NOT NULL,
	`content_type` text DEFAULT 'video' NOT NULL,
	`video_id` text,
	`quiz_id` text,
	`article_id` text,
	`assignment_id` text,
	`order` integer DEFAULT 0 NOT NULL,
	`module_id` text,
	`release_after_days` integer,
	`is_required` integer DEFAULT false,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`collection_id`) REFERENCES `video_collections`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`video_id`) REFERENCES `videos`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`quiz_id`) REFERENCES `quizzes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`article_id`) REFERENCES `articles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`assignment_id`) REFERENCES `assignments`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`module_id`) REFERENCES `course_modules`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_video_collection_items`("id", "collection_id", "content_type", "video_id", "quiz_id", "article_id", "assignment_id", "order", "module_id", "release_after_days", "is_required", "created_at") SELECT "id", "collection_id", "content_type", "video_id", "quiz_id", "article_id", "assignment_id", "order", "module_id", "release_after_days", "is_required", "created_at" FROM `video_collection_items`;--> statement-breakpoint
DROP TABLE `video_collection_items`;--> statement-breakpoint
ALTER TABLE `__new_video_collection_items` RENAME TO `video_collection_items`;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `collection_item_idx` ON `video_collection_items` (`collection_id`);--> statement-breakpoint
ALTER TABLE `class_pack_definitions` ADD `stripe_product_id` text;--> statement-breakpoint
ALTER TABLE `class_pack_definitions` ADD `stripe_price_id` text;--> statement-breakpoint
ALTER TABLE `membership_plans` ADD `stripe_product_id` text;--> statement-breakpoint
ALTER TABLE `membership_plans` ADD `stripe_price_id` text;--> statement-breakpoint
ALTER TABLE `membership_plans` ADD `updated_at` integer DEFAULT (strftime('%s', 'now'));--> statement-breakpoint
ALTER TABLE `tenants` ADD `is_test` integer DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `apt_location_time_idx` ON `appointments` (`location_id`,`start_time`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `booking_member_active_idx` ON `bookings` (`member_id`,`status`,`checked_in_at`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `booking_created_idx` ON `bookings` (`created_at`);