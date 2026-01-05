ALTER TABLE `class_pack_definitions` ADD `vod_enabled` integer DEFAULT false;--> statement-breakpoint
ALTER TABLE `membership_plans` ADD `vod_enabled` integer DEFAULT false;--> statement-breakpoint
ALTER TABLE `products` ADD `stripe_product_id` text;--> statement-breakpoint
ALTER TABLE `products` ADD `stripe_price_id` text;