ALTER TABLE `tenant_members` ADD `sms_consent` integer DEFAULT false;--> statement-breakpoint
ALTER TABLE `tenant_members` ADD `sms_consent_at` integer;--> statement-breakpoint
ALTER TABLE `tenant_members` ADD `sms_opt_out_at` integer;--> statement-breakpoint
ALTER TABLE `tenants` DROP COLUMN `payment_provider`;--> statement-breakpoint
ALTER TABLE `tenants` DROP COLUMN `stripe_credentials`;