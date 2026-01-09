ALTER TABLE `classes` ADD `member_price` integer;--> statement-breakpoint
ALTER TABLE `classes` ADD `type` text DEFAULT 'class' NOT NULL;--> statement-breakpoint
ALTER TABLE `classes` ADD `allow_credits` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `classes` ADD `included_plan_ids` text;--> statement-breakpoint
ALTER TABLE `marketing_automations` ADD `template_id` text;--> statement-breakpoint
ALTER TABLE `marketing_automations` ADD `audience_filter` text;