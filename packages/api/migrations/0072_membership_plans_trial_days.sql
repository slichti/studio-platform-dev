-- Migration 0072: Add trial_days to membership_plans
ALTER TABLE `membership_plans` ADD COLUMN `trial_days` integer DEFAULT 0;
