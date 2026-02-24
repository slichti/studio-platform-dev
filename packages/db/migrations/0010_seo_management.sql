-- Add SEO and GBP fields to tenants
ALTER TABLE tenants ADD COLUMN seo_config TEXT;
ALTER TABLE tenants ADD COLUMN gbp_token TEXT;

-- Add poster_url and tags to videos for better SEO/LMS
ALTER TABLE videos ADD COLUMN poster_url TEXT;
ALTER TABLE videos ADD COLUMN tags TEXT;
