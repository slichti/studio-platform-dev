-- Migration: Multi-role support

-- 1. Add settings to tenants
ALTER TABLE tenants ADD COLUMN settings TEXT;

-- 2. Create tenant_members
CREATE TABLE tenant_members (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    profile TEXT,
    settings TEXT,
    joined_at TIMESTAMP DEFAULT (strftime('%s', 'now'))
);
CREATE INDEX tenant_user_idx ON tenant_members(tenant_id, user_id);

-- 3. Create tenant_roles
CREATE TABLE tenant_roles (
    member_id TEXT NOT NULL REFERENCES tenant_members(id),
    role TEXT NOT NULL CHECK(role IN ('owner', 'instructor', 'student')),
    created_at TIMESTAMP DEFAULT (strftime('%s', 'now')),
    PRIMARY KEY (member_id, role)
);

-- 4. Update Users (Dropping columns if supported, otherwise just ignore for now or recreate)
-- D1 supports DROP COLUMN
ALTER TABLE users DROP COLUMN tenant_id;
ALTER TABLE users DROP COLUMN role;
ALTER TABLE users DROP COLUMN password_hash; 
ALTER TABLE users ADD COLUMN is_system_admin BOOLEAN DEFAULT 0;

-- 5. Audit Logs
ALTER TABLE audit_logs ADD COLUMN tenant_id TEXT REFERENCES tenants(id);

-- 6. Update Classes (Recreate for new columns and FK)
CREATE TABLE classes_new (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id),
    instructor_id TEXT NOT NULL REFERENCES tenant_members(id),
    location_id TEXT REFERENCES locations(id),
    title TEXT NOT NULL,
    description TEXT,
    start_time TIMESTAMP NOT NULL,
    duration_minutes INTEGER NOT NULL,
    capacity INTEGER,
    price INTEGER DEFAULT 0,
    currency TEXT DEFAULT 'usd',
    zoom_meeting_url TEXT,
    thumbnail_url TEXT,
    cloudflare_stream_id TEXT,
    recording_status TEXT CHECK(recording_status IN ('processing', 'ready', 'error')),
    min_students INTEGER DEFAULT 1,
    auto_cancel_threshold INTEGER,
    auto_cancel_enabled BOOLEAN DEFAULT 0,
    created_at TIMESTAMP DEFAULT (strftime('%s', 'now'))
);
-- We are NOT copying data for classes as it requires migrating instructor_id from user_id to member_id
DROP TABLE classes;
ALTER TABLE classes_new RENAME TO classes;
CREATE INDEX tenant_time_idx ON classes(tenant_id, start_time);

-- 7. Subscriptions
ALTER TABLE subscriptions ADD COLUMN tenant_id TEXT REFERENCES tenants(id);

-- 8. Bookings (Recreate for member_id)
CREATE TABLE bookings_new (
    id TEXT PRIMARY KEY,
    class_id TEXT NOT NULL REFERENCES classes(id),
    member_id TEXT NOT NULL REFERENCES tenant_members(id),
    status TEXT DEFAULT 'confirmed' CHECK(status IN ('confirmed', 'cancelled', 'waitlisted')),
    created_at TIMESTAMP DEFAULT (strftime('%s', 'now'))
);
DROP TABLE bookings;
ALTER TABLE bookings_new RENAME TO bookings;
CREATE INDEX member_class_idx ON bookings(member_id, class_id);
