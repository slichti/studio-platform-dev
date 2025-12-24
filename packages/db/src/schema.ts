import { sqliteTable, text, integer, index, primaryKey } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// --- Multi-Tenancy Root ---
export const tenants = sqliteTable('tenants', {
    id: text('id').primaryKey(),
    slug: text('slug').notNull().unique(), // subdomain
    name: text('name').notNull(),
    customDomain: text('custom_domain').unique(),
    branding: text('branding', { mode: 'json' }), // JSON: { primaryColor, logoUrl, font }
    settings: text('settings', { mode: 'json' }), // JSON: Studio-wide settings (e.g. cancellation policies)
    stripeAccountId: text('stripe_account_id'), // Connect Account ID
    zoomCredentials: text('zoom_credentials', { mode: 'json' }), // Encrypted
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
});

// --- Global Users (Clerk-linked) ---
export const users = sqliteTable('users', {
    id: text('id').primaryKey(), // Clerk ID
    email: text('email').notNull(),
    profile: text('profile', { mode: 'json' }), // Global profile: { firstName, lastName, portraitUrl }
    isSystemAdmin: integer('is_system_admin', { mode: 'boolean' }).default(false), // Platform-level admin
    lastActiveAt: integer('last_active_at', { mode: 'timestamp' }), // Timestamp of last API request
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (table) => ({
    emailIdx: index('email_idx').on(table.email),
}));

// --- Tenant Members ---
// Links a Global User to a specific Tenant
export const tenantMembers = sqliteTable('tenant_members', {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id),
    userId: text('user_id').notNull().references(() => users.id),
    profile: text('profile', { mode: 'json' }), // Studio-specific profile overrides (e.g. bio for instructors)
    settings: text('settings', { mode: 'json' }), // User's preferences for this studio (notifications etc)
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

// --- Classes ---
export const classes = sqliteTable('classes', {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id),
    instructorId: text('instructor_id').notNull().references(() => tenantMembers.id), // Reference Member, not User
    locationId: text('location_id').references(() => locations.id),
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

    // Cancellation Logic
    minStudents: integer('min_students').default(1),
    autoCancelThreshold: integer('auto_cancel_threshold'), // Hours before start
    autoCancelEnabled: integer('auto_cancel_enabled', { mode: 'boolean' }).default(false),

    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (table) => ({
    tenantTimeIdx: index('tenant_time_idx').on(table.tenantId, table.startTime),
}));

// --- Subscriptions ---
export const subscriptions = sqliteTable('subscriptions', {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id), // Subscriptions are likely tied to user+tenant, but for now user is global. 
    // Wait, subscriptions should probably belong to a tenantMember? 
    // Usually subscriptions are "User X pays Tenant Y". 
    // If we link to User, we need TenantID too. 
    tenantId: text('tenant_id').notNull().references(() => tenants.id),

    status: text('status', { enum: ['active', 'past_due', 'canceled', 'incomplete'] }).notNull(),
    tier: text('tier', { enum: ['basic', 'premium'] }).default('basic'),
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
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (table) => ({
    memberClassIdx: index('member_class_idx').on(table.memberId, table.classId),
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
}));
