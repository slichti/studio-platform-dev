ALTER TABLE tenants ADD COLUMN tier text DEFAULT 'basic' NOT NULL;
ALTER TABLE tenants ADD COLUMN subscription_status text DEFAULT 'active' NOT NULL;
