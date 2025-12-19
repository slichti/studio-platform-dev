import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// --- Multi-Tenancy Root ---
export const tenants = sqliteTable('tenants', {
    id: text('id').primaryKey(),
    slug: text('slug').notNull().unique(), // subdomain
    name: text('name').notNull(),
    customDomain: text('custom_domain').unique(),
    branding: text('branding', { mode: 'json' }), // JSON: { primaryColor, logoUrl, font }
    stripeAccountId: text('stripe_account_id'), // Connect Account ID
    zoomCredentials: text('zoom_credentials', { mode: 'json' }), // Encrypted
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
});

// --- Users ---
export const users = sqliteTable('users', {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id),
    role: text('role', { enum: ['owner', 'instructor', 'student'] }).notNull(),
    email: text('email').notNull(),
    passwordHash: text('password_hash'),
    profile: text('profile', { mode: 'json' }), // { bio, portraitUrl, etc. }
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (table) => ({
    emailIdx: index('email_idx').on(table.email),
    tenantIdx: index('tenant_idx').on(table.tenantId),
}));

// --- Classes ---
export const classes = sqliteTable('classes', {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id),
    instructorId: text('instructor_id').notNull().references(() => users.id),
    title: text('title').notNull(),
    description: text('description'),
    startTime: integer('start_time', { mode: 'timestamp' }).notNull(),
    durationMinutes: integer('duration_minutes').notNull(),
    zoomMeetingUrl: text('zoom_meeting_url'),
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (table) => ({
    tenantTimeIdx: index('tenant_time_idx').on(table.tenantId, table.startTime),
}));

// --- Sub Requests (Instructor Substitution) ---
export const subRequests = sqliteTable('sub_requests', {
    id: text('id').primaryKey(),
    classId: text('class_id').notNull().references(() => classes.id),
    requesterId: text('requester_id').notNull().references(() => users.id),
    status: text('status', { enum: ['open', 'accepted', 'cancelled'] }).default('open'),
    acceptedById: text('accepted_by_id').references(() => users.id),
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
});
