-- Migration: Make instructorId nullable in class_series table
-- This allows creating recurring classes without assigning an instructor upfront

-- SQLite doesn't support ALTER COLUMN directly, so we need to recreate the table
-- Step 1: Create new table with nullable instructorId
CREATE TABLE class_series_new (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id),
    instructor_id TEXT REFERENCES tenant_members(id), -- Now nullable
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

-- Step 2: Copy data from old table
INSERT INTO class_series_new
SELECT * FROM class_series;

-- Step 3: Drop old table
DROP TABLE class_series;

-- Step 4: Rename new table
ALTER TABLE class_series_new RENAME TO class_series;
