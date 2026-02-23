-- Migration 0073: Add churn_reason to subscriptions for cancellation feedback
ALTER TABLE `subscriptions` ADD COLUMN `churn_reason` text;
