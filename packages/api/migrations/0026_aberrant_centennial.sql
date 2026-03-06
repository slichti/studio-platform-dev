DROP INDEX IF EXISTS `invitation_tenant_email_idx`;--> statement-breakpoint
CREATE UNIQUE INDEX `invitation_tenant_email_idx` ON `tenant_invitations` (`tenant_id`,`email`);--> statement-breakpoint
ALTER TABLE `platform_plans` ADD `application_fee_percent` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `tenants` ADD `custom_application_fee_percent` integer;