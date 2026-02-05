-- migration 0060_fix_classes_columns.sql
-- Safely add missing series_id column to classes table to fix seeding 500 error

ALTER TABLE `classes` ADD `series_id` text;
