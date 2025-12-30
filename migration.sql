-- Enable foreign keys
PRAGMA foreign_keys = ON;

-- Tenants
CREATE TABLE IF NOT EXISTS tenants (
    id TEXT PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    custom_domain TEXT UNIQUE,
    branding TEXT,
    stripe_account_id TEXT,
    zoom_credentials TEXT,
    created_at TIMESTAMP DEFAULT (strftime('%s', 'now'))
);

-- Tenant Features (Entitlements)
CREATE TABLE IF NOT EXISTS tenant_features (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    feature_key TEXT NOT NULL, -- e.g. 'financials', 'vod', 'zoom'
    enabled BOOLEAN NOT NULL DEFAULT 0,
    source TEXT DEFAULT 'manual', -- 'manual', 'subscription', 'trial'
    updated_at TIMESTAMP DEFAULT (strftime('%s', 'now')),
    UNIQUE(tenant_id, feature_key)
);
CREATE INDEX IF NOT EXISTS tenant_features_idx ON tenant_features(tenant_id);

-- Users
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id),
    role TEXT NOT NULL CHECK(role IN ('owner', 'instructor', 'student')),
    email TEXT NOT NULL,
    password_hash TEXT,
    profile TEXT,
    created_at TIMESTAMP DEFAULT (strftime('%s', 'now'))
);
CREATE INDEX IF NOT EXISTS email_idx ON users(email);
CREATE INDEX IF NOT EXISTS tenant_idx ON users(tenant_id);

-- Locations
CREATE TABLE IF NOT EXISTS locations (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id),
    name TEXT NOT NULL,
    address TEXT,
    timezone TEXT DEFAULT 'UTC',
    created_at TIMESTAMP DEFAULT (strftime('%s', 'now'))
);

-- Classes
CREATE TABLE IF NOT EXISTS classes (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id),
    instructor_id TEXT NOT NULL REFERENCES users(id),
    location_id TEXT REFERENCES locations(id),
    title TEXT NOT NULL,
    description TEXT,
    start_time TIMESTAMP NOT NULL,
    duration_minutes INTEGER NOT NULL,
    capacity INTEGER,
    zoom_meeting_url TEXT,
    thumbnail_url TEXT,
    cloudflare_stream_id TEXT,
    recording_status TEXT CHECK(recording_status IN ('processing', 'ready', 'error')),
    created_at TIMESTAMP DEFAULT (strftime('%s', 'now'))
);
CREATE INDEX IF NOT EXISTS tenant_time_idx ON classes(tenant_id, start_time);

-- Subscriptions
CREATE TABLE IF NOT EXISTS subscriptions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    status TEXT NOT NULL CHECK(status IN ('active', 'past_due', 'canceled', 'incomplete')),
    tier TEXT DEFAULT 'basic' CHECK(tier IN ('basic', 'premium')),
    current_period_end TIMESTAMP,
    stripe_subscription_id TEXT,
    created_at TIMESTAMP DEFAULT (strftime('%s', 'now'))
);

-- Bookings
CREATE TABLE IF NOT EXISTS bookings (
    id TEXT PRIMARY KEY,
    class_id TEXT NOT NULL REFERENCES classes(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    status TEXT DEFAULT 'confirmed' CHECK(status IN ('confirmed', 'cancelled', 'waitlisted')),
    created_at TIMESTAMP DEFAULT (strftime('%s', 'now'))
);
CREATE INDEX IF NOT EXISTS user_class_idx ON bookings(user_id, class_id);
