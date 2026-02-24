ALTER TABLE `locations` ADD `slug` text NOT NULL;--> statement-breakpoint
ALTER TABLE `locations` ADD `seo_config` text;--> statement-breakpoint
CREATE INDEX `location_tenant_idx` ON `locations` (`tenant_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `location_slug_idx` ON `locations` (`tenant_id`,`slug`);