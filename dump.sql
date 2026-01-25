PRAGMA foreign_keys=OFF;
BEGIN TRANSACTION;
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
CREATE TABLE `appointments` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`service_id` text NOT NULL,
	`instructor_id` text NOT NULL,
	`member_id` text NOT NULL,
	`start_time` integer NOT NULL,
	`end_time` integer NOT NULL,
	`status` text DEFAULT 'confirmed',
	`notes` text,
	`zoom_meeting_url` text,
	`google_event_id` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`service_id`) REFERENCES `appointment_services`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`instructor_id`) REFERENCES `tenant_members`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`member_id`) REFERENCES `tenant_members`(`id`) ON UPDATE no action ON DELETE no action
);
CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_id` text,
	`tenant_id` text,
	`action` text NOT NULL,
	`target_id` text,
	`details` text,
	`ip_address` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
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
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`class_id`) REFERENCES `classes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`member_id`) REFERENCES `tenant_members`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`used_pack_id`) REFERENCES `purchased_packs`(`id`) ON UPDATE no action ON DELETE no action
);
INSERT INTO bookings VALUES('booking_e47f8d6e-0ab2-4f3a-b667-924a31af7e48','class_e4539394-9a0d-4539-8fa4-080897539042','member_c50b07c5-c46d-4e3f-aee5-63c923326415','confirmed','in_person',NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1769266518);
INSERT INTO bookings VALUES('booking_f610b27b-c7ec-4811-ac90-16bc1224454e','class_e4539394-9a0d-4539-8fa4-080897539042','member_92c02fe0-f079-4d7b-97d1-614de04726a7','confirmed','in_person',NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1769266518);
INSERT INTO bookings VALUES('booking_75017876-6e51-4913-a644-6922e09484ce','class_8d5e2dbb-852a-4a82-80b3-6fd226958404','member_137e1cd8-2e2a-450e-9d2d-ed510ec8659d','confirmed','in_person',NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1769266518);
INSERT INTO bookings VALUES('booking_405c42ac-a646-4954-af50-fbf3035a96b6','class_91cefb00-1050-48b8-b2df-95b98938e739','member_c80fac91-ff32-49ae-abba-92bd071dc19a','confirmed','in_person',NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1769266518);
INSERT INTO bookings VALUES('booking_922e1b57-cb30-4fb1-ac16-adddb13ef796','class_91cefb00-1050-48b8-b2df-95b98938e739','member_c116b9ee-4a65-4696-8234-6b2954c88d39','confirmed','in_person',NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1769266518);
INSERT INTO bookings VALUES('booking_9209ef79-7acd-4cd2-a89d-563c8e1d0fe6','class_b96609fa-6e15-47d3-b65f-879033686af9','member_c116b9ee-4a65-4696-8234-6b2954c88d39','confirmed','in_person',NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1769266518);
INSERT INTO bookings VALUES('booking_87befb05-6181-4cbf-9d32-c3f86026a31b','class_c29ab280-3437-4423-bf6e-e2d18b01097a','member_42b9beaa-7855-4f7c-879b-05879cd457bf','confirmed','in_person',NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1769266518);
INSERT INTO bookings VALUES('booking_f994ee81-9d69-4837-bd0d-62167d5ba36c','class_c29ab280-3437-4423-bf6e-e2d18b01097a','member_c80fac91-ff32-49ae-abba-92bd071dc19a','confirmed','in_person',NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1769266518);
INSERT INTO bookings VALUES('booking_cc96b491-61a2-4669-a3d0-6e688520b0ed','class_c29ab280-3437-4423-bf6e-e2d18b01097a','member_92c02fe0-f079-4d7b-97d1-614de04726a7','confirmed','in_person',NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1769266518);
INSERT INTO bookings VALUES('booking_60d8c07b-ce5d-4e22-a7ee-97fc0d7ce934','class_c29ab280-3437-4423-bf6e-e2d18b01097a','member_137e1cd8-2e2a-450e-9d2d-ed510ec8659d','confirmed','in_person',NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1769266518);
INSERT INTO bookings VALUES('booking_10329d0a-4a8d-4e55-9d6f-ee7ae53417cd','class_c29ab280-3437-4423-bf6e-e2d18b01097a','member_6092f0cf-a364-442a-b861-81651095dde8','confirmed','in_person',NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1769266518);
INSERT INTO bookings VALUES('booking_51909bf3-020d-48b4-bd1d-8cf4fb9bcda3','class_3060bd15-c79e-422b-946b-bcbc7f393b62','member_dbe80677-125d-49fc-994d-815e290ce244','confirmed','in_person',NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1769266518);
INSERT INTO bookings VALUES('booking_8ca38801-dbd7-4a22-ac9e-f0f1947b6a83','class_3060bd15-c79e-422b-946b-bcbc7f393b62','member_e19079f3-9bfa-442d-86c2-b7db88bde410','confirmed','in_person',NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1769266518);
INSERT INTO bookings VALUES('booking_9651dd19-8ca0-4761-9496-665e9dae4031','class_3060bd15-c79e-422b-946b-bcbc7f393b62','member_6092f0cf-a364-442a-b861-81651095dde8','confirmed','in_person',NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1769266518);
INSERT INTO bookings VALUES('booking_f7a473e8-edc5-478a-a342-1dd9aa0cb414','class_3060bd15-c79e-422b-946b-bcbc7f393b62','member_137e1cd8-2e2a-450e-9d2d-ed510ec8659d','confirmed','in_person',NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1769266518);
INSERT INTO bookings VALUES('booking_ccda1095-fb87-430b-b8e6-95cab6a8ab01','class_3060bd15-c79e-422b-946b-bcbc7f393b62','member_92c02fe0-f079-4d7b-97d1-614de04726a7','confirmed','in_person',NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1769266518);
INSERT INTO bookings VALUES('booking_5957c87d-1244-4d9f-a08b-f850ba7a4cf1','class_84883dad-6b8b-4b0a-bd3d-7b711a57eb9b','member_42b9beaa-7855-4f7c-879b-05879cd457bf','confirmed','in_person',NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1769266518);
INSERT INTO bookings VALUES('booking_7779c14d-08c2-48c4-89aa-40ee92e484a4','class_84883dad-6b8b-4b0a-bd3d-7b711a57eb9b','member_6092f0cf-a364-442a-b861-81651095dde8','confirmed','in_person',NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1769266518);
INSERT INTO bookings VALUES('booking_118e8476-327e-4806-afae-614b1214effc','class_49d92f84-b663-4467-a2f7-fabefcf5c613','member_c116b9ee-4a65-4696-8234-6b2954c88d39','confirmed','in_person',NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1769266518);
INSERT INTO bookings VALUES('booking_b325f429-7d62-4fe1-b52c-5fbdb06b0c52','class_5f84b4ad-2094-4614-a378-b619b341fdf2','member_6092f0cf-a364-442a-b861-81651095dde8','confirmed','in_person',NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1769266518);
INSERT INTO bookings VALUES('booking_19de74a3-f4ff-45ad-8108-ac5120a2d39c','class_5f84b4ad-2094-4614-a378-b619b341fdf2','member_92c02fe0-f079-4d7b-97d1-614de04726a7','confirmed','in_person',NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1769266518);
INSERT INTO bookings VALUES('booking_6f0bc4ff-ee55-469b-9d71-ad2c6464acff','class_24edb96e-880b-412c-b726-5006ce0b8594','member_6092f0cf-a364-442a-b861-81651095dde8','confirmed','in_person',NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1769266518);
INSERT INTO bookings VALUES('booking_ee61d6e0-4a56-490c-872d-918e5ca0aad3','class_24edb96e-880b-412c-b726-5006ce0b8594','member_92c02fe0-f079-4d7b-97d1-614de04726a7','confirmed','in_person',NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1769266518);
INSERT INTO bookings VALUES('booking_3047a5af-0366-4862-9597-7cffb16fd3fa','class_24edb96e-880b-412c-b726-5006ce0b8594','member_c1720a51-5a2a-465b-a5f9-8b020cb6230c','confirmed','in_person',NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1769266518);
INSERT INTO bookings VALUES('booking_b5bd1b75-e668-4961-8957-b6a39d3c72d0','class_a0ea09a3-ddaf-4c27-8b5b-8577306c0fff','member_92c02fe0-f079-4d7b-97d1-614de04726a7','confirmed','in_person',NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1769266518);
INSERT INTO bookings VALUES('booking_0f74b6ec-dcfe-413c-baff-f1fa1c51c284','class_d56b51ef-f4c3-44f1-b900-92e4159f4bc2','member_e19079f3-9bfa-442d-86c2-b7db88bde410','confirmed','in_person',NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1769266518);
INSERT INTO bookings VALUES('booking_7f13b0cf-8d33-48a5-8604-979036c63047','class_d56b51ef-f4c3-44f1-b900-92e4159f4bc2','member_42b9beaa-7855-4f7c-879b-05879cd457bf','confirmed','in_person',NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1769266518);
INSERT INTO bookings VALUES('booking_87238a5b-db8a-4ed7-8c4d-29d007f9c7e2','class_a39feb1f-59fc-47dc-9c4b-1e6e276091b7','member_c116b9ee-4a65-4696-8234-6b2954c88d39','confirmed','in_person',NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1769266518);
INSERT INTO bookings VALUES('booking_fdfc8b65-7574-4820-9fd9-9e5090fdbf68','class_a39feb1f-59fc-47dc-9c4b-1e6e276091b7','member_137e1cd8-2e2a-450e-9d2d-ed510ec8659d','confirmed','in_person',NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1769266518);
INSERT INTO bookings VALUES('booking_916629ca-32e9-4dcf-95c5-d0ee940e21aa','class_a39feb1f-59fc-47dc-9c4b-1e6e276091b7','member_42b9beaa-7855-4f7c-879b-05879cd457bf','confirmed','in_person',NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1769266518);
INSERT INTO bookings VALUES('booking_a4aa56df-9fae-4a78-ae19-300484b653a2','class_a39feb1f-59fc-47dc-9c4b-1e6e276091b7','member_c50b07c5-c46d-4e3f-aee5-63c923326415','confirmed','in_person',NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1769266518);
INSERT INTO bookings VALUES('booking_96c1e9d1-7477-441a-8baf-ddf1f00ad50f','class_851ce0f0-8740-403a-bb90-10fb64d9ba99','member_92c02fe0-f079-4d7b-97d1-614de04726a7','confirmed','in_person',NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1769266518);
INSERT INTO bookings VALUES('booking_ce61c140-d6a7-4aa8-9897-f5e7b90560b7','class_851ce0f0-8740-403a-bb90-10fb64d9ba99','member_c1720a51-5a2a-465b-a5f9-8b020cb6230c','confirmed','in_person',NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1769266518);
INSERT INTO bookings VALUES('booking_ef5009d6-7710-45e9-a75c-00fec78f9c08','class_851ce0f0-8740-403a-bb90-10fb64d9ba99','member_c50b07c5-c46d-4e3f-aee5-63c923326415','confirmed','in_person',NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1769266518);
INSERT INTO bookings VALUES('booking_59e8a5ae-0399-4e52-bc44-6ddd62f32e71','class_d410883c-5a99-4c30-aad6-28d744927c32','member_92c02fe0-f079-4d7b-97d1-614de04726a7','confirmed','in_person',NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1769266518);
INSERT INTO bookings VALUES('booking_c85dff43-1922-46f9-8b93-448e0ab4ba5f','class_d410883c-5a99-4c30-aad6-28d744927c32','member_c80fac91-ff32-49ae-abba-92bd071dc19a','confirmed','in_person',NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1769266518);
INSERT INTO bookings VALUES('booking_81525fec-0e56-4149-ae0a-9d2957413d77','class_d410883c-5a99-4c30-aad6-28d744927c32','member_c50b07c5-c46d-4e3f-aee5-63c923326415','confirmed','in_person',NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1769266518);
INSERT INTO bookings VALUES('booking_cf529e20-fe73-49ff-8de3-99762b5778db','class_d410883c-5a99-4c30-aad6-28d744927c32','member_42b9beaa-7855-4f7c-879b-05879cd457bf','confirmed','in_person',NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1769266518);
INSERT INTO bookings VALUES('booking_259bb604-1f0d-4c43-8770-d9112eaae8f4','class_d410883c-5a99-4c30-aad6-28d744927c32','member_137e1cd8-2e2a-450e-9d2d-ed510ec8659d','confirmed','in_person',NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1769266518);
INSERT INTO bookings VALUES('booking_fccd110b-7952-4272-af5b-d2aecfb5ab2c','class_969a2e1f-fe1c-47d6-ac25-4a4553167d1c','member_c1720a51-5a2a-465b-a5f9-8b020cb6230c','confirmed','in_person',NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1769266518);
INSERT INTO bookings VALUES('booking_e71a99d0-fcbc-4b83-9953-8ce2104a965a','class_969a2e1f-fe1c-47d6-ac25-4a4553167d1c','member_42b9beaa-7855-4f7c-879b-05879cd457bf','confirmed','in_person',NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1769266518);
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
CREATE TABLE `chat_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`user_id` text NOT NULL,
	`content` text NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`room_id`) REFERENCES `chat_rooms`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
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
INSERT INTO class_pack_definitions VALUES('pack_c86e7a7d-49d5-4eb9-9af6-e8711afdbfc7','tenant_test_fixed_id','5 Class Pack',6000,5,90,NULL,0,1,1769266518);
INSERT INTO class_pack_definitions VALUES('pack_9e1a0a1a-5c1f-4abe-a9c8-3c19441c2f74','tenant_test_fixed_id','20 Class Pack',22000,20,180,NULL,0,1,1769266518);
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
CREATE TABLE `classes` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`instructor_id` text NOT NULL,
	`location_id` text,
	`series_id` text,
	`title` text NOT NULL,
	`description` text,
	`start_time` integer NOT NULL,
	`duration_minutes` integer NOT NULL,
	`capacity` integer,
	`price` integer DEFAULT 0,
	`member_price` integer,
	`currency` text DEFAULT 'usd',
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
INSERT INTO classes VALUES('class_e4539394-9a0d-4539-8fa4-080897539042','tenant_test_fixed_id','member_fbf72173-f1a5-4d92-9195-c200eaebc806','loc_7984a392-6609-4b37-a211-f25139f59d19',NULL,'Restorative',NULL,1769263200,60,20,0,NULL,'usd','class',1,NULL,NULL,NULL,NULL,0,NULL,NULL,NULL,'offline',NULL,NULL,'active',1,NULL,0,NULL,1769266518);
INSERT INTO classes VALUES('class_8d5e2dbb-852a-4a82-80b3-6fd226958404','tenant_test_fixed_id','member_fbf72173-f1a5-4d92-9195-c200eaebc806','loc_7984a392-6609-4b37-a211-f25139f59d19',NULL,'Restorative',NULL,1769295600,60,20,0,NULL,'usd','class',1,NULL,NULL,NULL,NULL,0,NULL,NULL,NULL,'offline',NULL,NULL,'active',1,NULL,0,NULL,1769266518);
INSERT INTO classes VALUES('class_91cefb00-1050-48b8-b2df-95b98938e739','tenant_test_fixed_id','member_2294287f-c5c3-4789-bfaa-8e99b2dfb836','loc_7984a392-6609-4b37-a211-f25139f59d19',NULL,'Power Yoga',NULL,1769349600,60,20,0,NULL,'usd','class',1,NULL,NULL,NULL,NULL,0,NULL,NULL,NULL,'offline',NULL,NULL,'active',1,NULL,0,NULL,1769266518);
INSERT INTO classes VALUES('class_b96609fa-6e15-47d3-b65f-879033686af9','tenant_test_fixed_id','member_2294287f-c5c3-4789-bfaa-8e99b2dfb836','loc_7984a392-6609-4b37-a211-f25139f59d19',NULL,'Power Yoga',NULL,1769382000,60,20,0,NULL,'usd','class',1,NULL,NULL,NULL,NULL,0,NULL,NULL,NULL,'offline',NULL,NULL,'active',1,NULL,0,NULL,1769266518);
INSERT INTO classes VALUES('class_c29ab280-3437-4423-bf6e-e2d18b01097a','tenant_test_fixed_id','member_fbf72173-f1a5-4d92-9195-c200eaebc806','loc_7984a392-6609-4b37-a211-f25139f59d19',NULL,'Meditation',NULL,1769436000,60,20,0,NULL,'usd','class',1,NULL,NULL,NULL,NULL,0,NULL,NULL,NULL,'offline',NULL,NULL,'active',1,NULL,0,NULL,1769266518);
INSERT INTO classes VALUES('class_3060bd15-c79e-422b-946b-bcbc7f393b62','tenant_test_fixed_id','member_fbf72173-f1a5-4d92-9195-c200eaebc806','loc_7984a392-6609-4b37-a211-f25139f59d19',NULL,'Meditation',NULL,1769468400,60,20,0,NULL,'usd','class',1,NULL,NULL,NULL,NULL,0,NULL,NULL,NULL,'offline',NULL,NULL,'active',1,NULL,0,NULL,1769266518);
INSERT INTO classes VALUES('class_8e7a6343-a556-4b17-81c6-83ef9aedb929','tenant_test_fixed_id','member_fbf72173-f1a5-4d92-9195-c200eaebc806','loc_7984a392-6609-4b37-a211-f25139f59d19',NULL,'Vinyasa Flow',NULL,1769522400,60,20,0,NULL,'usd','class',1,NULL,NULL,NULL,NULL,0,NULL,NULL,NULL,'offline',NULL,NULL,'active',1,NULL,0,NULL,1769266518);
INSERT INTO classes VALUES('class_84883dad-6b8b-4b0a-bd3d-7b711a57eb9b','tenant_test_fixed_id','member_fbf72173-f1a5-4d92-9195-c200eaebc806','loc_7984a392-6609-4b37-a211-f25139f59d19',NULL,'Vinyasa Flow',NULL,1769554800,60,20,0,NULL,'usd','class',1,NULL,NULL,NULL,NULL,0,NULL,NULL,NULL,'offline',NULL,NULL,'active',1,NULL,0,NULL,1769266518);
INSERT INTO classes VALUES('class_49d92f84-b663-4467-a2f7-fabefcf5c613','tenant_test_fixed_id','member_2294287f-c5c3-4789-bfaa-8e99b2dfb836','loc_7984a392-6609-4b37-a211-f25139f59d19',NULL,'Meditation',NULL,1769608800,60,20,0,NULL,'usd','class',1,NULL,NULL,NULL,NULL,0,NULL,NULL,NULL,'offline',NULL,NULL,'active',1,NULL,0,NULL,1769266518);
INSERT INTO classes VALUES('class_5f84b4ad-2094-4614-a378-b619b341fdf2','tenant_test_fixed_id','member_2294287f-c5c3-4789-bfaa-8e99b2dfb836','loc_7984a392-6609-4b37-a211-f25139f59d19',NULL,'Meditation',NULL,1769641200,60,20,0,NULL,'usd','class',1,NULL,NULL,NULL,NULL,0,NULL,NULL,NULL,'offline',NULL,NULL,'active',1,NULL,0,NULL,1769266518);
INSERT INTO classes VALUES('class_93fcac3b-6e93-4771-981e-7a54de3dfaaa','tenant_test_fixed_id','member_fbf72173-f1a5-4d92-9195-c200eaebc806','loc_7984a392-6609-4b37-a211-f25139f59d19',NULL,'Restorative',NULL,1769695200,60,20,0,NULL,'usd','class',1,NULL,NULL,NULL,NULL,0,NULL,NULL,NULL,'offline',NULL,NULL,'active',1,NULL,0,NULL,1769266518);
INSERT INTO classes VALUES('class_24edb96e-880b-412c-b726-5006ce0b8594','tenant_test_fixed_id','member_fbf72173-f1a5-4d92-9195-c200eaebc806','loc_7984a392-6609-4b37-a211-f25139f59d19',NULL,'Restorative',NULL,1769727600,60,20,0,NULL,'usd','class',1,NULL,NULL,NULL,NULL,0,NULL,NULL,NULL,'offline',NULL,NULL,'active',1,NULL,0,NULL,1769266518);
INSERT INTO classes VALUES('class_a0ea09a3-ddaf-4c27-8b5b-8577306c0fff','tenant_test_fixed_id','member_2294287f-c5c3-4789-bfaa-8e99b2dfb836','loc_7984a392-6609-4b37-a211-f25139f59d19',NULL,'Restorative',NULL,1769781600,60,20,0,NULL,'usd','class',1,NULL,NULL,NULL,NULL,0,NULL,NULL,NULL,'offline',NULL,NULL,'active',1,NULL,0,NULL,1769266518);
INSERT INTO classes VALUES('class_243092ab-ab59-4950-83f8-cacf2b56ebec','tenant_test_fixed_id','member_2294287f-c5c3-4789-bfaa-8e99b2dfb836','loc_7984a392-6609-4b37-a211-f25139f59d19',NULL,'Restorative',NULL,1769814000,60,20,0,NULL,'usd','class',1,NULL,NULL,NULL,NULL,0,NULL,NULL,NULL,'offline',NULL,NULL,'active',1,NULL,0,NULL,1769266518);
INSERT INTO classes VALUES('class_d56b51ef-f4c3-44f1-b900-92e4159f4bc2','tenant_test_fixed_id','member_fbf72173-f1a5-4d92-9195-c200eaebc806','loc_7984a392-6609-4b37-a211-f25139f59d19',NULL,'Restorative',NULL,1769868000,60,20,0,NULL,'usd','class',1,NULL,NULL,NULL,NULL,0,NULL,NULL,NULL,'offline',NULL,NULL,'active',1,NULL,0,NULL,1769266518);
INSERT INTO classes VALUES('class_c340fa9c-6d5d-4369-a83b-153b50cbacc5','tenant_test_fixed_id','member_fbf72173-f1a5-4d92-9195-c200eaebc806','loc_7984a392-6609-4b37-a211-f25139f59d19',NULL,'Restorative',NULL,1769900400,60,20,0,NULL,'usd','class',1,NULL,NULL,NULL,NULL,0,NULL,NULL,NULL,'offline',NULL,NULL,'active',1,NULL,0,NULL,1769266518);
INSERT INTO classes VALUES('class_a39feb1f-59fc-47dc-9c4b-1e6e276091b7','tenant_test_fixed_id','member_2294287f-c5c3-4789-bfaa-8e99b2dfb836','loc_7984a392-6609-4b37-a211-f25139f59d19',NULL,'Meditation',NULL,1769954400,60,20,0,NULL,'usd','class',1,NULL,NULL,NULL,NULL,0,NULL,NULL,NULL,'offline',NULL,NULL,'active',1,NULL,0,NULL,1769266518);
INSERT INTO classes VALUES('class_851ce0f0-8740-403a-bb90-10fb64d9ba99','tenant_test_fixed_id','member_2294287f-c5c3-4789-bfaa-8e99b2dfb836','loc_7984a392-6609-4b37-a211-f25139f59d19',NULL,'Meditation',NULL,1769986800,60,20,0,NULL,'usd','class',1,NULL,NULL,NULL,NULL,0,NULL,NULL,NULL,'offline',NULL,NULL,'active',1,NULL,0,NULL,1769266518);
INSERT INTO classes VALUES('class_d410883c-5a99-4c30-aad6-28d744927c32','tenant_test_fixed_id','member_fbf72173-f1a5-4d92-9195-c200eaebc806','loc_7984a392-6609-4b37-a211-f25139f59d19',NULL,'Meditation',NULL,1770040800,60,20,0,NULL,'usd','class',1,NULL,NULL,NULL,NULL,0,NULL,NULL,NULL,'offline',NULL,NULL,'active',1,NULL,0,NULL,1769266518);
INSERT INTO classes VALUES('class_969a2e1f-fe1c-47d6-ac25-4a4553167d1c','tenant_test_fixed_id','member_fbf72173-f1a5-4d92-9195-c200eaebc806','loc_7984a392-6609-4b37-a211-f25139f59d19',NULL,'Meditation',NULL,1770073200,60,20,0,NULL,'usd','class',1,NULL,NULL,NULL,NULL,0,NULL,NULL,NULL,'offline',NULL,NULL,'active',1,NULL,0,NULL,1769266518);
INSERT INTO classes VALUES('class_d492e1b6-ed6a-4426-909d-6fe9aca0aba6','tenant_test_fixed_id','member_fbf72173-f1a5-4d92-9195-c200eaebc806','loc_7984a392-6609-4b37-a211-f25139f59d19',NULL,'Meditation',NULL,1770127200,60,20,0,NULL,'usd','class',1,NULL,NULL,NULL,NULL,0,NULL,NULL,NULL,'offline',NULL,NULL,'active',1,NULL,0,NULL,1769266518);
INSERT INTO classes VALUES('class_a96ea2cb-4417-42c7-be12-6e46d0e74bc5','tenant_test_fixed_id','member_fbf72173-f1a5-4d92-9195-c200eaebc806','loc_7984a392-6609-4b37-a211-f25139f59d19',NULL,'Meditation',NULL,1770159600,60,20,0,NULL,'usd','class',1,NULL,NULL,NULL,NULL,0,NULL,NULL,NULL,'offline',NULL,NULL,'active',1,NULL,0,NULL,1769266518);
INSERT INTO classes VALUES('class_63973dec-45c3-416d-b8df-e108183f33e8','tenant_test_fixed_id','member_fbf72173-f1a5-4d92-9195-c200eaebc806','loc_7984a392-6609-4b37-a211-f25139f59d19',NULL,'Power Yoga',NULL,1770213600,60,20,0,NULL,'usd','class',1,NULL,NULL,NULL,NULL,0,NULL,NULL,NULL,'offline',NULL,NULL,'active',1,NULL,0,NULL,1769266518);
INSERT INTO classes VALUES('class_2731b35b-5f92-4654-ad26-a4565ea568eb','tenant_test_fixed_id','member_fbf72173-f1a5-4d92-9195-c200eaebc806','loc_7984a392-6609-4b37-a211-f25139f59d19',NULL,'Power Yoga',NULL,1770246000,60,20,0,NULL,'usd','class',1,NULL,NULL,NULL,NULL,0,NULL,NULL,NULL,'offline',NULL,NULL,'active',1,NULL,0,NULL,1769266518);
INSERT INTO classes VALUES('class_d53a2f67-71cb-4693-9dfa-b6a1858e02b7','tenant_test_fixed_id','member_fbf72173-f1a5-4d92-9195-c200eaebc806','loc_7984a392-6609-4b37-a211-f25139f59d19',NULL,'Power Yoga',NULL,1770300000,60,20,0,NULL,'usd','class',1,NULL,NULL,NULL,NULL,0,NULL,NULL,NULL,'offline',NULL,NULL,'active',1,NULL,0,NULL,1769266518);
INSERT INTO classes VALUES('class_62ee927a-bd7a-4196-9aca-33a18e87c061','tenant_test_fixed_id','member_fbf72173-f1a5-4d92-9195-c200eaebc806','loc_7984a392-6609-4b37-a211-f25139f59d19',NULL,'Power Yoga',NULL,1770332400,60,20,0,NULL,'usd','class',1,NULL,NULL,NULL,NULL,0,NULL,NULL,NULL,'offline',NULL,NULL,'active',1,NULL,0,NULL,1769266518);
INSERT INTO classes VALUES('class_2af95038-e174-4f14-9413-6421804810a6','tenant_test_fixed_id','member_fbf72173-f1a5-4d92-9195-c200eaebc806','loc_7984a392-6609-4b37-a211-f25139f59d19',NULL,'Power Yoga',NULL,1770386400,60,20,0,NULL,'usd','class',1,NULL,NULL,NULL,NULL,0,NULL,NULL,NULL,'offline',NULL,NULL,'active',1,NULL,0,NULL,1769266518);
INSERT INTO classes VALUES('class_25660101-b13e-4f45-be25-8b733c9f7c83','tenant_test_fixed_id','member_fbf72173-f1a5-4d92-9195-c200eaebc806','loc_7984a392-6609-4b37-a211-f25139f59d19',NULL,'Power Yoga',NULL,1770418800,60,20,0,NULL,'usd','class',1,NULL,NULL,NULL,NULL,0,NULL,NULL,NULL,'offline',NULL,NULL,'active',1,NULL,0,NULL,1769266518);
CREATE TABLE `community_comments` (
	`id` text PRIMARY KEY NOT NULL,
	`post_id` text NOT NULL,
	`author_id` text NOT NULL,
	`content` text NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`post_id`) REFERENCES `community_posts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`author_id`) REFERENCES `tenant_members`(`id`) ON UPDATE no action ON DELETE no action
);
CREATE TABLE `community_likes` (
	`post_id` text NOT NULL,
	`member_id` text NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	PRIMARY KEY(`post_id`, `member_id`),
	FOREIGN KEY (`post_id`) REFERENCES `community_posts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`) REFERENCES `tenant_members`(`id`) ON UPDATE no action ON DELETE no action
);
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
INSERT INTO coupons VALUES('coupon_3f67a281-aad3-4809-93f5-b02377d6116e','tenant_test_fixed_id','WELCOME20','percent',20,1,NULL,NULL,1769266518);
INSERT INTO coupons VALUES('coupon_97528a83-15b2-4cdd-9d50-c8cc638965c6','tenant_test_fixed_id','SAVE10','amount',1000,1,NULL,NULL,1769266518);
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
CREATE TABLE `gift_card_transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`gift_card_id` text NOT NULL,
	`amount` integer NOT NULL,
	`type` text NOT NULL,
	`reference_id` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`gift_card_id`) REFERENCES `gift_cards`(`id`) ON UPDATE no action ON DELETE no action
);
CREATE TABLE `gift_cards` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`code` text NOT NULL,
	`initial_value` integer NOT NULL,
	`current_balance` integer NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`expiry_date` integer,
	`buyer_member_id` text,
	`recipient_member_id` text,
	`recipient_email` text,
	`notes` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`buyer_member_id`) REFERENCES `tenant_members`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`recipient_member_id`) REFERENCES `tenant_members`(`id`) ON UPDATE no action ON DELETE no action
);
INSERT INTO gift_cards VALUES('gc_9962d2cd-7508-4044-bbdc-d8049e59c6e8','tenant_test_fixed_id','5MPDGQ45BS6T',5000,5000,'active',NULL,NULL,NULL,'Athena.Lemke@hotmail.com','Seeded gift card',1769266518,1769266518);
INSERT INTO gift_cards VALUES('gc_3e1df077-b41c-42d6-8361-7170977069e3','tenant_test_fixed_id','CEKFA61M0Z4D',5000,5000,'active',NULL,NULL,NULL,'Angelo_McDermott43@yahoo.com','Seeded gift card',1769266518,1769266518);
INSERT INTO gift_cards VALUES('gc_0041e596-5a98-4b95-a3ef-8ecdbbb028e1','tenant_test_fixed_id','SUAO54SIR9LK',5000,5000,'active',NULL,NULL,NULL,'Marlin13@yahoo.com','Seeded gift card',1769266518,1769266518);
INSERT INTO gift_cards VALUES('gc_095e43cf-2f67-4301-a1b0-d6c1249fa98f','tenant_test_fixed_id','VCZVU88RB0Y3',5000,5000,'active',NULL,NULL,NULL,'Broderick_Greenholt81@yahoo.com','Seeded gift card',1769266518,1769266518);
INSERT INTO gift_cards VALUES('gc_207390d3-b78f-4703-8d9d-92aa0694891c','tenant_test_fixed_id','4G5GYN6NECT3',5000,5000,'active',NULL,NULL,NULL,'Johnny_Stamm@hotmail.com','Seeded gift card',1769266518,1769266518);
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
INSERT INTO locations VALUES('loc_7984a392-6609-4b37-a211-f25139f59d19','tenant_test_fixed_id','Main Studio','123 Yoga Lane',NULL,'UTC',1,NULL,1,1769266518);
CREATE TABLE `marketing_automations` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`trigger_event` text NOT NULL,
	`trigger_condition` text,
	`template_id` text,
	`audience_filter` text,
	`subject` text NOT NULL,
	`content` text NOT NULL,
	`is_enabled` integer DEFAULT false NOT NULL,
	`metadata` text,
	`timing_type` text DEFAULT 'immediate' NOT NULL,
	`timing_value` integer DEFAULT 0,
	`delay_hours` integer DEFAULT 0,
	`channels` text DEFAULT ('["email"]'),
	`coupon_config` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
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
INSERT INTO membership_plans VALUES('plan_724f4764-b586-421b-b592-09649760e2c9','tenant_test_fixed_id','Unlimited Month',NULL,15000,'usd','month',NULL,NULL,NULL,0,1,1769266518);
INSERT INTO membership_plans VALUES('plan_3c18bbdd-05fa-48a8-99bb-d8c38d1f8407','tenant_test_fixed_id','10 Class Pack',NULL,12000,'usd','one_time',NULL,NULL,NULL,0,1,1769266518);
INSERT INTO membership_plans VALUES('plan_fa6156b4-e3f9-4d64-957e-3f9c3b7d196e','tenant_test_fixed_id','Drop In',NULL,2500,'usd','one_time',NULL,NULL,NULL,0,1,1769266518);
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
CREATE TABLE `payroll_config` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`user_id` text NOT NULL,
	`member_id` text,
	`pay_model` text NOT NULL,
	`rate` integer NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`member_id`) REFERENCES `tenant_members`(`id`) ON UPDATE no action ON DELETE no action
);
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
CREATE TABLE `platform_config` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text,
	`enabled` integer DEFAULT false NOT NULL,
	`description` text,
	`updated_at` integer DEFAULT (strftime('%s', 'now'))
);
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
CREATE TABLE `processed_webhooks` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now'))
);
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
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
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
INSERT INTO products VALUES('prod_9b517aa5-07d9-45b9-b0d3-1e300cdde7f5','tenant_test_fixed_id','Yoga Mat',NULL,NULL,NULL,8000,'usd',50,5,NULL,NULL,NULL,1,1769266518,1769266518);
INSERT INTO products VALUES('prod_5a055598-2db6-4aab-81f2-4f6f287ab13e','tenant_test_fixed_id','Yoga Block',NULL,NULL,NULL,1500,'usd',30,5,NULL,NULL,NULL,1,1769266518,1769266518);
INSERT INTO products VALUES('prod_c4997db2-8ada-4e32-8a00-f56c2b1ea668','tenant_test_fixed_id','Studio T-Shirt',NULL,NULL,NULL,3500,'usd',100,5,NULL,NULL,NULL,1,1769266518,1769266518);
INSERT INTO products VALUES('prod_bc34d301-eae8-4108-8152-65aa7fa6be72','tenant_test_fixed_id','Essential Oil',NULL,NULL,NULL,2000,'usd',50,5,NULL,NULL,NULL,1,1769266518,1769266518);
INSERT INTO products VALUES('prod_907ead5f-e6e6-4942-98c3-2a65d51188b4','tenant_test_fixed_id','Water Bottle',NULL,NULL,NULL,2500,'usd',100,5,NULL,NULL,NULL,1,1769266518,1769266518);
CREATE TABLE `purchased_packs` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`member_id` text NOT NULL,
	`pack_definition_id` text NOT NULL,
	`initial_credits` integer NOT NULL,
	`remaining_credits` integer NOT NULL,
	`purchased_price_cents` integer DEFAULT 0,
	`stripe_payment_id` text,
	`expires_at` integer,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`member_id`) REFERENCES `tenant_members`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`pack_definition_id`) REFERENCES `class_pack_definitions`(`id`) ON UPDATE no action ON DELETE no action
);
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
CREATE TABLE `scheduled_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`report_type` text NOT NULL,
	`frequency` text NOT NULL,
	`recipients` text NOT NULL,
	`last_sent` integer,
	`next_run` integer NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE TABLE `sms_config` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`provider` text DEFAULT 'mock',
	`sender_id` text,
	`enabled_events` text,
	`updated_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
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
	`dunning_state` text,
	`last_dunning_at` integer,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`member_id`) REFERENCES `tenant_members`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`plan_id`) REFERENCES `membership_plans`(`id`) ON UPDATE no action ON DELETE no action
);
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
CREATE TABLE `tenant_features` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`feature_key` text NOT NULL,
	`enabled` integer DEFAULT false NOT NULL,
	`source` text DEFAULT 'manual',
	`updated_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE TABLE `tenant_members` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`user_id` text NOT NULL,
	`profile` text,
	`settings` text,
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
INSERT INTO tenant_members VALUES('member_56ac56be-cf2a-46f6-8eb1-67a36ea4e53e','tenant_test_fixed_id','user_owner_fixed_id','{"bio":"I own this place"}',NULL,'active',1769266518,100,'safe',NULL,50,NULL,0,NULL,NULL);
INSERT INTO tenant_members VALUES('member_fbf72173-f1a5-4d92-9195-c200eaebc806','tenant_test_fixed_id','user_0f708ac0-8cf6-4855-a7c2-adfdc8c69057','{"bio":"Yoga Teacher"}',NULL,'active',1769266518,100,'safe',NULL,50,NULL,0,NULL,NULL);
INSERT INTO tenant_members VALUES('member_2294287f-c5c3-4789-bfaa-8e99b2dfb836','tenant_test_fixed_id','user_0d679a03-4580-4036-8d0f-4966a9343f70','{"bio":"Yoga Teacher"}',NULL,'active',1769266518,100,'safe',NULL,50,NULL,0,NULL,NULL);
INSERT INTO tenant_members VALUES('member_6092f0cf-a364-442a-b861-81651095dde8','tenant_test_fixed_id','user_9fb6ebd6-2cb6-42a0-b510-e417bf4a56a2',NULL,NULL,'active',1769266518,100,'safe',NULL,50,NULL,0,NULL,NULL);
INSERT INTO tenant_members VALUES('member_c116b9ee-4a65-4696-8234-6b2954c88d39','tenant_test_fixed_id','user_e877e575-0ca3-449c-9ccc-d80637e8a07f',NULL,NULL,'active',1769266518,100,'safe',NULL,50,NULL,0,NULL,NULL);
INSERT INTO tenant_members VALUES('member_137e1cd8-2e2a-450e-9d2d-ed510ec8659d','tenant_test_fixed_id','user_1c975822-85cf-498e-ba92-6b60994ba78e',NULL,NULL,'active',1769266518,100,'safe',NULL,50,NULL,0,NULL,NULL);
INSERT INTO tenant_members VALUES('member_dbe80677-125d-49fc-994d-815e290ce244','tenant_test_fixed_id','user_92489980-42c3-47a3-90a6-e9ead71cdcdb',NULL,NULL,'active',1769266518,100,'safe',NULL,50,NULL,0,NULL,NULL);
INSERT INTO tenant_members VALUES('member_c80fac91-ff32-49ae-abba-92bd071dc19a','tenant_test_fixed_id','user_d5b87e92-1b7d-485e-ac77-61e89a8d832c',NULL,NULL,'active',1769266518,100,'safe',NULL,50,NULL,0,NULL,NULL);
INSERT INTO tenant_members VALUES('member_92c02fe0-f079-4d7b-97d1-614de04726a7','tenant_test_fixed_id','user_e47bdbf4-c47d-4d3f-b7ca-eb8854f72a9e',NULL,NULL,'active',1769266518,100,'safe',NULL,50,NULL,0,NULL,NULL);
INSERT INTO tenant_members VALUES('member_42b9beaa-7855-4f7c-879b-05879cd457bf','tenant_test_fixed_id','user_3f93132b-74ad-4336-be77-ab2f0381b1a2',NULL,NULL,'active',1769266518,100,'safe',NULL,50,NULL,0,NULL,NULL);
INSERT INTO tenant_members VALUES('member_c1720a51-5a2a-465b-a5f9-8b020cb6230c','tenant_test_fixed_id','user_1610b203-1a48-4d02-a3bd-f31ec85b10d9',NULL,NULL,'active',1769266518,100,'safe',NULL,50,NULL,0,NULL,NULL);
INSERT INTO tenant_members VALUES('member_c50b07c5-c46d-4e3f-aee5-63c923326415','tenant_test_fixed_id','user_36db1a9c-720e-4d27-a737-c1f7351abe5e',NULL,NULL,'active',1769266518,100,'safe',NULL,50,NULL,0,NULL,NULL);
INSERT INTO tenant_members VALUES('member_e19079f3-9bfa-442d-86c2-b7db88bde410','tenant_test_fixed_id','user_31d3a748-e09a-4251-846d-51cc1582a6de',NULL,NULL,'active',1769266518,100,'safe',NULL,50,NULL,0,NULL,NULL);
CREATE TABLE `tenant_roles` (
	`member_id` text NOT NULL,
	`role` text NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	PRIMARY KEY(`member_id`, `role`),
	FOREIGN KEY (`member_id`) REFERENCES `tenant_members`(`id`) ON UPDATE no action ON DELETE no action
);
INSERT INTO tenant_roles VALUES('member_56ac56be-cf2a-46f6-8eb1-67a36ea4e53e','owner',1769266518);
INSERT INTO tenant_roles VALUES('member_fbf72173-f1a5-4d92-9195-c200eaebc806','instructor',1769266518);
INSERT INTO tenant_roles VALUES('member_2294287f-c5c3-4789-bfaa-8e99b2dfb836','instructor',1769266518);
INSERT INTO tenant_roles VALUES('member_6092f0cf-a364-442a-b861-81651095dde8','student',1769266518);
INSERT INTO tenant_roles VALUES('member_c116b9ee-4a65-4696-8234-6b2954c88d39','student',1769266518);
INSERT INTO tenant_roles VALUES('member_137e1cd8-2e2a-450e-9d2d-ed510ec8659d','student',1769266518);
INSERT INTO tenant_roles VALUES('member_dbe80677-125d-49fc-994d-815e290ce244','student',1769266518);
INSERT INTO tenant_roles VALUES('member_c80fac91-ff32-49ae-abba-92bd071dc19a','student',1769266518);
INSERT INTO tenant_roles VALUES('member_92c02fe0-f079-4d7b-97d1-614de04726a7','student',1769266518);
INSERT INTO tenant_roles VALUES('member_42b9beaa-7855-4f7c-879b-05879cd457bf','student',1769266518);
INSERT INTO tenant_roles VALUES('member_c1720a51-5a2a-465b-a5f9-8b020cb6230c','student',1769266518);
INSERT INTO tenant_roles VALUES('member_c50b07c5-c46d-4e3f-aee5-63c923326415','student',1769266518);
INSERT INTO tenant_roles VALUES('member_e19079f3-9bfa-442d-86c2-b7db88bde410','student',1769266518);
CREATE TABLE `tenants` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`custom_domain` text,
	`branding` text,
	`mobile_app_config` text,
	`settings` text,
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
	`status` text DEFAULT 'active' NOT NULL,
	`tier` text DEFAULT 'basic' NOT NULL,
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
	`created_at` integer DEFAULT (strftime('%s', 'now'))
);
INSERT INTO tenants VALUES('tenant_test_fixed_id','test-studio','Test Studio',NULL,'{"primaryColor":"#000000"}',NULL,'{"enableStudentRegistration":true}',NULL,NULL,NULL,NULL,'system',NULL,NULL,NULL,'usd',NULL,NULL,NULL,NULL,NULL,NULL,'active','growth','active',0,0,0,0,NULL,NULL,NULL,0,0,0,0,NULL,NULL,NULL,0,1769266518);
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
CREATE TABLE `usage_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`metric` text NOT NULL,
	`value` integer DEFAULT 1 NOT NULL,
	`timestamp` integer DEFAULT (strftime('%s', 'now')),
	`meta` text,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
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
CREATE TABLE `user_relationships` (
	`id` text PRIMARY KEY NOT NULL,
	`parent_user_id` text NOT NULL,
	`child_user_id` text NOT NULL,
	`type` text DEFAULT 'parent_child' NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`parent_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`child_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
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
INSERT INTO users VALUES('user_owner_fixed_id','owner@test-studio.com','{"firstName":"Otis","lastName":"Owner"}',0,'owner',NULL,NULL,NULL,0,NULL,NULL,0,NULL,NULL,NULL,1769266518);
INSERT INTO users VALUES('user_0f708ac0-8cf6-4855-a7c2-adfdc8c69057','instructor0@test-studio.com','{"firstName":"Jailyn","lastName":"Cole"}',0,'user',NULL,NULL,NULL,0,NULL,NULL,0,NULL,NULL,NULL,1769266518);
INSERT INTO users VALUES('user_0d679a03-4580-4036-8d0f-4966a9343f70','instructor1@test-studio.com','{"firstName":"Viviane","lastName":"McCullough"}',0,'user',NULL,NULL,NULL,0,NULL,NULL,0,NULL,NULL,NULL,1769266518);
INSERT INTO users VALUES('user_9fb6ebd6-2cb6-42a0-b510-e417bf4a56a2','student0@test-studio.com','{"firstName":"Aron","lastName":"Wilkinson"}',0,'user',NULL,NULL,NULL,0,NULL,NULL,0,NULL,NULL,NULL,1769266518);
INSERT INTO users VALUES('user_e877e575-0ca3-449c-9ccc-d80637e8a07f','student1@test-studio.com','{"firstName":"Lillian","lastName":"Bernier"}',0,'user',NULL,NULL,NULL,0,NULL,NULL,0,NULL,NULL,NULL,1769266518);
INSERT INTO users VALUES('user_1c975822-85cf-498e-ba92-6b60994ba78e','student2@test-studio.com','{"firstName":"Rico","lastName":"Langosh"}',0,'user',NULL,NULL,NULL,0,NULL,NULL,0,NULL,NULL,NULL,1769266518);
INSERT INTO users VALUES('user_92489980-42c3-47a3-90a6-e9ead71cdcdb','student3@test-studio.com','{"firstName":"Guillermo","lastName":"Hoppe"}',0,'user',NULL,NULL,NULL,0,NULL,NULL,0,NULL,NULL,NULL,1769266518);
INSERT INTO users VALUES('user_d5b87e92-1b7d-485e-ac77-61e89a8d832c','student4@test-studio.com','{"firstName":"Aaliyah","lastName":"Mills"}',0,'user',NULL,NULL,NULL,0,NULL,NULL,0,NULL,NULL,NULL,1769266518);
INSERT INTO users VALUES('user_e47bdbf4-c47d-4d3f-b7ca-eb8854f72a9e','student5@test-studio.com','{"firstName":"Esther","lastName":"Kautzer"}',0,'user',NULL,NULL,NULL,0,NULL,NULL,0,NULL,NULL,NULL,1769266518);
INSERT INTO users VALUES('user_3f93132b-74ad-4336-be77-ab2f0381b1a2','student6@test-studio.com','{"firstName":"Maryse","lastName":"Franey"}',0,'user',NULL,NULL,NULL,0,NULL,NULL,0,NULL,NULL,NULL,1769266518);
INSERT INTO users VALUES('user_1610b203-1a48-4d02-a3bd-f31ec85b10d9','student7@test-studio.com','{"firstName":"Newton","lastName":"Hickle"}',0,'user',NULL,NULL,NULL,0,NULL,NULL,0,NULL,NULL,NULL,1769266518);
INSERT INTO users VALUES('user_36db1a9c-720e-4d27-a737-c1f7351abe5e','student8@test-studio.com','{"firstName":"Blanca","lastName":"Emard-Cormier"}',0,'user',NULL,NULL,NULL,0,NULL,NULL,0,NULL,NULL,NULL,1769266518);
INSERT INTO users VALUES('user_31d3a748-e09a-4251-846d-51cc1582a6de','student9@test-studio.com','{"firstName":"Mervin","lastName":"Vandervort"}',0,'user',NULL,NULL,NULL,0,NULL,NULL,0,NULL,NULL,NULL,1769266518);
CREATE TABLE `video_collection_items` (
	`id` text PRIMARY KEY NOT NULL,
	`collection_id` text NOT NULL,
	`video_id` text NOT NULL,
	`order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`collection_id`) REFERENCES `video_collections`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`video_id`) REFERENCES `videos`(`id`) ON UPDATE no action ON DELETE cascade
);
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
CREATE TABLE `video_shares` (
	`id` text PRIMARY KEY NOT NULL,
	`video_id` text NOT NULL,
	`tenant_id` text NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`video_id`) REFERENCES `videos`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade
);
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
CREATE INDEX `apt_tenant_time_idx` ON `appointments` (`tenant_id`,`start_time`);
CREATE INDEX `apt_instructor_time_idx` ON `appointments` (`instructor_id`,`start_time`);
CREATE INDEX `apt_member_idx` ON `appointments` (`member_id`);
CREATE UNIQUE INDEX `automation_log_unique_idx` ON `automation_logs` (`automation_id`,`user_id`,`channel`);
CREATE INDEX `automation_log_tenant_idx` ON `automation_logs` (`tenant_id`);
CREATE INDEX `avail_instructor_idx` ON `availabilities` (`instructor_id`);
CREATE INDEX `member_class_idx` ON `bookings` (`member_id`,`class_id`);
CREATE INDEX `booking_waitlist_idx` ON `bookings` (`class_id`,`waitlist_position`);
CREATE INDEX `booking_class_status_idx` ON `bookings` (`class_id`,`status`);
CREATE INDEX `branding_tenant_type_idx` ON `branding_assets` (`tenant_id`,`type`);
CREATE INDEX `challenge_tenant_idx` ON `challenges` (`tenant_id`);
CREATE INDEX `chat_message_room_idx` ON `chat_messages` (`room_id`);
CREATE INDEX `chat_message_user_idx` ON `chat_messages` (`user_id`);
CREATE INDEX `chat_room_tenant_idx` ON `chat_rooms` (`tenant_id`);
CREATE INDEX `chat_room_type_idx` ON `chat_rooms` (`tenant_id`,`type`);
CREATE INDEX `chat_room_status_idx` ON `chat_rooms` (`tenant_id`,`status`);
CREATE INDEX `chat_room_assignee_idx` ON `chat_rooms` (`assigned_to_id`);
CREATE INDEX `tenant_time_idx` ON `classes` (`tenant_id`,`start_time`);
CREATE INDEX `series_idx` ON `classes` (`series_id`);
CREATE INDEX `class_tenant_start_idx` ON `classes` (`tenant_id`,`start_time`);
CREATE INDEX `community_comment_post_idx` ON `community_comments` (`post_id`);
CREATE INDEX `community_post_tenant_idx` ON `community_posts` (`tenant_id`);
CREATE INDEX `community_post_pinned_idx` ON `community_posts` (`tenant_id`,`is_pinned`);
CREATE UNIQUE INDEX `tenant_code_idx` ON `coupons` (`tenant_id`,`code`);
CREATE INDEX `custom_reports_tenant_idx` ON `custom_reports` (`tenant_id`);
CREATE INDEX `email_log_tenant_idx` ON `email_logs` (`tenant_id`);
CREATE INDEX `email_log_campaign_idx` ON `email_logs` (`campaign_id`);
CREATE INDEX `email_log_email_idx` ON `email_logs` (`recipient_email`);
CREATE INDEX `email_log_sent_at_idx` ON `email_logs` (`sent_at`);
CREATE INDEX `gift_card_tx_card_idx` ON `gift_card_transactions` (`gift_card_id`);
CREATE UNIQUE INDEX `gift_card_tenant_code_idx` ON `gift_cards` (`tenant_id`,`code`);
CREATE INDEX `gift_card_tenant_idx` ON `gift_cards` (`tenant_id`);
CREATE UNIQUE INDEX `lead_tenant_email_idx` ON `leads` (`tenant_id`,`email`);
CREATE INDEX `lead_status_idx` ON `leads` (`status`);
CREATE INDEX `automation_tenant_idx` ON `marketing_automations` (`tenant_id`);
CREATE INDEX `payroll_config_member_idx` ON `payroll_config` (`member_id`);
CREATE INDEX `payroll_item_payout_idx` ON `payroll_items` (`payout_id`);
CREATE INDEX `payroll_item_ref_idx` ON `payroll_items` (`reference_id`);
CREATE UNIQUE INDEX `platform_pages_slug_unique` ON `platform_pages` (`slug`);
CREATE INDEX `pos_item_order_idx` ON `pos_order_items` (`order_id`);
CREATE INDEX `pos_item_product_idx` ON `pos_order_items` (`product_id`);
CREATE INDEX `pos_order_tenant_idx` ON `pos_orders` (`tenant_id`);
CREATE INDEX `pos_order_member_idx` ON `pos_orders` (`member_id`);
CREATE INDEX `product_tenant_idx` ON `products` (`tenant_id`);
CREATE INDEX `member_pack_idx` ON `purchased_packs` (`member_id`);
CREATE INDEX `pack_member_credits_idx` ON `purchased_packs` (`member_id`,`remaining_credits`);
CREATE INDEX `referral_tenant_idx` ON `referrals` (`tenant_id`);
CREATE UNIQUE INDEX `referral_code_idx` ON `referrals` (`tenant_id`,`code`);
CREATE INDEX `referral_referrer_idx` ON `referrals` (`referrer_id`);
CREATE INDEX `refund_tenant_idx` ON `refunds` (`tenant_id`);
CREATE INDEX `refund_ref_idx` ON `refunds` (`reference_id`);
CREATE INDEX `review_tenant_idx` ON `reviews` (`tenant_id`);
CREATE INDEX `review_member_idx` ON `reviews` (`member_id`);
CREATE INDEX `review_approved_idx` ON `reviews` (`tenant_id`,`is_approved`);
CREATE INDEX `scheduled_reports_tenant_idx` ON `scheduled_reports` (`tenant_id`);
CREATE INDEX `student_idx` ON `student_notes` (`student_id`);
CREATE INDEX `sub_req_tenant_status_idx` ON `sub_requests` (`tenant_id`,`status`);
CREATE INDEX `sub_req_class_idx` ON `sub_requests` (`class_id`);
CREATE INDEX `sub_tenant_idx` ON `substitutions` (`tenant_id`);
CREATE INDEX `sub_class_idx` ON `substitutions` (`class_id`);
CREATE INDEX `sub_status_idx` ON `substitutions` (`status`);
CREATE INDEX `task_tenant_idx` ON `tasks` (`tenant_id`);
CREATE INDEX `task_assignee_idx` ON `tasks` (`assigned_to_id`);
CREATE INDEX `task_lead_idx` ON `tasks` (`related_lead_id`);
CREATE INDEX `task_tenant_status_idx` ON `tasks` (`tenant_id`,`status`);
CREATE UNIQUE INDEX `unique_feature_idx` ON `tenant_features` (`tenant_id`,`feature_key`);
CREATE INDEX `tenant_user_idx` ON `tenant_members` (`tenant_id`,`user_id`);
CREATE INDEX `member_engagement_idx` ON `tenant_members` (`engagement_score`);
CREATE UNIQUE INDEX `tenants_slug_unique` ON `tenants` (`slug`);
CREATE UNIQUE INDEX `tenants_custom_domain_unique` ON `tenants` (`custom_domain`);
CREATE INDEX `upload_tenant_idx` ON `uploads` (`tenant_id`);
CREATE INDEX `usage_tenant_metric_idx` ON `usage_logs` (`tenant_id`,`metric`,`timestamp`);
CREATE INDEX `usage_metric_idx` ON `usage_logs` (`metric`,`timestamp`);
CREATE UNIQUE INDEX `user_challenge_idx` ON `user_challenges` (`user_id`,`challenge_id`);
CREATE INDEX `user_challenge_tenant_idx` ON `user_challenges` (`tenant_id`);
CREATE INDEX `parent_idx` ON `user_relationships` (`parent_user_id`);
CREATE INDEX `child_idx` ON `user_relationships` (`child_user_id`);
CREATE INDEX `email_idx` ON `users` (`email`);
CREATE INDEX `user_stripe_customer_idx` ON `users` (`stripe_customer_id`);
CREATE INDEX `collection_item_idx` ON `video_collection_items` (`collection_id`);
CREATE INDEX `collection_tenant_idx` ON `video_collections` (`tenant_id`);
CREATE UNIQUE INDEX `collection_tenant_slug_idx` ON `video_collections` (`tenant_id`,`slug`);
CREATE UNIQUE INDEX `unique_video_share` ON `video_shares` (`video_id`,`tenant_id`);
CREATE INDEX `video_share_tenant_idx` ON `video_shares` (`tenant_id`);
CREATE INDEX `video_tenant_idx` ON `videos` (`tenant_id`);
CREATE INDEX `video_status_idx` ON `videos` (`status`);
CREATE INDEX `waitlist_class_pos_idx` ON `waitlist` (`class_id`,`position`);
CREATE UNIQUE INDEX `waitlist_user_class_idx` ON `waitlist` (`user_id`,`class_id`);
CREATE INDEX `member_template_idx` ON `waiver_signatures` (`member_id`,`template_id`);
CREATE INDEX `webhook_tenant_idx` ON `webhook_endpoints` (`tenant_id`);
CREATE INDEX `website_page_tenant_idx` ON `website_pages` (`tenant_id`);
CREATE UNIQUE INDEX `website_page_slug_idx` ON `website_pages` (`tenant_id`,`slug`);
CREATE UNIQUE INDEX `website_settings_tenant_id_unique` ON `website_settings` (`tenant_id`);
COMMIT;
