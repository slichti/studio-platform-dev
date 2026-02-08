-- Migration: Make content column nullable in marketing_automations
-- SQLite requires table recreation to remove NOT NULL constraint

-- 1. Rename the existing table
ALTER TABLE marketing_automations RENAME TO marketing_automations_old;

-- 2. Create new table with content as nullable
CREATE TABLE marketing_automations (
    id TEXT PRIMARY KEY NOT NULL,
    tenant_id TEXT REFERENCES tenants(id),
    trigger_event TEXT NOT NULL,
    trigger_condition TEXT,
    template_id TEXT,
    audience_filter TEXT,
    subject TEXT NOT NULL,
    content TEXT, -- Now nullable
    is_enabled INTEGER NOT NULL DEFAULT false,
    metadata TEXT,
    timing_type TEXT NOT NULL DEFAULT 'immediate',
    timing_value INTEGER DEFAULT 0,
    delay_hours INTEGER DEFAULT 0,
    channels TEXT DEFAULT '["email"]',
    coupon_config TEXT,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER DEFAULT (strftime('%s', 'now')),
    recipients TEXT DEFAULT '["student"]'
);

-- 3. Copy data from old table to new table
INSERT INTO marketing_automations (
    id, tenant_id, trigger_event, trigger_condition, template_id, audience_filter,
    subject, content, is_enabled, metadata, timing_type, timing_value, delay_hours,
    channels, coupon_config, created_at, updated_at, recipients
)
SELECT
    id, tenant_id, trigger_event, trigger_condition, template_id, audience_filter,
    subject, content, is_enabled, metadata, timing_type, timing_value, delay_hours,
    channels, coupon_config, created_at, updated_at, recipients
FROM marketing_automations_old;

-- 4. Drop the old table
DROP TABLE marketing_automations_old;

-- 5. Recreate the index
CREATE INDEX automation_tenant_idx ON marketing_automations(tenant_id);
