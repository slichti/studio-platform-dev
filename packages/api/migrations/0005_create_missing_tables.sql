-- Create tenant_members
CREATE TABLE tenant_members (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    profile TEXT,
    settings TEXT,
    joined_at TIMESTAMP DEFAULT (strftime('%s', 'now'))
);
CREATE INDEX tenant_user_idx ON tenant_members(tenant_id, user_id);

-- Create tenant_roles
CREATE TABLE tenant_roles (
    member_id TEXT NOT NULL REFERENCES tenant_members(id),
    role TEXT NOT NULL CHECK(role IN ('owner', 'instructor', 'student')),
    created_at TIMESTAMP DEFAULT (strftime('%s', 'now')),
    PRIMARY KEY (member_id, role)
);


