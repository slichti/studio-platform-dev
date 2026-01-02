ALTER TABLE `tenants` ADD `streaming_usage` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `tenants` ADD `streaming_limit` integer;