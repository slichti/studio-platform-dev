-- Migration 0074: Add SEO and GBP fields to tenants and video metadata
ALTER TABLE `tenants` ADD COLUMN `seo_config` text;
ALTER TABLE `tenants` ADD COLUMN `gbp_token` text;
ALTER TABLE `videos` ADD COLUMN `poster_url` text;
ALTER TABLE `videos` ADD COLUMN `tags` text;
