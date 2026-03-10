-- Add paused_until to subscriptions (schema had it but no migration existed)
ALTER TABLE `subscriptions` ADD `paused_until` integer;
