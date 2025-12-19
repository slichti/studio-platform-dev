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
    instructorId: text('instructor_id').notNull().references(() => users.id),
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
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (table) => ({
    tenantTimeIdx: index('tenant_time_idx').on(table.tenantId, table.startTime),
}));

// --- Subscriptions ---
export const subscriptions = sqliteTable('subscriptions', {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id),
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
    userId: text('user_id').notNull().references(() => users.id),
    status: text('status', { enum: ['confirmed', 'cancelled', 'waitlisted'] }).default('confirmed'),
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (table) => ({
    userClassIdx: index('user_class_idx').on(table.userId, table.classId),
}));
