CREATE TABLE `membership_plans` (
    `id` text PRIMARY KEY NOT NULL,
    `tenant_id` text NOT NULL REFERENCES `tenants`(`id`),
    `name` text NOT NULL,
    `description` text,
    `price` integer DEFAULT 0,
    `currency` text DEFAULT 'usd',
    `interval` text DEFAULT 'month',
    `active` integer DEFAULT 1,
    `created_at` integer DEFAULT (strftime('%s', 'now'))
);
