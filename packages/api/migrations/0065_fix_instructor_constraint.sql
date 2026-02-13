PRAGMA foreign_keys=OFF;

CREATE TABLE "classes_new" (
    `id` text PRIMARY KEY NOT NULL,
    `tenant_id` text NOT NULL REFERENCES tenants(id),
    `instructor_id` text REFERENCES tenant_members(id),
    `location_id` text REFERENCES locations(id),
    `series_id` text REFERENCES class_series(id),
    `title` text NOT NULL,
    `description` text,
    `start_time` integer NOT NULL,
    `duration_minutes` integer NOT NULL,
    `capacity` integer,
    `waitlist_capacity` integer DEFAULT 10,
    `price` integer DEFAULT 0,
    `member_price` integer,
    `currency` text DEFAULT 'usd',
    `payroll_model` text,
    `payroll_value` integer,
    `type` text DEFAULT 'class' NOT NULL,
    `allow_credits` integer DEFAULT true NOT NULL,
    `included_plan_ids` text,
    `zoom_meeting_url` text,
    `zoom_meeting_id` text,
    `zoom_password` text,
    `zoom_enabled` integer DEFAULT 0,
    `thumbnail_url` text,
    `cloudflare_stream_id` text,
    `recording_status` text,
    `video_provider` text DEFAULT 'offline' NOT NULL,
    `livekit_room_name` text,
    `livekit_room_sid` text,
    `status` text DEFAULT 'active' NOT NULL,
    `min_students` integer DEFAULT 1,
    `auto_cancel_threshold` integer,
    `auto_cancel_enabled` integer DEFAULT 0,
    `google_event_id` text,
    `created_at` integer DEFAULT (strftime('%s', 'now'))
);

INSERT INTO "classes_new" (
    id, tenant_id, instructor_id, location_id, series_id, title, description, start_time, duration_minutes, capacity, 
    waitlist_capacity, price, member_price, currency, payroll_model, payroll_value, type, allow_credits, included_plan_ids, 
    zoom_meeting_url, zoom_meeting_id, zoom_password, zoom_enabled, thumbnail_url, cloudflare_stream_id, recording_status, 
    video_provider, livekit_room_name, livekit_room_sid, status, min_students, auto_cancel_threshold, auto_cancel_enabled, 
    google_event_id, created_at
)
SELECT 
    id, tenant_id, instructor_id, location_id, series_id, title, description, start_time, duration_minutes, capacity, 
    waitlist_capacity, price, member_price, currency, payroll_model, payroll_value, type, allow_credits, included_plan_ids, 
    zoom_meeting_url, zoom_meeting_id, zoom_password, zoom_enabled, thumbnail_url, cloudflare_stream_id, recording_status, 
    video_provider, livekit_room_name, livekit_room_sid, status, min_students, auto_cancel_threshold, auto_cancel_enabled, 
    google_event_id, created_at
FROM classes;

DROP TABLE classes;
ALTER TABLE classes_new RENAME TO classes;

CREATE INDEX tenant_time_idx ON classes (tenant_id, start_time);
CREATE INDEX series_idx ON classes (series_id);
CREATE INDEX class_instructor_idx ON classes (instructor_id, start_time);
CREATE INDEX class_location_time_idx ON classes (location_id, start_time);

PRAGMA foreign_keys=ON;
