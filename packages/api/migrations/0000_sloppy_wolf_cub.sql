CREATE TABLE `appointment_services` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`duration_minutes` integer NOT NULL,
	`price` integer DEFAULT 0,
	`currency` text DEFAULT 'usd',
	`is_active` integer DEFAULT true,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `appointments` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`service_id` text NOT NULL,
	`instructor_id` text NOT NULL,
	`member_id` text NOT NULL,
	`start_time` integer NOT NULL,
	`end_time` integer NOT NULL,
	`status` text DEFAULT 'confirmed',
	`location_id` text,
	`notes` text,
	`zoom_meeting_url` text,
	`google_event_id` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`service_id`) REFERENCES `appointment_services`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`instructor_id`) REFERENCES `tenant_members`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`member_id`) REFERENCES `tenant_members`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `apt_tenant_time_idx` ON `appointments` (`tenant_id`,`start_time`);--> statement-breakpoint
CREATE INDEX `apt_instructor_time_idx` ON `appointments` (`instructor_id`,`start_time`);--> statement-breakpoint
CREATE INDEX `apt_member_idx` ON `appointments` (`member_id`);--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_id` text,
	`tenant_id` text,
	`action` text NOT NULL,
	`target_id` text,
	`target_type` text,
	`details` text,
	`ip_address` text,
	`country` text,
	`city` text,
	`region` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `audit_tenant_idx` ON `audit_logs` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `audit_target_idx` ON `audit_logs` (`target_type`,`target_id`);--> statement-breakpoint
CREATE TABLE `automation_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`automation_id` text NOT NULL,
	`user_id` text NOT NULL,
	`channel` text NOT NULL,
	`triggered_at` integer DEFAULT (strftime('%s', 'now')),
	`metadata` text,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`automation_id`) REFERENCES `marketing_automations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `automation_log_unique_idx` ON `automation_logs` (`automation_id`,`user_id`,`channel`);--> statement-breakpoint
CREATE INDEX `automation_log_tenant_idx` ON `automation_logs` (`tenant_id`);--> statement-breakpoint
CREATE TABLE `availabilities` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`instructor_id` text NOT NULL,
	`day_of_week` integer NOT NULL,
	`start_time` text NOT NULL,
	`end_time` text NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`instructor_id`) REFERENCES `tenant_members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `avail_instructor_idx` ON `availabilities` (`instructor_id`);--> statement-breakpoint
CREATE TABLE `backup_metadata` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`tenant_id` text,
	`backup_date` integer NOT NULL,
	`file_size` integer NOT NULL,
	`r2_key` text NOT NULL,
	`status` text NOT NULL,
	`record_count` integer,
	`error_message` text,
	`created_at` integer DEFAULT (strftime('%s', 'now'))
);
--> statement-breakpoint
CREATE INDEX `backup_type_idx` ON `backup_metadata` (`type`,`backup_date`);--> statement-breakpoint
CREATE INDEX `backup_tenant_idx` ON `backup_metadata` (`tenant_id`,`backup_date`);--> statement-breakpoint
CREATE TABLE `bookings` (
	`id` text PRIMARY KEY NOT NULL,
	`class_id` text NOT NULL,
	`member_id` text NOT NULL,
	`status` text DEFAULT 'confirmed',
	`attendance_type` text DEFAULT 'in_person' NOT NULL,
	`checked_in_at` integer,
	`is_guest` integer DEFAULT false,
	`guest_name` text,
	`guest_email` text,
	`spot_number` text,
	`waitlist_position` integer,
	`waitlist_notified_at` integer,
	`payment_method` text,
	`used_pack_id` text,
	`external_source` text,
	`external_id` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`class_id`) REFERENCES `classes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`member_id`) REFERENCES `tenant_members`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`used_pack_id`) REFERENCES `purchased_packs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `member_class_idx` ON `bookings` (`member_id`,`class_id`);--> statement-breakpoint
CREATE INDEX `booking_waitlist_idx` ON `bookings` (`class_id`,`waitlist_position`);--> statement-breakpoint
CREATE INDEX `booking_class_status_idx` ON `bookings` (`class_id`,`status`);--> statement-breakpoint
CREATE TABLE `branding_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`cloudflare_stream_id` text NOT NULL,
	`active` integer DEFAULT false,
	`tags` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `branding_tenant_type_idx` ON `branding_assets` (`tenant_id`,`type`);--> statement-breakpoint
CREATE TABLE `challenges` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`type` text NOT NULL,
	`period` text,
	`frequency` integer DEFAULT 1,
	`target_value` integer NOT NULL,
	`reward_type` text NOT NULL,
	`reward_value` text,
	`start_date` integer,
	`end_date` integer,
	`active` integer DEFAULT true,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `challenge_tenant_idx` ON `challenges` (`tenant_id`);--> statement-breakpoint
CREATE TABLE `chat_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`user_id` text NOT NULL,
	`content` text NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`room_id`) REFERENCES `chat_rooms`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `chat_message_room_idx` ON `chat_messages` (`room_id`);--> statement-breakpoint
CREATE INDEX `chat_message_user_idx` ON `chat_messages` (`user_id`);--> statement-breakpoint
CREATE TABLE `chat_rooms` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`type` text NOT NULL,
	`name` text NOT NULL,
	`metadata` text,
	`status` text DEFAULT 'open' NOT NULL,
	`priority` text DEFAULT 'normal' NOT NULL,
	`assigned_to_id` text,
	`customer_email` text,
	`is_archived` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`assigned_to_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `chat_room_tenant_idx` ON `chat_rooms` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `chat_room_type_idx` ON `chat_rooms` (`tenant_id`,`type`);--> statement-breakpoint
CREATE INDEX `chat_room_status_idx` ON `chat_rooms` (`tenant_id`,`status`);--> statement-breakpoint
CREATE INDEX `chat_room_assignee_idx` ON `chat_rooms` (`assigned_to_id`);--> statement-breakpoint
CREATE TABLE `class_pack_definitions` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`name` text NOT NULL,
	`price` integer DEFAULT 0,
	`credits` integer NOT NULL,
	`expiration_days` integer,
	`image_url` text,
	`vod_enabled` integer DEFAULT false,
	`active` integer DEFAULT true,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `class_series` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`instructor_id` text NOT NULL,
	`location_id` text,
	`title` text NOT NULL,
	`description` text,
	`duration_minutes` integer NOT NULL,
	`price` integer DEFAULT 0,
	`currency` text DEFAULT 'usd',
	`recurrence_rule` text NOT NULL,
	`valid_from` integer NOT NULL,
	`valid_until` integer,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`instructor_id`) REFERENCES `tenant_members`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `classes` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`instructor_id` text,
	`location_id` text,
	`series_id` text,
	`title` text NOT NULL,
	`description` text,
	`start_time` integer NOT NULL,
	`duration_minutes` integer NOT NULL,
	`capacity` integer,
	`waitlist_capacity` integer DEFAULT 10,
	`price` integer DEFAULT 0,
	`member_price` integer,
	`currency` text DEFAULT 'usd',
	`payroll_model` text,
	`payroll_value` integer,
	`type` text DEFAULT 'class' NOT NULL,
	`allow_credits` integer DEFAULT true NOT NULL,
	`included_plan_ids` text,
	`zoom_meeting_url` text,
	`zoom_meeting_id` text,
	`zoom_password` text,
	`zoom_enabled` integer DEFAULT false,
	`thumbnail_url` text,
	`cloudflare_stream_id` text,
	`recording_status` text,
	`video_provider` text DEFAULT 'offline' NOT NULL,
	`livekit_room_name` text,
	`livekit_room_sid` text,
	`status` text DEFAULT 'active' NOT NULL,
	`min_students` integer DEFAULT 1,
	`auto_cancel_threshold` integer,
	`auto_cancel_enabled` integer DEFAULT false,
	`google_event_id` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`instructor_id`) REFERENCES `tenant_members`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`series_id`) REFERENCES `class_series`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `tenant_time_idx` ON `classes` (`tenant_id`,`start_time`);--> statement-breakpoint
CREATE INDEX `series_idx` ON `classes` (`series_id`);--> statement-breakpoint
CREATE INDEX `class_tenant_start_idx` ON `classes` (`tenant_id`,`start_time`);--> statement-breakpoint
CREATE TABLE `community_comments` (
	`id` text PRIMARY KEY NOT NULL,
	`post_id` text NOT NULL,
	`author_id` text NOT NULL,
	`content` text NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`post_id`) REFERENCES `community_posts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`author_id`) REFERENCES `tenant_members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `community_comment_post_idx` ON `community_comments` (`post_id`);--> statement-breakpoint
CREATE TABLE `community_likes` (
	`post_id` text NOT NULL,
	`member_id` text NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	PRIMARY KEY(`post_id`, `member_id`),
	FOREIGN KEY (`post_id`) REFERENCES `community_posts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`) REFERENCES `tenant_members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `community_posts` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`author_id` text NOT NULL,
	`content` text NOT NULL,
	`type` text DEFAULT 'post' NOT NULL,
	`image_url` text,
	`likes_count` integer DEFAULT 0,
	`comments_count` integer DEFAULT 0,
	`is_pinned` integer DEFAULT false,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`author_id`) REFERENCES `tenant_members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `community_post_tenant_idx` ON `community_posts` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `community_post_pinned_idx` ON `community_posts` (`tenant_id`,`is_pinned`);--> statement-breakpoint
CREATE TABLE `coupon_redemptions` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`coupon_id` text NOT NULL,
	`user_id` text NOT NULL,
	`order_id` text,
	`redeemed_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`coupon_id`) REFERENCES `coupons`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `coupons` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`code` text NOT NULL,
	`type` text NOT NULL,
	`value` integer NOT NULL,
	`active` integer DEFAULT true,
	`usage_limit` integer,
	`expires_at` integer,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tenant_code_idx` ON `coupons` (`tenant_id`,`code`);--> statement-breakpoint
CREATE TABLE `custom_field_definitions` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`entity_type` text NOT NULL,
	`key` text NOT NULL,
	`label` text NOT NULL,
	`field_type` text NOT NULL,
	`options` text,
	`is_required` integer DEFAULT false NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `cf_def_tenant_entity_idx` ON `custom_field_definitions` (`tenant_id`,`entity_type`);--> statement-breakpoint
CREATE UNIQUE INDEX `cf_def_unique_key_idx` ON `custom_field_definitions` (`tenant_id`,`entity_type`,`key`);--> statement-breakpoint
CREATE TABLE `custom_field_values` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`definition_id` text NOT NULL,
	`entity_id` text NOT NULL,
	`value` text,
	`updated_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`definition_id`) REFERENCES `custom_field_definitions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `cf_val_entity_idx` ON `custom_field_values` (`entity_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `cf_val_unique_idx` ON `custom_field_values` (`entity_id`,`definition_id`);--> statement-breakpoint
CREATE TABLE `custom_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`name` text NOT NULL,
	`config` text NOT NULL,
	`is_public` integer DEFAULT false NOT NULL,
	`created_by` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `custom_reports_tenant_idx` ON `custom_reports` (`tenant_id`);--> statement-breakpoint
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
CREATE TABLE `email_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`campaign_id` text,
	`recipient_email` text NOT NULL,
	`subject` text NOT NULL,
	`template_id` text,
	`data` text,
	`status` text DEFAULT 'sent',
	`error` text,
	`sent_at` integer DEFAULT (strftime('%s', 'now')),
	`metadata` text,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `email_log_tenant_idx` ON `email_logs` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `email_log_campaign_idx` ON `email_logs` (`campaign_id`);--> statement-breakpoint
CREATE INDEX `email_log_email_idx` ON `email_logs` (`recipient_email`);--> statement-breakpoint
CREATE INDEX `email_log_sent_at_idx` ON `email_logs` (`sent_at`);--> statement-breakpoint
CREATE TABLE `faqs` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text,
	`category` text NOT NULL,
	`question` text NOT NULL,
	`answer` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `faqs_category_idx` ON `faqs` (`category`);--> statement-breakpoint
CREATE INDEX `faqs_tenant_idx` ON `faqs` (`tenant_id`);--> statement-breakpoint
CREATE TABLE `gift_card_transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`gift_card_id` text NOT NULL,
	`amount` integer NOT NULL,
	`type` text NOT NULL,
	`reference_id` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`gift_card_id`) REFERENCES `gift_cards`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `gift_card_tx_card_idx` ON `gift_card_transactions` (`gift_card_id`);--> statement-breakpoint
CREATE TABLE `gift_cards` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`code` text NOT NULL,
	`initial_value` integer NOT NULL,
	`current_balance` integer NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`expiry_date` integer,
	`buyer_member_id` text,
	`stripe_payment_id` text,
	`recipient_member_id` text,
	`recipient_email` text,
	`notes` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`buyer_member_id`) REFERENCES `tenant_members`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`recipient_member_id`) REFERENCES `tenant_members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `gift_card_tenant_code_idx` ON `gift_cards` (`tenant_id`,`code`);--> statement-breakpoint
CREATE INDEX `gift_card_tenant_idx` ON `gift_cards` (`tenant_id`);--> statement-breakpoint
CREATE TABLE `inventory_adjustments` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`product_id` text NOT NULL,
	`staff_id` text,
	`delta` integer NOT NULL,
	`reason` text NOT NULL,
	`notes` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`staff_id`) REFERENCES `tenant_members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `inv_adj_product_idx` ON `inventory_adjustments` (`product_id`);--> statement-breakpoint
CREATE INDEX `inv_adj_tenant_idx` ON `inventory_adjustments` (`tenant_id`);--> statement-breakpoint
CREATE TABLE `leads` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`email` text NOT NULL,
	`first_name` text,
	`last_name` text,
	`phone` text,
	`status` text DEFAULT 'new' NOT NULL,
	`source` text,
	`notes` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `lead_tenant_email_idx` ON `leads` (`tenant_id`,`email`);--> statement-breakpoint
CREATE INDEX `lead_status_idx` ON `leads` (`status`);--> statement-breakpoint
CREATE TABLE `locations` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`name` text NOT NULL,
	`address` text,
	`layout` text,
	`timezone` text DEFAULT 'UTC',
	`is_primary` integer DEFAULT false,
	`settings` text,
	`is_active` integer DEFAULT true,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `marketing_automations` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text,
	`trigger_event` text NOT NULL,
	`trigger_condition` text,
	`template_id` text,
	`audience_filter` text,
	`subject` text NOT NULL,
	`content` text,
	`is_enabled` integer DEFAULT false NOT NULL,
	`metadata` text,
	`timing_type` text DEFAULT 'immediate' NOT NULL,
	`timing_value` integer DEFAULT 0,
	`delay_hours` integer DEFAULT 0,
	`channels` text DEFAULT '["email"]',
	`recipients` text DEFAULT '["student"]',
	`coupon_config` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `automation_tenant_idx` ON `marketing_automations` (`tenant_id`);--> statement-breakpoint
CREATE TABLE `marketing_campaigns` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`subject` text NOT NULL,
	`content` text NOT NULL,
	`status` text DEFAULT 'draft',
	`sent_at` integer,
	`stats` text,
	`filters` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
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
CREATE TABLE `member_progress_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`member_id` text NOT NULL,
	`metric_definition_id` text NOT NULL,
	`value` integer NOT NULL,
	`recorded_at` integer DEFAULT (strftime('%s', 'now')),
	`source` text DEFAULT 'auto',
	`metadata` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`) REFERENCES `tenant_members`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`metric_definition_id`) REFERENCES `progress_metric_definitions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `progress_entry_member_idx` ON `member_progress_entries` (`member_id`);--> statement-breakpoint
CREATE INDEX `progress_entry_metric_idx` ON `member_progress_entries` (`metric_definition_id`);--> statement-breakpoint
CREATE INDEX `progress_entry_tenant_idx` ON `member_progress_entries` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `progress_entry_recorded_idx` ON `member_progress_entries` (`member_id`,`recorded_at`);--> statement-breakpoint
CREATE TABLE `member_tags` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`name` text NOT NULL,
	`color` text,
	`description` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `member_tag_tenant_idx` ON `member_tags` (`tenant_id`);--> statement-breakpoint
CREATE TABLE `members_to_tags` (
	`member_id` text NOT NULL,
	`tag_id` text NOT NULL,
	PRIMARY KEY(`member_id`, `tag_id`),
	FOREIGN KEY (`member_id`) REFERENCES `tenant_members`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `member_tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `membership_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`price` integer DEFAULT 0,
	`currency` text DEFAULT 'usd',
	`interval` text DEFAULT 'month',
	`image_url` text,
	`overlay_title` text,
	`overlay_subtitle` text,
	`vod_enabled` integer DEFAULT false,
	`active` integer DEFAULT true,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `payouts` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`instructor_id` text NOT NULL,
	`amount` integer NOT NULL,
	`currency` text DEFAULT 'usd',
	`period_start` integer NOT NULL,
	`period_end` integer NOT NULL,
	`status` text DEFAULT 'processing',
	`paid_at` integer,
	`stripe_transfer_id` text,
	`notes` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`instructor_id`) REFERENCES `tenant_members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `payroll_config` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`user_id` text NOT NULL,
	`member_id` text,
	`pay_model` text NOT NULL,
	`rate` integer NOT NULL,
	`payout_basis` text DEFAULT 'net',
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`member_id`) REFERENCES `tenant_members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `payroll_config_member_idx` ON `payroll_config` (`member_id`);--> statement-breakpoint
CREATE TABLE `payroll_items` (
	`id` text PRIMARY KEY NOT NULL,
	`payout_id` text NOT NULL,
	`type` text NOT NULL,
	`reference_id` text NOT NULL,
	`amount` integer NOT NULL,
	`details` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`payout_id`) REFERENCES `payouts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `payroll_item_payout_idx` ON `payroll_items` (`payout_id`);--> statement-breakpoint
CREATE INDEX `payroll_item_ref_idx` ON `payroll_items` (`reference_id`);--> statement-breakpoint
CREATE TABLE `platform_config` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text,
	`enabled` integer DEFAULT false NOT NULL,
	`description` text,
	`updated_at` integer DEFAULT (strftime('%s', 'now'))
);
--> statement-breakpoint
CREATE TABLE `platform_pages` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`content` text,
	`is_published` integer DEFAULT false NOT NULL,
	`seo_title` text,
	`seo_description` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `platform_pages_slug_unique` ON `platform_pages` (`slug`);--> statement-breakpoint
CREATE TABLE `platform_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`description` text,
	`stripe_price_id_monthly` text,
	`stripe_price_id_annual` text,
	`monthly_price_cents` integer DEFAULT 0,
	`annual_price_cents` integer DEFAULT 0,
	`trial_days` integer DEFAULT 14 NOT NULL,
	`features` text NOT NULL,
	`highlight` integer DEFAULT false,
	`active` integer DEFAULT true,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `platform_plans_slug_unique` ON `platform_plans` (`slug`);--> statement-breakpoint
CREATE TABLE `pos_order_items` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`product_id` text NOT NULL,
	`quantity` integer NOT NULL,
	`unit_price` integer NOT NULL,
	`total_price` integer NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`order_id`) REFERENCES `pos_orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `pos_item_order_idx` ON `pos_order_items` (`order_id`);--> statement-breakpoint
CREATE INDEX `pos_item_product_idx` ON `pos_order_items` (`product_id`);--> statement-breakpoint
CREATE TABLE `pos_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`member_id` text,
	`staff_id` text,
	`total_amount` integer NOT NULL,
	`tax_amount` integer DEFAULT 0,
	`status` text DEFAULT 'completed' NOT NULL,
	`payment_method` text DEFAULT 'card',
	`stripe_payment_intent_id` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`member_id`) REFERENCES `tenant_members`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`staff_id`) REFERENCES `tenant_members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `pos_order_tenant_idx` ON `pos_orders` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `pos_order_member_idx` ON `pos_orders` (`member_id`);--> statement-breakpoint
CREATE TABLE `processed_webhooks` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now'))
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`supplier_id` text,
	`name` text NOT NULL,
	`description` text,
	`category` text,
	`sku` text,
	`price` integer DEFAULT 0 NOT NULL,
	`currency` text DEFAULT 'usd',
	`stock_quantity` integer DEFAULT 0 NOT NULL,
	`low_stock_threshold` integer DEFAULT 5,
	`image_url` text,
	`stripe_product_id` text,
	`stripe_price_id` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `product_tenant_idx` ON `products` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `product_supplier_idx` ON `products` (`supplier_id`);--> statement-breakpoint
CREATE TABLE `progress_metric_definitions` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`unit` text NOT NULL,
	`icon` text,
	`aggregation` text DEFAULT 'sum',
	`visible_to_students` integer DEFAULT true NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`display_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `progress_metric_tenant_idx` ON `progress_metric_definitions` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `progress_metric_category_idx` ON `progress_metric_definitions` (`tenant_id`,`category`);--> statement-breakpoint
CREATE TABLE `purchase_order_items` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`purchase_order_id` text NOT NULL,
	`product_id` text NOT NULL,
	`quantity_ordered` integer NOT NULL,
	`quantity_received` integer DEFAULT 0 NOT NULL,
	`unit_cost` integer NOT NULL,
	`total_cost` integer NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`purchase_order_id`) REFERENCES `purchase_orders`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `po_item_po_idx` ON `purchase_order_items` (`purchase_order_id`);--> statement-breakpoint
CREATE INDEX `po_item_product_idx` ON `purchase_order_items` (`product_id`);--> statement-breakpoint
CREATE TABLE `purchase_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`supplier_id` text NOT NULL,
	`staff_id` text,
	`po_number` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`total_amount` integer DEFAULT 0 NOT NULL,
	`currency` text DEFAULT 'usd',
	`notes` text,
	`sent_at` integer,
	`received_at` integer,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`staff_id`) REFERENCES `tenant_members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `po_tenant_idx` ON `purchase_orders` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `po_supplier_idx` ON `purchase_orders` (`supplier_id`);--> statement-breakpoint
CREATE TABLE `purchased_packs` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`member_id` text NOT NULL,
	`pack_definition_id` text NOT NULL,
	`initial_credits` integer NOT NULL,
	`remaining_credits` integer NOT NULL,
	`purchased_price_cents` integer DEFAULT 0,
	`status` text DEFAULT 'active' NOT NULL,
	`stripe_payment_id` text,
	`expires_at` integer,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`member_id`) REFERENCES `tenant_members`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`pack_definition_id`) REFERENCES `class_pack_definitions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `member_pack_idx` ON `purchased_packs` (`member_id`);--> statement-breakpoint
CREATE INDEX `pack_member_credits_idx` ON `purchased_packs` (`member_id`,`remaining_credits`);--> statement-breakpoint
CREATE TABLE `push_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`recipient_token` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`status` text DEFAULT 'queued',
	`sent_at` integer DEFAULT (strftime('%s', 'now')),
	`metadata` text,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `referral_codes` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`user_id` text NOT NULL,
	`member_id` text,
	`code` text NOT NULL,
	`clicks` integer DEFAULT 0,
	`signups` integer DEFAULT 0,
	`earnings` integer DEFAULT 0,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`active` integer DEFAULT true,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`member_id`) REFERENCES `tenant_members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `referral_code_unique_idx` ON `referral_codes` (`tenant_id`,`code`);--> statement-breakpoint
CREATE INDEX `referral_user_idx` ON `referral_codes` (`user_id`);--> statement-breakpoint
CREATE TABLE `referral_rewards` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`referrer_user_id` text NOT NULL,
	`referred_user_id` text NOT NULL,
	`status` text DEFAULT 'pending',
	`amount` integer NOT NULL,
	`currency` text DEFAULT 'usd',
	`paid_at` integer,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`referrer_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`referred_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `reward_referrer_idx` ON `referral_rewards` (`referrer_user_id`);--> statement-breakpoint
CREATE TABLE `referrals` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`referrer_id` text NOT NULL,
	`referee_id` text,
	`code` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`reward_type` text,
	`reward_value` integer,
	`rewarded_at` integer,
	`expires_at` integer,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`referrer_id`) REFERENCES `tenant_members`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`referee_id`) REFERENCES `tenant_members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `referral_tenant_idx` ON `referrals` (`tenant_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `referral_code_idx` ON `referrals` (`tenant_id`,`code`);--> statement-breakpoint
CREATE INDEX `referral_referrer_idx` ON `referrals` (`referrer_id`);--> statement-breakpoint
CREATE TABLE `refunds` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`amount` integer NOT NULL,
	`reason` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`type` text NOT NULL,
	`reference_id` text NOT NULL,
	`stripe_refund_id` text,
	`member_id` text,
	`performed_by` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`member_id`) REFERENCES `tenant_members`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`performed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `refund_tenant_idx` ON `refunds` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `refund_ref_idx` ON `refunds` (`reference_id`);--> statement-breakpoint
CREATE TABLE `restore_history` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`tenant_id` text,
	`backup_key` text NOT NULL,
	`backup_date` integer NOT NULL,
	`restored_by` text NOT NULL,
	`restored_at` integer NOT NULL,
	`status` text NOT NULL,
	`records_restored` integer,
	`duration_ms` integer,
	`details` text,
	`error_message` text
);
--> statement-breakpoint
CREATE INDEX `restore_type_idx` ON `restore_history` (`type`,`restored_at`);--> statement-breakpoint
CREATE INDEX `restore_tenant_idx` ON `restore_history` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `restore_user_idx` ON `restore_history` (`restored_by`);--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`member_id` text NOT NULL,
	`target_type` text DEFAULT 'studio' NOT NULL,
	`target_id` text,
	`rating` integer NOT NULL,
	`content` text,
	`is_testimonial` integer DEFAULT false,
	`is_approved` integer DEFAULT false,
	`is_public` integer DEFAULT true,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`member_id`) REFERENCES `tenant_members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `review_tenant_idx` ON `reviews` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `review_member_idx` ON `reviews` (`member_id`);--> statement-breakpoint
CREATE INDEX `review_approved_idx` ON `reviews` (`tenant_id`,`is_approved`);--> statement-breakpoint
CREATE TABLE `scheduled_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`report_type` text NOT NULL,
	`frequency` text NOT NULL,
	`recipients` text NOT NULL,
	`custom_report_id` text,
	`last_sent` integer,
	`next_run` integer NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`custom_report_id`) REFERENCES `custom_reports`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `scheduled_reports_tenant_idx` ON `scheduled_reports` (`tenant_id`);--> statement-breakpoint
CREATE TABLE `sms_config` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`provider` text DEFAULT 'mock',
	`sender_id` text,
	`enabled_events` text,
	`updated_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `sms_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`recipient_phone` text NOT NULL,
	`body` text NOT NULL,
	`status` text DEFAULT 'queued',
	`sent_at` integer DEFAULT (strftime('%s', 'now')),
	`metadata` text,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `student_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`student_id` text NOT NULL,
	`author_id` text NOT NULL,
	`note` text NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`student_id`) REFERENCES `tenant_members`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`author_id`) REFERENCES `tenant_members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `student_idx` ON `student_notes` (`student_id`);--> statement-breakpoint
CREATE TABLE `sub_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`class_id` text NOT NULL,
	`original_instructor_id` text NOT NULL,
	`covered_by_user_id` text,
	`status` text DEFAULT 'open' NOT NULL,
	`message` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`class_id`) REFERENCES `classes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`original_instructor_id`) REFERENCES `tenant_members`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`covered_by_user_id`) REFERENCES `tenant_members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `sub_req_tenant_status_idx` ON `sub_requests` (`tenant_id`,`status`);--> statement-breakpoint
CREATE INDEX `sub_req_class_idx` ON `sub_requests` (`class_id`);--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`tenant_id` text NOT NULL,
	`member_id` text,
	`plan_id` text,
	`status` text NOT NULL,
	`tier` text DEFAULT 'basic',
	`current_period_end` integer,
	`stripe_subscription_id` text,
	`canceled_at` integer,
	`dunning_state` text,
	`last_dunning_at` integer,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`member_id`) REFERENCES `tenant_members`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`plan_id`) REFERENCES `membership_plans`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `substitutions` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`class_id` text NOT NULL,
	`requesting_instructor_id` text NOT NULL,
	`covering_instructor_id` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`notes` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`class_id`) REFERENCES `classes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`requesting_instructor_id`) REFERENCES `tenant_members`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`covering_instructor_id`) REFERENCES `tenant_members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `sub_tenant_idx` ON `substitutions` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `sub_class_idx` ON `substitutions` (`class_id`);--> statement-breakpoint
CREATE INDEX `sub_status_idx` ON `substitutions` (`status`);--> statement-breakpoint
CREATE TABLE `suppliers` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`name` text NOT NULL,
	`contact_name` text,
	`email` text,
	`phone` text,
	`address` text,
	`website` text,
	`notes` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `supplier_tenant_idx` ON `suppliers` (`tenant_id`);--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`status` text DEFAULT 'todo' NOT NULL,
	`priority` text DEFAULT 'medium' NOT NULL,
	`due_date` integer,
	`assigned_to_id` text,
	`related_lead_id` text,
	`related_member_id` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`assigned_to_id`) REFERENCES `tenant_members`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`related_lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`related_member_id`) REFERENCES `tenant_members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `task_tenant_idx` ON `tasks` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `task_assignee_idx` ON `tasks` (`assigned_to_id`);--> statement-breakpoint
CREATE INDEX `task_lead_idx` ON `tasks` (`related_lead_id`);--> statement-breakpoint
CREATE INDEX `task_tenant_status_idx` ON `tasks` (`tenant_id`,`status`);--> statement-breakpoint
CREATE TABLE `tenant_features` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`feature_key` text NOT NULL,
	`enabled` integer DEFAULT false NOT NULL,
	`source` text DEFAULT 'manual',
	`updated_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `unique_feature_idx` ON `tenant_features` (`tenant_id`,`feature_key`);--> statement-breakpoint
CREATE TABLE `tenant_invitations` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`email` text NOT NULL,
	`role` text DEFAULT 'student' NOT NULL,
	`token` text NOT NULL,
	`expires_at` integer NOT NULL,
	`accepted_at` integer,
	`invited_by` text NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tenant_invitations_token_unique` ON `tenant_invitations` (`token`);--> statement-breakpoint
CREATE INDEX `invitation_tenant_email_idx` ON `tenant_invitations` (`tenant_id`,`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `invitation_token_idx` ON `tenant_invitations` (`token`);--> statement-breakpoint
CREATE TABLE `tenant_members` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`user_id` text NOT NULL,
	`profile` text,
	`settings` text,
	`custom_fields` text,
	`status` text DEFAULT 'active' NOT NULL,
	`joined_at` integer DEFAULT (strftime('%s', 'now')),
	`churn_score` integer DEFAULT 100,
	`churn_status` text DEFAULT 'safe',
	`last_churn_check` integer,
	`engagement_score` integer DEFAULT 50,
	`last_engagement_calc` integer,
	`sms_consent` integer DEFAULT false,
	`sms_consent_at` integer,
	`sms_opt_out_at` integer,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `tenant_user_idx` ON `tenant_members` (`tenant_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `member_engagement_idx` ON `tenant_members` (`engagement_score`);--> statement-breakpoint
CREATE TABLE `tenant_roles` (
	`id` text PRIMARY KEY NOT NULL,
	`member_id` text NOT NULL,
	`role` text NOT NULL,
	`custom_role_id` text,
	`permissions` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`member_id`) REFERENCES `tenant_members`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`custom_role_id`) REFERENCES `custom_roles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `member_role_idx` ON `tenant_roles` (`member_id`,`role`);--> statement-breakpoint
CREATE INDEX `member_custom_role_idx` ON `tenant_roles` (`member_id`,`custom_role_id`);--> statement-breakpoint
CREATE TABLE `tenants` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`custom_domain` text,
	`branding` text,
	`mobile_app_config` text,
	`settings` text,
	`custom_field_definitions` text,
	`stripe_account_id` text,
	`stripe_customer_id` text,
	`stripe_subscription_id` text,
	`current_period_end` integer,
	`marketing_provider` text DEFAULT 'system' NOT NULL,
	`resend_credentials` text,
	`twilio_credentials` text,
	`flodesk_credentials` text,
	`currency` text DEFAULT 'usd' NOT NULL,
	`zoom_credentials` text,
	`mailchimp_credentials` text,
	`zapier_credentials` text,
	`google_credentials` text,
	`slack_credentials` text,
	`google_calendar_credentials` text,
	`resend_audience_id` text,
	`status` text DEFAULT 'active' NOT NULL,
	`tier` text DEFAULT 'launch' NOT NULL,
	`subscription_status` text DEFAULT 'active' NOT NULL,
	`is_public` integer DEFAULT false NOT NULL,
	`sms_usage` integer DEFAULT 0 NOT NULL,
	`email_usage` integer DEFAULT 0 NOT NULL,
	`streaming_usage` integer DEFAULT 0 NOT NULL,
	`sms_limit` integer,
	`email_limit` integer,
	`streaming_limit` integer,
	`billing_exempt` integer DEFAULT false NOT NULL,
	`storage_usage` integer DEFAULT 0 NOT NULL,
	`member_count` integer DEFAULT 0 NOT NULL,
	`instructor_count` integer DEFAULT 0 NOT NULL,
	`last_billed_at` integer,
	`archived_at` integer,
	`grace_period_ends_at` integer,
	`student_access_disabled` integer DEFAULT false NOT NULL,
	`aggregator_config` text,
	`created_at` integer DEFAULT (strftime('%s', 'now'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tenants_slug_unique` ON `tenants` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `tenants_custom_domain_unique` ON `tenants` (`custom_domain`);--> statement-breakpoint
CREATE TABLE `uploads` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`file_key` text NOT NULL,
	`file_url` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`mime_type` text NOT NULL,
	`original_name` text,
	`uploaded_by` text,
	`title` text,
	`description` text,
	`tags` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `upload_tenant_idx` ON `uploads` (`tenant_id`);--> statement-breakpoint
CREATE TABLE `usage_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`metric` text NOT NULL,
	`value` integer DEFAULT 1 NOT NULL,
	`timestamp` integer DEFAULT (strftime('%s', 'now')),
	`meta` text,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `usage_tenant_metric_idx` ON `usage_logs` (`tenant_id`,`metric`,`timestamp`);--> statement-breakpoint
CREATE INDEX `usage_metric_idx` ON `usage_logs` (`metric`,`timestamp`);--> statement-breakpoint
CREATE TABLE `user_challenges` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`user_id` text NOT NULL,
	`challenge_id` text NOT NULL,
	`progress` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`metadata` text,
	`completed_at` integer,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`challenge_id`) REFERENCES `challenges`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_challenge_idx` ON `user_challenges` (`user_id`,`challenge_id`);--> statement-breakpoint
CREATE INDEX `user_challenge_tenant_idx` ON `user_challenges` (`tenant_id`);--> statement-breakpoint
CREATE TABLE `user_relationships` (
	`id` text PRIMARY KEY NOT NULL,
	`parent_user_id` text NOT NULL,
	`child_user_id` text NOT NULL,
	`type` text DEFAULT 'parent_child' NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`parent_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`child_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `parent_idx` ON `user_relationships` (`parent_user_id`);--> statement-breakpoint
CREATE INDEX `child_idx` ON `user_relationships` (`child_user_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`profile` text,
	`is_platform_admin` integer DEFAULT false,
	`role` text DEFAULT 'user' NOT NULL,
	`phone` text,
	`dob` integer,
	`address` text,
	`is_minor` integer DEFAULT false,
	`stripe_customer_id` text,
	`stripe_account_id` text,
	`mfa_enabled` integer DEFAULT false,
	`push_token` text,
	`last_active_at` integer,
	`last_location` text,
	`created_at` integer DEFAULT (strftime('%s', 'now'))
);
--> statement-breakpoint
CREATE INDEX `email_idx` ON `users` (`email`);--> statement-breakpoint
CREATE INDEX `user_stripe_customer_idx` ON `users` (`stripe_customer_id`);--> statement-breakpoint
CREATE TABLE `video_collection_items` (
	`id` text PRIMARY KEY NOT NULL,
	`collection_id` text NOT NULL,
	`video_id` text NOT NULL,
	`order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`collection_id`) REFERENCES `video_collections`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`video_id`) REFERENCES `videos`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `collection_item_idx` ON `video_collection_items` (`collection_id`);--> statement-breakpoint
CREATE TABLE `video_collections` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`slug` text NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `collection_tenant_idx` ON `video_collections` (`tenant_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `collection_tenant_slug_idx` ON `video_collections` (`tenant_id`,`slug`);--> statement-breakpoint
CREATE TABLE `video_shares` (
	`id` text PRIMARY KEY NOT NULL,
	`video_id` text NOT NULL,
	`tenant_id` text NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`video_id`) REFERENCES `videos`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `unique_video_share` ON `video_shares` (`video_id`,`tenant_id`);--> statement-breakpoint
CREATE INDEX `video_share_tenant_idx` ON `video_shares` (`tenant_id`);--> statement-breakpoint
CREATE TABLE `videos` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text,
	`title` text NOT NULL,
	`description` text,
	`r2_key` text NOT NULL,
	`cloudflare_stream_id` text,
	`duration` integer DEFAULT 0,
	`width` integer,
	`height` integer,
	`size_bytes` integer DEFAULT 0,
	`status` text DEFAULT 'processing' NOT NULL,
	`source` text DEFAULT 'upload',
	`video_provider` text DEFAULT 'offline' NOT NULL,
	`livekit_room_name` text,
	`livekit_room_sid` text,
	`trim_start` integer,
	`trim_end` integer,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `video_tenant_idx` ON `videos` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `video_status_idx` ON `videos` (`status`);--> statement-breakpoint
CREATE TABLE `waitlist` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`class_id` text NOT NULL,
	`user_id` text NOT NULL,
	`position` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`offer_expires_at` integer,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`class_id`) REFERENCES `classes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `waitlist_class_pos_idx` ON `waitlist` (`class_id`,`position`);--> statement-breakpoint
CREATE UNIQUE INDEX `waitlist_user_class_idx` ON `waitlist` (`user_id`,`class_id`);--> statement-breakpoint
CREATE TABLE `waiver_signatures` (
	`id` text PRIMARY KEY NOT NULL,
	`template_id` text NOT NULL,
	`member_id` text NOT NULL,
	`signed_by_member_id` text,
	`signed_at` integer DEFAULT (strftime('%s', 'now')),
	`ip_address` text,
	`signature_data` text,
	FOREIGN KEY (`template_id`) REFERENCES `waiver_templates`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`member_id`) REFERENCES `tenant_members`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`signed_by_member_id`) REFERENCES `tenant_members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `member_template_idx` ON `waiver_signatures` (`member_id`,`template_id`);--> statement-breakpoint
CREATE TABLE `waiver_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`title` text NOT NULL,
	`content` text NOT NULL,
	`pdf_url` text,
	`active` integer DEFAULT true,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `webhook_endpoints` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`url` text NOT NULL,
	`secret` text NOT NULL,
	`events` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`description` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `webhook_tenant_idx` ON `webhook_endpoints` (`tenant_id`);--> statement-breakpoint
CREATE TABLE `webhook_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`endpoint_id` text NOT NULL,
	`event_type` text NOT NULL,
	`payload` text NOT NULL,
	`status_code` integer,
	`response_body` text,
	`error` text,
	`duration_ms` integer,
	`attempt_count` integer DEFAULT 1,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`endpoint_id`) REFERENCES `webhook_endpoints`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `webhook_log_tenant_idx` ON `webhook_logs` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `webhook_log_endpoint_idx` ON `webhook_logs` (`endpoint_id`);--> statement-breakpoint
CREATE INDEX `webhook_log_event_idx` ON `webhook_logs` (`event_type`);--> statement-breakpoint
CREATE TABLE `website_pages` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`content` text,
	`is_published` integer DEFAULT false NOT NULL,
	`seo_title` text,
	`seo_description` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `website_page_tenant_idx` ON `website_pages` (`tenant_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `website_page_slug_idx` ON `website_pages` (`tenant_id`,`slug`);--> statement-breakpoint
CREATE TABLE `website_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`domain` text,
	`theme` text,
	`navigation` text,
	`global_styles` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `website_settings_tenant_id_unique` ON `website_settings` (`tenant_id`);