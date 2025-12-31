CREATE TABLE tenant_features (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    feature_key TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 0,
    source TEXT DEFAULT 'manual',
    updated_at TIMESTAMP DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX unique_feature_idx ON tenant_features(tenant_id, feature_key);

ALTER TABLE tenant_members ADD COLUMN status TEXT DEFAULT 'active' NOT NULL;
