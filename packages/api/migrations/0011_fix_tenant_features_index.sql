DROP INDEX IF EXISTS unique_feature_idx;
CREATE UNIQUE INDEX unique_feature_idx ON tenant_features(tenant_id, feature_key);
