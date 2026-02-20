-- Migration: 0066_courses_feature_additions.sql
-- Adds schema additions for course management improvements.
-- Order: CREATE tables first, then ALTER TABLE to add FK columns.

-- H1: Create course_modules FIRST (before adding module_id FK to video_collection_items)
CREATE TABLE IF NOT EXISTS course_modules (
    id TEXT PRIMARY KEY,
    course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
);
CREATE INDEX IF NOT EXISTS course_module_idx ON course_modules(course_id);

-- N1: Create course_access_codes table
CREATE TABLE IF NOT EXISTS course_access_codes (
    id TEXT PRIMARY KEY,
    course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    tenant_id TEXT NOT NULL REFERENCES tenants(id),
    code TEXT NOT NULL,
    max_uses INTEGER,
    used_count INTEGER NOT NULL DEFAULT 0,
    expires_at INTEGER,
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS access_code_course_code_idx ON course_access_codes(course_id, code);
CREATE INDEX IF NOT EXISTS access_code_tenant_idx ON course_access_codes(tenant_id);

-- H3: Cohort mode columns on courses
ALTER TABLE courses ADD COLUMN delivery_mode TEXT DEFAULT 'self_paced';
ALTER TABLE courses ADD COLUMN cohort_start_date INTEGER;

-- H1 + H2: New columns on video_collection_items (after course_modules exists)
ALTER TABLE video_collection_items ADD COLUMN module_id TEXT REFERENCES course_modules(id);
ALTER TABLE video_collection_items ADD COLUMN release_after_days INTEGER;
ALTER TABLE video_collection_items ADD COLUMN is_required INTEGER DEFAULT 0;
