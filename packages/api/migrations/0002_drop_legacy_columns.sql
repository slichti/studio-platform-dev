DROP INDEX IF EXISTS tenant_idx;
ALTER TABLE users DROP COLUMN tenant_id;
