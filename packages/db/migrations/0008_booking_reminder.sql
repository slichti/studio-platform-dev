-- Add reminder tracking to bookings for 24h class reminder cron
ALTER TABLE bookings ADD COLUMN reminder_sent_at INTEGER; -- unix timestamp (epoch seconds)
