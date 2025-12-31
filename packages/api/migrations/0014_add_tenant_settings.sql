-- Migration to add settings column to tenants table
-- SQLite doesn't strictly support adding a JSON column type, it's just TEXT.
-- But Drizzle handles the JSON parsing/stringifying in code.

ALTER TABLE `tenants` ADD COLUMN `settings` text;
