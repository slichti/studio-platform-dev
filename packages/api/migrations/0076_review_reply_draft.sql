-- Migration 0076: Review AI — store AI-generated reply drafts per review
ALTER TABLE `reviews` ADD COLUMN `reply_draft` text;
ALTER TABLE `reviews` ADD COLUMN `reply_draft_generated_at` integer;
