import { sqliteTable, text, integer, uniqueIndex, index, primaryKey } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// --- Multi-Tenancy Root ---
export const tenants = sqliteTable('tenants', {
    id: text('id').primaryKey(),
    slug: text('slug').notNull().unique(), // subdomain
    name: text('name').notNull(),
    customDomain: text('custom_domain').unique(),
    branding: text('branding', { mode: 'json' }), // JSON: { primaryColor, logoUrl, font }
    mobileAppConfig: text('mobile_app_config', { mode: 'json' }), // JSON: { appName, iconUrl, splashUrl, primaryColor }
    settings: text('settings', { mode: 'json' }), // JSON: { enableStudentRegistration, noShowFeeEnabled, noShowFeeAmount, notifications, progressTracking: { studioType, enabledCategories, showLeaderboards } }
    customFieldDefinitions: text('custom_field_definitions', { mode: 'json' }), // JSON: [{ key: 'tshirt_size', label: 'T-Shirt Size', type: 'text', options: [] }]
    stripeAccountId: text('stripe_account_id'), // Connect Account ID (Receiving money)
    stripeCustomerId: text('stripe_customer_id'), // Platform Customer ID (Paying for SaaS)
    stripeSubscriptionId: text('stripe_subscription_id'), // Active info
    currentPeriodEnd: integer('current_period_end', { mode: 'timestamp' }),

    // Phase 15: Flexible Payments (Connect vs BYOK)
    marketingProvider: text('marketing_provider', { enum: ['system', 'mailchimp', 'flodesk'] }).default('system').notNull(),

    // Phase 16: Secure BYOK (Email/SMS)
    resendCredentials: text('resend_credentials', { mode: 'json' }), // Encrypted JSON: { apiKey }
    twilioCredentials: text('twilio_credentials', { mode: 'json' }), // Encrypted JSON: { accountSid, authToken, fromNumber }
    flodeskCredentials: text('flodesk_credentials', { mode: 'json' }), // Encrypted JSON: { apiKey }

    currency: text('currency').default('usd').notNull(), // Added currency
    zoomCredentials: text('zoom_credentials', { mode: 'json' }), // Encrypted
    mailchimpCredentials: text('mailchimp_credentials', { mode: 'json' }), // JSON: { apiKey, serverPrefix, listId }
    zapierCredentials: text('zapier_credentials', { mode: 'json' }), // JSON: { webhookUrl, apiKey }
    googleCredentials: text('google_credentials', { mode: 'json' }), // JSON: { clientId, measurementId }
    slackCredentials: text('slack_credentials', { mode: 'json' }), // JSON: { webhookUrl, botToken }
    googleCalendarCredentials: text('google_calendar_credentials'), // Temporarily disabled JSON mode to fix raw string crash
    resendAudienceId: text('resend_audience_id'), // Added for Resend Audience tracking
    status: text('status', { enum: ['active', 'paused', 'suspended', 'archived'] }).default('active').notNull(),
    tier: text('tier', { enum: ['launch', 'growth', 'scale'] }).default('launch').notNull(),
    subscriptionStatus: text('subscription_status', { enum: ['active', 'past_due', 'canceled', 'trialing'] }).default('active').notNull(),

    // Marketplace
    isPublic: integer('is_public', { mode: 'boolean' }).default(false).notNull(),

    // Quotas (Reset monthly)
    smsUsage: integer('sms_usage').default(0).notNull(),
    emailUsage: integer('email_usage').default(0).notNull(),
    streamingUsage: integer('streaming_usage').default(0).notNull(), // in minutes

    smsLimit: integer('sms_limit'), // null = use tier default
    emailLimit: integer('email_limit'), // null = use tier default
    streamingLimit: integer('streaming_limit'), // null = use tier default
    billingExempt: integer('billing_exempt', { mode: 'boolean' }).default(false).notNull(), // Bypass limits/charges

    // Usage Stats (Updated via triggers/logic)
    storageUsage: integer('storage_usage').default(0).notNull(), // in bytes
    memberCount: integer('member_count').default(0).notNull(),
    instructorCount: integer('instructor_count').default(0).notNull(),

    lastBilledAt: integer('last_billed_at', { mode: 'timestamp' }), // Track last chargeback invoice
    archivedAt: integer('archived_at', { mode: 'timestamp' }),
    gracePeriodEndsAt: integer('grace_period_ends_at', { mode: 'timestamp' }),
    studentAccessDisabled: integer('student_access_disabled', { mode: 'boolean' }).default(false).notNull(),
    aggregatorConfig: text('aggregator_config', { mode: 'json' }), // { classpass: { partnerId: '...' }, gympass: { ... } }

    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
});

// --- Uploads (File Tracking) ---
export const uploads = sqliteTable('uploads', {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id),
    fileKey: text('file_key').notNull(), // R2 Key
    fileUrl: text('file_url').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    mimeType: text('mime_type').notNull(),
    originalName: text('original_name'),
    uploadedBy: text('uploaded_by'), // User ID
    title: text('title'), // User-friendly title
    description: text('description'), // Description
    tags: text('tags', { mode: 'json' }), // Tags
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (table) => ({
    tenantIdx: index('upload_tenant_idx').on(table.tenantId),
}));

// --- Tenant Features (Entitlements) ---
export const tenantFeatures = sqliteTable('tenant_features', {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    featureKey: text('feature_key').notNull(), // e.g. 'financials', 'vod', 'zoom'
    enabled: integer('enabled', { mode: 'boolean' }).default(false).notNull(),
    source: text('source', { enum: ['manual', 'subscription', 'trial'] }).default('manual'), // 'manual', 'subscription', 'trial'
    updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (table) => ({
    uniqueFeature: uniqueIndex('unique_feature_idx').on(table.tenantId, table.featureKey),
}));

// --- Global Users (Clerk-linked) ---
export const users = sqliteTable('users', {
    id: text('id').primaryKey(), // Clerk ID
    email: text('email').notNull(),
    profile: text('profile', { mode: 'json' }), // Global profile: { firstName, lastName, portraitUrl }
    isPlatformAdmin: integer('is_platform_admin', { mode: 'boolean' }).default(false), // Legacy boolean flag (keep for compat, but role supersedes)
    role: text('role', { enum: ['owner', 'admin', 'user'] }).default('user').notNull(), // New Role System
    phone: text('phone'),
    dob: integer('dob', { mode: 'timestamp' }),
    address: text('address'), // Full address string or JSON
    isMinor: integer('is_minor', { mode: 'boolean' }).default(false),
    stripeCustomerId: text('stripe_customer_id'), // Platform-level Stripe Customer ID
    stripeAccountId: text('stripe_account_id'), // Instructor's Stripe Connect Account ID
    mfaEnabled: integer('mfa_enabled', { mode: 'boolean' }).default(false), // Tracked from Clerk/Auth Token
    pushToken: text('push_token'), // Expo Push Token
    lastActiveAt: integer('last_active_at', { mode: 'timestamp' }), // Timestamp of last API request
    lastLocation: text('last_location', { mode: 'json' }), // JSON: { city, country, lat, lng }
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (table) => ({
    emailIdx: index('email_idx').on(table.email),
    stripeCustomerIdx: index('user_stripe_customer_idx').on(table.stripeCustomerId), // Fast webhook lookup
}));

// --- User Relationships (Family) ---
export const userRelationships = sqliteTable('user_relationships', {
    id: text('id').primaryKey(),
    parentUserId: text('parent_user_id').notNull().references(() => users.id),
    childUserId: text('child_user_id').notNull().references(() => users.id),
    type: text('type', { enum: ['parent_child', 'spouse', 'guardian'] }).default('parent_child').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (table) => ({
    parentIdx: index('parent_idx').on(table.parentUserId),
    childIdx: index('child_idx').on(table.childUserId),
}));

// --- Tenant Members ---
// Links a Global User to a specific Tenant
export const tenantMembers = sqliteTable('tenant_members', {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id),
    userId: text('user_id').notNull().references(() => users.id),
    profile: text('profile', { mode: 'json' }), // Studio-specific profile overrides (e.g. bio for instructors)
    settings: text('settings', { mode: 'json' }), // User's preferences for this studio (notifications etc)
    customFields: text('custom_fields', { mode: 'json' }), // JSON: { tshirt_size: 'L' }
    status: text('status', { enum: ['active', 'inactive', 'archived'] }).default('active').notNull(),
    joinedAt: integer('joined_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),

    // AI Churn Prediction
    churnScore: integer('churn_score').default(100), // 0-100 (100 = Safe)
    churnStatus: text('churn_status', { enum: ['safe', 'at_risk', 'churned'] }).default('safe'),
    lastChurnCheck: integer('last_churn_check', { mode: 'timestamp' }),

    // Member Engagement Scoring
    engagementScore: integer('engagement_score').default(50), // 0-100 (higher = more engaged)
    lastEngagementCalc: integer('last_engagement_calc', { mode: 'timestamp' }),

    // TCPA SMS Consent (Compliance)
    smsConsent: integer('sms_consent', { mode: 'boolean' }).default(false), // Has user opted-in to SMS?
    smsConsentAt: integer('sms_consent_at', { mode: 'timestamp' }), // When consent was given
    smsOptOutAt: integer('sms_opt_out_at', { mode: 'timestamp' }), // When user opted out (STOP)
}, (table) => ({
    tenantUserIdx: index('tenant_user_idx').on(table.tenantId, table.userId),
    engagementIdx: index('member_engagement_idx').on(table.engagementScore),
}));

// --- Invitations ---
export const tenantInvitations = sqliteTable('tenant_invitations', {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id),
    email: text('email').notNull(),
    role: text('role', { enum: ['owner', 'admin', 'instructor', 'student'] }).default('student').notNull(),
    token: text('token').notNull().unique(),
    expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
    acceptedAt: integer('accepted_at', { mode: 'timestamp' }),
    invitedBy: text('invited_by').notNull(), // User ID
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (table) => ({
    tenantEmailIdx: index('invitation_tenant_email_idx').on(table.tenantId, table.email),
    tokenIdx: uniqueIndex('invitation_token_idx').on(table.token),
}));



// --- Tenant Roles ---
// A member can have multiple roles in a tenant (e.g. Owner + Instructor)
// If role is 'custom', customRoleId must be provided.
export const tenantRoles = sqliteTable('tenant_roles', {
    id: text('id').primaryKey(),
    memberId: text('member_id').notNull().references(() => tenantMembers.id),
    role: text('role', { enum: ['owner', 'admin', 'instructor', 'student', 'custom'] }).notNull(),
    customRoleId: text('custom_role_id').references(() => customRoles.id), // Only used if role='custom'
    permissions: text('permissions', { mode: 'json' }), // JSON Array of specific permissions e.g. ['manage_billing']
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (table) => ({
    memberRoleIdx: index('member_role_idx').on(table.memberId, table.role),
    customRoleIdx: index('member_custom_role_idx').on(table.memberId, table.customRoleId),
}));
// Actually, simpler PK: [memberId, role] if role != custom, but if role==custom, we might have multiple?
// Let's assume one 'custom' role entry per member per specific custom role? 
// If I assign 2 custom roles, I need checks.
// Let's stick to: member can have 'owner', 'instructor', and MULTIPLE 'custom' roles?
// Drizzle Composite PK with nullable columns is tricky.
// Improved Design: just use a unique ID for the row if it gets complex, but let's keep it simple for now.
// If role is 'custom', uniqueness should be on [memberId, customRoleId].
// If role is 'owner', uniqueness on [memberId, role].

// For simplicity in Phase 30: Let's assume a member has a list of roles.
// If I want to assign Custom Role A and Custom Role B, they are distinct rows.
// Row 1: role='custom', customRoleId='A'
// Row 2: role='custom', customRoleId='B'
// So PK should include customRoleId (sqlite handles nullable in PK uniquely? No.)
// D1/SQLite: Primary Key columns must not be null.

// ERROR PREVENT: customRoleId CANNOT be in PK if it is nullable.
// Solution: Add a surrogate key `id` OR make `customRoleId` not null but default to empty string equivalent? No.
// Alternative: `tenant_roles` is just for system roles. Create `tenant_member_custom_roles` table?
// OR: Just make `customRoleId` non-null for keys and verify logic locally. 
// BUT legacy data has no customRoleId.

// New Table Approach is safer for migration and logic.

// Re-defining tenantRoles (keeping backward compat)
// We will ADD a new table `memberCustomRoles` instead of modifying `tenantRoles` heavily to break PKs.


// --- Advanced RBAC: Custom Roles ---
export const customRoles = sqliteTable('custom_roles', {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id),
    name: text('name').notNull(), // e.g. "Front Desk", "Manager"
    description: text('description'),
    permissions: text('permissions', { mode: 'json' }).notNull(), // Array of permissions
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (table) => ({
    tenantIdx: index('custom_role_tenant_idx').on(table.tenantId),
}));

// Junction: Member <-> Custom Role
export const memberCustomRoles = sqliteTable('member_custom_roles', {
    memberId: text('member_id').notNull().references(() => tenantMembers.id),
    customRoleId: text('custom_role_id').notNull().references(() => customRoles.id),
    assignedAt: integer('assigned_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
    assignedBy: text('assigned_by'), // User ID
}, (table) => ({
    pk: primaryKey({ columns: [table.memberId, table.customRoleId] }),
}));

// --- Audit Logs ---
export const auditLogs = sqliteTable('audit_logs', {
    id: text('id').primaryKey(),
    actorId: text('actor_id'), // User who performed the action
    tenantId: text('tenant_id').references(() => tenants.id),
    action: text('action').notNull(), // e.g., 'impersonate', 'update_settings'
    targetId: text('target_id'), // User/Class/Tenant ID affected
    targetType: text('target_type'), // e.g., 'member', 'class', 'tenant'
    details: text('details', { mode: 'json' }),
    ipAddress: text('ip_address'),
    country: text('country'), // ISO 3166-1 alpha-2 code
    city: text('city'),
    region: text('region'), // State/Province
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (table) => ({
    tenantIdx: index('audit_tenant_idx').on(table.tenantId),
    targetIdx: index('audit_target_idx').on(table.targetType, table.targetId),
}));

// --- Usage Logs (Billing) ---
export const usageLogs = sqliteTable('usage_logs', {
    id: text('id').primaryKey(), // UUID
    tenantId: text('tenant_id').notNull().references(() => tenants.id),
    metric: text('metric').notNull(), // 'sms_segments', 'emails_sent', 'vod_storage_gb'
    value: integer('value').notNull().default(1),
    timestamp: integer('timestamp', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
    meta: text('meta', { mode: 'json' }), // Optional metadata (e.g. { messageId: '...' })
}, (table) => ({
    tenantMetricIdx: index('usage_tenant_metric_idx').on(table.tenantId, table.metric, table.timestamp),
    metricIdx: index('usage_metric_idx').on(table.metric, table.timestamp), // For platform-wide aggregation
}));

// --- Locations ---
export const locations = sqliteTable('locations', {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id),
    name: text('name').notNull(),
    address: text('address'),
    layout: text('layout', { mode: 'json' }), // JSON: { rows: 5, cols: 5, spots: [{ id: 'A1', type: 'standard', x: 0, y: 0 }] }
    timezone: text('timezone').default('UTC'),
    isPrimary: integer('is_primary', { mode: 'boolean' }).default(false),
    settings: text('settings', { mode: 'json' }), // Location-specific settings (hours, contact, etc)
    isActive: integer('is_active', { mode: 'boolean' }).default(true),
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
});

// --- Class Series (Recurring Logic) ---
export const classSeries = sqliteTable('class_series', {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id),
    instructorId: text('instructor_id').notNull().references(() => tenantMembers.id),
    locationId: text('location_id').references(() => locations.id),
    title: text('title').notNull(),
    description: text('description'),
    durationMinutes: integer('duration_minutes').notNull(),
    price: integer('price').default(0),
    currency: text('currency').default('usd'),
    recurrenceRule: text('recurrence_rule').notNull(), // RRule string e.g. "FREQ=WEEKLY;BYDAY=MO,WE"
    validFrom: integer('valid_from', { mode: 'timestamp' }).notNull(),
    validUntil: integer('valid_until', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
});

// --- Classes (Sessions) ---
export const classes = sqliteTable('classes', {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id),
    instructorId: text('instructor_id').references(() => tenantMembers.id), // Nullable - instructor may be TBA
    locationId: text('location_id').references(() => locations.id),
    seriesId: text('series_id').references(() => classSeries.id), // Link to parent series
    title: text('title').notNull(),
    description: text('description'),
    startTime: integer('start_time', { mode: 'timestamp' }).notNull(),
    durationMinutes: integer('duration_minutes').notNull(),
    capacity: integer('capacity'),
    waitlistCapacity: integer('waitlist_capacity').default(10), // Default 10 spots on waitlist
    price: integer('price').default(0), // In cents
    memberPrice: integer('member_price'), // Discounted price for members (nullable)
    currency: text('currency').default('usd'),

    // Payroll Override (Phase 7)
    payrollModel: text('payroll_model', { enum: ['flat', 'percentage', 'hourly'] }), // Null = use Instructor Default
    payrollValue: integer('payroll_value'), // Rate in cents or Basis Points (5000 = 50%)

    type: text('type', { enum: ['class', 'workshop', 'event', 'appointment'] }).default('class').notNull(),
    allowCredits: integer('allow_credits', { mode: 'boolean' }).default(true).notNull(), // Can pay with credits?
    includedPlanIds: text('included_plan_ids', { mode: 'json' }), // JSON Array of Plan IDs that get this free
    zoomMeetingUrl: text('zoom_meeting_url'),
    zoomMeetingId: text('zoom_meeting_id'),
    zoomPassword: text('zoom_password'),
    zoomEnabled: integer('zoom_enabled', { mode: 'boolean' }).default(false),
    thumbnailUrl: text('thumbnail_url'),
    cloudflareStreamId: text('cloudflare_stream_id'),
    recordingStatus: text('recording_status', { enum: ['processing', 'ready', 'error'] }),

    // Hybrid Video
    videoProvider: text('video_provider', { enum: ['zoom', 'livekit', 'offline'] }).default('offline').notNull(),
    livekitRoomName: text('livekit_room_name'),
    livekitRoomSid: text('livekit_room_sid'),

    status: text('status', { enum: ['active', 'cancelled', 'archived'] }).default('active').notNull(),

    // Cancellation & Archive Logic
    minStudents: integer('min_students').default(1),
    autoCancelThreshold: integer('auto_cancel_threshold'), // Hours before start
    autoCancelEnabled: integer('auto_cancel_enabled', { mode: 'boolean' }).default(false),

    googleEventId: text('google_event_id'),

    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (table) => ({
    tenantTimeIdx: index('tenant_time_idx').on(table.tenantId, table.startTime),
    seriesIdx: index('series_idx').on(table.seriesId),
    tenantStartIdx: index('class_tenant_start_idx').on(table.tenantId, table.startTime), // Optimize schedule queries
}));

// --- Student Notes (CRM) ---
export const studentNotes = sqliteTable('student_notes', {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id),
    studentId: text('student_id').notNull().references(() => tenantMembers.id), // The subject
    authorId: text('author_id').notNull().references(() => tenantMembers.id), // The writer (staff)
    note: text('note').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (table) => ({
    studentIdx: index('student_idx').on(table.studentId),
}));

// --- Subscriptions ---
export const subscriptions = sqliteTable('subscriptions', {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id),
    tenantId: text('tenant_id').notNull().references(() => tenants.id),
    memberId: text('member_id').references(() => tenantMembers.id), // Link to Member
    planId: text('plan_id').references(() => membershipPlans.id), // Link to Plan

    status: text('status', { enum: ['active', 'past_due', 'canceled', 'incomplete', 'trialing'] }).notNull(),
    tier: text('tier', { enum: ['basic', 'premium'] }).default('basic'), // Deprecated in favor of planId
    currentPeriodEnd: integer('current_period_end', { mode: 'timestamp' }),
    stripeSubscriptionId: text('stripe_subscription_id'),
    canceledAt: integer('canceled_at', { mode: 'timestamp' }),

    // Dunning Automation
    dunningState: text('dunning_state', { enum: ['active', 'warning1', 'warning2', 'warning3', 'failed', 'recovered'] }),
    lastDunningAt: integer('last_dunning_at', { mode: 'timestamp' }),

    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
});

// --- Bookings ---
export const bookings = sqliteTable('bookings', {
    id: text('id').primaryKey(),
    classId: text('class_id').notNull().references(() => classes.id),
    memberId: text('member_id').notNull().references(() => tenantMembers.id), // Bookings are by Members
    status: text('status', { enum: ['confirmed', 'cancelled', 'waitlisted'] }).default('confirmed'),
    attendanceType: text('attendance_type', { enum: ['in_person', 'zoom'] }).default('in_person').notNull(),
    checkedInAt: integer('checked_in_at', { mode: 'timestamp' }), // Attendance tracking

    // Guest Pass Logic
    isGuest: integer('is_guest', { mode: 'boolean' }).default(false),
    guestName: text('guest_name'),
    guestEmail: text('guest_email'),

    // Spot Booking Logic
    spotNumber: text('spot_number'), // e.g. "A1" or "10"

    // Waitlist Management
    waitlistPosition: integer('waitlist_position'), // Position in waitlist (1 = first in line)
    waitlistNotifiedAt: integer('waitlist_notified_at', { mode: 'timestamp' }), // When promotion notification was sent

    // Payment Tracking
    paymentMethod: text('payment_method', { enum: ['credit', 'subscription', 'drop_in', 'free'] }),
    usedPackId: text('used_pack_id').references(() => purchasedPacks.id), // If credit, which pack?

    externalSource: text('external_source'),
    externalId: text('external_id'),
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (table) => ({
    memberClassIdx: index('member_class_idx').on(table.memberId, table.classId),
    waitlistIdx: index('booking_waitlist_idx').on(table.classId, table.waitlistPosition),
    classStatusIdx: index('booking_class_status_idx').on(table.classId, table.status), // Fast roster fetch
}));

// --- Appointments (Private Sessions) ---

export const appointmentServices = sqliteTable('appointment_services', {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id),
    title: text('title').notNull(), // e.g. "Private Yoga", "Consultation"
    description: text('description'),
    durationMinutes: integer('duration_minutes').notNull(),
    price: integer('price').default(0),
    currency: text('currency').default('usd'),
    isActive: integer('is_active', { mode: 'boolean' }).default(true),
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
});

export const availabilities = sqliteTable('availabilities', {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id),
    instructorId: text('instructor_id').notNull().references(() => tenantMembers.id),
    dayOfWeek: integer('day_of_week').notNull(), // 0 = Sunday, 1 = Monday, etc.
    startTime: text('start_time').notNull(), // HH:MM (24h)
    endTime: text('end_time').notNull(), // HH:MM (24h)
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (table) => ({
    instructorIdx: index('avail_instructor_idx').on(table.instructorId),
}));

export const appointments = sqliteTable('appointments', {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id),
    serviceId: text('service_id').notNull().references(() => appointmentServices.id),
    instructorId: text('instructor_id').notNull().references(() => tenantMembers.id), // The provider
    memberId: text('member_id').notNull().references(() => tenantMembers.id), // The customer

    startTime: integer('start_time', { mode: 'timestamp' }).notNull(),
    endTime: integer('end_time', { mode: 'timestamp' }).notNull(),

    status: text('status', { enum: ['pending', 'confirmed', 'cancelled', 'completed'] }).default('confirmed'),
    locationId: text('location_id').references(() => locations.id), // Where the appointment happens
    notes: text('notes'),

    // Zoom/Virtual support
    zoomMeetingUrl: text('zoom_meeting_url'),
    googleEventId: text('google_event_id'),

    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (table) => ({
    tenantTimeIdx: index('apt_tenant_time_idx').on(table.tenantId, table.startTime),
    instructorTimeIdx: index('apt_instructor_time_idx').on(table.instructorId, table.startTime),
    memberIdx: index('apt_member_idx').on(table.memberId),
}));

// --- Payroll & Payouts ---

export const payrollConfig = sqliteTable('payroll_config', {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id),
    userId: text('user_id').notNull().references(() => users.id), // Link to Global User or Member? Let's link to User for portability, but Member is better for tenant-scoping. Let's use Member ID.
    memberId: text('member_id').references(() => tenantMembers.id), // Better to use Member ID

    payModel: text('pay_model', { enum: ['flat', 'percentage', 'hourly'] }).notNull(), // 'flat' (per class/session), 'percentage' (of revenue), 'hourly' (based on duration)
    rate: integer('rate').notNull(), // If flat/hourly: in cents. If percentage: in basis points (e.g. 5000 = 50%)
    payoutBasis: text('payout_basis', { enum: ['gross', 'net'] }).default('net'), // For percentage: calculate on gross price or net (after Stripe fees)

    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (table) => ({
    memberIdx: index('payroll_config_member_idx').on(table.memberId),
}));

export const payouts = sqliteTable('payouts', {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id),
    instructorId: text('instructor_id').notNull().references(() => tenantMembers.id),

    amount: integer('amount').notNull(), // Total paid in cents
    currency: text('currency').default('usd'),

    periodStart: integer('period_start', { mode: 'timestamp' }).notNull(),
    periodEnd: integer('period_end', { mode: 'timestamp' }).notNull(),

    status: text('status', { enum: ['processing', 'paid', 'failed'] }).default('processing'),
    paidAt: integer('paid_at', { mode: 'timestamp' }),
    stripeTransferId: text('stripe_transfer_id'),

    notes: text('notes'),
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
});

export const payrollItems = sqliteTable('payroll_items', {
    id: text('id').primaryKey(),
    payoutId: text('payout_id').notNull().references(() => payouts.id),

    type: text('type', { enum: ['class', 'appointment'] }).notNull(),
    referenceId: text('reference_id').notNull(), // ID of the class or appointment

    amount: integer('amount').notNull(), // Calculated earning for this item

    details: text('details', { mode: 'json' }), // Snapshot of calculation logic (e.g. "50% of $100")
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (table) => ({
    payoutIdx: index('payroll_item_payout_idx').on(table.payoutId),
    refIdx: index('payroll_item_ref_idx').on(table.referenceId),
}));


// --- Marketing & Email Logs ---

export const marketingCampaigns = sqliteTable('marketing_campaigns', {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id),

    subject: text('subject').notNull(),
    content: text('content').notNull(), // HTML or Text content

    status: text('status', { enum: ['draft', 'sending', 'sent', 'failed'] }).default('draft'),
    sentAt: integer('sent_at', { mode: 'timestamp' }),

    stats: text('stats', { mode: 'json' }), // { sent: 100, failed: 0 }
    filters: text('filters', { mode: 'json' }), // { ageMin: 18, ageMax: 30, tags: ['yoga'] }

    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
});

export const marketingAutomations = sqliteTable('marketing_automations', {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').references(() => tenants.id), // Nullable for platform global templates

    // Expanded Trigger Logic
    triggerEvent: text('trigger_event').notNull(), // e.g. 'new_student', 'class_attended', 'order_completed', 'absent'
    triggerCondition: text('trigger_condition', { mode: 'json' }), // Filter: { planId: '...', minAmount: 1000 }

    // Template & Targeting
    templateId: text('template_id'), // Resend Template ID (optional, overrides content)
    audienceFilter: text('audience_filter', { mode: 'json' }), // { ageMin: 18, ageMax: 65, tags: ['vip'] }

    subject: text('subject').notNull(),
    content: text('content'), // HTML or Text (nullable for simple triggers)

    isEnabled: integer('is_enabled', { mode: 'boolean' }).default(false).notNull(),
    metadata: text('metadata', { mode: 'json' }), // Extra UI config

    // Timing Logic
    timingType: text('timing_type', { enum: ['immediate', 'delay', 'before', 'after'] }).default('immediate').notNull(),
    timingValue: integer('timing_value').default(0), // Hours. e.g. 24 for "1 day after". 48 for "2 days before" (if timingType=before)

    // Legacy/Convenience (keep for migration or map to timingType='delay')
    delayHours: integer('delay_hours').default(0),

    channels: text('channels', { mode: 'json' }).default(sql`'["email"]'`), // ['email', 'sms']
    recipients: text('recipients', { mode: 'json' }).default(sql`'["student"]'`), // ['student', 'owner']
    couponConfig: text('coupon_config', { mode: 'json' }), // { type: 'percent', value: 20, validityDays: 7 }

    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (table) => ({
    tenantIdx: index('automation_tenant_idx').on(table.tenantId),
}));

export const automationLogs = sqliteTable('automation_logs', {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id),
    automationId: text('automation_id').notNull().references(() => marketingAutomations.id),
    userId: text('user_id').notNull().references(() => users.id),
    channel: text('channel').notNull(), // 'email' or 'sms'
    triggeredAt: integer('triggered_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
    metadata: text('metadata', { mode: 'json' }), // { generatedCouponId: '...' }
}, (table) => ({
    uniqueLog: uniqueIndex('automation_log_unique_idx').on(table.automationId, table.userId, table.channel), // Prevent duplicate send of SAME automation to SAME user
    tenantIdx: index('automation_log_tenant_idx').on(table.tenantId),
}));

export const emailLogs = sqliteTable('email_logs', {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id),

    campaignId: text('campaign_id'), // Optional, null if transactional
    recipientEmail: text('recipient_email').notNull(),
    subject: text('subject').notNull(),
    templateId: text('template_id'), // e.g. 'welcome_owner'
    data: text('data', { mode: 'json' }), // Payload for replay capability

    status: text('status', { enum: ['sent', 'failed', 'bounced'] }).default('sent'), // Simulated status
    error: text('error'), // Failure reason
    sentAt: integer('sent_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),

    metadata: text('metadata', { mode: 'json' }), // Extra debug info
}, (table) => ({
    tenantIdx: index('email_log_tenant_idx').on(table.tenantId),
    campaignIdx: index('email_log_campaign_idx').on(table.campaignId),
    emailIdx: index('email_log_email_idx').on(table.recipientEmail),
    sentAtIdx: index('email_log_sent_at_idx').on(table.sentAt),
}));





// --- Membership Plans (Tiers) ---
export const membershipPlans = sqliteTable('membership_plans', {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id),
    name: text('name').notNull(), // e.g. "Unlimited", "10 Class Pack"
    description: text('description'),
    price: integer('price').default(0), // in cents
    currency: text('currency').default('usd'),
    interval: text('interval', { enum: ['month', 'year', 'week', 'one_time'] }).default('month'),
    imageUrl: text('image_url'),
    overlayTitle: text('overlay_title'),
    overlaySubtitle: text('overlay_subtitle'),
    vodEnabled: integer('vod_enabled', { mode: 'boolean' }).default(false), // Grant VOD access?
    active: integer('active', { mode: 'boolean' }).default(true),
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
});

export const platformPlans = sqliteTable('platform_plans', {
    id: text('id').primaryKey(),
    name: text('name').notNull(), // e.g. "Growth"
    slug: text('slug').notNull().unique(), // e.g. "growth"
    description: text('description'),

    // Stripe Metadata
    stripePriceIdMonthly: text('stripe_price_id_monthly'),
    stripePriceIdAnnual: text('stripe_price_id_annual'),

    // Cached Prices (for display)
    monthlyPriceCents: integer('monthly_price_cents').default(0),
    annualPriceCents: integer('annual_price_cents').default(0),

    // Config
    trialDays: integer('trial_days').default(14).notNull(),
    features: text('features', { mode: 'json' }).notNull(), // Array of strings
    highlight: integer('highlight', { mode: 'boolean' }).default(false),
    active: integer('active', { mode: 'boolean' }).default(true),

    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
});

// --- Waivers ---
export const waiverTemplates = sqliteTable('waiver_templates', {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id),
    title: text('title').notNull(),
    content: text('content').notNull(), // HTML or Rich Text
    pdfUrl: text('pdf_url'), // Link to R2 PDF
    active: integer('active', { mode: 'boolean' }).default(true),
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
});

export const waiverSignatures = sqliteTable('waiver_signatures', {
    id: text('id').primaryKey(),
    templateId: text('template_id').notNull().references(() => waiverTemplates.id),
    memberId: text('member_id').notNull().references(() => tenantMembers.id),
    signedByMemberId: text('signed_by_member_id').references(() => tenantMembers.id), // If parent signs for child
    signedAt: integer('signed_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
    ipAddress: text('ip_address'),
    signatureData: text('signature_data'), // Optional: Base64 signature image or initial
}, (table) => ({
    memberTemplateIdx: index('member_template_idx').on(table.memberId, table.templateId),
}));

// --- Commerce: Class Packs ---
export const classPackDefinitions = sqliteTable('class_pack_definitions', {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id),
    name: text('name').notNull(), // e.g. "10 Class Pass"
    price: integer('price').default(0), // in cents
    credits: integer('credits').notNull(), // Number of classes
    expirationDays: integer('expiration_days'), // Validity in days
    imageUrl: text('image_url'), // Visual representation
    vodEnabled: integer('vod_enabled', { mode: 'boolean' }).default(false), // Grant VOD access?
    active: integer('active', { mode: 'boolean' }).default(true),
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
});

export const purchasedPacks = sqliteTable('purchased_packs', {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id),
    memberId: text('member_id').notNull().references(() => tenantMembers.id),
    packDefinitionId: text('pack_definition_id').notNull().references(() => classPackDefinitions.id),
    initialCredits: integer('initial_credits').notNull(),
    remainingCredits: integer('remaining_credits').notNull(),
    price: integer('purchased_price_cents').default(0), // Actual price paid
    status: text('status', { enum: ['active', 'refunded', 'expired'] }).default('active').notNull(),
    stripePaymentId: text('stripe_payment_id'),
    expiresAt: integer('expires_at', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (table) => ({
    memberPackIdx: index('member_pack_idx').on(table.memberId),
    memberCreditsIdx: index('pack_member_credits_idx').on(table.memberId, table.remainingCredits), // Fast credit check
}));

// --- Phase 4: Discounts ---
export const coupons = sqliteTable('coupons', {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id),
    code: text('code').notNull(),
    type: text('type', { enum: ['percent', 'amount'] }).notNull(), // percent or flat amount
    value: integer('value').notNull(), // 10 = 10% or 1000 = $10.00
    active: integer('active', { mode: 'boolean' }).default(true),
    usageLimit: integer('usage_limit'), // null = unlimited
    expiresAt: integer('expires_at', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (table) => ({
    tenantCodeIdx: uniqueIndex('tenant_code_idx').on(table.tenantId, table.code),
}));

export const couponRedemptions = sqliteTable('coupon_redemptions', {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id),
    couponId: text('coupon_id').notNull().references(() => coupons.id),
    userId: text('user_id').notNull().references(() => users.id),
    orderId: text('order_id'), // Optional link to purchase
    redeemedAt: integer('redeemed_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
});

// --- Phase 4: SMS ---
export const smsConfig = sqliteTable('sms_config', {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id),
    provider: text('provider', { enum: ['twilio', 'mock'] }).default('mock'),
    senderId: text('sender_id'), // Alphanumeric or Phone Number
    enabledEvents: text('enabled_events', { mode: 'json' }), // { class_reminder: true }
    updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
});

export const smsLogs = sqliteTable('sms_logs', {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id),
    recipientPhone: text('recipient_phone').notNull(),
    body: text('body').notNull(),
    status: text('status', { enum: ['queued', 'sent', 'delivered', 'failed'] }).default('queued'),
    sentAt: integer('sent_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
    metadata: text('metadata', { mode: 'json' }),
});



export const pushLogs = sqliteTable('push_logs', {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id),
    recipientToken: text('recipient_token').notNull(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    status: text('status', { enum: ['queued', 'sent', 'delivered', 'failed'] }).default('queued'),
    sentAt: integer('sent_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
    metadata: text('metadata', { mode: 'json' }),
});

// --- Phase 6: Substitute Management ---
export const substitutions = sqliteTable('substitutions', {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id),
    classId: text('class_id').notNull().references(() => classes.id),
    requestingInstructorId: text('requesting_instructor_id').notNull().references(() => tenantMembers.id),
    coveringInstructorId: text('covering_instructor_id').references(() => tenantMembers.id), // Nullable until claimed

    status: text('status', { enum: ['pending', 'claimed', 'approved', 'declined'] }).default('pending').notNull(),
    notes: text('notes'),

    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (table) => ({
    tenantIdx: index('sub_tenant_idx').on(table.tenantId),
    classIdx: index('sub_class_idx').on(table.classId),
    statusIdx: index('sub_status_idx').on(table.status),
}));

// --- Phase 5: POS & Retail ---

export const products = sqliteTable('products', {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id),
    supplierId: text('supplier_id').references(() => suppliers.id),
    name: text('name').notNull(),
    description: text('description'),
    category: text('category'), // e.g. "Equipement", "Apparel", "Food"
    sku: text('sku'),
    price: integer('price').default(0).notNull(), // in cents
    currency: text('currency').default('usd'),
    stockQuantity: integer('stock_quantity').default(0).notNull(),
    lowStockThreshold: integer('low_stock_threshold').default(5),
    imageUrl: text('image_url'),
    stripeProductId: text('stripe_product_id'),
    stripePriceId: text('stripe_price_id'),
    isActive: integer('is_active', { mode: 'boolean' }).default(true).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (table) => ({
    tenantIdx: index('product_tenant_idx').on(table.tenantId),
    supplierIdx: index('product_supplier_idx').on(table.supplierId),
}));

export const suppliers = sqliteTable('suppliers', {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id),
    name: text('name').notNull(),
    contactName: text('contact_name'),
    email: text('email'),
    phone: text('phone'),
    address: text('address'),
    website: text('website'),
    notes: text('notes'),
    isActive: integer('is_active', { mode: 'boolean' }).default(true).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (table) => ({
    tenantIdx: index('supplier_tenant_idx').on(table.tenantId),
}));

export const inventoryAdjustments = sqliteTable('inventory_adjustments', {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id),
    productId: text('product_id').notNull().references(() => products.id),
    staffId: text('staff_id').references(() => tenantMembers.id),
    delta: integer('delta').notNull(), // positive for restock, negative for deduction
    reason: text('reason', { enum: ['restock', 'correction', 'damage', 'loss', 'sale', 'return', 'po_received'] }).notNull(),
    notes: text('notes'),
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (table) => ({
    productIdx: index('inv_adj_product_idx').on(table.productId),
    tenantIdx: index('inv_adj_tenant_idx').on(table.tenantId),
}));

export const purchaseOrders = sqliteTable('purchase_orders', {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id),
    supplierId: text('supplier_id').notNull().references(() => suppliers.id),
    staffId: text('staff_id').references(() => tenantMembers.id),
    poNumber: text('po_number').notNull(),
    status: text('status', { enum: ['draft', 'sent', 'partially_received', 'received', 'cancelled'] }).default('draft').notNull(),
    totalAmount: integer('total_amount').default(0).notNull(),
    currency: text('currency').default('usd'),
    notes: text('notes'),
    sentAt: integer('sent_at', { mode: 'timestamp' }),
    receivedAt: integer('received_at', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (table) => ({
    tenantIdx: index('po_tenant_idx').on(table.tenantId),
    supplierIdx: index('po_supplier_idx').on(table.supplierId),
}));

export const purchaseOrderItems = sqliteTable('purchase_order_items', {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id),
    purchaseOrderId: text('purchase_order_id').notNull().references(() => purchaseOrders.id, { onDelete: 'cascade' }),
    productId: text('product_id').notNull().references(() => products.id),
    quantityOrdered: integer('quantity_ordered').notNull(),
    quantityReceived: integer('quantity_received').default(0).notNull(),
    unitCost: integer('unit_cost').notNull(), // in cents
    totalCost: integer('total_cost').notNull(),
}, (table) => ({
    poIdx: index('po_item_po_idx').on(table.purchaseOrderId),
    productIdx: index('po_item_product_idx').on(table.productId),
}));

export const posOrders = sqliteTable('pos_orders', {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id),
    memberId: text('member_id').references(() => tenantMembers.id), // Optional: Link to a student member
    staffId: text('staff_id').references(() => tenantMembers.id), // Staff who processed the sale

    totalAmount: integer('total_amount').notNull(), // Total in cents
    taxAmount: integer('tax_amount').default(0),
    status: text('status', { enum: ['pending', 'completed', 'cancelled', 'refunded'] }).default('completed').notNull(),
    paymentMethod: text('payment_method', { enum: ['card', 'cash', 'account', 'other'] }).default('card'),
    stripePaymentIntentId: text('stripe_payment_intent_id'),
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (table) => ({
    tenantIdx: index('pos_order_tenant_idx').on(table.tenantId),
    memberIdx: index('pos_order_member_idx').on(table.memberId),
}));

// --- Phase 4: Referrals ---
export const referralCodes = sqliteTable('referral_codes', {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id),
    userId: text('user_id').notNull().references(() => users.id), // The referrer
    memberId: text('member_id').references(() => tenantMembers.id), // Optional link to member profile (for easier lookup)
    code: text('code').notNull(), // Unique string e.g. "JOHN-123"
    clicks: integer('clicks').default(0),
    signups: integer('signups').default(0),
    earnings: integer('earnings').default(0), // Total earned in cents
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
    active: integer('active', { mode: 'boolean' }).default(true),
}, (table) => ({
    uniqueCode: uniqueIndex('referral_code_unique_idx').on(table.tenantId, table.code),
    userIdx: index('referral_user_idx').on(table.userId),
}));

export const referralRewards = sqliteTable('referral_rewards', {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id),
    referrerUserId: text('referrer_user_id').notNull().references(() => users.id),
    referredUserId: text('referred_user_id').notNull().references(() => users.id), // The new user
    status: text('status', { enum: ['pending', 'paid', 'voided'] }).default('pending'),
    amount: integer('amount').notNull(), // Amount to be paid/credited
    currency: text('currency').default('usd'),
    paidAt: integer('paid_at', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (table) => ({
    referrerIdx: index('reward_referrer_idx').on(table.referrerUserId),
}));

export const posOrderItems = sqliteTable('pos_order_items', {
    id: text('id').primaryKey(),
    orderId: text('order_id').notNull().references(() => posOrders.id),
    productId: text('product_id').notNull().references(() => products.id),

    quantity: integer('quantity').notNull(),
    unitPrice: integer('unit_price').notNull(), // Snapshot of price at time of sale
    totalPrice: integer('total_price').notNull(),

    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (table) => ({
    orderIdx: index('pos_item_order_idx').on(table.orderId),
    productId: index('pos_item_product_idx').on(table.productId),
}));

// --- Phase 10: Gift Cards ---
export const giftCards = sqliteTable('gift_cards', {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id),
    code: text('code').notNull(), // Unique per tenant
    initialValue: integer('initial_value').notNull(), // in cents
    currentBalance: integer('current_balance').notNull(), // in cents
    status: text('status', { enum: ['active', 'exhausted', 'disabled', 'expired'] }).default('active').notNull(),
    expiryDate: integer('expiry_date', { mode: 'timestamp' }),
    buyerMemberId: text('buyer_member_id').references(() => tenantMembers.id),
    stripePaymentId: text('stripe_payment_id'),
    recipientMemberId: text('recipient_member_id').references(() => tenantMembers.id), // Link to Student Member (if known)
    recipientEmail: text('recipient_email'),
    notes: text('notes'),
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (table) => ({
    tenantCodeIdx: uniqueIndex('gift_card_tenant_code_idx').on(table.tenantId, table.code),
    tenantIdx: index('gift_card_tenant_idx').on(table.tenantId),
}));

export const giftCardTransactions = sqliteTable('gift_card_transactions', {
    id: text('id').primaryKey(),
    giftCardId: text('gift_card_id').notNull().references(() => giftCards.id),
    amount: integer('amount').notNull(), // positive for load, negative for spend
    type: text('type', { enum: ['purchase', 'redemption', 'refund', 'adjustment'] }).notNull(),
    referenceId: text('reference_id'), // orderId, packId, etc.
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (table) => ({
    giftCardIdx: index('gift_card_tx_card_idx').on(table.giftCardId),
}));

// --- CRM: Leads ---
export const leads = sqliteTable('leads', {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    firstName: text('first_name'),
    lastName: text('last_name'),
    phone: text('phone'),
    status: text('status', { enum: ['new', 'contacted', 'trialing', 'converted', 'lost'] }).default('new').notNull(),
    source: text('source'), // e.g. "website", "referral"
    notes: text('notes'),
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (table) => ({
    tenantEmailIdx: uniqueIndex('lead_tenant_email_idx').on(table.tenantId, table.email),
    statusIdx: index('lead_status_idx').on(table.status),
}));

// --- Phase 4b: Gamified Loyalty (Challenges) ---
export const challenges = sqliteTable('challenges', {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id),
    title: text('title').notNull(), // e.g. "Summer Warrior"
    description: text('description'),
    type: text('type', { enum: ['count', 'streak', 'minutes'] }).notNull(), // 'count' = total classes, 'streak' = consecutive days/weeks, 'minutes' = total duration
    period: text('period', { enum: ['day', 'week', 'month'] }), // For streaks: e.g. "3 classes per [week]"
    frequency: integer('frequency').default(1), // e.g. [3] classes per week
    targetValue: integer('target_value').notNull(), // e.g. 10 weeks streak to complete
    rewardType: text('reward_type', { enum: ['badge', 'coupon', 'retail_credit'] }).notNull(),
    rewardValue: text('reward_value', { mode: 'json' }), // { badgeUrl: '...', couponId: '...' }
    startDate: integer('start_date', { mode: 'timestamp' }),
    endDate: integer('end_date', { mode: 'timestamp' }),
    active: integer('active', { mode: 'boolean' }).default(true),
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (table) => ({
    tenantIdx: index('challenge_tenant_idx').on(table.tenantId),
}));

export const userChallenges = sqliteTable('user_challenges', {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id),
    userId: text('user_id').notNull().references(() => users.id), // Global User ID
    challengeId: text('challenge_id').notNull().references(() => challenges.id),

    progress: integer('progress').default(0).notNull(),
    status: text('status', { enum: ['active', 'completed'] }).default('active').notNull(),
    metadata: text('metadata', { mode: 'json' }), // { currentPeriod: '2023-W01', periodCount: 2 }
    completedAt: integer('completed_at', { mode: 'timestamp' }),

    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (table) => ({
    userChallengeIdx: uniqueIndex('user_challenge_idx').on(table.userId, table.challengeId),
    tenantIdx: index('user_challenge_tenant_idx').on(table.tenantId),
}));

// --- Progress Tracking (Advanced Metrics) ---
export const progressMetricDefinitions = sqliteTable('progress_metric_definitions', {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    name: text('name').notNull(), // e.g. "Classes Attended", "Total Minutes", "Weight Lifted"
    category: text('category', { enum: ['mindfulness', 'strength', 'cardio', 'custom'] }).notNull(),
    unit: text('unit').notNull(), // e.g. "classes", "minutes", "lbs", "kg"
    icon: text('icon'), // Lucide icon name
    aggregation: text('aggregation', { enum: ['sum', 'max', 'avg', 'latest'] }).default('sum'),
    visibleToStudents: integer('visible_to_students', { mode: 'boolean' }).default(true).notNull(),
    active: integer('active', { mode: 'boolean' }).default(true).notNull(),
    displayOrder: integer('display_order').default(0).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (table) => ({
    tenantIdx: index('progress_metric_tenant_idx').on(table.tenantId),
    categoryIdx: index('progress_metric_category_idx').on(table.tenantId, table.category),
}));

export const memberProgressEntries = sqliteTable('member_progress_entries', {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    memberId: text('member_id').notNull().references(() => tenantMembers.id, { onDelete: 'cascade' }),
    metricDefinitionId: text('metric_definition_id').notNull().references(() => progressMetricDefinitions.id, { onDelete: 'cascade' }),
    value: integer('value').notNull(), // Actual value (e.g. 150 lbs, 45 minutes)
    recordedAt: integer('recorded_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
    source: text('source', { enum: ['auto', 'manual', 'import'] }).default('auto'),
    metadata: text('metadata', { mode: 'json' }), // { classId, exerciseName, notes }
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (table) => ({
    memberIdx: index('progress_entry_member_idx').on(table.memberId),
    metricIdx: index('progress_entry_metric_idx').on(table.metricDefinitionId),
    tenantIdx: index('progress_entry_tenant_idx').on(table.tenantId),
    recordedIdx: index('progress_entry_recorded_idx').on(table.memberId, table.recordedAt),
}));

// --- Phase 4b: Video Management ---
export const videos = sqliteTable('videos', {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').references(() => tenants.id), // Nullable for Platform videos
    title: text('title').notNull(),
    description: text('description'),

    // Storage
    r2Key: text('r2_key').notNull(),
    cloudflareStreamId: text('cloudflare_stream_id'),

    // Metadata
    duration: integer('duration').default(0), // Seconds
    width: integer('width'),
    height: integer('height'),
    sizeBytes: integer('size_bytes').default(0),

    // Status
    status: text('status', { enum: ['processing', 'ready', 'error'] }).default('processing').notNull(),
    source: text('source', { enum: ['zoom', 'livekit', 'upload'] }).default('upload'),

    // Non-Destructive Editing
    videoProvider: text('video_provider', { enum: ['zoom', 'livekit', 'offline'] }).default('offline').notNull(),
    livekitRoomName: text('livekit_room_name'),
    livekitRoomSid: text('livekit_room_sid'),

    trimStart: integer('trim_start'),
    trimEnd: integer('trim_end'),

    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (table) => ({
    tenantIdx: index('video_tenant_idx').on(table.tenantId),
    statusIdx: index('video_status_idx').on(table.status),
}));

// --- Webhook Security (Idempotency) ---
export const processedWebhooks = sqliteTable('processed_webhooks', {
    id: text('id').primaryKey(), // Event ID from Stripe/Clerk
    type: text('type').notNull(), // 'stripe', 'clerk'
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
});



// --- Phase 12: Smart Waitlists ---
export const waitlist = sqliteTable('waitlist', {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id),
    classId: text('class_id').notNull().references(() => classes.id),
    userId: text('user_id').notNull().references(() => users.id),
    position: integer('position').notNull(),
    status: text('status', { enum: ['pending', 'offered', 'expired', 'accepted', 'cancelled'] }).default('pending').notNull(),
    offerExpiresAt: integer('offer_expires_at', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (table) => ({
    classPositionIdx: index('waitlist_class_pos_idx').on(table.classId, table.position),
    userClassIdx: uniqueIndex('waitlist_user_class_idx').on(table.userId, table.classId),
}));

// --- Phase 12: Substitute Dispatch ---
export const subRequests = sqliteTable('sub_requests', {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id),
    classId: text('class_id').notNull().references(() => classes.id),
    originalInstructorId: text('original_instructor_id').notNull().references(() => tenantMembers.id),
    coveredByUserId: text('covered_by_user_id').references(() => tenantMembers.id), // Nullable until claimed

    status: text('status', { enum: ['open', 'filled', 'cancelled'] }).default('open').notNull(),
    message: text('message'),

    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (table) => ({
    tenantStatusIdx: index('sub_req_tenant_status_idx').on(table.tenantId, table.status),
    classIdx: index('sub_req_class_idx').on(table.classId),
}));


export const videoShares = sqliteTable('video_shares', {
    id: text('id').primaryKey(),
    videoId: text('video_id').notNull().references(() => videos.id, { onDelete: 'cascade' }),
    tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (table) => ({
    uniqueShare: uniqueIndex('unique_video_share').on(table.videoId, table.tenantId),
    tenantIdx: index('video_share_tenant_idx').on(table.tenantId),
}));

export const videoCollections = sqliteTable('video_collections', {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id),
    title: text('title').notNull(),
    description: text('description'),
    slug: text('slug').notNull(), // for public URLs
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (table) => ({
    tenantIdx: index('collection_tenant_idx').on(table.tenantId),
    tenantSlugIdx: uniqueIndex('collection_tenant_slug_idx').on(table.tenantId, table.slug),
}));

export const videoCollectionItems = sqliteTable('video_collection_items', {
    id: text('id').primaryKey(),
    collectionId: text('collection_id').notNull().references(() => videoCollections.id, { onDelete: 'cascade' }),
    videoId: text('video_id').notNull().references(() => videos.id, { onDelete: 'cascade' }),
    order: integer('order').notNull().default(0),
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (table) => ({
    collectionIdx: index('collection_item_idx').on(table.collectionId),
}));

export const brandingAssets = sqliteTable('branding_assets', {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id),
    type: text('type', { enum: ['intro', 'outro'] }).notNull(),
    title: text('title').notNull(),
    description: text('description'), // Added description

    cloudflareStreamId: text('cloudflare_stream_id').notNull(),
    active: integer('active', { mode: 'boolean' }).default(false),
    tags: text('tags', { mode: 'json' }), // Added tags

    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (table) => ({
    tenantTypeIdx: index('branding_tenant_type_idx').on(table.tenantId, table.type),
}));

// --- Referral Program ---
export const referrals = sqliteTable('referrals', {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id),
    referrerId: text('referrer_id').notNull().references(() => tenantMembers.id), // Member who referred
    refereeId: text('referee_id').references(() => tenantMembers.id), // Member who joined (nullable until they sign up)
    code: text('code').notNull(), // Unique referral code
    status: text('status', { enum: ['pending', 'completed', 'rewarded', 'expired'] }).default('pending').notNull(),
    rewardType: text('reward_type', { enum: ['credit', 'discount', 'free_class', 'cash'] }),
    rewardValue: integer('reward_value'), // In cents or credits
    rewardedAt: integer('rewarded_at', { mode: 'timestamp' }),
    expiresAt: integer('expires_at', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (table) => ({
    tenantIdx: index('referral_tenant_idx').on(table.tenantId),
    codeIdx: uniqueIndex('referral_code_idx').on(table.tenantId, table.code),
    referrerIdx: index('referral_referrer_idx').on(table.referrerId),
}));

// --- Tagging System ---
export const memberTags = sqliteTable('member_tags', {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id),
    name: text('name').notNull(),
    color: text('color'),
    description: text('description'),
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (table) => ({
    tenantIdx: index('member_tag_tenant_idx').on(table.tenantId),
}));

export const membersToTags = sqliteTable('members_to_tags', {
    memberId: text('member_id').notNull().references(() => tenantMembers.id, { onDelete: 'cascade' }),
    tagId: text('tag_id').notNull().references(() => memberTags.id, { onDelete: 'cascade' }),
}, (table) => ({
    pk: primaryKey({ columns: [table.memberId, table.tagId] }),
}));

// --- Custom Fields ---
export const customFieldDefinitions = sqliteTable('custom_field_definitions', {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id),
    entityType: text('entity_type', { enum: ['member', 'class', 'lead'] }).notNull(),
    key: text('key').notNull(),
    label: text('label').notNull(),
    fieldType: text('field_type', { enum: ['text', 'number', 'boolean', 'date', 'select'] }).notNull(),
    options: text('options', { mode: 'json' }), // For 'select' type
    isRequired: integer('is_required', { mode: 'boolean' }).default(false).notNull(),
    isActive: integer('is_active', { mode: 'boolean' }).default(true).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (table) => ({
    tenantEntityIdx: index('cf_def_tenant_entity_idx').on(table.tenantId, table.entityType),
    uniqueKey: uniqueIndex('cf_def_unique_key_idx').on(table.tenantId, table.entityType, table.key),
}));

export const customFieldValues = sqliteTable('custom_field_values', {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id),
    definitionId: text('definition_id').notNull().references(() => customFieldDefinitions.id),
    entityId: text('entity_id').notNull(), // memberId, classId, or leadId
    value: text('value'), // Stored as string, cast at runtime
    updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (table) => ({
    entityIdx: index('cf_val_entity_idx').on(table.entityId),
    uniqueVal: uniqueIndex('cf_val_unique_idx').on(table.entityId, table.definitionId),
}));

// --- Community Feed ---
export const communityPosts = sqliteTable('community_posts', {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id),
    authorId: text('author_id').notNull().references(() => tenantMembers.id),
    content: text('content').notNull(),
    type: text('type', { enum: ['post', 'announcement', 'event', 'photo'] }).default('post').notNull(),
    imageUrl: text('image_url'),
    likesCount: integer('likes_count').default(0),
    commentsCount: integer('comments_count').default(0),
    isPinned: integer('is_pinned', { mode: 'boolean' }).default(false),
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (table) => ({
    tenantIdx: index('community_post_tenant_idx').on(table.tenantId),
    pinnedIdx: index('community_post_pinned_idx').on(table.tenantId, table.isPinned),
}));

export const communityComments = sqliteTable('community_comments', {
    id: text('id').primaryKey(),
    postId: text('post_id').notNull().references(() => communityPosts.id, { onDelete: 'cascade' }),
    authorId: text('author_id').notNull().references(() => tenantMembers.id),
    content: text('content').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (table) => ({
    postIdx: index('community_comment_post_idx').on(table.postId),
}));

export const communityLikes = sqliteTable('community_likes', {
    postId: text('post_id').notNull().references(() => communityPosts.id, { onDelete: 'cascade' }),
    memberId: text('member_id').notNull().references(() => tenantMembers.id),
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (table) => ({
    pk: primaryKey({ columns: [table.postId, table.memberId] }),
}));

// --- Reviews & Testimonials ---
export const reviews = sqliteTable('reviews', {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id),
    memberId: text('member_id').notNull().references(() => tenantMembers.id),
    targetType: text('target_type', { enum: ['studio', 'class', 'instructor'] }).default('studio').notNull(),
    targetId: text('target_id'), // classId or instructorId
    rating: integer('rating').notNull(), // 1-5 stars
    content: text('content'),
    isTestimonial: integer('is_testimonial', { mode: 'boolean' }).default(false),
    isApproved: integer('is_approved', { mode: 'boolean' }).default(false),
    isPublic: integer('is_public', { mode: 'boolean' }).default(true),
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (table) => ({
    tenantIdx: index('review_tenant_idx').on(table.tenantId),
    memberIdx: index('review_member_idx').on(table.memberId),
    approvedIdx: index('review_approved_idx').on(table.tenantId, table.isApproved),
}));

// --- Relations ---
import { relations } from 'drizzle-orm';

export const usersRelations = relations(users, ({ many }) => ({
    memberships: many(tenantMembers),
    subscriptions: many(subscriptions),
}));

export const tenantsRelations = relations(tenants, ({ many }) => ({
    members: many(tenantMembers),
    classes: many(classes),
    locations: many(locations),
    membershipPlans: many(membershipPlans),
    waiverTemplates: many(waiverTemplates),
    classPackDefinitions: many(classPackDefinitions),
    leads: many(leads),
    tasks: many(tasks),
    memberTags: many(memberTags),
    customFieldDefinitions: many(customFieldDefinitions),
}));

export const tenantMembersRelations = relations(tenantMembers, ({ one, many }) => ({
    user: one(users, {
        fields: [tenantMembers.userId],
        references: [users.id],
    }),
    tenant: one(tenants, {
        fields: [tenantMembers.tenantId],
        references: [tenants.id],
    }),
    roles: many(tenantRoles),
    bookings: many(bookings),
    memberships: many(subscriptions), // Alias subscriptions as memberships
    purchasedPacks: many(purchasedPacks),
    waiverSignatures: many(waiverSignatures),
    tags: many(membersToTags),
}));

export const tenantRolesRelations = relations(tenantRoles, ({ one }) => ({
    member: one(tenantMembers, {
        fields: [tenantRoles.memberId],
        references: [tenantMembers.id],
    }),
}));

export const classesRelations = relations(classes, ({ one, many }) => ({
    tenant: one(tenants, {
        fields: [classes.tenantId],
        references: [tenants.id],
    }),
    location: one(locations, {
        fields: [classes.locationId],
        references: [locations.id],
    }),
    instructor: one(tenantMembers, {
        fields: [classes.instructorId],
        references: [tenantMembers.id],
    }),
    bookings: many(bookings),
    substitutions: many(substitutions),
    series: one(classSeries, {
        fields: [classes.seriesId],
        references: [classSeries.id],
    }),
}));

export const classSeriesRelations = relations(classSeries, ({ one, many }) => ({
    tenant: one(tenants, {
        fields: [classSeries.tenantId],
        references: [tenants.id],
    }),
    instructor: one(tenantMembers, {
        fields: [classSeries.instructorId],
        references: [tenantMembers.id],
    }),
    location: one(locations, {
        fields: [classSeries.locationId],
        references: [locations.id],
    }),
    classes: many(classes),
}));

export const bookingsRelations = relations(bookings, ({ one }) => ({
    class: one(classes, {
        fields: [bookings.classId],
        references: [classes.id],
    }),
    member: one(tenantMembers, {
        fields: [bookings.memberId],
        references: [tenantMembers.id],
    }),
    usedPack: one(purchasedPacks, {
        fields: [bookings.usedPackId],
        references: [purchasedPacks.id],
    }),
}));

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
    user: one(users, {
        fields: [subscriptions.userId],
        references: [users.id],
    }),
    tenant: one(tenants, {
        fields: [subscriptions.tenantId],
        references: [tenants.id],
    }),
    member: one(tenantMembers, {
        fields: [subscriptions.memberId],
        references: [tenantMembers.id],
    }),
    plan: one(membershipPlans, {
        fields: [subscriptions.planId],
        references: [membershipPlans.id],
    }),
}));

export const classPackDefinitionsRelations = relations(classPackDefinitions, ({ one, many }) => ({
    tenant: one(tenants, {
        fields: [classPackDefinitions.tenantId],
        references: [tenants.id],
    }),
    purchasedPacks: many(purchasedPacks),
}));

export const purchasedPacksRelations = relations(purchasedPacks, ({ one }) => ({
    tenant: one(tenants, {
        fields: [purchasedPacks.tenantId],
        references: [tenants.id],
    }),
    member: one(tenantMembers, {
        fields: [purchasedPacks.memberId],
        references: [tenantMembers.id],
    }),
    definition: one(classPackDefinitions, {
        fields: [purchasedPacks.packDefinitionId],
        references: [classPackDefinitions.id],
    }),
}));

export const substitutionsRelations = relations(substitutions, ({ one }) => ({
    tenant: one(tenants, {
        fields: [substitutions.tenantId],
        references: [tenants.id],
    }),
    class: one(classes, {
        fields: [substitutions.classId],
        references: [classes.id],
    }),
    requestingInstructor: one(tenantMembers, {
        fields: [substitutions.requestingInstructorId],
        references: [tenantMembers.id],
    }),
    coveringInstructor: one(tenantMembers, {
        fields: [substitutions.coveringInstructorId],
        references: [tenantMembers.id],
    }),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
    tenant: one(tenants, {
        fields: [products.tenantId],
        references: [tenants.id],
    }),
    supplier: one(suppliers, {
        fields: [products.supplierId],
        references: [suppliers.id],
    }),
    orderItems: many(posOrderItems),
    adjustments: many(inventoryAdjustments),
    poItems: many(purchaseOrderItems),
}));

export const suppliersRelations = relations(suppliers, ({ one, many }) => ({
    tenant: one(tenants, {
        fields: [suppliers.tenantId],
        references: [tenants.id],
    }),
    products: many(products),
    purchaseOrders: many(purchaseOrders),
}));

export const inventoryAdjustmentsRelations = relations(inventoryAdjustments, ({ one }) => ({
    tenant: one(tenants, {
        fields: [inventoryAdjustments.tenantId],
        references: [tenants.id],
    }),
    product: one(products, {
        fields: [inventoryAdjustments.productId],
        references: [products.id],
    }),
    staff: one(tenantMembers, {
        fields: [inventoryAdjustments.staffId],
        references: [tenantMembers.id],
    }),
}));

export const purchaseOrdersRelations = relations(purchaseOrders, ({ one, many }) => ({
    tenant: one(tenants, {
        fields: [purchaseOrders.tenantId],
        references: [tenants.id],
    }),
    supplier: one(suppliers, {
        fields: [purchaseOrders.supplierId],
        references: [suppliers.id],
    }),
    staff: one(tenantMembers, {
        fields: [purchaseOrders.staffId],
        references: [tenantMembers.id],
    }),
    items: many(purchaseOrderItems),
}));

export const purchaseOrderItemsRelations = relations(purchaseOrderItems, ({ one }) => ({
    tenant: one(tenants, {
        fields: [purchaseOrderItems.tenantId],
        references: [tenants.id],
    }),
    purchaseOrder: one(purchaseOrders, {
        fields: [purchaseOrderItems.purchaseOrderId],
        references: [purchaseOrders.id],
    }),
    product: one(products, {
        fields: [purchaseOrderItems.productId],
        references: [products.id],
    }),
}));

export const posOrdersRelations = relations(posOrders, ({ one, many }) => ({
    tenant: one(tenants, {
        fields: [posOrders.tenantId],
        references: [tenants.id],
    }),
    member: one(tenantMembers, {
        fields: [posOrders.memberId],
        references: [tenantMembers.id],
    }),
    staff: one(tenantMembers, {
        fields: [posOrders.staffId],
        references: [tenantMembers.id],
    }),
    items: many(posOrderItems),
}));

export const posOrderItemsRelations = relations(posOrderItems, ({ one }) => ({
    order: one(posOrders, {
        fields: [posOrderItems.orderId],
        references: [posOrders.id],
    }),
    product: one(products, {
        fields: [posOrderItems.productId],
        references: [products.id],
    }),
}));

export const challengesRelations = relations(challenges, ({ one, many }) => ({
    tenant: one(tenants, {
        fields: [challenges.tenantId],
        references: [tenants.id],
    }),
    participants: many(userChallenges),
}));


export const videoSharesRelations = relations(videoShares, ({ one }) => ({
    video: one(videos, {
        fields: [videoShares.videoId],
        references: [videos.id],
    }),
    tenant: one(tenants, {
        fields: [videoShares.tenantId],
        references: [tenants.id],
    }),
}));

export const userChallengesRelations = relations(userChallenges, ({ one }) => ({
    user: one(users, {
        fields: [userChallenges.userId],
        references: [users.id],
    }),
    tenant: one(tenants, {
        fields: [userChallenges.tenantId],
        references: [tenants.id],
    }),
    challenge: one(challenges, {
        fields: [userChallenges.challengeId],
        references: [challenges.id],
    }),
}));

export const giftCardsRelations = relations(giftCards, ({ one, many }) => ({
    tenant: one(tenants, {
        fields: [giftCards.tenantId],
        references: [tenants.id],
    }),
    buyer: one(tenantMembers, {
        fields: [giftCards.buyerMemberId],
        references: [tenantMembers.id],
    }),
    transactions: many(giftCardTransactions),
}));

export const marketingAutomationsRelations = relations(marketingAutomations, ({ one }) => ({
    tenant: one(tenants, {
        fields: [marketingAutomations.tenantId],
        references: [tenants.id],
    }),
}));

// --- CRM: Tasks ---
export const tasks = sqliteTable('tasks', {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description'),
    status: text('status', { enum: ['todo', 'in_progress', 'done'] }).default('todo').notNull(),
    priority: text('priority', { enum: ['low', 'medium', 'high'] }).default('medium').notNull(),
    dueDate: integer('due_date', { mode: 'timestamp' }),

    assignedToId: text('assigned_to_id').references(() => tenantMembers.id), // Staff
    relatedLeadId: text('related_lead_id').references(() => leads.id), // Link to Lead
    relatedMemberId: text('related_member_id').references(() => tenantMembers.id), // Link to Member

    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (table) => ({
    tenantIdx: index('task_tenant_idx').on(table.tenantId),
    assigneeIdx: index('task_assignee_idx').on(table.assignedToId),
    leadIdx: index('task_lead_idx').on(table.relatedLeadId),
    // compound index for dashboard?
    tenantStatusIdx: index('task_tenant_status_idx').on(table.tenantId, table.status),
}));

export const leadsRelations = relations(leads, ({ one, many }) => ({
    tenant: one(tenants, {
        fields: [leads.tenantId],
        references: [tenants.id],
    }),
    tasks: many(tasks),
}));

export const tasksRelations = relations(tasks, ({ one }) => ({
    tenant: one(tenants, {
        fields: [tasks.tenantId],
        references: [tenants.id],
    }),
    assignedTo: one(tenantMembers, {
        fields: [tasks.assignedToId],
        references: [tenantMembers.id],
    }),
    lead: one(leads, {
        fields: [tasks.relatedLeadId],
        references: [leads.id],
    }),
    member: one(tenantMembers, {
        fields: [tasks.relatedMemberId],
        references: [tenantMembers.id],
    }),
}));

export const giftCardTransactionsRelations = relations(giftCardTransactions, ({ one }) => ({
    giftCard: one(giftCards, {
        fields: [giftCardTransactions.giftCardId],
        references: [giftCards.id],
    }),
}));

export const waiverTemplatesRelations = relations(waiverTemplates, ({ one, many }) => ({
    tenant: one(tenants, {
        fields: [waiverTemplates.tenantId],
        references: [tenants.id],
    }),
    signatures: many(waiverSignatures),
}));

export const waiverSignaturesRelations = relations(waiverSignatures, ({ one }) => ({
    template: one(waiverTemplates, {
        fields: [waiverSignatures.templateId],
        references: [waiverTemplates.id],
    }),
    member: one(tenantMembers, {
        fields: [waiverSignatures.memberId],
        references: [tenantMembers.id],
    }),
}));

// --- Refunds ---
export const refunds = sqliteTable('refunds', {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id),
    amount: integer('amount').notNull(), // in cents
    reason: text('reason'),
    status: text('status', { enum: ['pending', 'succeeded', 'failed'] }).default('pending').notNull(),
    type: text('type', { enum: ['pos', 'membership', 'pack', 'custom'] }).notNull(),
    referenceId: text('reference_id').notNull(), // ID of the original order/subscription
    stripeRefundId: text('stripe_refund_id'),
    memberId: text('member_id').references(() => tenantMembers.id), // Recipient
    performedBy: text('performed_by').references(() => users.id), // Admin
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (table) => ({
    tenantIdx: index('refund_tenant_idx').on(table.tenantId),
    refIdx: index('refund_ref_idx').on(table.referenceId),
}));

export const refundsRelations = relations(refunds, ({ one }) => ({
    tenant: one(tenants, {
        fields: [refunds.tenantId],
        references: [tenants.id],
    }),
    member: one(tenantMembers, {
        fields: [refunds.memberId],
        references: [tenantMembers.id],
    }),
}));

// --- Integrations: Webhooks ---
export const webhookEndpoints = sqliteTable('webhook_endpoints', {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id),
    url: text('url').notNull(),
    secret: text('secret').notNull(), // Shared secret for HMAC signing
    events: text('events', { mode: 'json' }).notNull(), // Array of event strings
    isActive: integer('is_active', { mode: 'boolean' }).default(true).notNull(),
    description: text('description'),
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (table) => ({
    tenantIdx: index('webhook_tenant_idx').on(table.tenantId),
}));

export const webhookLogs = sqliteTable('webhook_logs', {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id),
    endpointId: text('endpoint_id').notNull().references(() => webhookEndpoints.id),
    eventType: text('event_type').notNull(),
    payload: text('payload', { mode: 'json' }).notNull(),
    statusCode: integer('status_code'),
    responseBody: text('response_body'),
    error: text('error'),
    durationMs: integer('duration_ms'),
    attemptCount: integer('attempt_count').default(1),
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (table) => ({
    tenantIdx: index('webhook_log_tenant_idx').on(table.tenantId),
    endpointIdx: index('webhook_log_endpoint_idx').on(table.endpointId),
    eventIdx: index('webhook_log_event_idx').on(table.eventType),
}));
// --- Platform Global Config ---
export const platformConfig = sqliteTable('platform_config', {
    key: text('key').primaryKey(), // e.g. 'feature_mobile_app'
    value: text('value', { mode: 'json' }), // Optional config payload
    enabled: integer('enabled', { mode: 'boolean' }).default(false).notNull(),
    description: text('description'),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
});

// --- Website Builder: Pages ---
export const websitePages = sqliteTable('website_pages', {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    slug: text('slug').notNull(), // e.g., "home", "about", "pricing"
    title: text('title').notNull(),
    content: text('content', { mode: 'json' }), // Puck JSON output
    isPublished: integer('is_published', { mode: 'boolean' }).default(false).notNull(),
    seoTitle: text('seo_title'),
    seoDescription: text('seo_description'),
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (table) => ({
    tenantIdx: index('website_page_tenant_idx').on(table.tenantId),
    slugIdx: uniqueIndex('website_page_slug_idx').on(table.tenantId, table.slug),
}));

export const websitePagesRelations = relations(websitePages, ({ one }) => ({
    tenant: one(tenants, {
        fields: [websitePages.tenantId],
        references: [tenants.id],
    }),
}));

export const webhookEndpointsRelations = relations(webhookEndpoints, ({ one, many }) => ({
    tenant: one(tenants, {
        fields: [webhookEndpoints.tenantId],
        references: [tenants.id],
    }),
    logs: many(webhookLogs),
}));

export const webhookLogsRelations = relations(webhookLogs, ({ one }) => ({
    tenant: one(tenants, {
        fields: [webhookLogs.tenantId],
        references: [tenants.id],
    }),
    endpoint: one(webhookEndpoints, {
        fields: [webhookLogs.endpointId],
        references: [webhookEndpoints.id],
    }),
}));

// --- Website Builder: Settings ---
export const websiteSettings = sqliteTable('website_settings', {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }).unique(),
    domain: text('domain'), // Custom domain for website
    theme: text('theme', { mode: 'json' }), // { primaryColor, secondaryColor, fontFamily }
    navigation: text('navigation', { mode: 'json' }), // [{ label, slug, order }]
    globalStyles: text('global_styles', { mode: 'json' }), // CSS overrides
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
});

export const websiteSettingsRelations = relations(websiteSettings, ({ one }) => ({
    tenant: one(tenants, {
        fields: [websiteSettings.tenantId],
        references: [tenants.id],
    }),
}));

// --- Chat: Rooms ---
export const chatRooms = sqliteTable('chat_rooms', {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    type: text('type', { enum: ['support', 'class', 'community', 'direct'] }).notNull(),
    name: text('name').notNull(),
    metadata: text('metadata', { mode: 'json' }), // { classId, memberIds, etc }

    // Support / Ticketing Fields
    status: text('status', { enum: ['open', 'in_progress', 'closed', 'archived'] }).default('open').notNull(),
    priority: text('priority', { enum: ['low', 'normal', 'high', 'urgent'] }).default('normal').notNull(),
    assignedToId: text('assigned_to_id').references(() => users.id), // Global User ID of the agent
    customerEmail: text('customer_email'), // For anonymous support requests (widget)

    isArchived: integer('is_archived', { mode: 'boolean' }).default(false).notNull(), // Deprecated in favor of status='archived'
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (table) => ({
    tenantIdx: index('chat_room_tenant_idx').on(table.tenantId),
    typeIdx: index('chat_room_type_idx').on(table.tenantId, table.type),
    statusIdx: index('chat_room_status_idx').on(table.tenantId, table.status),
    assigneeIdx: index('chat_room_assignee_idx').on(table.assignedToId),
}));

export const chatRoomsRelations = relations(chatRooms, ({ one, many }) => ({
    tenant: one(tenants, {
        fields: [chatRooms.tenantId],
        references: [tenants.id],
    }),
    messages: many(chatMessages),
}));

// --- Chat: Messages ---
export const chatMessages = sqliteTable('chat_messages', {
    id: text('id').primaryKey(),
    roomId: text('room_id').notNull().references(() => chatRooms.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull().references(() => users.id),
    content: text('content').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (table) => ({
    roomIdx: index('chat_message_room_idx').on(table.roomId),
    userIdx: index('chat_message_user_idx').on(table.userId),
}));

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
    room: one(chatRooms, {
        fields: [chatMessages.roomId],
        references: [chatRooms.id],
    }),
    user: one(users, {
        fields: [chatMessages.userId],
        references: [users.id],
    }),
}));

// --- Platform Pages (Main Site) ---
export const platformPages = sqliteTable('platform_pages', {
    id: text('id').primaryKey(),
    slug: text('slug').notNull().unique(), // e.g., "home", "pricing", "about"
    title: text('title').notNull(),
    content: text('content', { mode: 'json' }), // Puck JSON output
    isPublished: integer('is_published', { mode: 'boolean' }).default(false).notNull(),
    seoTitle: text('seo_title'),
    seoDescription: text('seo_description'),
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
});

// --- Custom Reporting ---
export const customReports = sqliteTable('custom_reports', {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id),
    name: text('name').notNull(),
    config: text('config', { mode: 'json' }).notNull(), // { metrics, dimensions, filters, chartType }
    isPublic: integer('is_public', { mode: 'boolean' }).default(false).notNull(),
    createdBy: text('created_by'), // userId
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (table) => ({
    tenantReportIdx: index('custom_reports_tenant_idx').on(table.tenantId),
}));
// --- Scheduled Reports ---
export const scheduledReports = sqliteTable('scheduled_reports', {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    reportType: text('report_type', { enum: ['revenue', 'attendance', 'journal', 'custom'] }).notNull(),
    frequency: text('frequency', { enum: ['daily', 'weekly', 'monthly'] }).notNull(),
    recipients: text('recipients', { mode: 'json' }).notNull(), // Array of emails
    customReportId: text('custom_report_id').references(() => customReports.id),
    lastSent: integer('last_sent', { mode: 'timestamp' }),
    nextRun: integer('next_run', { mode: 'timestamp' }).notNull(),
    status: text('status', { enum: ['active', 'paused'] }).default('active').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (table) => ({
    tenantIdx: index('scheduled_reports_tenant_idx').on(table.tenantId),
}));

export const scheduledReportsRelations = relations(scheduledReports, ({ one }) => ({
    tenant: one(tenants, {
        fields: [scheduledReports.tenantId],
        references: [tenants.id],
    }),
}));

// --- FAQs (Features Page & Support) ---
export const faqs = sqliteTable('faqs', {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }), // NULL = platform-wide FAQ
    category: text('category', { enum: ['features', 'pricing', 'support', 'getting_started'] }).notNull(),
    question: text('question').notNull(),
    answer: text('answer').notNull(),
    sortOrder: integer('sort_order').default(0).notNull(),
    isActive: integer('is_active', { mode: 'boolean' }).default(true).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (table) => ({
    categoryIdx: index('faqs_category_idx').on(table.category),
    tenantIdx: index('faqs_tenant_idx').on(table.tenantId),
}));

export const faqsRelations = relations(faqs, ({ one }) => ({
    tenant: one(tenants, {
        fields: [faqs.tenantId],
        references: [tenants.id],
    }),
}));

export const memberTagsRelations = relations(memberTags, ({ one, many }) => ({
    tenant: one(tenants, {
        fields: [memberTags.tenantId],
        references: [tenants.id],
    }),
    members: many(membersToTags),
}));

export const membersToTagsRelations = relations(membersToTags, ({ one }) => ({
    member: one(tenantMembers, {
        fields: [membersToTags.memberId],
        references: [tenantMembers.id],
    }),
    tag: one(memberTags, {
        fields: [membersToTags.tagId],
        references: [memberTags.id],
    }),
}));

export const customFieldDefinitionsRelations = relations(customFieldDefinitions, ({ one, many }) => ({
    tenant: one(tenants, {
        fields: [customFieldDefinitions.tenantId],
        references: [tenants.id],
    }),
    values: many(customFieldValues),
}));

export const customFieldValuesRelations = relations(customFieldValues, ({ one }) => ({
    tenant: one(tenants, {
        fields: [customFieldValues.tenantId],
        references: [tenants.id],
    }),
    definition: one(customFieldDefinitions, {
        fields: [customFieldValues.definitionId],
        references: [customFieldDefinitions.id],
    }),
}));

// --- Backup Metadata ---
export const backupMetadata = sqliteTable('backup_metadata', {
    id: text('id').primaryKey(),
    type: text('type', { enum: ['system', 'tenant'] }).notNull(),
    tenantId: text('tenant_id'), // Only for tenant backups
    backupDate: integer('backup_date', { mode: 'timestamp' }).notNull(),
    fileSize: integer('file_size').notNull(), // bytes
    r2Key: text('r2_key').notNull(),
    status: text('status', { enum: ['success', 'failed', 'in_progress'] }).notNull(),
    recordCount: integer('record_count'), // For tenant backups
    errorMessage: text('error_message'), // If failed
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (table) => ({
    typeIdx: index('backup_type_idx').on(table.type, table.backupDate),
    tenantIdx: index('backup_tenant_idx').on(table.tenantId, table.backupDate),
}));

// --- Restore History (Audit) ---
export const restoreHistory = sqliteTable('restore_history', {
    id: text('id').primaryKey(),
    type: text('type', { enum: ['system', 'tenant'] }).notNull(),
    tenantId: text('tenant_id'), // Only for tenant restores
    backupKey: text('backup_key').notNull(), // R2 key of backup used
    backupDate: integer('backup_date', { mode: 'timestamp' }).notNull(),
    restoredBy: text('restored_by').notNull(), // User ID
    restoredAt: integer('restored_at', { mode: 'timestamp' }).notNull(),
    status: text('status', { enum: ['success', 'failed', 'in_progress'] }).notNull(),
    recordsRestored: integer('records_restored'),
    durationMs: integer('duration_ms'),
    details: text('details', { mode: 'json' }), // { preSnapshot: '...', tables: [...] }
    errorMessage: text('error_message'),
}, (table) => ({
    typeIdx: index('restore_type_idx').on(table.type, table.restoredAt),
    tenantIdx: index('restore_tenant_idx').on(table.tenantId),
    restoredByIdx: index('restore_user_idx').on(table.restoredBy),
}));
