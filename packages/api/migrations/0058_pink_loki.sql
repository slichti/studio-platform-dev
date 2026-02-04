CREATE TABLE `inventory_adjustments` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`product_id` text NOT NULL,
	`staff_id` text,
	`delta` integer NOT NULL,
	`reason` text NOT NULL,
	`notes` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`staff_id`) REFERENCES `tenant_members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `inv_adj_product_idx` ON `inventory_adjustments` (`product_id`);--> statement-breakpoint
CREATE INDEX `inv_adj_tenant_idx` ON `inventory_adjustments` (`tenant_id`);--> statement-breakpoint
CREATE TABLE `member_progress_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`member_id` text NOT NULL,
	`metric_definition_id` text NOT NULL,
	`value` integer NOT NULL,
	`recorded_at` integer DEFAULT (strftime('%s', 'now')),
	`source` text DEFAULT 'auto',
	`metadata` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`) REFERENCES `tenant_members`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`metric_definition_id`) REFERENCES `progress_metric_definitions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `progress_entry_member_idx` ON `member_progress_entries` (`member_id`);--> statement-breakpoint
CREATE INDEX `progress_entry_metric_idx` ON `member_progress_entries` (`metric_definition_id`);--> statement-breakpoint
CREATE INDEX `progress_entry_tenant_idx` ON `member_progress_entries` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `progress_entry_recorded_idx` ON `member_progress_entries` (`member_id`,`recorded_at`);--> statement-breakpoint
CREATE TABLE `progress_metric_definitions` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`unit` text NOT NULL,
	`icon` text,
	`aggregation` text DEFAULT 'sum',
	`visible_to_students` integer DEFAULT true NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`display_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `progress_metric_tenant_idx` ON `progress_metric_definitions` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `progress_metric_category_idx` ON `progress_metric_definitions` (`tenant_id`,`category`);--> statement-breakpoint
CREATE TABLE `purchase_order_items` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`purchase_order_id` text NOT NULL,
	`product_id` text NOT NULL,
	`quantity_ordered` integer NOT NULL,
	`quantity_received` integer DEFAULT 0 NOT NULL,
	`unit_cost` integer NOT NULL,
	`total_cost` integer NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`purchase_order_id`) REFERENCES `purchase_orders`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `po_item_po_idx` ON `purchase_order_items` (`purchase_order_id`);--> statement-breakpoint
CREATE INDEX `po_item_product_idx` ON `purchase_order_items` (`product_id`);--> statement-breakpoint
CREATE TABLE `purchase_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`supplier_id` text NOT NULL,
	`staff_id` text,
	`po_number` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`total_amount` integer DEFAULT 0 NOT NULL,
	`currency` text DEFAULT 'usd',
	`notes` text,
	`sent_at` integer,
	`received_at` integer,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`staff_id`) REFERENCES `tenant_members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `po_tenant_idx` ON `purchase_orders` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `po_supplier_idx` ON `purchase_orders` (`supplier_id`);--> statement-breakpoint
CREATE TABLE `suppliers` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`name` text NOT NULL,
	`contact_name` text,
	`email` text,
	`phone` text,
	`address` text,
	`website` text,
	`notes` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `supplier_tenant_idx` ON `suppliers` (`tenant_id`);--> statement-breakpoint
ALTER TABLE `bookings` ADD `external_source` text;--> statement-breakpoint
ALTER TABLE `bookings` ADD `external_id` text;--> statement-breakpoint
ALTER TABLE `products` ADD `supplier_id` text REFERENCES suppliers(id);--> statement-breakpoint
CREATE INDEX `product_supplier_idx` ON `products` (`supplier_id`);--> statement-breakpoint
ALTER TABLE `tenants` ADD `aggregator_config` text;