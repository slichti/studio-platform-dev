-- Migration 0069: Add VOD and Course fields to classes

ALTER TABLE `classes` ADD `recording_price` integer;
ALTER TABLE `classes` ADD `is_recording_sellable` integer DEFAULT 0;
ALTER TABLE `classes` ADD `is_course` integer DEFAULT 0;
ALTER TABLE `classes` ADD `content_collection_id` text REFERENCES `video_collections`(`id`);
ALTER TABLE `classes` ADD `course_id` text REFERENCES `courses`(`id`);
