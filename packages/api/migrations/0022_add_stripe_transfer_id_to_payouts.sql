-- 0022_add_stripe_transfer_id_to_payouts.sql

ALTER TABLE `payouts` ADD COLUMN `stripe_transfer_id` text;
