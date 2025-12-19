ALTER TABLE users ADD COLUMN is_super_admin INTEGER DEFAULT 0;

CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    actor_id TEXT,
    action TEXT NOT NULL,
    target_id TEXT,
    details TEXT,
    ip_address TEXT,
    created_at TIMESTAMP DEFAULT (strftime('%s', 'now'))
);
