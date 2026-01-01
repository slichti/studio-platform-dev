CREATE TABLE `gift_card_transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`gift_card_id` text NOT NULL,
	`amount` integer NOT NULL,
	`type` text NOT NULL,
	`reference_id` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`gift_card_id`) REFERENCES `gift_cards`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `gift_card_tx_card_idx` ON `gift_card_transactions` (`gift_card_id`);--> statement-breakpoint
CREATE TABLE `gift_cards` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`code` text NOT NULL,
	`initial_value` integer NOT NULL,
	`current_balance` integer NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`expiry_date` integer,
	`buyer_member_id` text,
	`recipient_email` text,
	`notes` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`buyer_member_id`) REFERENCES `tenant_members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `gift_card_tenant_code_idx` ON `gift_cards` (`tenant_id`,`code`);--> statement-breakpoint
CREATE INDEX `gift_card_tenant_idx` ON `gift_cards` (`tenant_id`);--> statement-breakpoint
CREATE TABLE `pos_order_items` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`product_id` text NOT NULL,
	`quantity` integer NOT NULL,
	`unit_price` integer NOT NULL,
	`total_price` integer NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`order_id`) REFERENCES `pos_orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `pos_item_order_idx` ON `pos_order_items` (`order_id`);--> statement-breakpoint
CREATE INDEX `pos_item_product_idx` ON `pos_order_items` (`product_id`);--> statement-breakpoint
CREATE TABLE `pos_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`member_id` text,
	`staff_id` text,
	`total_amount` integer NOT NULL,
	`tax_amount` integer DEFAULT 0,
	`status` text DEFAULT 'completed' NOT NULL,
	`payment_method` text DEFAULT 'card',
	`stripe_payment_intent_id` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`member_id`) REFERENCES `tenant_members`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`staff_id`) REFERENCES `tenant_members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `pos_order_tenant_idx` ON `pos_orders` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `pos_order_member_idx` ON `pos_orders` (`member_id`);--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`category` text,
	`sku` text,
	`price` integer DEFAULT 0 NOT NULL,
	`currency` text DEFAULT 'usd',
	`stock_quantity` integer DEFAULT 0 NOT NULL,
	`image_url` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `product_tenant_idx` ON `products` (`tenant_id`);--> statement-breakpoint
ALTER TABLE `tenants` ADD `stripe_customer_id` text;--> statement-breakpoint
ALTER TABLE `tenants` ADD `stripe_subscription_id` text;--> statement-breakpoint
ALTER TABLE `tenants` ADD `current_period_end` integer;--> statement-breakpoint
ALTER TABLE `tenants` ADD `currency` text DEFAULT 'usd' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `stripe_customer_id` text;--> statement-breakpoint
ALTER TABLE `waiver_signatures` ADD `signed_by_member_id` text REFERENCES tenant_members(id);