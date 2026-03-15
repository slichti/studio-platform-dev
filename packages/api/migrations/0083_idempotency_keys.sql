-- Idempotency keys for guest booking (and optionally checkout) to avoid duplicate processing on retries.
CREATE TABLE IF NOT EXISTS idempotency_keys (
    key TEXT PRIMARY KEY NOT NULL,
    response TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);
CREATE INDEX IF NOT EXISTS idempotency_created_idx ON idempotency_keys (created_at);
