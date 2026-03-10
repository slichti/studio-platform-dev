-- Add invitation tracking columns to tenant_members (schema had these but no migration existed)
ALTER TABLE `tenant_members` ADD `invited_at` integer;--> statement-breakpoint
ALTER TABLE `tenant_members` ADD `accepted_at` integer;
