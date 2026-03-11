-- Migration 0010: Indexes for instructor-centric queries
-- classes: (tenant_id, instructor_id, start_time) for "my classes in this studio" and instructor profile
CREATE INDEX IF NOT EXISTS class_tenant_instructor_time_idx ON classes(tenant_id, instructor_id, start_time);
