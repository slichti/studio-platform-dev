CREATE TABLE `custom_roles` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`permissions` text NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `custom_role_tenant_idx` ON `custom_roles` (`tenant_id`);--> statement-breakpoint
CREATE TABLE `member_custom_roles` (
	`member_id` text NOT NULL,
	`custom_role_id` text NOT NULL,
	`assigned_at` integer DEFAULT (strftime('%s', 'now')),
	`assigned_by` text,
	PRIMARY KEY(`member_id`, `custom_role_id`),
	FOREIGN KEY (`member_id`) REFERENCES `tenant_members`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`custom_role_id`) REFERENCES `custom_roles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_tenant_roles` (
	`member_id` text NOT NULL,
	`role` text NOT NULL,
	`custom_role_id` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	PRIMARY KEY(`member_id`, `role`, `custom_role_id`),
	FOREIGN KEY (`member_id`) REFERENCES `tenant_members`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`custom_role_id`) REFERENCES `custom_roles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_tenant_roles`("member_id", "role", "custom_role_id", "created_at") 
SELECT "member_id", "role", NULL, "created_at" FROM `tenant_roles` 
WHERE "member_id" IN (SELECT "id" FROM "tenant_members");--> statement-breakpoint
DROP TABLE `tenant_roles`;--> statement-breakpoint
ALTER TABLE `__new_tenant_roles` RENAME TO `tenant_roles`;--> statement-breakpoint
PRAGMA foreign_keys=ON;