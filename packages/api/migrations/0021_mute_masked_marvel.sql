CREATE TABLE `ai_usage_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text,
	`user_id` text,
	`model` text NOT NULL,
	`feature` text NOT NULL,
	`prompt_tokens` integer NOT NULL,
	`completion_tokens` integer NOT NULL,
	`total_tokens` integer NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `ai_usage_tenant_idx` ON `ai_usage_logs` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `ai_usage_feature_idx` ON `ai_usage_logs` (`feature`);--> statement-breakpoint
CREATE INDEX `ai_usage_created_idx` ON `ai_usage_logs` (`created_at`);--> statement-breakpoint
DROP INDEX `automation_log_unique_idx`;--> statement-breakpoint
ALTER TABLE `automation_logs` ADD `step_index` integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE `automation_logs` ADD `opened_at` integer;--> statement-breakpoint
ALTER TABLE `automation_logs` ADD `clicked_at` integer;--> statement-breakpoint
CREATE UNIQUE INDEX `automation_log_unique_idx` ON `automation_logs` (`automation_id`,`user_id`,`channel`,`step_index`);