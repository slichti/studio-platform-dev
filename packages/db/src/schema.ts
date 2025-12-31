
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
    stripeAccountId: text('stripe_account_id'), // Connect Account ID
    zoomCredentials: text('zoom_credentials', { mode: 'json' }), // Encrypted
    status: text('status', { enum: ['active', 'paused', 'suspended'] }).default('active').notNull(),
    tier: text('tier', { enum: ['basic', 'growth', 'scale'] }).default('basic').notNull(),
    subscriptionStatus: text('subscription_status', { enum: ['active', 'past_due', 'canceled', 'trialing'] }).default('active').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
});

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

    status: text('status', { enum: ['active', 'past_due', 'canceled', 'incomplete'] }).notNull(),
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
    checkedInAt: integer('checked_in_at', { mode: 'timestamp' }), // Attendance tracking

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
