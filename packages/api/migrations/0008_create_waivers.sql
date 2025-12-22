CREATE TABLE `waiver_templates` (
    `id` text PRIMARY KEY NOT NULL,
    `tenant_id` text NOT NULL REFERENCES `tenants`(`id`),
    `title` text NOT NULL,
    `content` text NOT NULL,
    `active` integer DEFAULT 1,
    `created_at` integer DEFAULT (strftime('%s', 'now'))
);

CREATE TABLE `waiver_signatures` (
    `id` text PRIMARY KEY NOT NULL,
    `template_id` text NOT NULL REFERENCES `waiver_templates`(`id`),
    `member_id` text NOT NULL REFERENCES `tenant_members`(`id`),
    `signed_at` integer DEFAULT (strftime('%s', 'now')),
    `ip_address` text,
    `signature_data` text
);

CREATE INDEX `member_template_idx` ON `waiver_signatures` (`member_id`, `template_id`);
