ALTER TABLE `tenants` ADD `payment_provider` text DEFAULT 'connect' NOT NULL;--> statement-breakpoint
ALTER TABLE `tenants` ADD `stripe_credentials` text;