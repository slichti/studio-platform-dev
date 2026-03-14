-- Member tags: extend tags for discounts and class eligibility; add class_required_tags
-- See docs/plan-member-tags.md

-- Tags: add slug, category, discount, visibility (existing name/color/description kept)
ALTER TABLE `tags` ADD COLUMN `slug` text;
ALTER TABLE `tags` ADD COLUMN `category` text;
ALTER TABLE `tags` ADD COLUMN `discount_type` text DEFAULT 'none';
ALTER TABLE `tags` ADD COLUMN `discount_value` integer;
ALTER TABLE `tags` ADD COLUMN `applies_to_products` text;
ALTER TABLE `tags` ADD COLUMN `visibility` text DEFAULT 'internal_only';
ALTER TABLE `tags` ADD COLUMN `updated_at` integer;

-- Backfill slug for existing rows so unique index can apply
UPDATE `tags` SET `slug` = `id` WHERE `slug` IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS `tag_unique_slug_idx` ON `tags` (`tenant_id`, `slug`);

-- Tag assignments: add source and created_by
ALTER TABLE `tag_assignments` ADD COLUMN `source` text DEFAULT 'manual';
ALTER TABLE `tag_assignments` ADD COLUMN `created_by` text;

CREATE UNIQUE INDEX IF NOT EXISTS `tag_assign_member_tag_idx` ON `tag_assignments` (`tag_id`, `target_id`);

-- Classes that only members with specific tags can register for (e.g. Silver Sneakers)
CREATE TABLE IF NOT EXISTS `class_required_tags` (
  `class_id` text NOT NULL REFERENCES `classes`(`id`) ON DELETE CASCADE,
  `tag_id` text NOT NULL REFERENCES `tags`(`id`) ON DELETE CASCADE,
  PRIMARY KEY (`class_id`, `tag_id`)
);

CREATE INDEX IF NOT EXISTS `class_required_tags_class_idx` ON `class_required_tags` (`class_id`);
CREATE INDEX IF NOT EXISTS `class_required_tags_tag_idx` ON `class_required_tags` (`tag_id`);
