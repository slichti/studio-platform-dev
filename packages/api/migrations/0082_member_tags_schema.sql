-- Member tags: create tags/tag_assignments/class_required_tags if missing (e.g. remote only had member_tags from 0000)

CREATE TABLE IF NOT EXISTS `tags` (
  `id` text PRIMARY KEY NOT NULL,
  `tenant_id` text NOT NULL REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
  `name` text NOT NULL,
  `slug` text NOT NULL,
  `color` text DEFAULT '#6366f1',
  `description` text,
  `category` text,
  `discount_type` text DEFAULT 'none' NOT NULL,
  `discount_value` integer,
  `applies_to_products` text,
  `visibility` text DEFAULT 'internal_only' NOT NULL,
  `created_at` integer DEFAULT (strftime('%s', 'now')),
  `updated_at` integer DEFAULT (strftime('%s', 'now'))
);
CREATE INDEX IF NOT EXISTS `tag_tenant_idx` ON `tags` (`tenant_id`);
CREATE UNIQUE INDEX IF NOT EXISTS `tag_unique_name_idx` ON `tags` (`tenant_id`, `name`);
CREATE UNIQUE INDEX IF NOT EXISTS `tag_unique_slug_idx` ON `tags` (`tenant_id`, `slug`);

CREATE TABLE IF NOT EXISTS `tag_assignments` (
  `id` text PRIMARY KEY NOT NULL,
  `tag_id` text NOT NULL REFERENCES `tags`(`id`) ON DELETE CASCADE,
  `target_id` text NOT NULL,
  `target_type` text DEFAULT 'member' NOT NULL,
  `source` text DEFAULT 'manual' NOT NULL,
  `created_by` text,
  `assigned_at` integer DEFAULT (strftime('%s', 'now'))
);
CREATE INDEX IF NOT EXISTS `tag_assign_target_idx` ON `tag_assignments` (`target_id`, `target_type`);
CREATE INDEX IF NOT EXISTS `tag_assign_tag_idx` ON `tag_assignments` (`tag_id`);
CREATE UNIQUE INDEX IF NOT EXISTS `tag_assign_member_tag_idx` ON `tag_assignments` (`tag_id`, `target_id`);

CREATE TABLE IF NOT EXISTS `class_required_tags` (
  `class_id` text NOT NULL REFERENCES `classes`(`id`) ON DELETE CASCADE,
  `tag_id` text NOT NULL REFERENCES `tags`(`id`) ON DELETE CASCADE,
  PRIMARY KEY (`class_id`, `tag_id`)
);
CREATE INDEX IF NOT EXISTS `class_required_tags_class_idx` ON `class_required_tags` (`class_id`);
CREATE INDEX IF NOT EXISTS `class_required_tags_tag_idx` ON `class_required_tags` (`tag_id`);
