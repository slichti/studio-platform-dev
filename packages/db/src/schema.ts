
import { sqliteTable, text, integer, uniqueIndex, index, primaryKey } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// --- Multi-Tenancy Root ---
export const tenants = sqliteTable('tenants', {
    id: text('id').primaryKey(),
    slug: text('slug').notNull().unique(), // subdomain
    name: text('name').notNull(),
    customDomain: text('custom_domain').unique(),
    branding: text('branding', { mode: 'json' }), // JSON: { primaryColor, logoUrl, font }
    settings: text('settings', { mode: 'json' }), // JSON: { enableStudentRegistration, noShowFeeEnabled, noShowFeeAmount, notifications }
    stripeAccountId: text('stripe_account_id'), // Connect Account ID (Receiving money)
    stripeCustomerId: text('stripe_customer_id'), // Platform Customer ID (Paying for SaaS)
    stripeSubscriptionId: text('stripe_subscription_id'), // Active info
    currentPeriodEnd: integer('current_period_end', { mode: 'timestamp' }),

    // Phase 15: Flexible Payments (Connect vs BYOK)
    paymentProvider: text('payment_provider', { enum: ['connect', 'custom'] }).default('connect').notNull(),
    stripeCredentials: text('stripe_credentials', { mode: 'json' }), // Encrypted JSON: { publishableKey, secretKey }

    // Phase 16: Secure BYOK (Email/SMS)
    resendCredentials: text('resend_credentials', { mode: 'json' }), // Encrypted JSON: { apiKey }
    twilioCredentials: text('twilio_credentials', { mode: 'json' }), // Encrypted JSON: { accountSid, authToken, fromNumber }

    currency: text('currency').default('usd').notNull(), // Added currency
    zoomCredentials: text('zoom_credentials', { mode: 'json' }), // Encrypted
    status: text('status', { enum: ['active', 'paused', 'suspended'] }).default('active').notNull(),
    tier: text('tier', { enum: ['basic', 'growth', 'scale'] }).default('basic').notNull(),
    subscriptionStatus: text('subscription_status', { enum: ['active', 'past_due', 'canceled', 'trialing'] }).default('active').notNull(),

    // Quotas (Reset monthly)
    smsUsage: integer('sms_usage').default(0).notNull(),
    emailUsage: integer('email_usage').default(0).notNull(),
    streamingUsage: integer('streaming_usage').default(0).notNull(), // in minutes

    smsLimit: integer('sms_limit'), // null = use tier default
    emailLimit: integer('email_limit'), // null = use tier default
    streamingLimit: integer('streaming_limit'), // null = use tier default

    // Usage Stats (Updated via triggers/logic)
    storageUsage: integer('storage_usage').default(0).notNull(), // in bytes
    memberCount: integer('member_count').default(0).notNull(),
    instructorCount: integer('instructor_count').default(0).notNull(),

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
    isSystemAdmin: integer('is_system_admin', { mode: 'boolean' }).default(false), // Platform-level admin
    phone: text('phone'),
    dob: integer('dob', { mode: 'timestamp' }),
    address: text('address'), // Full address string or JSON
    isMinor: integer('is_minor', { mode: 'boolean' }).default(false),
    stripeCustomerId: text('stripe_customer_id'), // Platform-level Stripe Customer ID
    stripeAccountId: text('stripe_account_id'), // Instructor's Stripe Connect Account ID
    lastActiveAt: integer('last_active_at', { mode: 'timestamp' }), // Timestamp of last API request
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (table) => ({
    emailIdx: index('email_idx').on(table.email),
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
    status: text('status', { enum: ['active', 'inactive', 'archived'] }).default('active').notNull(),
    joinedAt: integer('joined_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),

    // AI Churn Prediction
    churnScore: integer('churn_score').default(100), // 0-100 (100 = Safe)
    churnStatus: text('churn_status', { enum: ['safe', 'at_risk', 'churned'] }).default('safe'),
    lastChurnCheck: integer('last_churn_check', { mode: 'timestamp' }),
}, (table) => ({
    tenantUserIdx: index('tenant_user_idx').on(table.tenantId, table.userId),
}));

// --- Tenant Roles ---
// A member can have multiple roles in a tenant (e.g. Owner + Instructor)
export const tenantRoles = sqliteTable('tenant_roles', {
    memberId: text('member_id').notNull().references(() => tenantMembers.id),
    role: text('role', { enum: ['owner', 'instructor', 'student'] }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (table) => ({
    pk: primaryKey({ columns: [table.memberId, table.role] }),
}));

// --- Audit Logs ---
export const auditLogs = sqliteTable('audit_logs', {
    id: text('id').primaryKey(),
    actorId: text('actor_id'), // User who performed the action
    tenantId: text('tenant_id').references(() => tenants.id),
    action: text('action').notNull(), // e.g., 'impersonate', 'update_settings'
    targetId: text('target_id'), // User/Class/Tenant ID affected
    details: text('details', { mode: 'json' }),
    ipAddress: text('ip_address'),
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
});

// --- Locations ---
export const locations = sqliteTable('locations', {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id),
    name: text('name').notNull(),
    address: text('address'),
    layout: text('layout', { mode: 'json' }), // JSON: { rows: 5, cols: 5, spots: [{ id: 'A1', type: 'standard', x: 0, y: 0 }] }
    timezone: text('timezone').default('UTC'),
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
    instructorId: text('instructor_id').notNull().references(() => tenantMembers.id), // Reference Member, not User
    locationId: text('location_id').references(() => locations.id),
    seriesId: text('series_id').references(() => classSeries.id), // Link to parent series
    title: text('title').notNull(),
    description: text('description'),
    startTime: integer('start_time', { mode: 'timestamp' }).notNull(),
    durationMinutes: integer('duration_minutes').notNull(),
    capacity: integer('capacity'),
    price: integer('price').default(0), // In cents
    currency: text('currency').default('usd'),
    zoomMeetingUrl: text('zoom_meeting_url'),
    zoomMeetingId: text('zoom_meeting_id'),
    zoomPassword: text('zoom_password'),
    zoomEnabled: integer('zoom_enabled', { mode: 'boolean' }).default(false),
    thumbnailUrl: text('thumbnail_url'),
    cloudflareStreamId: text('cloudflare_stream_id'),
    recordingStatus: text('recording_status', { enum: ['processing', 'ready', 'error'] }),
    status: text('status', { enum: ['active', 'cancelled'] }).default('active').notNull(),

    // Cancellation Logic
    minStudents: integer('min_students').default(1),
    autoCancelThreshold: integer('auto_cancel_threshold'), // Hours before start
    autoCancelEnabled: integer('auto_cancel_enabled', { mode: 'boolean' }).default(false),

    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (table) => ({
    tenantTimeIdx: index('tenant_time_idx').on(table.tenantId, table.startTime),
    seriesIdx: index('series_idx').on(table.seriesId),
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

    // Payment Tracking
    paymentMethod: text('payment_method', { enum: ['credit', 'subscription', 'drop_in', 'free'] }),
    usedPackId: text('used_pack_id').references(() => purchasedPacks.id), // If credit, which pack?

    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (table) => ({
    memberClassIdx: index('member_class_idx').on(table.memberId, table.classId),
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
    notes: text('notes'),

    // Zoom/Virtual support
    zoomMeetingUrl: text('zoom_meeting_url'),

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
    tenantId: text('tenant_id').notNull().references(() => tenants.id),

    triggerType: text('trigger_type', { enum: ['new_student', 'birthday', 'absent_30_days'] }).notNull(),
    subject: text('subject').notNull(),
    content: text('content').notNull(), // HTML or Text

    isEnabled: integer('is_enabled', { mode: 'boolean' }).default(false).notNull(),
    metadata: text('metadata', { mode: 'json' }), // Extra config

    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (table) => ({
    tenantTriggerIdx: uniqueIndex('automation_tenant_trigger_idx').on(table.tenantId, table.triggerType),
}));

export const emailLogs = sqliteTable('email_logs', {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id),

    campaignId: text('campaign_id'), // Optional, null if transactional
    recipientEmail: text('recipient_email').notNull(),
    subject: text('subject').notNull(),

    status: text('status', { enum: ['sent', 'failed', 'bounced'] }).default('sent'), // Simulated status
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
    stripePaymentId: text('stripe_payment_id'),
    expiresAt: integer('expires_at', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (table) => ({
    memberPackIdx: index('member_pack_idx').on(table.memberId),
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
    name: text('name').notNull(),
    description: text('description'),
    category: text('category'), // e.g. "Equipement", "Apparel", "Food"
    sku: text('sku'),
    price: integer('price').default(0).notNull(), // in cents
    currency: text('currency').default('usd'),
    stockQuantity: integer('stock_quantity').default(0).notNull(),
    imageUrl: text('image_url'),
    stripeProductId: text('stripe_product_id'),
    stripePriceId: text('stripe_price_id'),
    isActive: integer('is_active', { mode: 'boolean' }).default(true).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (table) => ({
    tenantIdx: index('product_tenant_idx').on(table.tenantId),
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
    orderItems: many(posOrderItems),
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
