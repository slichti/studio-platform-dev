-- migration 0062_fix_bookings_checked_in.sql
-- Safely add missing checked_in_at column to bookings table

ALTER TABLE `bookings` ADD `checked_in_at` integer;
