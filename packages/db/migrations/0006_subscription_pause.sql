-- Add pause support to subscriptions
ALTER TABLE subscriptions ADD COLUMN paused_until INTEGER; -- unix timestamp (epoch seconds)
