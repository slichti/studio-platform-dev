-- Migration: Recurring classes and Fix roles schema

-- 1. Fix tenant_roles by adding id column
-- SQLite doesn't support ALTER TABLE ADD COLUMN PRIMARY KEY easily, 
-- so we recreate the table to match schema.ts
CREATE TABLE IF NOT EXISTS tenant_roles_new (
    id TEXT PRIMARY KEY,
    member_id TEXT NOT NULL REFERENCES tenant_members(id),
    role TEXT NOT NULL CHECK(role IN ('owner', 'admin', 'instructor', 'student', 'custom')),
    custom_role_id TEXT,
    permissions TEXT, -- JSON
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- Copy existing data if any (mapping composite PK to id)
INSERT INTO tenant_roles_new (id, member_id, role, created_at)
SELECT member_id || '_' || role, member_id, role, created_at FROM tenant_roles;

DROP TABLE tenant_roles;
ALTER TABLE tenant_roles_new RENAME TO tenant_roles;
CREATE INDEX IF NOT EXISTS member_role_idx ON tenant_roles(member_id, role);

-- 2. Create class_series table
CREATE TABLE IF NOT EXISTS class_series (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id),
    instructor_id TEXT NOT NULL REFERENCES tenant_members(id),
    location_id TEXT REFERENCES locations(id),
    title TEXT NOT NULL,
    description TEXT,
    duration_minutes INTEGER NOT NULL,
    price INTEGER DEFAULT 0,
    currency TEXT DEFAULT 'usd',
    recurrence_rule TEXT NOT NULL,
    valid_from INTEGER NOT NULL,
    valid_until INTEGER,
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- 3. Update classes table to link to series
-- Adding series_id column if it doesn't exist
ALTER TABLE classes ADD COLUMN series_id TEXT REFERENCES class_series(id);
