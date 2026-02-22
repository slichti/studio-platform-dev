-- Seed test-studio tenant for k6 benchmarks
-- Clear existing to ensure clean state
DELETE FROM bookings WHERE class_id IN (SELECT id FROM classes WHERE tenant_id = 'tenant_test_studio_123');
DELETE FROM classes WHERE tenant_id = 'tenant_test_studio_123';
DELETE FROM locations WHERE tenant_id = 'tenant_test_studio_123';
DELETE FROM tenants WHERE id = 'tenant_test_studio_123';

INSERT INTO tenants (id, slug, name, tier, status, currency)
VALUES ('tenant_test_studio_123', 'test-studio', 'Test Studio', 'growth', 'active', 'usd');

INSERT INTO locations (id, tenant_id, name, is_primary, is_active)
VALUES ('loc_test_studio_123', 'tenant_test_studio_123', 'Main Studio', 1, 1);

-- Create some classes for the next 30 days
-- Timestamps in milliseconds for Drizzle { mode: 'timestamp' }
INSERT INTO classes (id, tenant_id, title, start_time, duration_minutes, capacity, status)
VALUES 
('class_1', 'tenant_test_studio_123', 'Vinyasa Flow', (strftime('%s', 'now') * 1000 + 3600000), 60, 20, 'active'),
('class_2', 'tenant_test_studio_123', 'Power Yoga', (strftime('%s', 'now') * 1000 + 7200000), 60, 20, 'active'),
('class_3', 'tenant_test_studio_123', 'Restorative', (strftime('%s', 'now') * 1000 + 86400000), 60, 20, 'active'),
('class_4', 'tenant_test_studio_123', 'Meditation', (strftime('%s', 'now') * 1000 + 90000000), 60, 20, 'active'),
('class_5', 'tenant_test_studio_123', 'Core Blast', (strftime('%s', 'now') * 1000 + 172800000), 45, 15, 'active');
