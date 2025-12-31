-- Migration to add user_relationships table for family linking
CREATE TABLE `user_relationships` (
    `id` text PRIMARY KEY NOT NULL,
    `parent_user_id` text NOT NULL REFERENCES `users`(`id`),
    `child_user_id` text NOT NULL REFERENCES `users`(`id`),
    `type` text DEFAULT 'parent_child' NOT NULL,
    `created_at` integer DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX `parent_idx` ON `user_relationships` (`parent_user_id`);
CREATE INDEX `child_idx` ON `user_relationships` (`child_user_id`);
