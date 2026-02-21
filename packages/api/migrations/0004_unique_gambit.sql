-- Migration: 0004_unique_gambit.sql
-- Repaired to be non-destructive and handle existing schema from manual migrations 0064-0070.

-- 1. Create new tables if they don't exist
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
CREATE INDEX IF NOT EXISTS `article_tenant_idx` ON `articles` (`tenant_id`);
--> statement-breakpoint

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
CREATE INDEX IF NOT EXISTS `assignment_tenant_idx` ON `assignments` (`tenant_id`);
--> statement-breakpoint

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
CREATE INDEX IF NOT EXISTS `assign_sub_user_idx` ON `assignment_submissions` (`user_id`,`assignment_id`);
--> statement-breakpoint

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
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`collection_item_id`) REFERENCES `video_collection_items`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`author_id`) REFERENCES `tenant_members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `course_comment_item_idx` ON `course_comments` (`collection_item_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `course_comment_course_idx` ON `course_comments` (`course_id`);
--> statement-breakpoint

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
CREATE INDEX IF NOT EXISTS `course_resource_item_idx` ON `course_resources` (`collection_item_id`);
--> statement-breakpoint

-- 2. Surgical Column Additions for video_collection_items
-- module_id, release_after_days, is_required were added in 0066.
-- We only add article_id and assignment_id here.
-- Note: We use the fact that these columns were definitively missing from 0066.
ALTER TABLE `video_collection_items` ADD COLUMN `article_id` text REFERENCES articles(id) ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE `video_collection_items` ADD COLUMN `assignment_id` text REFERENCES assignments(id) ON DELETE cascade;
--> statement-breakpoint

-- 3. Surgical Column Additions for other tables
ALTER TABLE `class_pack_definitions` ADD COLUMN `stripe_product_id` text;
--> statement-breakpoint
ALTER TABLE `class_pack_definitions` ADD COLUMN `stripe_price_id` text;
--> statement-breakpoint
ALTER TABLE `membership_plans` ADD COLUMN `stripe_product_id` text;
--> statement-breakpoint
ALTER TABLE `membership_plans` ADD COLUMN `stripe_price_id` text;
--> statement-breakpoint
ALTER TABLE `membership_plans` ADD COLUMN `updated_at` integer DEFAULT (strftime('%s', 'now'));
--> statement-breakpoint
ALTER TABLE `tenants` ADD COLUMN `is_test` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint

-- 4. Handled by manual migrations 0064-0070 (NO ACTION NEEDED)
-- courses table (already handled by 0066, 0068, 0070)
-- course_access_codes (already handled by 0066)
-- course_enrollments (already handled by 0068)
-- course_modules (already handled by 0066)
-- course_prerequisites (already handled by 0068)

-- 5. Misc cleanup
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
CREATE INDEX IF NOT EXISTS `video_purchase_tenant_user_idx` ON `video_purchases` (`tenant_id`,`user_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `video_purchase_user_class_idx` ON `video_purchases` (`user_id`,`class_id`);