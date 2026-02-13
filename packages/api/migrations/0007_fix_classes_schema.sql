ALTER TABLE classes ADD COLUMN waitlist_capacity INTEGER DEFAULT 10;
ALTER TABLE classes ADD COLUMN video_provider TEXT DEFAULT 'offline' NOT NULL;
