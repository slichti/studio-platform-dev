-- Migration 0071: Add per-lesson completion tracking

CREATE TABLE IF NOT EXISTS `course_item_completions` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL REFERENCES `users`(`id`) ON DELETE CASCADE,
  `tenant_id` text NOT NULL REFERENCES `tenants`(`id`) ON DELETE CASCADE,
  `course_id` text NOT NULL REFERENCES `courses`(`id`) ON DELETE CASCADE,
  `item_id` text NOT NULL REFERENCES `video_collection_items`(`id`) ON DELETE CASCADE,
  `completed_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS `course_item_completion_unique` ON `course_item_completions`(`user_id`, `item_id`);
CREATE INDEX IF NOT EXISTS `course_item_completion_course_idx` ON `course_item_completions`(`user_id`, `course_id`);
