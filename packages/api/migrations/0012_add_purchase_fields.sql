CREATE TABLE IF NOT EXISTS `class_pack_definitions` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL REFERENCES `tenants`(`id`),
	`name` text NOT NULL,
	`price` integer DEFAULT 0,
	`credits` integer NOT NULL,
	`expiration_days` integer,
	`active` integer DEFAULT true,
	`created_at` integer DEFAULT (strftime('%s', 'now'))
);

CREATE TABLE IF NOT EXISTS `purchased_packs` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL REFERENCES `tenants`(`id`),
	`member_id` text NOT NULL REFERENCES `tenant_members`(`id`),
	`pack_definition_id` text NOT NULL REFERENCES `class_pack_definitions`(`id`),
	`initial_credits` integer NOT NULL,
	`remaining_credits` integer NOT NULL,
	`purchased_price_cents` integer DEFAULT 0,
	`stripe_payment_id` text,
	`expires_at` integer,
	`created_at` integer DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS `member_pack_idx` ON `purchased_packs` (`member_id`);
