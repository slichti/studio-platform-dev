-- migration 0061_fix_remaining_seeding_tables.sql
-- Safely add missing columns to bookings table to fix seeding 500 error

ALTER TABLE `bookings` ADD `payment_method` text;
ALTER TABLE `bookings` ADD `used_pack_id` text;
