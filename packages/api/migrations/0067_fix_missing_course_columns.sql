CREATE TABLE `video_collection_items_new` (
	`id` text PRIMARY KEY NOT NULL,
	`collection_id` text NOT NULL,
	`content_type` text DEFAULT 'video' NOT NULL,
	`video_id` text,
	`quiz_id` text,
	`order` integer DEFAULT 0 NOT NULL,
	`module_id` text,
	`release_after_days` integer,
	`is_required` integer DEFAULT 0,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`collection_id`) REFERENCES `video_collections`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`video_id`) REFERENCES `videos`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`quiz_id`) REFERENCES `quizzes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`module_id`) REFERENCES `course_modules`(`id`) ON UPDATE no action ON DELETE set null
);
INSERT INTO `video_collection_items_new` (`id`, `collection_id`, `video_id`, `order`, `created_at`) 
SELECT `id`, `collection_id`, `video_id`, `order`, `created_at` FROM `video_collection_items`;
DROP TABLE `video_collection_items`;
ALTER TABLE `video_collection_items_new` RENAME TO `video_collection_items`;
CREATE INDEX IF NOT EXISTS `collection_item_idx` ON `video_collection_items` (`collection_id`);
