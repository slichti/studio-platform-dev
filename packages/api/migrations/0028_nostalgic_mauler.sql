ALTER TABLE `tenant_members` ADD `engagement_score` integer DEFAULT 50;--> statement-breakpoint
ALTER TABLE `tenant_members` ADD `last_engagement_calc` integer;--> statement-breakpoint
CREATE INDEX `member_engagement_idx` ON `tenant_members` (`engagement_score`);