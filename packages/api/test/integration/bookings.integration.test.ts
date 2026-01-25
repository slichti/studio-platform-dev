import { env, createExecutionContext, waitOnExecutionContext, SELF } from 'cloudflare:test';
import { describe, it, expect, beforeAll } from 'vitest';
import { drizzle } from 'drizzle-orm/d1';
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { eq, and, sql } from 'drizzle-orm';

// Minimal Schema for Testing
const tenants = sqliteTable('tenants', {
    id: text('id').primaryKey(),
    slug: text('slug'),
    name: text('name'),
    marketingProvider: text('marketing_provider').default('system'),
    currency: text('currency').default('usd'),
    status: text('status').default('active'),
    tier: text('tier').default('basic'),
    subscriptionStatus: text('subscription_status').default('active')
});

const users = sqliteTable('users', {
    id: text('id').primaryKey(),
    email: text('email'),
    role: text('role').default('user')
});

const tenantMembers = sqliteTable('tenant_members', {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id'),
    userId: text('user_id'),
    status: text('status').default('active')
});

const classes = sqliteTable('classes', {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id'),
    instructorId: text('instructor_id'),
    title: text('title'),
    startTime: integer('start_time', { mode: 'timestamp' }),
    durationMinutes: integer('duration_minutes'),
    capacity: integer('capacity'),
    status: text('status').default('active'),
    zoomEnabled: integer('zoom_enabled', { mode: 'boolean' }).default(false),
    videoProvider: text('video_provider').default('offline')
});

const bookings = sqliteTable('bookings', {
    id: text('id').primaryKey(),
    classId: text('class_id'),
    memberId: text('member_id'),
    status: text('status').default('confirmed'),
    attendanceType: text('attendance_type').default('in_person'),
    createdAt: integer('created_at', { mode: 'timestamp' })
});

describe('Bookings API (Integration)', () => {
    const TENANT_ID = 'test_tenant_id';
    const USER_ID = 'test_user_id';
    const MEMBER_ID = 'test_member_id';
    const CLASS_ID = 'test_class_id';
    const INSTRUCTOR_ID = 'test_instructor_id';
    const INSTRUCTOR_USER_ID = 'test_instructor_user_id';

    beforeAll(async () => {
        // Init with Minimal Schema
        const db = drizzle(env.DB, { schema: { tenants, users, tenantMembers, classes, bookings } });

        // [Manual Migration] Create Tables
        try {
            await db.run(sql`CREATE TABLE IF NOT EXISTS tenants (
                id TEXT PRIMARY KEY, slug TEXT, name TEXT, marketing_provider TEXT, currency TEXT, status TEXT, tier TEXT, subscription_status TEXT
            )`);
            await db.run(sql`CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY, email TEXT, role TEXT
            )`);
            await db.run(sql`CREATE TABLE IF NOT EXISTS tenant_members (
                id TEXT PRIMARY KEY, tenant_id TEXT, user_id TEXT, status TEXT
            )`);
            await db.run(sql`CREATE TABLE IF NOT EXISTS classes (
                id TEXT PRIMARY KEY, tenant_id TEXT, instructor_id TEXT, title TEXT, 
                start_time INTEGER, duration_minutes INTEGER, capacity INTEGER, 
                status TEXT, zoom_enabled INTEGER, video_provider TEXT
            )`);
            await db.run(sql`CREATE TABLE IF NOT EXISTS bookings (
                id TEXT PRIMARY KEY, class_id TEXT, member_id TEXT, 
                status TEXT, attendance_type TEXT, created_at INTEGER
            )`);
        } catch (e) {
            console.error("Migration Error:", e);
        }

        // 1. Create Tenant
        await db.insert(tenants).values({
            id: TENANT_ID,
            name: 'Integration Test Studio',
            slug: 'integration-studio',
            marketingProvider: 'system',
            currency: 'usd',
            status: 'active',
            tier: 'basic',
            subscriptionStatus: 'active'
        }).onConflictDoNothing().run();

        // 2. Create Student User & Member
        await db.insert(users).values({
            id: USER_ID,
            email: 'student@test.com',
            role: 'user'
        }).onConflictDoNothing().run();

        await db.insert(tenantMembers).values({
            id: MEMBER_ID,
            tenantId: TENANT_ID,
            userId: USER_ID,
            status: 'active'
        }).onConflictDoNothing().run();

        // 3. Create Instructor
        await db.insert(users).values({
            id: INSTRUCTOR_USER_ID,
            email: 'instructor@test.com',
            role: 'user'
        }).onConflictDoNothing().run();

        await db.insert(tenantMembers).values({
            id: INSTRUCTOR_ID,
            tenantId: TENANT_ID,
            userId: INSTRUCTOR_USER_ID,
            status: 'active'
        }).onConflictDoNothing().run();

        // 4. Create Class
        const startTime = new Date();
        startTime.setDate(startTime.getDate() + 1); // Tomorrow

        await db.insert(classes).values({
            id: CLASS_ID,
            tenantId: TENANT_ID,
            instructorId: INSTRUCTOR_ID, // Use memeber ID
            title: 'Integration Flow Yoga',
            startTime: startTime,
            durationMinutes: 60,
            capacity: 5,
            status: 'active',
            zoomEnabled: false,
            videoProvider: 'offline'
        }).onConflictDoNothing().run();
    });

    it('should successfully book a class', async () => {
        const response = await SELF.fetch('https://api.studio.local/bookings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'TEST-AUTH': USER_ID,
                'X-Tenant-Slug': 'integration-studio'
            },
            body: JSON.stringify({
                classId: CLASS_ID
            })
        });

        // Debug response if fail
        if (response.status !== 200) {
            console.log("Error Response:", await response.text());
        }

        const json = await response.json() as any;
        expect(response.status).toBe(200);
        expect(json.success).toBe(true);
        expect(json.id).toBeDefined();

        // Verify DB
        const db = drizzle(env.DB, { schema: { bookings, classes } }); // use local schemas
        const booking = await db.select().from(bookings).where(eq(bookings.id, json.id)).get();
        expect(booking).toBeDefined();
        expect(booking?.status).toBe('confirmed');
    });

    it('should prevent double booking', async () => {
        const response = await SELF.fetch('https://api.studio.local/bookings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'TEST-AUTH': USER_ID,
                'X-Tenant-Slug': 'integration-studio'
            },
            body: JSON.stringify({
                classId: CLASS_ID
            })
        });

        const json = await response.json() as any;
        expect(response.status).toBe(400);
        expect(json.error).toBe('Already booked');
    });

    it('should respect capacity limit', async () => {
        const SMALL_CLASS_ID = 'small_class';
        const db = drizzle(env.DB, { schema: { classes, users, tenantMembers } });

        const startTime = new Date();
        startTime.setDate(startTime.getDate() + 2);

        await db.insert(classes).values({
            id: SMALL_CLASS_ID,
            tenantId: TENANT_ID,
            instructorId: INSTRUCTOR_ID,
            title: 'Tiny Class',
            startTime: startTime,
            durationMinutes: 60,
            capacity: 1, // Only 1 spot
            status: 'active',
            zoomEnabled: false,
            videoProvider: 'offline'
        }).run();

        // User 1 Books (Success) - reusing main user
        const res1 = await SELF.fetch('https://api.studio.local/bookings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'TEST-AUTH': USER_ID, 'X-Tenant-Slug': 'integration-studio' },
            body: JSON.stringify({ classId: SMALL_CLASS_ID })
        });
        expect(res1.status).toBe(200);

        // User 2 Books (Should Fail)
        const USER2_ID = 'user2';
        await db.insert(users).values({ id: USER2_ID, email: 'u2@t.com', role: 'user' }).run();
        await db.insert(tenantMembers).values({ id: 'member2', tenantId: TENANT_ID, userId: USER2_ID, status: 'active' }).run();

        const res2 = await SELF.fetch('https://api.studio.local/bookings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'TEST-AUTH': USER2_ID, 'X-Tenant-Slug': 'integration-studio' },
            body: JSON.stringify({ classId: SMALL_CLASS_ID })
        });

        const json2 = await res2.json() as any;
        expect(res2.status).toBe(400);
        expect(json2.error).toBe('Class is full');
    });
});
