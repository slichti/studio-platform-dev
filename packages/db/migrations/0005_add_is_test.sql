-- Add is_test column to tenants table for distinguishing test-seeded tenants
ALTER TABLE tenants ADD COLUMN is_test integer NOT NULL DEFAULT 0;
